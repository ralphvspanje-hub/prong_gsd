-- Add explicit RLS policy to api_rate_limits table
-- Previously had RLS enabled but no policies (safe-by-default deny-all via anon key,
-- but fragile if someone adds a permissive policy later)

-- Users can only see their own rate limit rows (defensive — edge functions use service role anyway)
CREATE POLICY "Users can only view own rate limits"
  ON api_rate_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated role — only service role writes
