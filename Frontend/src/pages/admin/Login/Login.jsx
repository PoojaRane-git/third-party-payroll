import React, {
    useState,
} from "react";

import {
    useNavigate,
    Link,
} from "react-router-dom";

import {
    supabase,
} from "../../../lib/supabaseClient";

const API_BASE_URL = String(
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD ? "/api" : "http://localhost:5000/api")
).replace(/\/+$/, "");

// =====================================================
// AUTHORIZED SUPER ADMIN
// =====================================================
import { useAuth } from "../../../auth/AuthProvider"; // add this import

// inside SUPER_ADMIN_EMAIL — remove hardcode, use env var instead
const ADMIN_EMAIL = String(
    import.meta.env.VITE_ADMIN_EMAIL || ""
).trim().toLowerCase();


function Login() {

    const navigate =
        useNavigate();
    const { login } = useAuth();

    // =====================================================
    // LOGIN DATA
    // =====================================================

    const [
        email,
        setEmail,
    ] = useState("");

    const [
        password,
        setPassword,
    ] = useState("");

    // =====================================================
    // OTP
    // =====================================================

    const [
        otp,
        setOtp,
    ] = useState("");

    const [
        otpStep,
        setOtpStep,
    ] = useState(false);

    // =====================================================
    // STATE
    // =====================================================

    const [
        error,
        setError,
    ] = useState("");

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        otpLoading,
        setOtpLoading,
    ] = useState(false);

    // =====================================================
    // CLEAR APPLICATION LOGIN DATA
    // =====================================================

    const clearLoginData = () => {

        localStorage.removeItem(
            "access_token"
        );

        localStorage.removeItem(
            "user"
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
    };

    // =====================================================
    // LOGIN
    // =====================================================

    const handleLogin =
        async (e) => {

            e.preventDefault();

            setError("");
            setLoading(true);

            try {

                // =================================================
                // CLEAN INPUT
                // =================================================

                const cleanEmail =
                    email
                        .trim()
                        .toLowerCase();

                if (!cleanEmail) {

                    throw new Error(
                        "Please enter your email."
                    );
                }

                if (!password) {

                    throw new Error(
                        "Please enter your password."
                    );
                }

                // =================================================
                // SUPABASE LOGIN
                // =================================================

                const {
                    data: authData,
                    error: authError,
                } =
                    await supabase.auth
                        .signInWithPassword({

                            email:
                                cleanEmail,

                            password:
                                password,
                        });

                if (authError) {

                    console.error(
                        "Supabase login error:",
                        authError
                    );

                    throw new Error(
                        authError.message ||
                        "Invalid email or password."
                    );
                }

                const session =
                    authData?.session;

                const authUser =
                    authData?.user;

                if (
                    !session ||
                    !authUser
                ) {

                    throw new Error(
                        "Login failed. No session was created."
                    );
                }

                console.log(
                    "SUPABASE AUTH USER:",
                    authUser
                );

                // =================================================
                // VERIFY PROFILE WITH BACKEND
                // =================================================

                console.log(
                    "LOGIN API BASE URL:",
                    API_BASE_URL
                );

                const response =
                    await fetch(
                        `${API_BASE_URL}/auth/me`,
                        {

                            method:
                                "GET",

                            headers: {

                                Authorization:
                                    `Bearer ${session.access_token}`,

                                "Content-Type":
                                    "application/json",
                            },
                        }
                    );

                const result =
                    await response
                        .json()
                        .catch(
                            () => ({})
                        );

                console.log(
                    "AUTH ME RESPONSE:",
                    result
                );

                // =================================================
                // PROFILE MUST EXIST
                // =================================================

                if (
                    !response.ok ||
                    result.success !== true
                ) {

                    await supabase.auth
                        .signOut();

                    clearLoginData();

                    throw new Error(
                        result.message ||
                        "Unable to verify your account."
                    );
                }

                const user =
                    result.user;

                if (!user) {

                    await supabase.auth
                        .signOut();

                    clearLoginData();

                    throw new Error(
                        "User profile was not returned by server."
                    );
                }

                // =================================================
                // ROLE
                // =================================================

                const role =
                    String(
                        user.role || ""
                    )
                        .trim()
                        .toLowerCase();

                const profileEmail =
                    String(
                        user.email ||
                        authUser.email ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                console.log(
                    "LOGIN USER:",
                    user
                );

                console.log(
                    "LOGIN ROLE:",
                    role
                );

                // =====================================================
                // DEBUG SUPER ADMIN CHECK
                // =====================================================

                console.log("========== SUPER ADMIN CHECK ==========");
                console.log("Profile Email:", profileEmail);
                console.log("Configured Admin Email:", ADMIN_EMAIL);
                console.log("Role:", role);
                console.log(
                    "Email Match:",
                    profileEmail === ADMIN_EMAIL
                );
                console.log("=======================================");

                // =================================================
                // ALLOWED ROLES
                //
                // Super Admin + Normal Admin + Client + Employee
                // are all allowed to continue to OTP.
                // =================================================

                if (
                    role !== "superadmin" &&
                    role !== "admin" &&
                    role !== "client" &&
                    role !== "employee"
                ) {

                    await supabase.auth
                        .signOut();

                    clearLoginData();

                    throw new Error(
                        "Access denied. You are not allowed to login."
                    );
                }

                // =================================================
                // SUPER ADMIN EMAIL CHECK
                // =================================================

                if (
                    role === "superadmin" &&
                    profileEmail !==
                    ADMIN_EMAIL
                ) {

                    await supabase.auth
                        .signOut();

                    clearLoginData();

                    throw new Error(
                        "Access denied. Only the authorized Super Admin can login."
                    );
                }

                // =================================================
                // SEND LOGIN OTP
                // =================================================

                const otpResponse =
                    await fetch(
                        `${API_BASE_URL}/auth/send-login-otp`,
                        {

                            method:
                                "POST",

                            headers: {

                                Authorization:
                                    `Bearer ${session.access_token}`,

                                "Content-Type":
                                    "application/json",
                            },
                        }
                    );

                const otpResult =
                    await otpResponse
                        .json()
                        .catch(
                            () => ({})
                        );

                console.log(
                    "SEND LOGIN OTP RESPONSE:",
                    otpResult
                );

                if (
                    !otpResponse.ok ||
                    otpResult.success !== true
                ) {

                    await supabase.auth
                        .signOut();

                    clearLoginData();

                    throw new Error(
                        otpResult.message ||
                        otpResult.message ||
                        "Unable to send OTP."
                    );
                }

                // =================================================
                // TEMPORARY USER ONLY
                //
                // This is NOT used for authorization.
                // Backend response after OTP is authoritative.
                // =================================================

                localStorage.setItem(
                    "pending_login_user",
                    JSON.stringify(user)
                );

                // =================================================
                // SHOW OTP SCREEN
                // =================================================

                setOtp("");

                setOtpStep(true);

            } catch (err) {

                console.error(
                    "LOGIN ERROR:",
                    err
                );

                console.error(
                    "LOGIN API BASE URL:",
                    API_BASE_URL
                );

                setError(
                    err?.message ||
                    "Unable to login."
                );

            } finally {

                setLoading(false);
            }
        };


    // =====================================================
    // VERIFY OTP
    // =====================================================

    const handleVerifyOtp =
        async (e) => {

            e.preventDefault();

            setError("");
            setOtpLoading(true);

            try {

                // =================================================
                // CLEAN OTP
                // =================================================

                const cleanOtp =
                    otp.trim();

                if (
                    !/^\d{6}$/.test(
                        cleanOtp
                    )
                ) {

                    throw new Error(
                        "Please enter the 6-digit OTP."
                    );
                }

                // =================================================
                // GET CURRENT SUPABASE SESSION
                // =================================================

                const {
                    data: sessionData,
                    error: sessionError,
                } =
                    await supabase.auth
                        .getSession();

                if (sessionError) {

                    throw new Error(
                        sessionError.message ||
                        "Unable to get login session."
                    );
                }

                const session =
                    sessionData?.session;

                if (!session) {

                    throw new Error(
                        "Your login session has expired. Please login again."
                    );
                }

                // =================================================
                // VERIFY OTP WITH BACKEND
                // =================================================

                const response =
                    await fetch(
                        `${API_BASE_URL}/auth/verify-login-otp`,
                        {

                            method:
                                "POST",

                            headers: {

                                Authorization:
                                    `Bearer ${session.access_token}`,

                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    otp:
                                        cleanOtp,
                                }),
                        }
                    );

                const result =
                    await response
                        .json()
                        .catch(
                            () => ({})
                        );

                console.log(
                    "VERIFY OTP RESPONSE:",
                    result
                );

                // =================================================
                // OTP VERIFICATION FAILED
                // =================================================

                if (!response.ok) {

                    throw new Error(
                        result.message ||
                        "OTP verification failed."
                    );
                }

                // =================================================
                // RESPONSE MUST BE SUCCESSFUL
                // =================================================

                if (
                    result.success !== true
                ) {

                    throw new Error(
                        result.message ||
                        "OTP verification failed."
                    );
                }

                // =================================================
                // BACKEND USER PROFILE
                // =================================================

                const authenticatedUser =
                    result.user;

                if (
                    !authenticatedUser
                ) {

                    throw new Error(
                        "Authenticated user profile was not returned by server."
                    );
                }

                console.log(
                    "AUTHENTICATED USER:",
                    authenticatedUser
                );

                // =================================================
                // ROLE FROM BACKEND
                // =================================================

                const role =
                    String(
                        authenticatedUser.role ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                // =================================================
                // ALLOWED ROLE CHECK
                // =================================================

                if (
                    role !== "superadmin" &&
                    role !== "admin" &&
                    role !== "client" &&
                    role !== "employee"
                ) {

                    await supabase.auth
                        .signOut();

                    clearLoginData();

                    throw new Error(
                        "Invalid account role."
                    );
                }

                // =================================================
                // SUPER ADMIN
                // =================================================

                if (
                    role === "superadmin"
                ) {

                    const authenticatedEmail =
                        String(
                            authenticatedUser.email ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    if (
                        authenticatedEmail !==
                        ADMIN_EMAIL
                    ) {

                        await supabase.auth
                            .signOut();

                        clearLoginData();

                        throw new Error(
                            "Access denied. Only the authorized Super Admin can login."
                        );
                    }

                    // ---------------------------------------------
                    // SAVE LOGIN
                    // ---------------------------------------------

                    clearLoginData();

                    localStorage.setItem("access_token", session.access_token);

                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            authenticatedUser
                        )
                    );

                    localStorage.setItem(
                        "company_name",
                        authenticatedUser.company_name ||
                        "Talent Corner"
                    );

                    // ---------------------------------------------
                    // ADMIN DASHBOARD
                    // ---------------------------------------------

                    login(authenticatedUser);

                    navigate(
                        "/admindashboard",
                        {
                            replace: true,
                        }
                    );

                    return;
                }

                // =================================================
                // NORMAL ADMIN
                // =================================================

                if (
                    role === "admin"
                ) {

                    clearLoginData();

                    localStorage.setItem(
                        "access_token",
                        session.access_token
                    );

                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            authenticatedUser
                        )
                    );

                    localStorage.setItem(
                        "company_name",
                        authenticatedUser.company_name ||
                        "Talent Corner"
                    );
                    login(authenticatedUser);
                    navigate(
                        "/admindashboard",
                        {
                            replace: true,
                        }
                    );

                    return;
                }

                // =================================================
                // CLIENT
                // =================================================

                if (
                    role === "client"
                ) {

                    clearLoginData();

                    localStorage.setItem(
                        "access_token",
                        session.access_token
                    );

                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            authenticatedUser
                        )
                    );

                    if (
                        authenticatedUser.client_id
                    ) {

                        localStorage.setItem(
                            "client_id",
                            String(
                                authenticatedUser.client_id
                            )
                        );
                    }

                    if (
                        authenticatedUser.company_name
                    ) {

                        localStorage.setItem(
                            "company_name",
                            authenticatedUser.company_name
                        );
                    }

                    login(authenticatedUser);

                    navigate(
                        "/client-dashboard",
                        {
                            replace: true,
                        }
                    );

                    return;
                }

                // =================================================
                // EMPLOYEE
                // =================================================

                if (
                    role === "employee"
                ) {

                    clearLoginData();

                    localStorage.setItem(
                        "access_token",
                        session.access_token
                    );

                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            authenticatedUser
                        )
                    );

                    if (
                        authenticatedUser.employee_id
                    ) {

                        localStorage.setItem(
                            "employee_id",
                            String(
                                authenticatedUser.employee_id
                            )
                        );
                    }
                    login(authenticatedUser);

                    navigate(
                        "/employee-portal",
                        {
                            replace: true,
                        }
                    );

                    return;
                }

                // =================================================
                // SHOULD NEVER REACH HERE
                // =================================================

                await supabase.auth
                    .signOut();

                clearLoginData();

                throw new Error(
                    "Invalid account role."
                );

            } catch (err) {

                console.error(
                    "OTP VERIFICATION ERROR:",
                    err
                );

                setError(
                    err?.message ||
                    "Unable to verify OTP."
                );

            } finally {

                setOtpLoading(false);
            }
        };


    // =====================================================
    // BACK TO LOGIN
    // =====================================================

    const handleBackToLogin =
        async () => {

            await supabase.auth
                .signOut();

            clearLoginData();

            setOtp("");
            setOtpStep(false);
            setError("");
        };

    // =====================================================
    // UI
    // =====================================================

    return (

        <div className="
                min-h-screen
                flex
                items-center
                justify-center
                bg-gray-100
                px-4
            ">

            <div className="
                    w-full
                    max-w-md
                    bg-white
                    rounded-2xl
                    shadow-lg
                    p-8
                ">

                {/* =================================================
                        HEADER
                    ================================================= */}

                <div className="
                        text-center
                        mb-8
                    ">

                    <h1 className="
                            text-3xl
                            font-bold
                            text-gray-900
                        ">
                        Talent Corner
                    </h1>

                    <p className="
                            text-gray-500
                            mt-2
                        ">
                        {otpStep
                            ? "Verify your email"
                            : "Login to your account"}
                    </p>

                </div>

                {/* =================================================
                        ERROR
                    ================================================= */}

                {error && (

                    <div className="
                            mb-5
                            rounded-lg
                            border
                            border-red-200
                            bg-red-50
                            px-4
                            py-3
                            text-sm
                            text-red-700
                        ">

                        {error}

                    </div>
                )}

                {/* =================================================
                        NORMAL LOGIN
                    ================================================= */}

                {!otpStep ? (

                    <form
                        onSubmit={
                            handleLogin
                        }
                        className="
                                space-y-5
                            "
                    >

                        {/* EMAIL */}

                        <div>

                            <label className="
                                    block
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    mb-2
                                ">
                                Email
                            </label>

                            <input
                                type="email"
                                value={email}
                                onChange={(e) =>
                                    setEmail(
                                        e.target.value
                                    )
                                }
                                placeholder="Enter your email"
                                autoComplete="email"
                                disabled={
                                    loading
                                }
                                className="
                                        w-full
                                        rounded-lg
                                        border
                                        border-gray-300
                                        px-4
                                        py-3
                                        outline-none
                                        focus:border-blue-500
                                        focus:ring-2
                                        focus:ring-blue-100
                                        disabled:bg-gray-100
                                    "
                            />

                        </div>

                        {/* PASSWORD */}

                        <div>

                            <label className="
                                    block
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    mb-2
                                ">
                                Password
                            </label>

                            <input
                                type="password"
                                value={password}
                                onChange={(e) =>
                                    setPassword(
                                        e.target.value
                                    )
                                }
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                disabled={
                                    loading
                                }
                                className="
                                        w-full
                                        rounded-lg
                                        border
                                        border-gray-300
                                        px-4
                                        py-3
                                        outline-none
                                        focus:border-blue-500
                                        focus:ring-2
                                        focus:ring-blue-100
                                        disabled:bg-gray-100
                                    "
                            />

                        </div>

                        {/* LOGIN */}

                        <button
                            type="submit"
                            disabled={
                                loading
                            }
                            className="
                                    w-full
                                    rounded-lg
                                    bg-blue-600
                                    px-4
                                    py-3
                                    font-semibold
                                    text-white
                                    hover:bg-blue-700
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                "
                        >

                            {loading
                                ? "Sending OTP..."
                                : "Login"}

                        </button>

                    </form>

                ) : (

                    /* =================================================
                    OTP
                    ================================================= */

                    <form
                        onSubmit={
                            handleVerifyOtp
                        }
                        className="
                                space-y-5
                            "
                    >

                        <div className="
                                text-center
                            ">

                            <div className="
                                    mx-auto
                                    mb-4
                                    flex
                                    h-14
                                    w-14
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-blue-100
                                    text-blue-600
                                    text-xl
                                    font-bold
                                ">
                                OTP
                            </div>

                            <h2 className="
                                    text-xl
                                    font-semibold
                                    text-gray-900
                                ">
                                Verify Your Email
                            </h2>

                            <p className="
                                    text-sm
                                    text-gray-500
                                    mt-2
                                ">
                                A 6-digit OTP was sent to
                            </p>

                            <p className="
                                    font-medium
                                    text-gray-900
                                    mt-1
                                    break-all
                                ">
                                {email}
                            </p>

                        </div>

                        {/* OTP INPUT */}

                        <div>

                            <label className="
                                    block
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    mb-2
                                ">
                                Enter OTP
                            </label>

                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={otp}
                                onChange={(e) =>
                                    setOtp(
                                        e.target.value
                                            .replace(
                                                /\D/g,
                                                ""
                                            )
                                            .slice(
                                                0,
                                                6
                                            )
                                    )
                                }
                                placeholder="000000"
                                autoFocus
                                disabled={
                                    otpLoading
                                }
                                className="
                                        w-full
                                        rounded-lg
                                        border
                                        border-gray-300
                                        px-4
                                        py-3
                                        text-center
                                        text-2xl
                                        tracking-[0.5em]
                                        outline-none
                                        focus:border-blue-500
                                        focus:ring-2
                                        focus:ring-blue-100
                                        disabled:bg-gray-100
                                    "
                            />

                        </div>

                        {/* VERIFY */}

                        <button
                            type="submit"
                            disabled={
                                otpLoading ||
                                otp.length !== 6
                            }
                            className="
                                    w-full
                                    rounded-lg
                                    bg-blue-600
                                    px-4
                                    py-3
                                    font-semibold
                                    text-white
                                    hover:bg-blue-700
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                "
                        >

                            {otpLoading
                                ? "Verifying..."
                                : "Verify OTP"}

                        </button>

                        {/* BACK */}

                        <button
                            type="button"
                            onClick={
                                handleBackToLogin
                            }
                            disabled={
                                otpLoading
                            }
                            className="
                                    w-full
                                    text-sm
                                    text-gray-500
                                    hover:text-gray-700
                                "
                        >
                            ← Back to Login
                        </button>

                    </form>
                )}

                {/* =================================================
                        SIGNUP
                    ================================================= */}

                {!otpStep && (

                    <div className="
                            mt-6
                            text-center
                        ">

                        <p className="
                                text-sm
                                text-gray-500
                            ">
                            Don't have an account?
                        </p>

                        <div className="
                                flex
                                justify-center
                                gap-4
                                mt-3
                            ">

                            <Link
                                to="/signup/client"
                                className="
                                        text-blue-600
                                        font-medium
                                        hover:underline
                                    "
                            >
                                Client Signup
                            </Link>

                            <span className="
                                    text-gray-300
                                ">
                                |
                            </span>

                            <Link
                                to="/signup/admin"
                                className="
                                        text-blue-600
                                        font-medium
                                        hover:underline
                                    "
                            >
                                Admin Signup
                            </Link>

                        </div>

                    </div>
                )}

            </div>

        </div>
    );
}

export default Login;