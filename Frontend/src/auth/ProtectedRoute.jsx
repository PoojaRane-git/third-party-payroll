import React from "react";
import {
    Navigate,
    Outlet,
    useLocation,
} from "react-router-dom";

import { useAuth } from "./AuthProvider";

export default function ProtectedRoute({
    allowedRoles,
}) {
    const {
        user,
        loading,
    } = useAuth();

    const location = useLocation();

    // ============================================================
    // CHECKING AUTHENTICATION
    // ============================================================

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] text-white">
                <div className="text-center">

                    <div className="text-lg font-semibold">
                        Checking authentication...
                    </div>

                    <div className="text-sm text-slate-400 mt-2">
                        Please wait
                    </div>

                </div>
            </div>
        );
    }

    // ============================================================
    // NOT LOGGED IN
    // ============================================================

    if (!user) {
        return (
            <Navigate
                to="/login"
                replace
                state={{
                    from: location,
                }}
            />
        );
    }

    // ============================================================
    // GET USER ROLE
    // ============================================================

    const userRole = String(
        user?.role ||
        user?.user_role ||
        user?.userRole ||
        ""
    )
        .trim()
        .toLowerCase();

    // ============================================================
    // GET USER STATUS
    // ============================================================

    const userStatus = String(
        user?.status || ""
    )
        .trim()
        .toLowerCase();

    // ============================================================
    // DEBUG LOGS
    // ============================================================

    console.log(
        "================================================"
    );

    console.log(
        "PROTECTED ROUTE:",
        location.pathname
    );

    console.log(
        "USER:",
        user
    );

    console.log(
        "USER ROLE:",
        userRole
    );

    console.log(
        "USER STATUS:",
        userStatus
    );

    console.log(
        "ALLOWED ROLES:",
        allowedRoles
    );

    console.log(
        "================================================"
    );

    // ============================================================
    // ROLE CHECK
    // ============================================================

    if (allowedRoles) {
        const normalizedAllowedRoles =
            allowedRoles.map((role) =>
                String(role)
                    .trim()
                    .toLowerCase()
            );

        if (
            !normalizedAllowedRoles.includes(
                userRole
            )
        ) {
            console.warn(
                `Access denied: ${userRole} cannot access ${location.pathname}`
            );

            return (
                <Navigate
                    to="/unauthorized"
                    replace
                    state={{
                        from: location,
                        reason: "ROLE_NOT_ALLOWED",
                        message:
                            "You do not have permission to access this resource.",
                    }}
                />
            );
        }
    }

    // ============================================================
    // APPROVAL CHECK
    //
    // Client / Employee / Admin require
    // Super Admin approval before accessing dashboard.
    //
    // Superadmin does NOT go through this check.
    // ============================================================

    const approvalRequiredRoles = [
        "client",
        "employee",
        "admin",
    ];

    if (
        approvalRequiredRoles.includes(
            userRole
        )
    ) {

        // ========================================================
        // PENDING APPROVAL
        // ========================================================

        if (userStatus === "pending") {

            console.warn(
                `Account pending approval: ${userRole}`
            );

            return (
                <Navigate
                    to="/unauthorized"
                    replace
                    state={{
                        from: location,
                        reason: "PENDING_APPROVAL",
                        message:
                            "Your account is waiting for Super Admin approval.",
                    }}
                />
            );
        }

        // ========================================================
        // REJECTED / DISABLED
        // ========================================================

        if (
            userStatus === "rejected" ||
            userStatus === "disabled"
        ) {

            console.warn(
                `Inactive account: ${userRole} - ${userStatus}`
            );

            return (
                <Navigate
                    to="/unauthorized"
                    replace
                    state={{
                        from: location,
                        reason: "ACCOUNT_INACTIVE",
                        message:
                            "Your account is not active. Please contact the administrator.",
                    }}
                />
            );
        }

        // ========================================================
        // ADMIN
        // ========================================================

        if (userRole === "admin") {

            if (
                ![
                    "active",
                    "approved",
                ].includes(userStatus)
            ) {

                console.warn(
                    `Admin account is not active: ${userStatus}`
                );

                return (
                    <Navigate
                        to="/unauthorized"
                        replace
                        state={{
                            from: location,
                            reason: "ACCOUNT_INACTIVE",
                            message:
                                "Your admin account is not active.",
                        }}
                    />
                );
            }
        }

        // ========================================================
        // CLIENT
        // ========================================================

        if (userRole === "client") {

            if (
                userStatus !== "active"
            ) {

                console.warn(
                    `Client account is not active: ${userStatus}`
                );

                return (
                    <Navigate
                        to="/unauthorized"
                        replace
                        state={{
                            from: location,
                            reason: "ACCOUNT_INACTIVE",
                            message:
                                "Your client account is not active.",
                        }}
                    />
                );
            }
        }

        // ========================================================
        // EMPLOYEE
        // ========================================================

        if (userRole === "employee") {

            if (
                userStatus !== "active"
            ) {

                console.warn(
                    `Employee account is not active: ${userStatus}`
                );

                return (
                    <Navigate
                        to="/unauthorized"
                        replace
                        state={{
                            from: location,
                            reason: "ACCOUNT_INACTIVE",
                            message:
                                "Your employee account is not active.",
                        }}
                    />
                );
            }
        }
    }

    // ============================================================
    // SUPERADMIN CHECK
    // ============================================================

    if (userRole === "superadmin") {

        if (
            userStatus &&
            ![
                "active",
                "approved",
            ].includes(userStatus)
        ) {

            console.warn(
                `Superadmin account is not active: ${userStatus}`
            );

            return (
                <Navigate
                    to="/unauthorized"
                    replace
                    state={{
                        from: location,
                        reason: "ACCOUNT_INACTIVE",
                        message:
                            "Super Admin account is not active.",
                    }}
                />
            );
        }
    }

    // ============================================================
    // AUTHORIZED
    // ============================================================

    console.log(
        `✅ Access granted: ${userRole} → ${location.pathname}`
    );

    return <Outlet />;
}