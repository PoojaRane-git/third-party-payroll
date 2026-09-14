
import React, {
    useState,
    useEffect,
} from "react";

import {
    useNavigate,
    Link,
} from "react-router-dom";

import {
    Loader2,
} from "lucide-react";

import {
    supabase,
} from "../../../lib/supabaseClient";

import {
    useAuth,
} from "../../../auth/AuthProvider";

// =====================================================
// API BASE URL
// =====================================================

const API_BASE_URL = String(
    import.meta.env.VITE_API_BASE_URL ||
        (
            import.meta.env.PROD
                ? "/api"
                : "http://localhost:5000/api"
        )
).replace(/\/+$/, "");

// =====================================================
// AUTHORIZED SUPER ADMIN
// =====================================================

const ADMIN_EMAIL = String(
    import.meta.env.VITE_ADMIN_EMAIL || ""
)
    .trim()
    .toLowerCase();

function Login() {
    const navigate = useNavigate();

    const {
        login,
    } = useAuth();

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
    // SHOW PASSWORD
    // =====================================================

    const [
        showPassword,
        setShowPassword,
    ] = useState(false);

    // =====================================================
    // KEEP LOGIN
    // =====================================================

    const [
        rememberMe,
        setRememberMe,
    ] = useState(true);

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
    // LOGIN APPROVAL STATE
    // =====================================================

    const [
        waitingForApproval,
        setWaitingForApproval,
    ] = useState(false);

    const [
        pendingLoginRequestId,
        setPendingLoginRequestId,
    ] = useState(null);

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

        localStorage.removeItem(
            "pending_approval"
        );
    };

    // =====================================================
    // SAVE AUTHENTICATED USER
    // =====================================================

    const saveAuthenticatedUser = (
        authenticatedUser,
        accessToken
    ) => {
        if (!authenticatedUser) {
            return;
        }

        // -------------------------------------------------
        // ACCESS TOKEN
        // -------------------------------------------------

        if (accessToken) {
            localStorage.setItem(
                "access_token",
                accessToken
            );
        }

        // -------------------------------------------------
        // USER
        // -------------------------------------------------

        localStorage.setItem(
            "user",
            JSON.stringify(
                authenticatedUser
            )
        );

        // -------------------------------------------------
        // COMPANY
        // -------------------------------------------------

        localStorage.setItem(
            "company_name",
            authenticatedUser.company_name ||
                "Talent Corner"
        );

        // -------------------------------------------------
        // CLIENT ID
        // -------------------------------------------------

        if (
            authenticatedUser.client_id
        ) {
            localStorage.setItem(
                "client_id",
                String(
                    authenticatedUser.client_id
                )
            );
        } else {
            localStorage.removeItem(
                "client_id"
            );
        }

        // -------------------------------------------------
        // EMPLOYEE ID
        // -------------------------------------------------

        if (
            authenticatedUser.employee_id
        ) {
            localStorage.setItem(
                "employee_id",
                String(
                    authenticatedUser.employee_id
                )
            );
        } else {
            localStorage.removeItem(
                "employee_id"
            );
        }

        // -------------------------------------------------
        // AUTH PROVIDER
        // -------------------------------------------------

        login(
            authenticatedUser
        );
    };

    // =====================================================
    // REDIRECT USER BASED ON ROLE
    // =====================================================

    const redirectBasedOnRole = (
        authenticatedUser
    ) => {
        const role = String(
            authenticatedUser?.role || ""
        )
            .trim()
            .toLowerCase();

        if (
            role === "superadmin" ||
            role === "admin"
        ) {
            navigate(
                "/admindashboard",
                {
                    replace: true,
                }
            );

            return;
        }

        if (
            role === "client"
        ) {
            navigate(
                "/client-dashboard",
                {
                    replace: true,
                }
            );

            return;
        }

        if (
            role === "employee"
        ) {
            navigate(
                "/employee-portal",
                {
                    replace: true,
                }
            );

            return;
        }

        throw new Error(
            "Invalid account role."
        );
    };

    // =====================================================
    // RECORD SUCCESSFUL LOGIN
    // =====================================================

    const recordLoginLog = async (
        accessToken
    ) => {
        try {
            if (!accessToken) {
                console.warn(
                    "LOGIN LOG SKIPPED: No access token."
                );

                return false;
            }

            const response =
                await fetch(
                    `${API_BASE_URL}/auth/login-log`,
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${accessToken}`,

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

            if (
                !response.ok ||
                result.success !== true
            ) {
                console.error(
                    "LOGIN LOG FAILED:",
                    result
                );

                return false;
            }

            console.log(
                "LOGIN LOG CREATED:",
                result
            );

            return true;

        } catch (error) {
            console.error(
                "LOGIN LOG ERROR:",
                error
            );

            return false;
        }
    };

    // =====================================================
    // LOGIN
    // =====================================================

    const handleLogin = async (
        e
    ) => {
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
                        method: "GET",

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

            // =================================================
            // LOGIN REQUEST PENDING APPROVAL
            // =================================================

            if (
                result.login_pending_approval
            ) {
                console.log(
                    "LOGIN REQUEST IS WAITING FOR ADMIN APPROVAL"
                );

                setOtpStep(false);

                setPendingLoginRequestId(
                    result.login_request_id
                );

                setWaitingForApproval(
                    true
                );

                return;
            }

            // =================================================
            // PROFILE CHECK
            // =================================================

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

            // =================================================
            // STATUS
            // =================================================

            const status =
                String(
                    user.status || ""
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

            console.log(
                "LOGIN STATUS:",
                status
            );

            // =================================================
            // SUPER ADMIN DEBUG
            // =================================================

            console.log(
                "========== SUPER ADMIN CHECK =========="
            );

            console.log(
                "Profile Email:",
                profileEmail
            );

            console.log(
                "Configured Admin Email:",
                ADMIN_EMAIL
            );

            console.log(
                "Role:",
                role
            );

            console.log(
                "Status:",
                status
            );

            console.log(
                "Email Match:",
                profileEmail ===
                    ADMIN_EMAIL
            );

            console.log(
                "======================================="
            );

            // =================================================
            // ALLOWED ROLES
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
                profileEmail !== ADMIN_EMAIL
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
                        method: "POST",

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
                        "Unable to send OTP."
                );
            }

            // =================================================
            // TEMPORARY USER
            // =================================================

            localStorage.setItem(
                "pending_login_user",
                JSON.stringify(
                    user
                )
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
        async (
            e
        ) => {
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
                // CURRENT SESSION
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
                // VERIFY OTP
                // =================================================

                const response =
                    await fetch(
                        `${API_BASE_URL}/auth/verify-login-otp`,
                        {
                            method: "POST",

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
                // OTP FAILED
                // =================================================

                if (
                    !response.ok ||
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
                // ROLE
                // =================================================

                const role =
                    String(
                        authenticatedUser.role ||
                            ""
                    )
                        .trim()
                        .toLowerCase();

                // =================================================
                // STATUS
                // =================================================

                const status =
                    String(
                        authenticatedUser.status ||
                            ""
                    )
                        .trim()
                        .toLowerCase();

                console.log(
                    "AUTHENTICATED ROLE:",
                    role
                );

                console.log(
                    "AUTHENTICATED STATUS:",
                    status
                );

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
                }

                // =================================================
                // APPROVAL CHECK
                //
                // CLIENT / EMPLOYEE / ADMIN
                // MUST BE APPROVED BY SUPER ADMIN
                //
                // Pending users can complete:
                //
                // Password → OTP
                //
                // But they CANNOT enter dashboard.
                // =================================================

                if (
                    (
                        role === "client" ||
                        role === "employee" ||
                        role === "admin"
                    ) &&
                    status === "pending"
                ) {
                    console.log(
                        "⏳ ACCOUNT PENDING SUPER ADMIN APPROVAL"
                    );

                    // -------------------------------------------------
                    // Save user
                    // -------------------------------------------------

                    login(
                        authenticatedUser
                    );

                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            authenticatedUser
                        )
                    );

                    localStorage.setItem(
                        "access_token",
                        session.access_token
                    );

                    localStorage.setItem(
                        "pending_approval",
                        "true"
                    );

                    // -------------------------------------------------
                    // Record login
                    // -------------------------------------------------

                    const loginLogged =
                        await recordLoginLog(
                            session.access_token
                        );

                    if (!loginLogged) {
                        console.warn(
                            "Pending account login could not be recorded."
                        );
                    }

                    // -------------------------------------------------
                    // GO TO APPROVAL PAGE
                    // -------------------------------------------------

                    navigate(
                        "/unauthorized",
                        {
                            replace: true,

                            state: {
                                reason:
                                    "PENDING_APPROVAL",

                                message:
                                    `Your ${role} account is waiting for Super Admin approval.`,
                            },
                        }
                    );

                    return;
                }

                // =================================================
                // REJECTED / DISABLED
                // =================================================

                if (
                    (
                        role === "client" ||
                        role === "employee" ||
                        role === "admin"
                    ) &&
                    (
                        status === "rejected" ||
                        status === "disabled"
                    )
                ) {
                    console.log(
                        "❌ ACCOUNT REJECTED / DISABLED"
                    );

                    login(
                        authenticatedUser
                    );

                    localStorage.setItem(
                        "user",
                        JSON.stringify(
                            authenticatedUser
                        )
                    );

                    localStorage.setItem(
                        "access_token",
                        session.access_token
                    );

                    navigate(
                        "/unauthorized",
                        {
                            replace: true,

                            state: {
                                reason:
                                    "ACCOUNT_INACTIVE",

                                message:
                                    `Your ${role} account is ${status}. Please contact the administrator.`,
                            },
                        }
                    );

                    return;
                }

                // =================================================
                // CLEAR OLD APPLICATION DATA
                // =================================================

                clearLoginData();

                // =================================================
                // REMOVE PENDING FLAG
                // =================================================

                localStorage.removeItem(
                    "pending_approval"
                );

                // =================================================
                // SAVE CURRENT SESSION
                // =================================================

                saveAuthenticatedUser(
                    authenticatedUser,
                    session.access_token
                );

                // =================================================
                // RECORD SUCCESSFUL LOGIN
                // =================================================

                const loginLogged =
                    await recordLoginLog(
                        session.access_token
                    );

                if (!loginLogged) {
                    console.warn(
                        "Login succeeded, but login activity could not be recorded."
                    );
                }

                // =================================================
                // REDIRECT
                // =================================================

                redirectBasedOnRole(
                    authenticatedUser
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
    // POLL LOGIN REQUEST APPROVAL
    // =====================================================

    useEffect(() => {
        if (
            !waitingForApproval ||
            !pendingLoginRequestId
        ) {
            return;
        }

        console.log(
            "STARTING LOGIN APPROVAL POLLING:",
            pendingLoginRequestId
        );

        const checkApprovalStatus =
            async () => {
                try {
                    // -------------------------------------------------
                    // CURRENT SUPABASE SESSION
                    // -------------------------------------------------

                    const {
                        data: sessionData,
                    } =
                        await supabase.auth
                            .getSession();

                    const session =
                        sessionData?.session;

                    if (!session) {
                        console.warn(
                            "No Supabase session while checking approval."
                        );

                        return;
                    }

                    // -------------------------------------------------
                    // CHECK LOGIN REQUEST
                    // -------------------------------------------------

                    const res =
                        await fetch(
                            `${API_BASE_URL}/auth/login-requests/${pendingLoginRequestId}/status`,
                            {
                                method: "GET",

                                headers: {
                                    Authorization:
                                        `Bearer ${session.access_token}`,

                                    "Content-Type":
                                        "application/json",
                                },
                            }
                        );

                    const result =
                        await res
                            .json()
                            .catch(
                                () => ({})
                            );

                    console.log(
                        "LOGIN REQUEST STATUS:",
                        result
                    );

                    // -------------------------------------------------
                    // API ERROR
                    // -------------------------------------------------

                    if (!res.ok) {
                        console.error(
                            "LOGIN REQUEST STATUS API ERROR:",
                            result
                        );

                        return;
                    }

                    // -------------------------------------------------
                    // APPROVED
                    // -------------------------------------------------

                    if (
                        result.status ===
                        "approved"
                    ) {
                        console.log(
                            "✅ LOGIN REQUEST APPROVED"
                        );

                        setWaitingForApproval(
                            false
                        );

                        setPendingLoginRequestId(
                            null
                        );

                        // -------------------------------------------------
                        // Get latest profile
                        // -------------------------------------------------

                        const meRes =
                            await fetch(
                                `${API_BASE_URL}/auth/me`,
                                {
                                    method: "GET",

                                    headers: {
                                        Authorization:
                                            `Bearer ${session.access_token}`,

                                        "Content-Type":
                                            "application/json",
                                    },
                                }
                            );

                        const meResult =
                            await meRes
                                .json()
                                .catch(
                                    () => ({})
                                );

                        console.log(
                            "APPROVED USER PROFILE:",
                            meResult
                        );

                        if (
                            !meRes.ok ||
                            meResult.success !== true ||
                            !meResult.user
                        ) {
                            throw new Error(
                                meResult.message ||
                                    "Unable to retrieve approved user profile."
                            );
                        }

                        const approvedUser =
                            meResult.user;

                        // -------------------------------------------------
                        // Check role
                        // -------------------------------------------------

                        const approvedRole =
                            String(
                                approvedUser.role ||
                                    ""
                            )
                                .trim()
                                .toLowerCase();

                        // -------------------------------------------------
                        // Super Admin check
                        // -------------------------------------------------

                        if (
                            approvedRole ===
                            "superadmin"
                        ) {
                            const approvedEmail =
                                String(
                                    approvedUser.email ||
                                        ""
                                )
                                    .trim()
                                    .toLowerCase();

                            if (
                                approvedEmail !==
                                ADMIN_EMAIL
                            ) {
                                await supabase.auth
                                    .signOut();

                                clearLoginData();

                                throw new Error(
                                    "Access denied. Only the authorized Super Admin can login."
                                );
                            }
                        }

                        // -------------------------------------------------
                        // Save authenticated user
                        // -------------------------------------------------

                        clearLoginData();

                        localStorage.removeItem(
                            "pending_approval"
                        );

                        saveAuthenticatedUser(
                            approvedUser,
                            session.access_token
                        );

                        // -------------------------------------------------
                        // Record login
                        // -------------------------------------------------

                        const loginLogged =
                            await recordLoginLog(
                                session.access_token
                            );

                        if (!loginLogged) {
                            console.warn(
                                "Approved login succeeded, but login activity could not be recorded."
                            );
                        }

                        // -------------------------------------------------
                        // Redirect
                        // -------------------------------------------------

                        redirectBasedOnRole(
                            approvedUser
                        );

                        return;
                    }

                    // -------------------------------------------------
                    // REJECTED
                    // -------------------------------------------------

                    if (
                        result.status ===
                        "rejected"
                    ) {
                        console.log(
                            "❌ LOGIN REQUEST REJECTED"
                        );

                        setWaitingForApproval(
                            false
                        );

                        setPendingLoginRequestId(
                            null
                        );

                        setError(
                            "Your login request was rejected by the administrator."
                        );

                        await supabase.auth
                            .signOut();

                        clearLoginData();

                        return;
                    }

                    // -------------------------------------------------
                    // EXPIRED
                    // -------------------------------------------------

                    if (
                        result.status ===
                        "expired"
                    ) {
                        console.log(
                            "⌛ LOGIN REQUEST EXPIRED"
                        );

                        setWaitingForApproval(
                            false
                        );

                        setPendingLoginRequestId(
                            null
                        );

                        setError(
                            "Login request expired. Please try again."
                        );

                        await supabase.auth
                            .signOut();

                        clearLoginData();

                        return;
                    }

                } catch (pollError) {
                    console.error(
                        "LOGIN APPROVAL POLLING ERROR:",
                        pollError
                    );
                }
            };

        // Check immediately
        checkApprovalStatus();

        // Then every 4 seconds
        const interval =
            setInterval(
                checkApprovalStatus,
                4000
            );

        return () => {
            clearInterval(
                interval
            );
        };

    }, [
        waitingForApproval,
        pendingLoginRequestId,
    ]);

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

            setWaitingForApproval(
                false
            );

            setPendingLoginRequestId(
                null
            );

            setError("");
        };

    // =====================================================
    // UI
    // =====================================================

    return (
        <div
            className="
                min-h-screen
                flex
                items-center
                justify-center
                bg-gray-100
                px-4
            "
        >
            <div
                className="
                    w-full
                    max-w-md
                    bg-white
                    rounded-2xl
                    shadow-lg
                    p-8
                "
            >

                {/* =================================================
                    HEADER
                ================================================= */}

                <div
                    className="
                        text-center
                        mb-8
                    "
                >
                    <h1
                        className="
                            text-3xl
                            font-bold
                            text-gray-900
                        "
                    >
                        Talent Corner
                    </h1>

                    <p
                        className="
                            text-gray-500
                            mt-2
                        "
                    >
                        {waitingForApproval
                            ? "Login request pending"
                            : otpStep
                                ? "Verify your email"
                                : "Login to your account"}
                    </p>
                </div>

                {/* =================================================
                    ERROR
                ================================================= */}

                {error && (
                    <div
                        className="
                            mb-5
                            rounded-lg
                            border
                            border-red-200
                            bg-red-50
                            px-4
                            py-3
                            text-sm
                            text-red-700
                        "
                    >
                        {error}
                    </div>
                )}

                {/* =================================================
                    WAITING FOR APPROVAL
                ================================================= */}

                {waitingForApproval ? (
                    <div
                        className="
                            text-center
                            space-y-5
                            py-6
                        "
                    >
                        <div
                            className="
                                flex
                                justify-center
                            "
                        >
                            <Loader2
                                className="
                                    h-12
                                    w-12
                                    text-blue-600
                                    animate-spin
                                "
                            />
                        </div>

                        <div>
                            <h2
                                className="
                                    text-xl
                                    font-semibold
                                    text-gray-900
                                "
                            >
                                Waiting for Approval
                            </h2>

                            <p
                                className="
                                    text-sm
                                    text-gray-500
                                    mt-2
                                "
                            >
                                Your login request has been
                                sent to the administrator.
                            </p>

                            <p
                                className="
                                    text-sm
                                    text-gray-500
                                    mt-1
                                "
                            >
                                This page will automatically
                                continue when your request
                                is approved.
                            </p>
                        </div>

                        <div
                            className="
                                rounded-lg
                                bg-blue-50
                                px-4
                                py-3
                                text-sm
                                text-blue-700
                            "
                        >
                            Checking approval status...
                        </div>

                        <button
                            type="button"
                            onClick={
                                handleBackToLogin
                            }
                            className="
                                w-full
                                rounded-lg
                                border
                                border-gray-300
                                px-4
                                py-3
                                text-sm
                                font-medium
                                text-gray-700
                                hover:bg-gray-50
                            "
                        >
                            ← Cancel & Back to Login
                        </button>
                    </div>

                ) : !otpStep ? (

                    /* =================================================
                       NORMAL LOGIN
                    ================================================= */

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
                            <label
                                className="
                                    block
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    mb-2
                                "
                            >
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
                            <label
                                className="
                                    block
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    mb-2
                                "
                            >
                                Password
                            </label>

                            <div className="relative">

                                <input
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    value={
                                        password
                                    }
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
                                        pr-20
                                        outline-none
                                        focus:border-blue-500
                                        focus:ring-2
                                        focus:ring-blue-100
                                        disabled:bg-gray-100
                                    "
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword(
                                            (prev) =>
                                                !prev
                                        )
                                    }
                                    disabled={
                                        loading
                                    }
                                    className="
                                        absolute
                                        right-3
                                        top-1/2
                                        -translate-y-1/2
                                        text-sm
                                        font-medium
                                        text-blue-600
                                        hover:text-blue-700
                                    "
                                >
                                    {showPassword
                                        ? "Hide"
                                        : "Show"}
                                </button>
                            </div>
                        </div>

                        {/* KEEP ME LOGGED IN */}

                        <div
                            className="
                                flex
                                items-center
                            "
                        >
                            <input
                                id="rememberMe"
                                type="checkbox"
                                checked={
                                    rememberMe
                                }
                                onChange={(e) =>
                                    setRememberMe(
                                        e.target.checked
                                    )
                                }
                                className="
                                    h-4
                                    w-4
                                    rounded
                                    border-gray-300
                                    text-blue-600
                                    focus:ring-blue-500
                                "
                            />

                            <label
                                htmlFor="rememberMe"
                                className="
                                    ml-2
                                    text-sm
                                    text-gray-600
                                "
                            >
                                Keep me logged in
                            </label>
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

                        <div
                            className="
                                text-center
                            "
                        >
                            <div
                                className="
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
                                "
                            >
                                OTP
                            </div>

                            <h2
                                className="
                                    text-xl
                                    font-semibold
                                    text-gray-900
                                "
                            >
                                Verify Your Email
                            </h2>

                            <p
                                className="
                                    text-sm
                                    text-gray-500
                                    mt-2
                                "
                            >
                                A 6-digit OTP was sent to
                            </p>

                            <p
                                className="
                                    font-medium
                                    text-gray-900
                                    mt-1
                                    break-all
                                "
                            >
                                {email}
                            </p>
                        </div>

                        {/* OTP INPUT */}

                        <div>
                            <label
                                className="
                                    block
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    mb-2
                                "
                            >
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

                {!otpStep &&
                    !waitingForApproval && (
                        <div
                            className="
                                mt-6
                                text-center
                            "
                        >
                            <p
                                className="
                                    text-sm
                                    text-gray-500
                                "
                            >
                                Don't have an account?
                            </p>

                            <div
                                className="
                                    flex
                                    justify-center
                                    gap-4
                                    mt-3
                                "
                            >
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

                                <span
                                    className="
                                        text-gray-300
                                    "
                                >
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
