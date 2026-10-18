import {
  createHash,
  createPublicKey,
  verify,
} from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const defaultPublicKeyPath = "keys/manifest-signing-public.pem";

function requireString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function requireHTTPSURL(value, field) {
  const text = requireString(value, field);
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${field} must use HTTPS`);
  }
  return text;
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

export function createPublicationCheckpoint(envelopeText, publicKeyPEM) {
  let envelope;
  try {
    envelope = JSON.parse(envelopeText);
  } catch {
    throw new Error("The deployed manifest is not valid JSON");
  }

  if (envelope.algorithm !== "Ed25519") {
    throw new Error("The deployed manifest does not use Ed25519");
  }

  const encodedPayload = requireString(envelope.payload, "payload");
  const encodedSignature = requireString(envelope.signature, "signature");
  const payload = Buffer.from(encodedPayload, "base64");
  const signature = Buffer.from(encodedSignature, "base64");

  if (
    payload.toString("base64") !== encodedPayload ||
    signature.toString("base64") !== encodedSignature
  ) {
    throw new Error("The deployed manifest contains invalid Base64 data");
  }

  if (!verify(null, payload, createPublicKey(publicKeyPEM), signature)) {
    throw new Error("The deployed manifest signature is invalid");
  }

  let manifest;
  try {
    manifest = JSON.parse(payload.toString("utf8"));
  } catch {
    throw new Error("The signed manifest payload is not valid JSON");
  }

  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported manifest schema version: ${manifest.schemaVersion}`);
  }

  const publishedAt = requireString(manifest.publishedAt, "publishedAt");
  if (Number.isNaN(Date.parse(publishedAt))) {
    throw new Error("publishedAt must be a valid date");
  }

  if (!manifest.converter || typeof manifest.converter !== "object") {
    throw new Error("converter must be an object");
  }
  const converter = {
    name: requireString(manifest.converter.name, "converter.name"),
    version: requireString(manifest.converter.version, "converter.version"),
    safariVersion: requireString(
      manifest.converter.safariVersion,
      "converter.safariVersion",
    ),
  };

  if (!Array.isArray(manifest.lists) || manifest.lists.length === 0) {
    throw new Error("lists must be a non-empty array");
  }
  const lists = manifest.lists.map((list, index) => {
    if (!list || typeof list !== "object") {
      throw new Error(`lists[${index}] must be an object`);
    }
    const sha256 = requireString(list.sha256, `lists[${index}].sha256`);
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      throw new Error(`lists[${index}].sha256 must be a lowercase SHA-256 digest`);
    }
    return {
      id: requireString(list.id, `lists[${index}].id`),
      sourceURL: requireHTTPSURL(list.sourceURL, `lists[${index}].sourceURL`),
      sourceVersion: requireString(
        list.sourceVersion,
        `lists[${index}].sourceVersion`,
      ),
      url: requireHTTPSURL(list.url, `lists[${index}].url`),
      sha256,
      byteCount: requireNonNegativeInteger(
        list.byteCount,
        `lists[${index}].byteCount`,
      ),
      ruleCount: requireNonNegativeInteger(
        list.ruleCount,
        `lists[${index}].ruleCount`,
      ),
    };
  });

  return {
    schemaVersion: 1,
    publishedAt,
    manifestSHA256: createHash("sha256").update(envelopeText).digest("hex"),
    converter,
    lists,
  };
}

function option(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) {
    throw new Error(`Missing required option ${name}`);
  }
  return process.argv[index + 1];
}

async function main() {
  const manifestPath = option("--manifest");
  const outputPath = option("--output");
  const publicKeyIndex = process.argv.indexOf("--public-key");
  const publicKeyPath =
    publicKeyIndex === -1
      ? defaultPublicKeyPath
      : process.argv[publicKeyIndex + 1];
  if (!publicKeyPath) {
    throw new Error("--public-key requires a path");
  }

  const [envelopeText, publicKeyPEM] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(publicKeyPath, "utf8"),
  ]);
  const checkpoint = createPublicationCheckpoint(envelopeText, publicKeyPEM);
  const resolvedOutputPath = resolve(outputPath);
  const temporaryPath = `${resolvedOutputPath}.tmp`;
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
  await rename(temporaryPath, resolvedOutputPath);
  console.log(`Recorded publication from ${checkpoint.publishedAt}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
