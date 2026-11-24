#!/bin/bash
FILE=$(jq -r '.tool_input.file_path // empty')
[[ "$FILE" != *.ts ]] && exit 0
npx jest --findRelatedTests "$FILE" --passWithNoTests --silent 1>&2 || exit 2