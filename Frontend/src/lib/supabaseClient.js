import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
    throw new Error("VITE_SUPABASE_URL is missing.");
}

if (!SUPABASE_ANON_KEY) {
    throw new Error("VITE_SUPABASE_ANON_KEY is missing.");
}

// Disable Supabase's cross-tab auth sync. Without this, logging
// into a different account in one tab broadcasts that sign-in to
// every other tab of this origin via BroadcastChannel, overwriting
// their live session state even though sessionStorage itself
// stays correctly isolated per tab.
if (typeof window !== "undefined") {
    window.BroadcastChannel = undefined;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storageKey: "tc-client-auth",
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
    },
});