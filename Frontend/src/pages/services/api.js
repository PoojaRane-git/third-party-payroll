import axios from "axios";
import { supabase } from "../../lib/supabaseClient";

// ============================================================
// API BASE URL
// ============================================================

const API_BASE = String(
    import.meta.env.VITE_API_BASE_URL ||
        (import.meta.env.PROD
            ? "/api"
            : "http://localhost:5000/api")
).replace(/\/+$/, "");

// ============================================================
// AXIOS INSTANCE
// ============================================================

const api = axios.create({
    baseURL: API_BASE,

    headers: {
        "Content-Type": "application/json",
    },
});

// ============================================================
// REQUEST INTERCEPTOR
// ============================================================

api.interceptors.request.use(
    async (config) => {
        try {
            // ----------------------------------------------------
            // Get current Supabase session
            // ----------------------------------------------------

            const {
                data: { session },
                error,
            } = await supabase.auth.getSession();

            if (error) {
                console.error(
                    "❌ Supabase session error:",
                    error
                );
            }

            // ----------------------------------------------------
            // Attach access token
            // ----------------------------------------------------

            if (session?.access_token) {
                config.headers =
                    config.headers || {};

                config.headers.Authorization =
                    `Bearer ${session.access_token}`;

                console.log(
                    "✅ Authorization token attached"
                );

                console.log(
                    "Token length:",
                    session.access_token.length
                );
            } else {
                console.error(
                    "❌ No Supabase access token available"
                );
            }

            return config;

        } catch (error) {
            console.error(
                "❌ Failed to get Supabase session:",
                error
            );

            return config;
        }
    },

    (error) => {
        return Promise.reject(error);
    }
);

// ============================================================
// RESPONSE INTERCEPTOR
// ============================================================

api.interceptors.response.use(
    (response) => {
        return response;
    },

    async (error) => {
        // --------------------------------------------------------
        // Authentication failure
        // --------------------------------------------------------

        if (error.response?.status === 401) {
            console.error(
                "❌ API authentication failed:",
                error.response?.data
            );

            console.error(
                "Request URL:",
                error.config?.url
            );

            console.error(
                "API Base:",
                API_BASE
            );
        }

        return Promise.reject(error);
    }
);

// ============================================================
// EXPORT
// ============================================================

export default api;

export { API_BASE };