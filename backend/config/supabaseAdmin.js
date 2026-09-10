require("dotenv").config();

// ============================================================
// DEBUG: CHECK SUPABASE ENV VARS
// ============================================================

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("========================================");
console.log("SUPABASE_URL:", url || "❌ UNDEFINED");
console.log("========================================");

if (!key) {
    console.log("❌ SUPABASE_SERVICE_ROLE_KEY is UNDEFINED.");
    console.log("Check that .env exists and dotenv is loaded.");
} else {

    try {

        const parts = key.split(".");

        if (parts.length !== 3) {
            console.log("❌ Key does not look like a valid JWT.");
        } else {

            const payload = JSON.parse(
                Buffer.from(parts[1], "base64").toString()
            );

            console.log("Key role:", payload.role || "unknown");
            console.log("Key project ref:", payload.ref || "unknown");
            console.log("Key issued at:", new Date(payload.iat * 1000).toISOString());
            console.log("Key expires at:", new Date(payload.exp * 1000).toISOString());
        }

    } catch (err) {
        console.log("❌ Failed to decode key:", err.message);
    }
}

console.log("========================================");