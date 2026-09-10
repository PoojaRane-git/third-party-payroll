import axios from "axios";
import { supabase } from "../../lib/supabaseClient";

const api = axios.create({
    baseURL: "http://localhost:5000/api",
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    async (config) => {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
            config.headers.Authorization =
                `Bearer ${session.access_token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

export default api;