#!/bin/bash
# Run TypeScript type-check after editing .ts/.tsx files
# Catches type errors immediately at write-time

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool_input.file_path||'')}catch{console.log('')}})")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only check TypeScript files
case "$FILE_PATH" in
  *.ts|*.tsx)
    ERRORS=$(npx tsc --noEmit --pretty false 2>&1 | grep -i "error" | head -5)
    if [ -n "$ERRORS" ]; then
      echo "TypeScript errors detected:" >&2
      echo "$ERRORS" >&2
    fi
    ;;
esac

exit 0
