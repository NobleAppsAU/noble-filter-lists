import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import { createPublicationCheckpoint } from "../scripts/create-publication-checkpoint.mjs";

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const payload = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      publishedAt: "2026-10-18T05:57:38.044Z",
      converter: {
        name: "AdGuard SafariConverterLib",
        version: "4.3.0",
        safariVersion: "18.0",
      },
      lists: [
        {
          id: "easylist",
          sourceURL: "https://easylist.to/easylist/easylist.txt",
          sourceVersion: "202610180551",
          url: "https://filters.matthewnoble.au/v1/apple/easylist.json",
          sha256: "a".repeat(64),
          byteCount: 8067071,
          ruleCount: 65019,
        },
      ],
    }),
  );
  const envelope = JSON.stringify({
    algorithm: "Ed25519",
    payload: payload.toString("base64"),
    signature: sign(null, payload, privateKey).toString("base64"),
  });
  const publicKeyPEM = publicKey.export({
    type: "spki",
    format: "pem",
  });
  return { envelope, publicKeyPEM };
}

test("creates a compact checkpoint from a valid signed manifest", () => {
  const { envelope, publicKeyPEM } = fixture();
  const checkpoint = createPublicationCheckpoint(envelope, publicKeyPEM);

  assert.equal(checkpoint.schemaVersion, 1);
  assert.equal(checkpoint.publishedAt, "2026-10-18T05:57:38.044Z");
  assert.match(checkpoint.manifestSHA256, /^[a-f0-9]{64}$/);
  assert.deepEqual(checkpoint.converter, {
    name: "AdGuard SafariConverterLib",
    version: "4.3.0",
    safariVersion: "18.0",
  });
  assert.deepEqual(checkpoint.lists, [
    {
      id: "easylist",
      sourceURL: "https://easylist.to/easylist/easylist.txt",
      sourceVersion: "202610180551",
      url: "https://filters.matthewnoble.au/v1/apple/easylist.json",
      sha256: "a".repeat(64),
      byteCount: 8067071,
      ruleCount: 65019,
    },
  ]);
});

test("rejects a payload changed after signing", () => {
  const { envelope, publicKeyPEM } = fixture();
  const parsed = JSON.parse(envelope);
  const payload = JSON.parse(Buffer.from(parsed.payload, "base64").toString("utf8"));
  payload.lists[0].ruleCount += 1;
  parsed.payload = Buffer.from(JSON.stringify(payload)).toString("base64");

  assert.throws(
    () => createPublicationCheckpoint(JSON.stringify(parsed), publicKeyPEM),
    /signature is invalid/,
  );
});
