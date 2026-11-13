import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { randomSeed, randomToken, sha256 } from "../src/app/domain/online-engine/crypto.js";

test("browser crypto preserves existing starter IDs and invitation hashes", async () => {
  for (const value of ["alice", "bob", "áçúcar", "x".repeat(43)]) {
    assert.equal(await sha256(value), createHash("sha256").update(value).digest("hex"));
  }
  assert.equal((await sha256("alice")).slice(0, 32), "2bd806c97f0e00af1a1fc3328fa763a9");
});
test("browser entropy preserves the invitation format accepted by existing links", () => {
  const one = randomToken(), two = randomToken();
  assert.match(one, /^[A-Za-z0-9_-]{43}$/);
  assert.match(two, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(one, two);
  const seed = randomSeed();
  assert.ok(Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff);
});
