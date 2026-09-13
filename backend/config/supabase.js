// ============================================================
// config/supabase.js
// SUPABASE ADMIN / SERVICE-ROLE CLIENT
// ============================================================

const { createClient } = require("@supabase/supabase-js");

// ============================================================
// ENVIRONMENT VARIABLES
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================================
// VALIDATE ENVIRONMENT VARIABLES
// ============================================================

if (!SUPABASE_URL) {
    throw new Error(
        "❌ SUPABASE_URL is missing from backend environment variables."
    );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
        "❌ SUPABASE_SERVICE_ROLE_KEY is missing from backend environment variables."
    );
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = supabase;