import axios from "axios";
import { supabase } from "../../lib/supabaseClient";

const API_BASE = String(
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD
        ? "/api"
        : "http://localhost:5000/api")
).replace(/\/+$/, "");

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    async (config) => {
        const {
            data: { session },
            error,
        } = await supabase.auth.getSession();

        if (error) {
            console.error(
                "Supabase session error:",
                error
            );
        }

        if (session?.access_token) {
            config.headers = config.headers || {};

            config.headers.Authorization =
                `Bearer ${session.access_token}`;
        } else {
            console.warn(
                "No Supabase access token available"
            );
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
export { API_BASE };