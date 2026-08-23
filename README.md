# Noble Filter Lists

Noble Filter Lists is a small shared service that converts well-maintained
community filter lists into Apple WebKit content-blocker rules for use across
multiple apps and sites.

The production endpoints are:

- `https://filters.matthewnoble.au/health`
- `https://filters.matthewnoble.au/v1/manifest.json`
- `https://filters.matthewnoble.au/v1/apple/easylist.json`
- `https://filters.matthewnoble.au/v1/apple/easyprivacy.json`

## Trust model

The manifest is an Ed25519-signed envelope. Its Base64 payload contains the
publication date, upstream versions, converter version, rule counts, byte
counts, URLs and SHA-256 digests. Consumer apps pin
`keys/manifest-signing-public.pem`, verify the signature, and verify each
downloaded list against its digest before compiling it.

The private signing key and Cloudflare credentials are GitHub Actions secrets.
They are never committed.

## Updating

The daily GitHub Actions workflow downloads EasyList and EasyPrivacy, builds
AdGuard's pinned Safari converter, creates the two WebKit JSON rule lists,
signs their manifest, validates the Worker, and deploys the Worker plus assets.
It can also be run manually.

For a local update:

```sh
npm ci
export CONVERTER_TOOL_PATH=/path/to/ConverterTool
export FILTER_LIST_SIGNING_PRIVATE_KEY_PATH=/secure/path/to/signing-private.pem
scripts/update-lists.sh
node scripts/verify-manifest.mjs
npm test
npm run check
```

## Sources and licences

The generated data is derived from [EasyList](https://easylist.to/) and
[EasyPrivacy](https://easylist.to/). Their copyright and licence notices remain
applicable to those lists. The conversion pipeline and Worker in this
repository are licensed under the MIT Licence.
