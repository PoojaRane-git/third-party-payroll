    const supabaseAdmin = require("../config/supabaseAdmin");

    const SUPER_ADMIN_EMAIL = "talentcorner103@gmail.com";

    const authorize = (...allowedRoles) => {
        return async (req, res, next) => {
            try {
                if (!req.user || !req.user.id) {
                    return res.status(401).json({
                        success: false,
                        message: "User is not authenticated.",
                    });
                }

                const userId = req.user.id;

                let profile = null;
                let role = null;

                // ====================================================
                // ADMIN / SUPER ADMIN
                // third_party_users
                // ====================================================

                const {
                    data: adminUser,
                    error: adminError,
                } = await supabaseAdmin
                    .from("third_party_users")
                    .select(`
                        id,
                        email,
                        company_name,
                        role,
                        status,
                        is_active,
                        auth_user_id,
                        client_id
                    `)
                    .eq("auth_user_id", userId)
                    .in("role", ["admin", "superadmin"])
                    .maybeSingle();

                if (adminError) {
                    console.error(
                        "Admin profile lookup error:",
                        adminError
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to verify admin profile.",
                    });
                }

                if (adminUser) {
                    profile = adminUser;

                    role = String(
                        adminUser.role || ""
                    )
                        .trim()
                        .toLowerCase();
                }

                // ====================================================
                // CLIENT
                // client_users
                // ====================================================

                if (!profile) {
                    const {
                        data: clientUser,
                        error: clientError,
                    } = await supabaseAdmin
                        .from("client_users")
                        .select(`
                            id,
                            user_id,
                            client_id,
                            name,
                            email,
                            role,
                            status
                        `)
                        .eq("user_id", userId)
                        .eq("role", "client")
                        .maybeSingle();

                    if (clientError) {
                        console.error(
                            "Client profile lookup error:",
                            clientError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                "Unable to verify client profile.",
                        });
                    }

                    if (clientUser) {
                        profile = clientUser;
                        role = "client";
                    }
                }

                // ====================================================
                // EMPLOYEE
                // employee_users
                // ====================================================

                if (!profile) {
                    const {
                        data: employeeUser,
                        error: employeeError,
                    } = await supabaseAdmin
                        .from("employee_users")
                        .select(`
                            id,
                            user_id,
                            employee_id,
                            name,
                            email,
                            role,
                            status
                        `)
                        .eq("user_id", userId)
                        .eq("role", "employee")
                        .maybeSingle();

                    if (employeeError) {
                        console.error(
                            "Employee profile lookup error:",
                            employeeError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                "Unable to verify employee profile.",
                        });
                    }

                    if (employeeUser) {
                        profile = employeeUser;
                        role = "employee";
                    }
                }

                // ====================================================
                // PROFILE NOT FOUND
                // ====================================================

                if (!profile) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "User profile was not found.",
                    });
                }

                // ====================================================
                // ROLE CHECK
                //
                // authorize("admin")
                // allows:
                //     admin
                //     superadmin
                //
                // Super Admin can perform admin-level actions.
                // ====================================================

                const hasPermission =
                    allowedRoles.includes(role) ||
                    (
                        role === "superadmin" &&
                        allowedRoles.includes("admin")
                    );

                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "You do not have permission to access this resource.",
                    });
                }

                // ====================================================
                // SUPER ADMIN STATUS
                //
                // Only the fixed Super Admin email is allowed.
                // Super Admin does not require normal admin approval.
                // ====================================================

                if (role === "superadmin") {
                    const superAdminEmail = String(
                        profile.email || ""
                    )
                        .trim()
                        .toLowerCase();

                    if (
                        superAdminEmail !==
                        SUPER_ADMIN_EMAIL
                    ) {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Only the authorized Super Admin can access this resource.",
                        });
                    }

                    if (
                        profile.is_active !== true
                    ) {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Super Admin account is inactive.",
                        });
                    }
                }

                // ====================================================
                // ADMIN STATUS
                // ====================================================

                if (role === "admin") {
                    const status = String(
                        profile.status || ""
                    ).toLowerCase();

                    if (status === "pending") {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your admin account is waiting for approval.",
                        });
                    }

                    if (status === "rejected") {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your admin registration was rejected.",
                        });
                    }

                    if (
                        !["active", "approved"].includes(
                            status
                        ) ||
                        profile.is_active !== true
                    ) {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your admin account is not active.",
                        });
                    }
                }

                // ====================================================
                // CLIENT STATUS
                // ====================================================

                if (role === "client") {
                    const status = String(
                        profile.status || ""
                    ).toLowerCase();

                    if (status === "pending") {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your client account is waiting for administrator approval.",
                        });
                    }

                    if (
                        status === "rejected" ||
                        status === "disabled"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your client account is not active.",
                        });
                    }

                    if (status !== "active") {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your client account is not active.",
                        });
                    }
                }

                // ====================================================
                // EMPLOYEE STATUS
                // ====================================================

                if (role === "employee") {
                    const status = String(
                        profile.status || ""
                    ).toLowerCase();

                    if (status === "pending") {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your employee account is waiting for administrator approval.",
                        });
                    }

                    if (
                        status === "rejected" ||
                        status === "disabled"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your employee account is not active.",
                        });
                    }

                    if (status !== "active") {
                        return res.status(403).json({
                            success: false,
                            message:
                                "Your employee account is not active.",
                        });
                    }
                }

                // ====================================================
                // SAVE PROFILE
                // ====================================================

                req.profile = profile;
                req.userRole = role;

                next();
            } catch (error) {
                console.error(
                    "Authorization middleware error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Authorization failed.",
                    error: error.message,
                });
            }
        };
    };

    module.exports = authorize;