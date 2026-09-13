import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ============================================================
    // INITIALIZE AUTH
    // ============================================================

    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
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

                if (!mounted) return;

                setSession(session);

                // ------------------------------------------------
                // LOAD USER FROM LOCAL STORAGE
                // ------------------------------------------------

                const storedUser =
                    localStorage.getItem("user");

                if (storedUser) {
                    try {
                        const parsedUser =
                            JSON.parse(storedUser);

                        setUser(parsedUser);

                        console.log(
                            "AUTH PROVIDER INITIAL USER:",
                            parsedUser
                        );

                    } catch (error) {
                        console.error(
                            "Invalid stored user:",
                            error
                        );

                        localStorage.removeItem("user");
                        setUser(null);
                    }
                } else {
                    setUser(null);
                }

            } catch (error) {
                console.error(
                    "Auth initialization error:",
                    error
                );

                if (mounted) {
                    setSession(null);
                    setUser(null);
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
            data: { subscription },
        } = supabase.auth.onAuthStateChange(
            (_event, session) => {

                if (!mounted) return;

                console.log(
                    "SUPABASE AUTH STATE:",
                    _event
                );

                setSession(session);

                // ------------------------------------------------
                // IMPORTANT:
                // Read application user from localStorage.
                // ------------------------------------------------

                const storedUser =
                    localStorage.getItem("user");

                if (storedUser) {
                    try {
                        setUser(
                            JSON.parse(storedUser)
                        );
                    } catch (error) {
                        console.error(
                            "Failed to parse stored user:",
                            error
                        );

                        localStorage.removeItem("user");
                        setUser(null);
                    }
                } else {
                    setUser(null);
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

        setUser(userObject);
    };

    // ============================================================
    // LOGOUT
    // ============================================================

    const logout = async () => {
        try {
            const { error } =
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

        localStorage.removeItem("user");
        localStorage.removeItem("access_token");
        localStorage.removeItem("client_id");
        localStorage.removeItem("company_name");
        localStorage.removeItem("employee_id");
        localStorage.removeItem("pending_login_user");

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
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// ================================================================
// useAuth
// ================================================================

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider"
        );
    }

    return context;
};