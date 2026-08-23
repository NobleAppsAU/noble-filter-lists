import { createHash, createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";

const envelope = JSON.parse(await readFile("assets/v1/manifest.json", "utf8"));
const payload = Buffer.from(envelope.payload, "base64");
const signature = Buffer.from(envelope.signature, "base64");
const publicKey = createPublicKey(
  await readFile("keys/manifest-signing-public.pem", "utf8"),
);

if (envelope.algorithm !== "Ed25519" || !verify(null, payload, publicKey, signature)) {
  throw new Error("Manifest signature is invalid");
}

const manifest = JSON.parse(payload.toString("utf8"));
for (const list of manifest.lists) {
  const bytes = await readFile(new URL(list.url).pathname.slice(1).replace(/^v1\//, "assets/v1/"));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== list.sha256) {
    throw new Error(`Digest mismatch for ${list.id}`);
  }
}

console.log(`Verified signed manifest for ${manifest.lists.length} lists`);
