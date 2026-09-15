const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================================
// FAIL FAST IF ENV VARS ARE MISSING
// ============================================================

if (!SUPABASE_URL) {
    throw new Error(
        "❌ SUPABASE_URL is undefined. Check .env is loaded BEFORE this file is required."
    );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
        "❌ SUPABASE_SERVICE_ROLE_KEY is undefined. Check .env is loaded BEFORE this file is required."
    );
}

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            storageKey: "tc-admin-auth",
            persistSession: true,
            autoRefreshToken: true,
        },
    }
);

// TEMPORARY DEBUG
console.log("DEBUG supabaseAdmin created. Has .auth?", typeof supabase.auth);

module.exports = supabase;