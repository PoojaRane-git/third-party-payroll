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
            const {
                data: { session },
                error,
            } = await supabase.auth.getSession();

            if (error) {
                console.error(
                    "❌ Supabase session error:",
                    error.message
                );
            }

            if (!session?.access_token) {
                console.error(
                    "❌ No Supabase access token available"
                );

                return config;
            }

            if (!config.headers) {
                config.headers = {};
            }

            config.headers.Authorization =
                `Bearer ${session.access_token}`;

            console.log(
                "✅ Authorization token attached:",
                config.method?.toUpperCase(),
                config.url
            );

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
    (response) => response,

    (error) => {
        if (error.response?.status === 401) {
            console.error(
                "❌ API authentication failed:",
                error.response.data
            );

            console.error(
                "Request:",
                error.config?.method?.toUpperCase(),
                error.config?.url
            );

            console.error(
                "Authorization sent:",
                error.config?.headers?.Authorization
                    ? "YES"
                    : "NO"
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