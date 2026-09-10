// =========================================================
// SHARED SUPABASE CLIENT
// BACKEND ONLY
// =========================================================

require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// =========================================================
// VALIDATION
// =========================================================

if (!SUPABASE_URL) {
  console.error(
    "ERROR: SUPABASE_URL is missing in backend/.env"
  );

  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in backend/.env"
  );

  process.exit(1);
}

// =========================================================
// CREATE CLIENT
// =========================================================

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// =========================================================
// DEBUG
// =========================================================

console.log("-----------------------------------------");
console.log("Supabase backend client initialized");
console.log("SUPABASE_URL:", SUPABASE_URL);
console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  SUPABASE_SERVICE_ROLE_KEY
    ? "Loaded"
    : "Missing"
);
console.log("-----------------------------------------");

// =========================================================
// EXPORT
// =========================================================

module.exports = supabase;