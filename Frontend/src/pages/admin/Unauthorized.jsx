
import React from "react";
import {
    useLocation,
    useNavigate,
} from "react-router-dom";

export default function Unauthorized() {
    const navigate = useNavigate();
    const location = useLocation();

    const reason = location.state?.reason || "";
    const message = location.state?.message || "";

    // ============================================================
    // PENDING APPROVAL
    // ============================================================

    const isPending =
        reason === "PENDING_APPROVAL";

    // ============================================================
    // ACCOUNT INACTIVE
    // ============================================================

    const isInactive =
        reason === "ACCOUNT_INACTIVE";

    // ============================================================
    // ROLE NOT ALLOWED
    // ============================================================

    const isRoleDenied =
        reason === "ROLE_NOT_ALLOWED";

    // ============================================================
    // CONTENT
    // ============================================================

    let title = "Access Denied";
    let description =
        "You don't have permission to access this page.";

    let statusText = "403";

    if (isPending) {
        statusText = "⏳";
        title = "Waiting for Approval";
        description =
            message ||
            "Your account is waiting for Super Admin approval.";
    }

    if (isInactive) {
        statusText = "403";
        title = "Account Not Active";
        description =
            message ||
            "Your account is not active. Please contact the administrator.";
    }

    if (isRoleDenied) {
        statusText = "403";
        title = "Access Denied";
        description =
            message ||
            "You don't have permission to access this page.";
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">

            <div className="text-center max-w-md">

                {/* ====================================================
                    STATUS ICON / CODE
                ==================================================== */}

                <div
                    className={`text-7xl font-bold ${
                        isPending
                            ? "text-amber-500"
                            : "text-red-500"
                    }`}
                >
                    {statusText}
                </div>

                {/* ====================================================
                    TITLE
                ==================================================== */}

                <h1 className="mt-4 text-3xl font-bold text-slate-900">
                    {title}
                </h1>

                {/* ====================================================
                    DESCRIPTION
                ==================================================== */}

                <p className="mt-3 text-slate-500 leading-6">
                    {description}
                </p>

                {/* ====================================================
                    PENDING INFORMATION
                ==================================================== */}

                {isPending && (
                    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-left">

                        <p className="text-sm font-semibold text-amber-800">
                            Approval Required
                        </p>

                        <p className="mt-1 text-sm text-amber-700">
                            Your registration was successful.
                            Once the Super Admin approves your
                            account, you can log in and access
                            your dashboard.
                        </p>

                    </div>
                )}

                {/* ====================================================
                    LOGIN BUTTON
                ==================================================== */}

                <button
                    onClick={() =>
                        navigate("/login", {
                            replace: true,
                        })
                    }
                    className="mt-6 rounded-lg bg-slate-900 px-6 py-3 text-white hover:bg-slate-800 transition"
                >
                    Go to Login
                </button>

            </div>

        </div>
    );
}

