#!/bin/bash
# Save session state before context compaction

INPUT=$(cat)
TRIGGER=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).compaction_trigger||'unknown')}catch{console.log('unknown')}})")
SESSION_ID=$(echo "$INPUT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).session_id||'unknown')}catch{console.log('unknown')}})")
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

STATE_FILE=".claude/hooks/last-compaction.log"

cat > "$STATE_FILE" << EOF
Compaction at: $TIMESTAMP
Trigger: $TRIGGER
Session: $SESSION_ID
Git branch: $(git branch --show-current 2>/dev/null || echo "unknown")
Modified files: $(git diff --name-only 2>/dev/null | tr '\n' ', ')
Staged files: $(git diff --cached --name-only 2>/dev/null | tr '\n' ', ')
EOF

echo "Context was compacted ($TRIGGER). Check .claude/hooks/last-compaction.log for pre-compaction state if needed."

exit 0
