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
    // CHECKING AUTH
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

    const userRole =
        user?.role ||
        user?.user_role ||
        user?.userRole;

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
        "ALLOWED ROLES:",
        allowedRoles
    );

    // ============================================================
    // ROLE CHECK
    // ============================================================

    if (
        allowedRoles &&
        !allowedRoles.includes(userRole)
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
                }}
            />
        );
    }

    // ============================================================
    // AUTHORIZED
    // ============================================================

    return <Outlet />;
}