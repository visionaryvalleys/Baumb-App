import "server-only";
import { HttpError } from "./http";

/** Least-recently-used cache with expiry. A Map keeps insertion order, so get/set/evict are O(1). */
export class LruCache<K, V> {
  private map = new Map<K, { value: V; expires: number }>();

  constructor(
    private max: number,
    private ttlMs: number,
  ) {}

  get(key: K): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    this.map.delete(key);
    if (hit.expires < Date.now()) return undefined;
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: K, value: V) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as K);
  }
}

/** Caps concurrent work (e.g. calls to the AI provider) and how many requests may wait for a slot. */
export class Semaphore {
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(
    private max: number,
    private maxQueue: number,
  ) {}

  /** Resolves with a release function once a slot is free; rejects with 503 when the queue is full. */
  acquire(): Promise<() => void> {
    const grant = () => {
      this.active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.active -= 1;
        this.waiting.shift()?.();
      };
    };
    if (this.active < this.max) return Promise.resolve(grant());
    if (this.waiting.length >= this.maxQueue) return Promise.reject(new HttpError(503, "BAUMB is busy right now. Try again in a moment."));
    return new Promise((resolve) => this.waiting.push(() => resolve(grant())));
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await task();
    } finally {
      release();
    }
  }
}

const windows = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

/** Fixed-window limit per key (per server process). Old windows are swept so memory stays bounded. */
export function limitPerUser(key: string, max: number, windowMs: number, message: string) {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, w] of windows) if (w.resetAt < now) windows.delete(k);
  }
  const w = windows.get(key);
  if (!w || w.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  w.count += 1;
  if (w.count > max) throw new HttpError(429, message);
}
