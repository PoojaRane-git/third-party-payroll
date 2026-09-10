import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Supabase session error:", error);
        }

        if (!mounted) return;

        setSession(session);

        /*
         * IMPORTANT:
         * Do NOT automatically consider the Supabase session
         * as application login.
         *
         * The user is considered logged in only after:
         * Password -> Supabase Auth -> OTP -> OTP verification
         *
         * Login.jsx stores the verified application user in localStorage.
         */
        const storedUser = localStorage.getItem("user");

        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
          } catch (error) {
            console.error(
              "Invalid stored user data:",
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        setSession(session);

        /*
         * Do NOT set:
         * setUser(session?.user ?? null)
         *
         * OTP verification controls application login.
         */
        const storedUser = localStorage.getItem("user");

        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (error) {
            console.error(
              "Invalid stored user data:",
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

  const logout = async () => {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    /*
     * Clear application login data.
     */
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("client_id");
    localStorage.removeItem("company_name");
    localStorage.removeItem("employee_id");
    localStorage.removeItem("pending_login_user");

    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}