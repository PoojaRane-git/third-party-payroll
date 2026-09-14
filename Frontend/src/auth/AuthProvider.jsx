import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

// ============================================================
// API BASE URL
// ============================================================

const API_BASE_URL = String(
    import.meta.env.VITE_API_BASE_URL ||
        (import.meta.env.PROD
            ? "/api"
            : "http://localhost:5000/api")
).replace(/\/+$/, "");

// ============================================================
// AUTH PROVIDER
// ============================================================

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ============================================================
    // FETCH AUTHORITATIVE USER FROM BACKEND
    // ============================================================

    const fetchCurrentUser = async (accessToken) => {
        if (!accessToken) {
            setUser(null);
            return null;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/auth/me`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${accessToken}`,
                        "Content-Type":
                            "application/json",
                    },
                }
            );

            const result =
                await response.json().catch(
                    () => ({})
                );

            if (!response.ok || result.success !== true) {
                console.error(
                    "AUTH PROVIDER /auth/me FAILED:",
                    result
                );

                setUser(null);

                return null;
            }

            const authenticatedUser =
                result.user || null;

            if (authenticatedUser) {
                setUser(
                    authenticatedUser
                );

                // Keep localStorage synchronized.
                localStorage.setItem(
                    "user",
                    JSON.stringify(
                        authenticatedUser
                    )
                );

                return authenticatedUser;
            }

            setUser(null);

            return null;

        } catch (error) {
            console.error(
                "AUTH PROVIDER USER FETCH ERROR:",
                error
            );

            setUser(null);

            return null;
        }
    };

    // ============================================================
    // INITIALIZE AUTH
    // ============================================================

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                const {
                    data: {
                        session: currentSession,
                    },
                    error,
                } =
                    await supabase.auth.getSession();

                if (error) {
                    console.error(
                        "Supabase session error:",
                        error
                    );
                }

                if (!mounted) return;

                setSession(
                    currentSession || null
                );

                // ------------------------------------------------
                // NO SUPABASE SESSION
                // ------------------------------------------------

                if (!currentSession?.access_token) {
                    setUser(null);

                    localStorage.removeItem(
                        "user"
                    );

                    return;
                }

                // ------------------------------------------------
                // IMPORTANT
                //
                // Get the authoritative user from backend.
                // Do NOT trust localStorage as the source
                // of authentication/profile information.
                // ------------------------------------------------

                await fetchCurrentUser(
                    currentSession.access_token
                );

            } catch (error) {
                console.error(
                    "Auth initialization error:",
                    error
                );

                if (mounted) {
                    setSession(null);
                    setUser(null);

                    localStorage.removeItem(
                        "user"
                    );
                }

            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        // ========================================================
        // SUPABASE AUTH STATE
        // ========================================================

        const {
            data: {
                subscription,
            },
        } =
            supabase.auth.onAuthStateChange(
                async (
                    event,
                    currentSession
                ) => {

                    if (!mounted) return;

                    console.log(
                        "SUPABASE AUTH STATE:",
                        event
                    );

                    setSession(
                        currentSession || null
                    );

                    // ------------------------------------------------
                    // SIGNED OUT
                    // ------------------------------------------------

                    if (
                        event ===
                            "SIGNED_OUT" ||
                        !currentSession?.access_token
                    ) {
                        setUser(null);

                        localStorage.removeItem(
                            "user"
                        );

                        localStorage.removeItem(
                            "access_token"
                        );

                        return;
                    }

                    // ------------------------------------------------
                    // SIGNED IN / TOKEN REFRESH
                    //
                    // Fetch current profile from backend.
                    // ------------------------------------------------

                    if (
                        event ===
                            "SIGNED_IN" ||
                        event ===
                            "TOKEN_REFRESHED" ||
                        event ===
                            "USER_UPDATED"
                    ) {
                        await fetchCurrentUser(
                            currentSession.access_token
                        );
                    }
                }
            );

        return () => {
            mounted = false;

            subscription.unsubscribe();
        };
    }, []);

    // ============================================================
    // LOGIN
    // ============================================================

    const login = (userObject) => {
        console.log(
            "AUTH PROVIDER LOGIN:",
            userObject
        );

        if (!userObject) {
            setUser(null);

            localStorage.removeItem(
                "user"
            );

            return;
        }

        setUser(userObject);

        localStorage.setItem(
            "user",
            JSON.stringify(userObject)
        );
    };

    // ============================================================
    // LOGOUT
    // ============================================================

    const logout = async () => {
        try {
            const {
                error,
            } =
                await supabase.auth.signOut();

            if (error) {
                console.error(
                    "Supabase logout error:",
                    error
                );
            }

        } catch (error) {
            console.error(
                "Logout error:",
                error
            );
        }

        // --------------------------------------------------------
        // CLEAR APPLICATION STORAGE
        // --------------------------------------------------------

        localStorage.removeItem(
            "user"
        );

        localStorage.removeItem(
            "access_token"
        );

        localStorage.removeItem(
            "client_id"
        );

        localStorage.removeItem(
            "company_name"
        );

        localStorage.removeItem(
            "employee_id"
        );

        localStorage.removeItem(
            "pending_login_user"
        );

        // --------------------------------------------------------
        // CLEAR STATE
        // --------------------------------------------------------

        setSession(null);
        setUser(null);
    };

    // ============================================================
    // CONTEXT
    // ============================================================

    const value = {
        session,
        user,
        loading,
        login,
        logout,
    };

    return (
        <AuthContext.Provider
            value={value}
        >
            {children}
        </AuthContext.Provider>
    );
};

// ================================================================
// useAuth
// ================================================================

export const useAuth = () => {
    const context =
        useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider"
        );
    }

    return context;
};