import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { AppState, ProgressPhoto } from "@/lib/types";

const PHOTO_ID = /^[A-Za-z0-9_-]{8,80}$/;
const MAX_DATA_URL = 1_500_000;

const globalForR2 = globalThis as unknown as { baumbR2?: S3Client };

export function photosConfigured(): boolean {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

export function photoObjectKey(userId: string, photoId: string): string {
  return `users/${userId}/${photoId}.jpg`;
}

function client(): S3Client {
  globalForR2.baumbR2 ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return globalForR2.baumbR2;
}

function bucket(): string {
  return process.env.R2_BUCKET!;
}

async function putPhoto(key: string, dataUrl: string): Promise<void> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: Buffer.from(base64, "base64"),
      ContentType: "image/jpeg",
    }),
  );
}

export async function readPhoto(userId: string, photoId: string): Promise<Uint8Array | null> {
  if (!photosConfigured() || !PHOTO_ID.test(photoId)) return null;
  try {
    const obj = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: photoObjectKey(userId, photoId) }));
    return (await obj.Body?.transformToByteArray()) ?? null;
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchKey") return null;
    throw err;
  }
}

async function deletePhotoObject(key: string): Promise<void> {
  try {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch (err) {
    if ((err as { name?: string }).name !== "NoSuchKey") throw err;
  }
}

/**
 * Uploads new photo bytes to R2 and returns account JSON that keeps the object key, not the image.
 * Photos already stored are not uploaded again. With R2 unset, the document is unchanged.
 */
export async function storePhotos(userId: string, state: AppState, previous: AppState | null): Promise<AppState> {
  if (!photosConfigured()) return state;
  const already = new Set((previous?.photos ?? []).filter((p) => p.objectKey).map((p) => p.id));
  const photos: ProgressPhoto[] = [];
  for (const photo of state.photos) {
    if (!PHOTO_ID.test(photo.id)) {
      photos.push(photo);
      continue;
    }
    const key = photoObjectKey(userId, photo.id);
    if (photo.dataUrl?.startsWith("data:image/") && !already.has(photo.id)) {
      if (photo.dataUrl.length > MAX_DATA_URL) throw new Error("A progress photo is too large to store.");
      await putPhoto(key, photo.dataUrl);
    }
    const { dataUrl: _dataUrl, ...rest } = photo;
    photos.push({ ...rest, objectKey: key });
  }
  const keep = new Set(photos.map((p) => p.id));
  for (const old of previous?.photos ?? []) {
    if (!keep.has(old.id) && PHOTO_ID.test(old.id)) await deletePhotoObject(photoObjectKey(userId, old.id));
  }
  return { ...state, photos };
}
