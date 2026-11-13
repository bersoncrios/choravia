import test from "node:test";
import assert from "node:assert/strict";
import { GameService } from "../src/app/domain/online-engine/service.js";
import type { DocumentStore, Transaction } from "../src/app/domain/online-engine/store.js";

// Unlike MemoryStore, this adapter allows overlapping transactions and rejects
// stale versions, exposing contention instead of silently serializing the test.
function fixture() {
  const documents = new Map<string, object>();
  const active = new Set<string>();
  let conflicts = 0;
  let failNext = false;
  const store: DocumentStore = {
    async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      const paths: string[] = [];
      const writes = new Map<string, object>();
      try {
        const result = await work({
          async get<TDoc extends object>(path: string): Promise<TDoc | null> {
            if (active.has(path)) {
              conflicts++;
              throw new Error("failed-precondition: concurrent quota transaction");
            }
            active.add(path);
            paths.push(path);
            await new Promise(resolve => setTimeout(resolve, 0));
            return (documents.get(path) ?? null) as TDoc | null;
          },
          set(path, value) { writes.set(path, value); },
        });
        if (failNext) {
          failNext = false;
          throw new Error("network unavailable");
        }
        for (const [path, value] of writes) documents.set(path, value);
        return result;
      } finally {
        for (const path of paths) active.delete(path);
      }
    },
    async owned() { return []; },
    async expiredOwners() { return []; },
  };
  let now = 1_800_000_000_000;
  const service = new GameService(store, { now: () => now });
  // Invalid input stops execution immediately after quota, isolating its writes.
  const call = (uid = "alice") => service.execute(uid, "syncExpedition", { creatures: null });
  return {
    call,
    documents,
    conflicts: () => conflicts,
    failNext: () => { failNext = true; },
    nextMinute: () => { now += 60_000; },
  };
}
const hasCode = (code: string) => (error: unknown) =>
  !!error && typeof error === "object" && "code" in error && error.code === code;

test("parallel online calls count each request without quota conflicts and preserve the limit", async () => {
  const f = fixture();
  await Promise.all(Array.from({ length: 120 }, () =>
    assert.rejects(f.call(), hasCode("invalid-argument")),
  ));
  assert.equal(f.conflicts(), 0);
  assert.deepEqual(f.documents.get("rate_limits/alice"), { window: 30_000_000, count: 120 });
  await assert.rejects(f.call(), hasCode("resource-exhausted"));
  f.nextMinute();
  await assert.rejects(f.call(), hasCode("invalid-argument"));
  assert.deepEqual(f.documents.get("rate_limits/alice"), { window: 30_000_001, count: 1 });
});

test("a failed quota write does not block queued or subsequent requests", async () => {
  const f = fixture();
  f.failNext();
  await Promise.all([
    assert.rejects(f.call(), /network unavailable/),
    assert.rejects(f.call(), hasCode("invalid-argument")),
  ]);
  await assert.rejects(f.call(), hasCode("invalid-argument"));
  await assert.rejects(f.call("bob"), hasCode("invalid-argument"));
  assert.equal(f.conflicts(), 0);
  assert.deepEqual(f.documents.get("rate_limits/alice"), { window: 30_000_000, count: 2 });
  assert.deepEqual(f.documents.get("rate_limits/bob"), { window: 30_000_000, count: 1 });
});
