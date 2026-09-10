const supabaseAdmin = require("../config/supabaseAdmin");

const SUPER_ADMIN_EMAIL = "talentcorner103@gmail.com";

const authorize = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            // ====================================================
            // 1. AUTHENTICATION CHECK
            // ====================================================

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
            // 2. ADMIN / SUPER ADMIN
            //
            // admin_users
            //     ↓
            // auth.users
            //
            // user_id = auth.users.id
            // ====================================================

            const {
                data: adminUser,
                error: adminError,
            } = await supabaseAdmin
                .from("admin_users")
                .select(`
                    user_id,
                    role,
                    status
                `)
                .eq("user_id", userId)
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
                    error: adminError.message,
                });
            }

            if (adminUser) {
                profile = adminUser;

                const rawRole = String(
                    adminUser.role || ""
                )
                    .trim()
                    .toLowerCase();

                // Normalize super_admin → superadmin
                if (
                    rawRole === "super_admin" ||
                    rawRole === "superadmin"
                ) {
                    role = "superadmin";
                } else {
                    role = rawRole;
                }
            }

            // ====================================================
            // 3. FALLBACK ADMIN PROFILE
            //
            // Some existing admin accounts may still be stored
            // inside third_party_users.
            // ====================================================

            if (!profile) {
                const {
                    data: thirdPartyAdmin,
                    error: thirdPartyAdminError,
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
                    .in("role", [
                        "admin",
                        "superadmin",
                        "super_admin",
                    ])
                    .maybeSingle();

                if (thirdPartyAdminError) {
                    console.error(
                        "Third-party admin lookup error:",
                        thirdPartyAdminError
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to verify admin profile.",
                        error:
                            thirdPartyAdminError.message,
                    });
                }

                if (thirdPartyAdmin) {
                    profile = thirdPartyAdmin;

                    const rawRole = String(
                        thirdPartyAdmin.role || ""
                    )
                        .trim()
                        .toLowerCase();

                    if (
                        rawRole === "super_admin" ||
                        rawRole === "superadmin"
                    ) {
                        role = "superadmin";
                    } else {
                        role = rawRole;
                    }
                }
            }

            // ====================================================
            // 4. CLIENT
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
                        error: clientError.message,
                    });
                }

                if (clientUser) {
                    profile = clientUser;
                    role = "client";
                }
            }

            // ====================================================
            // 5. EMPLOYEE
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
                        error: employeeError.message,
                    });
                }

                if (employeeUser) {
                    profile = employeeUser;
                    role = "employee";
                }
            }

            // ====================================================
            // 6. PROFILE NOT FOUND
            // ====================================================

            if (!profile) {
                console.error(
                    "Authorization profile not found:",
                    {
                        userId,
                        email: req.user.email,
                    }
                );

                return res.status(403).json({
                    success: false,
                    message:
                        "User profile was not found.",
                });
            }

            // ====================================================
            // 7. ROLE CHECK
            //
            // authorize("admin")
            //
            // allows:
            // admin
            // superadmin
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
            // 8. SUPER ADMIN
            // ====================================================

            if (role === "superadmin") {

                const superAdminEmail = String(
                    req.user.email ||
                    profile.email ||
                    ""
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

                const status = String(
                    profile.status || ""
                )
                    .trim()
                    .toLowerCase();

                if (
                    status &&
                    ![
                        "active",
                        "approved",
                    ].includes(status)
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Super Admin account is inactive.",
                    });
                }
            }

            // ====================================================
            // 9. ADMIN
            //
            // IMPORTANT:
            // Admin login is NOT blocked by approval.
            // Only inactive/disabled admins are blocked.
            // ====================================================

            if (role === "admin") {

                const status = String(
                    profile.status || ""
                )
                    .trim()
                    .toLowerCase();

                if (
                    [
                        "rejected",
                        "disabled",
                        "inactive",
                    ].includes(status)
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Your admin account is not active.",
                    });
                }

                if (
                    status &&
                    ![
                        "active",
                        "approved",
                    ].includes(status)
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Your admin account is not active.",
                    });
                }
            }

            // ====================================================
            // 10. CLIENT STATUS
            // ====================================================

            if (role === "client") {

                const status = String(
                    profile.status || ""
                )
                    .trim()
                    .toLowerCase();

                if (status === "pending") {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Your client account is waiting for administrator approval.",
                    });
                }

                if (
                    status === "rejected" ||
                    status === "disabled" ||
                    status === "inactive"
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
            // 11. EMPLOYEE STATUS
            // ====================================================

            if (role === "employee") {

                const status = String(
                    profile.status || ""
                )
                    .trim()
                    .toLowerCase();

                if (status === "pending") {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Your employee account is waiting for administrator approval.",
                    });
                }

                if (
                    status === "rejected" ||
                    status === "disabled" ||
                    status === "inactive"
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
            // 12. SAVE PROFILE
            // ====================================================

            req.profile = profile;
            req.userRole = role;

            console.log(
                "Authorization successful:",
                {
                    userId,
                    email: req.user.email,
                    role,
                }
            );

            // ====================================================
            // 13. CONTINUE
            // ====================================================

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