import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isUniqueViolation, query } from "./db";
import { HttpError } from "./http";
import { photosConfigured } from "./photos";
import { cleanText, fileMediaType, MAX_COMMENT, postProblem, type PostKind } from "@/lib/gallery";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GalleryComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type GalleryPost = {
  id: string;
  userId: string;
  authorName: string;
  kind: PostKind;
  quarter: number | null;
  year: number | null;
  caption: string;
  contentType: string | null;
  durationSec: number | null;
  createdAt: string;
  comments: GalleryComment[];
};

type PostRow = {
  id: string;
  user_id: string;
  author_name: string;
  kind: PostKind;
  quarter: number | null;
  year: number | null;
  caption: string;
  content_type: string | null;
  duration_sec: string | null;
  created_at: Date;
  object_key: string | null;
};

const globalForR2 = globalThis as unknown as { baumbGalleryR2?: S3Client };

function r2(): S3Client {
  globalForR2.baumbGalleryR2 ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  return globalForR2.baumbGalleryR2;
}

function objectKey(userId: string, postId: string): string {
  return `gallery/${userId}/${postId}`;
}

async function deleteObject(key: string): Promise<void> {
  if (!photosConfigured()) return;
  try {
    await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }));
  } catch (err) {
    if ((err as { name?: string }).name !== "NoSuchKey") throw err;
  }
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toPost(row: PostRow, comments: GalleryComment[]): GalleryPost {
  return {
    id: row.id.toLowerCase(),
    userId: row.user_id.toLowerCase(),
    authorName: row.author_name,
    kind: row.kind,
    quarter: row.quarter,
    year: row.year,
    caption: row.caption,
    contentType: row.content_type,
    durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
    createdAt: iso(row.created_at),
    comments,
  };
}

const VISIBLE = `p.user_id = $1 OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = p.user_id)`;

export async function listFeed(viewerId: string): Promise<GalleryPost[]> {
  const rows = await query<PostRow>(
    `SELECT p.id, p.user_id, u.name AS author_name, p.kind, p.quarter, p.year, p.caption, p.content_type, p.duration_sec, p.created_at, p.object_key
     FROM gallery_posts p
     JOIN users u ON u.id = p.user_id
     WHERE ${VISIBLE}
     ORDER BY p.created_at DESC
     LIMIT 40`,
    [viewerId],
  );
  if (!rows.length) return [];
  const comments = await query<{ id: string; post_id: string; user_id: string; author_name: string; body: string; created_at: Date }>(
    `SELECT c.id, c.post_id, c.user_id, u.name AS author_name, c.body, c.created_at
     FROM gallery_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ANY($1::uuid[])
     ORDER BY c.created_at ASC`,
    [rows.map((row) => row.id)],
  );
  const byPost = new Map<string, GalleryComment[]>();
  for (const comment of comments) {
    const postId = comment.post_id.toLowerCase();
    const list = byPost.get(postId) ?? [];
    list.push({
      id: comment.id.toLowerCase(),
      postId,
      userId: comment.user_id.toLowerCase(),
      authorName: comment.author_name,
      body: comment.body,
      createdAt: iso(comment.created_at),
    });
    byPost.set(postId, list);
  }
  return rows.map((row) => toPost(row, byPost.get(row.id.toLowerCase()) ?? []));
}

export async function listPeople(viewerId: string): Promise<{ id: string; name: string; following: boolean }[]> {
  const rows = await query<{ id: string; name: string; following: boolean }>(
    `SELECT u.id, u.name,
            EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.following_id = u.id) AS following
     FROM users u
     WHERE u.id <> $1
     ORDER BY u.name ASC
     LIMIT 200`,
    [viewerId],
  );
  return rows.map((row) => ({ id: row.id.toLowerCase(), name: row.name, following: row.following }));
}

export async function setFollow(viewerId: string, targetId: string, follow: boolean): Promise<void> {
  if (!UUID.test(targetId)) throw new HttpError(400, "Choose a member to follow.");
  if (targetId.toLowerCase() === viewerId) throw new HttpError(400, "You can't follow yourself.");
  const found = await query<{ id: string }>("SELECT id FROM users WHERE id = $1", [targetId]);
  if (!found.length) throw new HttpError(404, "That member isn't on BAUMB.");
  if (follow) await query("INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [viewerId, targetId]);
  else await query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [viewerId, targetId]);
}

async function visiblePost(viewerId: string, postId: string): Promise<PostRow | null> {
  if (!UUID.test(postId)) return null;
  const rows = await query<PostRow>(
    `SELECT p.id, p.user_id, u.name AS author_name, p.kind, p.quarter, p.year, p.caption, p.content_type, p.duration_sec, p.created_at, p.object_key
     FROM gallery_posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $2 AND (${VISIBLE})`,
    [viewerId, postId],
  );
  return rows[0] ?? null;
}

export async function addComment(viewerId: string, postId: string, body: string): Promise<void> {
  const text = cleanText(body, MAX_COMMENT + 1);
  if (!text) throw new HttpError(400, "Write a comment first.");
  if (text.length > MAX_COMMENT) throw new HttpError(400, "Keep the comment under 280 characters.");
  const post = await visiblePost(viewerId, postId);
  if (!post) throw new HttpError(404, "That post isn't available.");
  await query("INSERT INTO gallery_comments (id, post_id, user_id, body) VALUES ($1, $2, $3, $4)", [randomUUID(), post.id, viewerId, text]);
}

export async function deleteComment(viewerId: string, commentId: string): Promise<void> {
  if (!UUID.test(commentId)) throw new HttpError(404, "That comment isn't available.");
  const rows = await query<{ id: string; user_id: string; author_id: string }>(
    `SELECT c.id, c.user_id, p.user_id AS author_id
     FROM gallery_comments c
     JOIN gallery_posts p ON p.id = c.post_id
     WHERE c.id = $1 AND (
       c.user_id = $2 OR p.user_id = $2
       OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.following_id = p.user_id)
     )`,
    [commentId, viewerId],
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, "That comment isn't available.");
  if (row.user_id.toLowerCase() !== viewerId && row.author_id.toLowerCase() !== viewerId) throw new HttpError(403, "You can remove your own comments.");
  await query("DELETE FROM gallery_comments WHERE id = $1", [row.id]);
}

export async function deletePost(viewerId: string, postId: string): Promise<void> {
  if (!UUID.test(postId)) throw new HttpError(404, "That post isn't available.");
  const rows = await query<{ id: string; object_key: string | null }>("SELECT id, object_key FROM gallery_posts WHERE id = $1 AND user_id = $2", [postId, viewerId]);
  const row = rows[0];
  if (!row) throw new HttpError(404, "That post isn't available.");
  if (row.object_key) await deleteObject(row.object_key);
  await query("DELETE FROM gallery_posts WHERE id = $1", [row.id]);
}

export async function createPost(
  viewerId: string,
  input: { kind: string; caption: string; quarter: number | null; year: number | null; durationSec: number | null; file: File | null },
): Promise<void> {
  const recent = await query<{ n: number }>("SELECT count(*)::int AS n FROM gallery_posts WHERE user_id = $1 AND created_at > now() - interval '1 day'", [viewerId]);
  if ((recent[0]?.n ?? 0) >= 20) throw new HttpError(429, "That's enough posts for today. Try again tomorrow.");
  const fileType = input.file ? fileMediaType(input.file.type, input.file.name) : "";
  const bytes = input.file ? Buffer.from(await input.file.arrayBuffer()) : Buffer.alloc(0);
  const problem = postProblem({
    kind: input.kind,
    caption: input.caption,
    hasFile: Boolean(input.file && bytes.length),
    fileType,
    bytes: bytes.length,
    durationSec: input.durationSec,
    quarter: input.quarter,
    year: input.year,
  });
  if (problem) throw new HttpError(400, problem);
  const caption = cleanText(input.caption, 280);
  const id = randomUUID();
  const hasFile = bytes.length > 0;
  const key = hasFile && photosConfigured() ? objectKey(viewerId, id) : null;
  if (key) {
    await r2().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key, Body: bytes, ContentType: fileType }));
  }
  try {
    await query(
      `INSERT INTO gallery_posts (id, user_id, kind, quarter, year, caption, object_key, content_type, duration_sec)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        viewerId,
        input.kind,
        input.kind === "quarter" ? input.quarter : null,
        input.kind === "quarter" ? input.year : null,
        caption,
        key,
        hasFile ? fileType : null,
        input.kind === "reel" ? input.durationSec : null,
      ],
    );
  } catch (err) {
    if (key) await deleteObject(key);
    if (isUniqueViolation(err)) throw new HttpError(409, "You already posted this quarter. Delete it if you want to upload a new photo.");
    throw err;
  }
  if (hasFile && !key) {
    try {
      await query("INSERT INTO gallery_media (post_id, content_type, bytes) VALUES ($1, $2, $3)", [id, fileType, bytes]);
    } catch (err) {
      await query("DELETE FROM gallery_posts WHERE id = $1", [id]);
      throw err;
    }
  }
}

export async function readPostMedia(viewerId: string, postId: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const post = await visiblePost(viewerId, postId);
  if (!post?.content_type) return null;
  if (post.object_key && photosConfigured()) {
    try {
      const obj = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: post.object_key }));
      const bytes = Buffer.from((await obj.Body?.transformToByteArray()) ?? new Uint8Array());
      return { bytes, contentType: post.content_type };
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }
  const rows = await query<{ bytes: Buffer; content_type: string }>("SELECT bytes, content_type FROM gallery_media WHERE post_id = $1", [post.id]);
  const row = rows[0];
  if (!row) return null;
  return { bytes: Buffer.from(row.bytes), contentType: row.content_type };
}

export async function deleteAccountGallery(userId: string): Promise<void> {
  const rows = await query<{ object_key: string | null }>("SELECT object_key FROM gallery_posts WHERE user_id = $1 AND object_key IS NOT NULL", [userId]);
  await Promise.all(rows.map((row) => (row.object_key ? deleteObject(row.object_key) : undefined)));
}
