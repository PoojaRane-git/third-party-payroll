import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../auth/AuthProvider";

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [otp, setOtp] = useState("");

    const [showOtp, setShowOtp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const API_BASE = String(
        import.meta.env.VITE_API_BASE_URL || "/api"
    ).replace(/\/+$/, "");

    // ============================================================
    // CLEAR OLD LOGIN DATA
    // ============================================================

    const clearLoginData = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("access_token");
        localStorage.removeItem("client_id");
        localStorage.removeItem("company_name");
        localStorage.removeItem("employee_id");
        localStorage.removeItem("pending_login_user");
    };

    // ============================================================
    // STEP 1 — PASSWORD LOGIN
    // ============================================================

    const handlePasswordLogin = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {
            if (!email || !password) {
                throw new Error("Please enter email and password.");
            }

            // ----------------------------------------------------
            // SUPABASE PASSWORD LOGIN
            // ----------------------------------------------------

            const {
                data: authData,
                error: authError,
            } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (authError) {
                throw new Error(authError.message);
            }

            if (!authData?.session?.access_token) {
                throw new Error("Authentication session not created.");
            }

            const accessToken = authData.session.access_token;

            console.log("SUPABASE LOGIN SUCCESS");

            // ----------------------------------------------------
            // GET USER FROM BACKEND
            // ----------------------------------------------------

            const response = await fetch(`${API_BASE}/auth/me`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json();

            console.log("AUTH /ME RESPONSE:", result);

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.error ||
                    "Unable to authenticate user."
                );
            }

            const authenticatedUser = result.user || result;

            if (!authenticatedUser) {
                throw new Error("User information not found.");
            }

            console.log("AUTHENTICATED USER:", authenticatedUser);

            // ----------------------------------------------------
            // ROLE
            // ----------------------------------------------------

            const role = String(
                authenticatedUser.role || ""
            ).toLowerCase();

            // ----------------------------------------------------
            // CHECK ALLOWED ROLES
            // ----------------------------------------------------

            const allowedRoles = [
                "superadmin",
                "admin",
                "client",
                "employee",
            ];

            if (!allowedRoles.includes(role)) {
                throw new Error(
                    `Invalid user role: ${authenticatedUser.role}`
                );
            }

            // ----------------------------------------------------
            // SUPERADMIN EMAIL CHECK
            // ----------------------------------------------------

            if (
                role === "superadmin" &&
                authenticatedUser.email?.toLowerCase() !==
                    "talentcorner103@gmail.com"
            ) {
                throw new Error("Unauthorized superadmin account.");
            }

            // ----------------------------------------------------
            // SEND OTP
            // ----------------------------------------------------

            const otpResponse = await fetch(
                `${API_BASE}/auth/send-login-otp`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: authenticatedUser.email,
                    }),
                }
            );

            const otpResult = await otpResponse.json();

            console.log("SEND OTP RESPONSE:", otpResult);

            if (!otpResponse.ok) {
                throw new Error(
                    otpResult?.message ||
                    otpResult?.error ||
                    "Failed to send OTP."
                );
            }

            // ----------------------------------------------------
            // SAVE TEMP USER
            // ----------------------------------------------------

            localStorage.setItem(
                "pending_login_user",
                JSON.stringify(authenticatedUser)
            );

            setShowOtp(true);

        } catch (err) {
            console.error("LOGIN ERROR:", err);

            setError(
                err?.message ||
                "Login failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // STEP 2 — OTP VERIFICATION
    // ============================================================

    const handleVerifyOtp = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        try {
            if (!otp || otp.length !== 6) {
                throw new Error("Please enter the 6-digit OTP.");
            }

            // ----------------------------------------------------
            // GET CURRENT SUPABASE SESSION
            // ----------------------------------------------------

            const {
                data: sessionData,
                error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError) {
                throw new Error(sessionError.message);
            }

            const session = sessionData?.session;

            if (!session?.access_token) {
                throw new Error(
                    "Authentication session expired. Please login again."
                );
            }

            // ----------------------------------------------------
            // VERIFY OTP
            // ----------------------------------------------------

            const response = await fetch(
                `${API_BASE}/auth/verify-login-otp`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: email.trim(),
                        otp: otp.trim(),
                    }),
                }
            );

            const result = await response.json();

            console.log("VERIFY OTP RESPONSE:", result);

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.error ||
                    "Invalid OTP."
                );
            }

            // ----------------------------------------------------
            // FINAL AUTHENTICATED USER
            // ----------------------------------------------------

            const authenticatedUser =
                result.user ||
                result.authenticatedUser ||
                JSON.parse(
                    localStorage.getItem("pending_login_user") || "null"
                );

            if (!authenticatedUser) {
                throw new Error(
                    "Authenticated user information not found."
                );
            }

            console.log(
                "FINAL AUTHENTICATED USER:",
                authenticatedUser
            );

            const role = String(
                authenticatedUser.role || ""
            ).toLowerCase();

            // ====================================================
            // IMPORTANT
            // ====================================================

            clearLoginData();

            // Save access token
            localStorage.setItem(
                "access_token",
                session.access_token
            );

            // Save user
            localStorage.setItem(
                "user",
                JSON.stringify(authenticatedUser)
            );

            // Save company
            if (authenticatedUser.company_name) {
                localStorage.setItem(
                    "company_name",
                    authenticatedUser.company_name
                );
            }

            // Save client ID
            if (authenticatedUser.client_id) {
                localStorage.setItem(
                    "client_id",
                    String(authenticatedUser.client_id)
                );
            }

            // Save employee ID
            if (authenticatedUser.employee_id) {
                localStorage.setItem(
                    "employee_id",
                    String(authenticatedUser.employee_id)
                );
            }

            // ====================================================
            // CRITICAL FIX
            // ====================================================
            // ProtectedRoute reads user from AuthProvider.
            // Therefore update AuthProvider BEFORE navigate().
            // ====================================================

            login(authenticatedUser);

            console.log(
                "AUTH PROVIDER USER UPDATED:",
                authenticatedUser
            );

            // ====================================================
            // REDIRECT BY ROLE
            // ====================================================

            if (role === "superadmin") {
                navigate("/admindashboard", {
                    replace: true,
                });

                return;
            }

            if (role === "admin") {
                navigate("/admindashboard", {
                    replace: true,
                });

                return;
            }

            if (role === "client") {
                navigate("/client-dashboard", {
                    replace: true,
                });

                return;
            }

            if (role === "employee") {
                navigate("/employee-portal", {
                    replace: true,
                });

                return;
            }

            throw new Error(
                `Unsupported user role: ${authenticatedUser.role}`
            );

        } catch (err) {
            console.error("OTP VERIFICATION ERROR:", err);

            setError(
                err?.message ||
                "OTP verification failed."
            );
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // BACK TO PASSWORD LOGIN
    // ============================================================

    const handleBackToLogin = () => {
        setShowOtp(false);
        setOtp("");
        setError("");
    };

    // ============================================================
    // UI
    // ============================================================

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">

            <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">

                <h1 className="text-2xl font-bold text-center mb-2">
                    Talent Corner
                </h1>

                <p className="text-center text-gray-500 mb-6">
                    {showOtp
                        ? "Verify your login"
                        : "Login to your account"}
                </p>

                {error && (
                    <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {!showOtp ? (
                    <form
                        onSubmit={handlePasswordLogin}
                        className="space-y-4"
                    >

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Email
                            </label>

                            <input
                                type="email"
                                value={email}
                                onChange={(e) =>
                                    setEmail(e.target.value)
                                }
                                placeholder="Enter email"
                                className="w-full border rounded-lg px-4 py-3"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Password
                            </label>

                            <input
                                type="password"
                                value={password}
                                onChange={(e) =>
                                    setPassword(e.target.value)
                                }
                                placeholder="Enter password"
                                className="w-full border rounded-lg px-4 py-3"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
                        >
                            {loading
                                ? "Please wait..."
                                : "Login"}
                        </button>

                    </form>
                ) : (
                    <form
                        onSubmit={handleVerifyOtp}
                        className="space-y-4"
                    >

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Enter OTP
                            </label>

                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={otp}
                                onChange={(e) =>
                                    setOtp(
                                        e.target.value.replace(
                                            /\D/g,
                                            ""
                                        )
                                    )
                                }
                                placeholder="6-digit OTP"
                                className="w-full border rounded-lg px-4 py-3 text-center tracking-widest text-lg"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
                        >
                            {loading
                                ? "Verifying..."
                                : "Verify OTP"}
                        </button>

                        <button
                            type="button"
                            onClick={handleBackToLogin}
                            className="w-full border rounded-lg py-3"
                        >
                            Back to Login
                        </button>

                    </form>
                )}

            </div>
        </div>
    );
};

export default Login;