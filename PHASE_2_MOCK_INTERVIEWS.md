# Phase 2: AI Mock Interviews — Execution Plan

> **For the implementing agent:** This plan was written with full codebase context. All file paths, patterns, and code examples are verified against the actual code. You should be able to execute this without deep exploration — just read the referenced files as you go.

## Context

Phase 1 (Interview Prep Crash Course) is complete. Users can now:
- Go through a 3-4 turn interview mini-onboarding (`/interview-onboarding`)
- Get a 1-3 week intensive plan with daily tasks
- Toggle between their learning plan and interview prep on the dashboard

Phase 2 adds **AI mock interviews** built into the app. The plan already schedules mock interview tasks (with `resource_type: 'mock_interview'`), but nothing handles them yet. This phase makes those tasks functional.

## What We're Building

1. **`gsd-mock-interview` edge function** — AI interviewer that asks questions, follows up, and gives structured feedback
2. **`MockInterview.tsx` page** — Chat interface for conducting mock interviews
3. **`TaskItem.tsx` enhancement** — Mock interview tasks show "Start Mock Interview" button instead of external link
4. **Mistake journal UI** — Post-mock reflection where users record mistakes (timebox method)

## User Flow

1. User sees a mock interview task on their interview prep dashboard (e.g., "MOCK: Behavioral interview — STAR method practice")
2. They click "Start Mock Interview" on the task
3. Frontend creates a `mock_interviews` row and navigates to `/mock-interview/:id`
4. AI asks 5-8 interview questions, user responds conversationally
5. After the last question, AI generates structured feedback (score, strengths, areas to improve)
6. User sees feedback card + "Record Your Mistakes" prompt
7. User enters mistakes + lessons learned → saved to `mistake_journal`
8. Completing the mock marks the parent `plan_task` as completed
9. User returns to dashboard

## Implementation Details

### 2A. Edge Function: `supabase/functions/gsd-mock-interview/index.ts`

**Pattern to follow:** `supabase/functions/gsd-interview-onboarding/index.ts` (same auth, rate limit, Gemini call structure)

**Actions:**

```typescript
// Request body: { action: "start" | "continue" | "complete", mock_id?, interview_type, messages? }
```

**`start` action:**
- Creates a `mock_interviews` row in DB (via supabaseAdmin)
- Input: `{ action: "start", interview_type: "behavioral" | "technical" | "system_design" | "case_study", plan_task_id?: string }`
- Fetches interview context from `user_profile`: `interview_target_role`, `interview_company`, `interview_company_context`
- Sends first prompt to Gemini with interviewer system prompt
- Returns: `{ mock_id, message }` (the opening question)

**`continue` action:**
- Input: `{ action: "continue", mock_id, messages: [...] }`
- Fetches `mock_interviews` row to get context
- Sends conversation to Gemini
- AI decides whether to ask another question or wrap up (based on turn count)
- If AI includes `[INTERVIEW_COMPLETE]` tag → parse feedback, update row, return feedback
- Returns: `{ message }` or `{ message, feedback, completed: true }`

**`complete` action (manual end):**
- Input: `{ action: "complete", mock_id, messages: [...] }`
- Forces Gemini to generate feedback from conversation so far
- Updates `mock_interviews` row: `status: 'completed'`, `ai_feedback`, `score`, `completed_at`
- Returns: `{ feedback }`

**System prompt structure (behavioral example):**

```
You are a professional interviewer conducting a behavioral interview for a ${targetRole} position${company ? ` at ${company}` : ''}.

INTERVIEW RULES:
- Ask one question at a time. Wait for the answer before asking the next.
- Use the STAR method to evaluate answers. Look for: Situation specificity, Task clarity, Action detail, Result impact.
- Ask 5-8 questions total. Mix categories: teamwork, conflict resolution, leadership, failure/learning, achievement.
- After each answer, briefly acknowledge it, then ask a follow-up OR move to the next question.
- Follow-ups should probe for specifics: "Can you quantify that impact?" "What specifically did YOU do vs. the team?"
- Be professional but not robotic. A real interviewer, not a quiz machine.
- After 5-8 questions, wrap up with: "That covers my questions. Let me put together some feedback for you."

${companyContext ? `COMPANY CONTEXT (tailor questions to this):\n${companyContext}` : ''}

COMPLETION:
After your final question has been answered, produce feedback wrapped in:
[INTERVIEW_COMPLETE]
{
  "overall_score": 1-5,
  "strengths": ["specific strength 1", "specific strength 2"],
  "areas_to_improve": ["specific area 1", "specific area 2"],
  "key_mistakes": ["mistake 1", "mistake 2"],
  "question_scores": [
    { "question": "brief question text", "score": 1-5, "note": "brief note" }
  ],
  "suggested_follow_up": "One sentence suggesting what to practice next"
}
[/INTERVIEW_COMPLETE]
```

**Technical interview system prompt** should ask conceptual coding questions, SQL scenarios, data modeling — NOT actual code execution. Example questions for a data analyst: "Walk me through how you'd design a query to find the top 10 customers by lifetime value, handling edge cases like refunds."

**System design** should follow the standard format: "Design a..." with guided exploration of requirements, components, trade-offs.

**Rate limiting:** Use `checkRateLimit` with endpoint `"mock-interview"`, same as other functions.

**Gemini settings:** `maxOutputTokens: 4096, temperature: 0.7` (same as onboarding/mentor)

**DB operations (use supabaseAdmin for writes):**
- INSERT into `mock_interviews` on start
- UPDATE `mock_interviews.messages` after each turn (append to JSONB array)
- UPDATE `mock_interviews` on completion (status, ai_feedback, score, completed_at, duration_minutes)

### 2B. Page: `src/pages/MockInterview.tsx`

**Pattern to follow:** `src/pages/Mentor.tsx` for the chat UI, `src/pages/InterviewOnboarding.tsx` for the header style.

**Route:** `/mock-interview/:id` — the `:id` is the `mock_interviews.id`

**Components to reuse:**
- Same chat bubble pattern from `Onboarding.tsx` / `InterviewOnboarding.tsx` (ReactMarkdown for assistant, plain text for user)
- Same textarea input pattern (the `TEXTAREA_BASE` class + auto-resize)
- `ScrollArea` from `@/components/ui/scroll-area`
- `Card`, `Badge`, `Button` from shadcn/ui

**State:**
```typescript
const { id } = useParams();  // mock_interviews.id
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState("");
const [loading, setLoading] = useState(false);
const [completed, setCompleted] = useState(false);
const [feedback, setFeedback] = useState<Feedback | null>(null);
const [showMistakeForm, setShowMistakeForm] = useState(false);
const [elapsedMinutes, setElapsedMinutes] = useState(0);
```

**Flow:**
1. On mount: fetch `mock_interviews` row by ID to get existing messages and status
2. If status is `in_progress` and messages empty → this is a fresh start, call `gsd-mock-interview` with `action: "start"` (but actually start was already called when creating the row — so just display existing messages)
3. User types response → call `action: "continue"` → display AI follow-up
4. When `completed: true` in response → show feedback card
5. "Record Mistakes" button → show mistake form
6. "End Interview" button (always visible) → call `action: "complete"` to force end early

**Header:** Show interview type + timer (elapsed time since page load). Orange accent like the rest of interview prep UI.

**Feedback card (shown after completion):**
```jsx
<Card className="border-orange-500/30">
  <CardHeader>
    <CardTitle>Interview Feedback</CardTitle>
    <div className="flex gap-2">
      <Badge>Score: {feedback.overall_score}/5</Badge>
      <Badge variant="outline">{elapsedMinutes} min</Badge>
    </div>
  </CardHeader>
  <CardContent>
    <h4>Strengths</h4>
    <ul>{feedback.strengths.map(...)}</ul>
    <h4>Areas to Improve</h4>
    <ul>{feedback.areas_to_improve.map(...)}</ul>
    <h4>Key Mistakes</h4>
    <ul>{feedback.key_mistakes.map(...)}</ul>
    <p className="italic">{feedback.suggested_follow_up}</p>
  </CardContent>
</Card>
```

**Mistake form (shown after feedback):**
```jsx
// Multiple mistakes can be added
const [mistakes, setMistakes] = useState([{ category: "", description: "", lesson: "" }]);
```

Each mistake entry:
- Category dropdown: `technical`, `behavioral`, `communication`, `time_management`
- Mistake description (textarea)
- Lesson learned (textarea)
- "+ Add another mistake" button
- "Save & Return to Dashboard" button → saves all to `mistake_journal`, marks parent `plan_task` as completed, navigates to `/dashboard`

**Also suggest external platforms** after feedback:
```jsx
<div className="text-sm text-muted-foreground mt-4">
  <p>Want deeper practice? Try these platforms:</p>
  <ul>
    <li><a href="https://www.pramp.com/">Pramp</a> — Free peer-to-peer mock interviews</li>
    <li><a href="https://interviewing.io/">Interviewing.io</a> — Anonymous mocks with real engineers</li>
  </ul>
</div>
```

### 2C. TaskItem Enhancement: `src/components/plan/TaskItem.tsx`

**Current behavior:** TaskItem renders a checkbox + action text + platform badge + resource link.

**What to change:** When `task.resource_type === "mock_interview"`, render differently:

```tsx
// Inside TaskItem, check resource_type
if (task.resource_type === "mock_interview" && !task.is_completed) {
  // Show "Start Mock Interview" button instead of the normal resource link
  return (
    // ... keep the checkbox and action text ...
    <Button
      size="sm"
      className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
      onClick={async () => {
        // Create mock_interviews row
        const { data } = await supabase.functions.invoke("gsd-mock-interview", {
          body: {
            action: "start",
            interview_type: inferTypeFromAction(task.action), // parse from task action text
            plan_task_id: task.id,
          },
        });
        if (data?.mock_id) {
          navigate(`/mock-interview/${data.mock_id}`);
        }
      }}
    >
      <Target className="h-3.5 w-3.5" />
      Start Mock Interview
    </Button>
  );
}
```

**Important:** `TaskItem.tsx` currently doesn't have `navigate`. You'll need to either:
- Pass an `onStartMock` callback from `DailyTaskList` → `Dashboard`
- Or use `useNavigate()` directly in TaskItem (simpler, components already import from react-router-dom elsewhere)

**Read `TaskItem.tsx` first** to understand its exact props and structure before modifying.

### 2D. Mistake Journal View on Dashboard

**Where:** On the interview prep dashboard, below the daily tasks.

**When visible:** Only when `viewMode === "interview_prep"` and there are recent mistakes.

**Query:**
```typescript
const { data: recentMistakes } = useQuery({
  queryKey: ["recent-mistakes", userId],
  queryFn: async () => {
    const { data } = await supabase
      .from("mistake_journal")
      .select("*, mock_interviews(interview_type, score)")
      .eq("user_id", userId!)
      .order("created_at", { ascending: false })
      .limit(10);
    return data || [];
  },
  enabled: !!userId && viewMode === "interview_prep",
});
```

**UI:** Compact list below tasks, grouped by category. Show pattern detection like "3 communication mistakes in last 5 mocks — focus on being more concise."

**This can be a new component:** `src/components/plan/MistakeJournal.tsx`

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/gsd-mock-interview/index.ts` | Mock interview AI edge function |
| `src/pages/MockInterview.tsx` | Mock interview chat page |
| `src/components/plan/MistakeJournal.tsx` | Mistake journal display component |

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/mock-interview/:id` route |
| `src/components/plan/TaskItem.tsx` | Mock interview task rendering |
| `src/pages/Dashboard.tsx` | Add MistakeJournal component for interview prep view |
| `supabase/config.toml` | Add `gsd-mock-interview` function config |
| `supabase/functions/CLAUDE.md` | Document mock-interview function |
| `src/pages/CLAUDE.md` | Document MockInterview page |
| `CLAUDE.md` (root) | Update status, routes, gotchas |

## Tables Already Created (Phase 1 migration)

```sql
-- mock_interviews: id, user_id, plan_task_id, interview_type, target_role, company_context,
--   messages (jsonb), status, ai_feedback (jsonb), score, duration_minutes, created_at, completed_at
-- mistake_journal: id, user_id, mock_interview_id, category, mistake_description, lesson_learned, created_at
```

Both have RLS policies scoped to `user_id`.

## Verification

1. Open interview prep dashboard → see a mock interview task → click "Start Mock Interview"
2. Chat with interviewer for 5-8 questions → receive structured feedback with score
3. Click "Record Mistakes" → enter 2-3 mistakes with categories → save
4. Verify parent plan_task is marked completed
5. Return to dashboard → see mistakes in journal view
6. Test "End Interview" early (after 2-3 questions) → still get feedback
7. Test all 4 interview types: behavioral, technical, system_design, case_study

## Edge Function Env Vars Needed

Same as existing functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`

No new env vars required.
