import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL;

const SUPABASE_ANON_KEY =
    import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log(
    "========================================="
);

console.log(
    "FRONTEND SUPABASE CONFIG"
);

console.log(
    "SUPABASE URL:",
    SUPABASE_URL
);

console.log(
    "ANON KEY EXISTS:",
    Boolean(SUPABASE_ANON_KEY)
);

console.log(
    "ANON KEY LENGTH:",
    SUPABASE_ANON_KEY
        ? SUPABASE_ANON_KEY.length
        : 0
);

console.log(
    "========================================="
);

if (!SUPABASE_URL) {
    throw new Error(
        "VITE_SUPABASE_URL is missing."
    );
}

if (!SUPABASE_ANON_KEY) {
    throw new Error(
        "VITE_SUPABASE_ANON_KEY is missing."
    );
}


export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            storageKey: "tc-client-auth",
            persistSession: true,
            autoRefreshToken: true,
        },
    }
);