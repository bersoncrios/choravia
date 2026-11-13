import test from "node:test";
import assert from "node:assert/strict";
import { firebaseFeedback } from "../src/app/application/firebase-feedback.js";

test("backend failure remains distinct from a completed Google authentication", () => {
  const result = firebaseFeedback(
    new Error("Serviço online indisponível."),
    "online",
  );
  assert.equal(result.phase, "online");
  assert.match(result.message, /Serviço online/);
  assert.equal(result.code, "");
});
test("the actual popup failure code is visible rather than inferred from COOP console output", () => {
  const result = firebaseFeedback(
    Object.assign(new Error("Firebase error"), {
      code: "auth/popup-closed-by-user",
    }),
    "authentication",
  );
  assert.equal(result.phase, "authentication");
  assert.match(result.message, /Código: auth\/popup-closed-by-user/);
});
test("unauthorized localhost has a precise actionable message and preserves its Firebase code", () => {
  const result = firebaseFeedback(
    { code: "auth/unauthorized-domain" },
    "authentication",
  );
  assert.match(result.message, /Autorize localhost/);
  assert.match(result.message, /auth\/unauthorized-domain/);
});
test("credential collision keeps the explicit account-switch action", () => {
  const error = Object.assign(
    new Error("Use Abrir conta Google existente sem mesclar inventários."),
    { code: "auth/credential-already-in-use" },
  );
  const result = firebaseFeedback(error, "authentication");
  assert.match(result.message, /sem mesclar/);
  assert.equal(result.code, error.code);
});
