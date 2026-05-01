// usage-helper.js
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Daily limits per feature — free tier only
const LIMITS = {
  optimize:     3,
  fit_analysis: 5,
  cover_letter: 2,
  synonym_swap: 5,
  rephrase:     10,
  build_resume: 2,
  extract_pay:  20
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function supabase(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: method || "GET",
    headers: {
      "apikey":        SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type":  "application/json",
      "Prefer":        method === "POST" ? "return=representation" : "return=minimal"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Check user's plan — pro users bypass all limits
async function getUserPlan(userId) {
  if (!userId) return "free";
  try {
    const rows = await supabase(`profiles?id=eq.${userId}&select=plan`, "GET");
    return rows && rows.length > 0 ? (rows[0].plan || "free") : "free";
  } catch(e) {
    return "free";
  }
}

async function getOrCreateRow(userId, feature, date) {
  const rows = await supabase(
    `usage?user_id=eq.${userId}&feature=eq.${feature}&month=eq.${date}`,
    "GET"
  );

  if (rows && rows.length > 0) return rows[0];

  const created = await supabase("usage", "POST", {
    user_id: userId,
    feature: feature,
    count:   0,
    month:   date
  });

  return Array.isArray(created) ? created[0] : created;
}

async function checkLimit(userId, feature) {
  // Allow unauthenticated requests through — no tracking without a userId.
  // Usage limits will be enforced once auth is fully wired in.
  if (!userId) {
    return { allowed: true, used: 0, limit: LIMITS[feature] || 3, remaining: LIMITS[feature] || 3, guest: true };
  }

  // Pro users have unlimited access
  const plan = await getUserPlan(userId);
  if (plan === "pro") {
    return { allowed: true, used: 0, limit: Infinity, remaining: Infinity, plan: "pro" };
  }

  const limit = LIMITS[feature] || 3;
  const date  = today();

  try {
    const row  = await getOrCreateRow(userId, feature, date);
    const used = row ? row.count : 0;
    return {
      allowed:   used < limit,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      plan:      "free"
    };
  } catch (err) {
    console.error("checkLimit error:", err.message);
    return { allowed: true, used: 0, limit, remaining: limit, error: err.message };
  }
}

async function logUsage(userId, feature) {
  // No userId means guest — skip logging silently
  if (!userId) return;

  // Don't log for pro users
  const plan = await getUserPlan(userId);
  if (plan === "pro") return;

  const date = today();

  try {
    const row = await getOrCreateRow(userId, feature, date);
    if (!row || !row.id) return;

    await supabase(`usage?id=eq.${row.id}`, "PATCH", {
      count: (row.count || 0) + 1
    });
  } catch (err) {
    console.error("logUsage error:", err.message);
  }
}

async function getAllUsage(userId) {
  if (!userId) return {};

  const plan = await getUserPlan(userId);
  const date = today();

  // Pro users show unlimited
  if (plan === "pro") {
    var result = {};
    Object.keys(LIMITS).forEach(function(feature) {
      result[feature] = { used: 0, limit: "unlimited", remaining: "unlimited", plan: "pro" };
    });
    return result;
  }

  try {
    const rows = await supabase(
      `usage?user_id=eq.${userId}&month=eq.${date}`,
      "GET"
    );

    var result = {};
    Object.keys(LIMITS).forEach(function(feature) {
      var row   = (rows || []).find(function(r) { return r.feature === feature; });
      var used  = row ? row.count : 0;
      var limit = LIMITS[feature];
      result[feature] = { used, limit, remaining: Math.max(0, limit - used), plan: "free" };
    });

    return result;
  } catch (err) {
    console.error("getAllUsage error:", err.message);
    return {};
  }
}

module.exports = { checkLimit, logUsage, getAllUsage, LIMITS };
