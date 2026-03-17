/**
 * Shared rate limiting for Supabase Edge Functions.
 * Limits: 50 calls/user/day (500 for owner), 100 calls/IP/day per endpoint.
 * Auto-cleans rows older than 48h.
 */
export async function checkRateLimit(
  supabaseAdmin: any,
  userId: string,
  ipAddress: string,
  endpoint: string,
  userLimitOverride?: number,
): Promise<{ allowed: boolean; message?: string }> {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Run owner check, user count, and IP count in parallel
  const ownerEmail = Deno.env.get("OWNER_EMAIL");
  const [ownerResult, userCallsResult, ipCallsResult] = await Promise.all([
    ownerEmail
      ? supabaseAdmin.auth.admin.getUserById(userId)
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("api_rate_limits")
      .select("call_count")
      .eq("user_id", userId)
      .eq("endpoint", endpoint)
      .gte("window_start", windowStart),
    supabaseAdmin
      .from("api_rate_limits")
      .select("call_count")
      .eq("ip_address", ipAddress)
      .eq("endpoint", endpoint)
      .gte("window_start", windowStart),
  ]);

  // Determine user limit
  let userLimit = userLimitOverride ?? 50;
  if (ownerEmail) {
    const authUser = ownerResult.data;
    if (authUser?.user?.email?.toLowerCase() === ownerEmail.toLowerCase()) {
      userLimit = Math.max(userLimit, 500);
    }
  }

  // Check user limit
  const userTotal = (userCallsResult.data || []).reduce(
    (sum: number, r: any) => sum + r.call_count,
    0,
  );
  if (userTotal >= userLimit) {
    return { allowed: false, message: "Daily limit reached." };
  }

  // Check IP limit (100/day)
  const ipTotal = (ipCallsResult.data || []).reduce(
    (sum: number, r: any) => sum + r.call_count,
    0,
  );
  if (ipTotal >= 100) {
    return { allowed: false, message: "Too many requests." };
  }

  // Increment + cleanup — fire-and-forget (don't block the response)
  supabaseAdmin.from("api_rate_limits").insert({
    user_id: userId,
    ip_address: ipAddress,
    endpoint,
    call_count: 1,
    window_start: new Date().toISOString(),
  });

  const cleanupTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  supabaseAdmin
    .from("api_rate_limits")
    .delete()
    .lt("window_start", cleanupTime);

  return { allowed: true };
}
