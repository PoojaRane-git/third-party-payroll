import axios from "axios";
import { supabase } from "../../lib/supabaseClient";

const API_BASE = String(
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD ? "/api" : "http://localhost:5000/api")
).replace(/\/+$/, "");

const api = axios.create({
    baseURL: API_BASE,
    headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    return config;
});

export default api;
export { API_BASE };