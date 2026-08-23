#!/bin/bash
set -euo pipefail

converter_path="${CONVERTER_TOOL_PATH:?Set CONVERTER_TOOL_PATH to ConverterTool}"
work_path="$(mktemp -d)"
trap 'rm -rf "$work_path"' EXIT

curl --fail --location --retry 3 --output "$work_path/easylist.txt" \
  https://easylist.to/easylist/easylist.txt
curl --fail --location --retry 3 --output "$work_path/easyprivacy.txt" \
  https://easylist.to/easylist/easyprivacy.txt

easylist_version="$(sed -n 's/^! Version: //p' "$work_path/easylist.txt" | head -1)"
easyprivacy_version="$(sed -n 's/^! Version: //p' "$work_path/easyprivacy.txt" | head -1)"
test -n "$easylist_version"
test -n "$easyprivacy_version"

mkdir -p assets/v1/apple
"$converter_path" convert \
  --safari-version "${SAFARI_VERSION:-18.0}" \
  --input-path "$work_path/easylist.txt" \
  --safari-rules-json-path assets/v1/apple/easylist.json
"$converter_path" convert \
  --safari-version "${SAFARI_VERSION:-18.0}" \
  --input-path "$work_path/easyprivacy.txt" \
  --safari-rules-json-path assets/v1/apple/easyprivacy.json

EASYLIST_VERSION="$easylist_version" \
EASYPRIVACY_VERSION="$easyprivacy_version" \
node scripts/generate-manifest.mjs

