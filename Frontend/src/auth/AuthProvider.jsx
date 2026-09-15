import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

const API_BASE_URL = String(
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD ? "/api" : "http://localhost:5000/api")
).replace(/\/+$/, "");

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchCurrentUser = async (accessToken) => {
        if (!accessToken) {
            setUser(null);
            return null;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || result.success !== true) {
                console.error("AUTH PROVIDER /auth/me FAILED:", result);
                return null;
            }

            const authenticatedUser = result.user || null;

            if (authenticatedUser) {
                setUser(authenticatedUser);
                sessionStorage.setItem("user", JSON.stringify(authenticatedUser));
                return authenticatedUser;
            }

            setUser(null);
            return null;
        } catch (error) {
            console.error("AUTH PROVIDER USER FETCH ERROR:", error);
            return null;
        }
    };

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                const {
                    data: { session: currentSession },
                    error,
                } = await supabase.auth.getSession();

                if (error) {
                    console.error("Supabase session error:", error);
                }

                if (!mounted) return;

                setSession(currentSession || null);

                if (!currentSession?.access_token) {
                    setUser(null);
                    sessionStorage.removeItem("user");
                    return;
                }

                await fetchCurrentUser(currentSession.access_token);
            } catch (error) {
                console.error("Auth initialization error:", error);

                if (mounted) {
                    setSession(null);
                    setUser(null);
                    sessionStorage.removeItem("user");
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!mounted) return;

            console.log("SUPABASE AUTH STATE:", event);

            setSession(currentSession || null);

            if (event === "SIGNED_OUT" || !currentSession?.access_token) {
                setUser(null);
                sessionStorage.removeItem("user");
                sessionStorage.removeItem("access_token");
                return;
            }

            if (
                event === "SIGNED_IN" ||
                event === "TOKEN_REFRESHED" ||
                event === "USER_UPDATED"
            ) {
                await fetchCurrentUser(currentSession.access_token);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const login = (userObject) => {
        console.log("AUTH PROVIDER LOGIN:", userObject);

        if (!userObject) {
            setUser(null);
            sessionStorage.removeItem("user");
            return;
        }

        setUser(userObject);
        sessionStorage.setItem("user", JSON.stringify(userObject));
    };

    const logout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error("Supabase logout error:", error);
            }
        } catch (error) {
            console.error("Logout error:", error);
        }

        sessionStorage.removeItem("user");
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("client_id");
        sessionStorage.removeItem("company_name");
        sessionStorage.removeItem("employee_id");
        sessionStorage.removeItem("pending_login_user");

        setSession(null);
        setUser(null);
    };

    const value = { session, user, loading, login, logout };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }

    return context;
};