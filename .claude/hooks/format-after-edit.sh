#!/bin/bash
# Auto-format files after Edit/Write tool calls
# Runs Prettier on supported file types

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).tool_input.file_path||'')}catch{console.log('')}})")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only format file types Prettier handles
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.html|*.md)
    npx prettier --write "$FILE_PATH" 2>/dev/null
    ;;
esac

exit 0
