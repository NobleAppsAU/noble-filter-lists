import { createHash, createPrivateKey, sign } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const baseURL = "https://filters.matthewnoble.au";
const definitions = [
  {
    id: "easylist",
    title: "EasyList",
    sourceURL: "https://easylist.to/easylist/easylist.txt",
    sourceVersion: process.env.EASYLIST_VERSION,
  },
  {
    id: "easyprivacy",
    title: "EasyPrivacy",
    sourceURL: "https://easylist.to/easylist/easyprivacy.txt",
    sourceVersion: process.env.EASYPRIVACY_VERSION,
  },
];

const privateKeyPEM =
  process.env.FILTER_LIST_SIGNING_PRIVATE_KEY ??
  (process.env.FILTER_LIST_SIGNING_PRIVATE_KEY_PATH
    ? await readFile(process.env.FILTER_LIST_SIGNING_PRIVATE_KEY_PATH, "utf8")
    : undefined);
if (!privateKeyPEM) {
  throw new Error("FILTER_LIST_SIGNING_PRIVATE_KEY is required");
}

const lists = [];
for (const definition of definitions) {
  if (!definition.sourceVersion) {
    throw new Error(`Missing source version for ${definition.id}`);
  }
  const path = `assets/v1/apple/${definition.id}.json`;
  const bytes = await readFile(path);
  const rules = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error(`${path} does not contain a non-empty JSON rule array`);
  }
  lists.push({
    ...definition,
    url: `${baseURL}/v1/apple/${definition.id}.json`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteCount: bytes.byteLength,
    ruleCount: rules.length,
  });
}

const payload = Buffer.from(
  JSON.stringify({
    schemaVersion: 1,
    publishedAt: process.env.PUBLISHED_AT ?? new Date().toISOString(),
    converter: {
      name: "AdGuard SafariConverterLib",
      version: process.env.CONVERTER_VERSION ?? "4.3.0",
      safariVersion: process.env.SAFARI_VERSION ?? "18.0",
    },
    lists,
  }),
  "utf8",
);
const signature = sign(null, payload, createPrivateKey(privateKeyPEM));
const envelope = {
  algorithm: "Ed25519",
  payload: payload.toString("base64"),
  signature: signature.toString("base64"),
};

await writeFile("assets/v1/manifest.json", `${JSON.stringify(envelope)}\n`);
console.log(
  JSON.stringify(
    lists.map(({ id, sourceVersion, ruleCount, byteCount, sha256 }) => ({
      id,
      sourceVersion,
      ruleCount,
      byteCount,
      sha256,
    })),
    null,
    2,
  ),
);
