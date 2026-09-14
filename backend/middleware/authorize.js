const supabaseAdmin = require("../config/supabaseAdmin");

const ADMIN_EMAIL = String(
    process.env.ADMIN_EMAIL || ""
)
    .trim()
    .toLowerCase();

const authorize = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            // =====================================================
            // AUTHENTICATION CHECK
            // =====================================================

            if (!req.user || !req.user.id) {
                return res.status(401).json({
                    success: false,
                    message: "User is not authenticated.",
                });
            }

            const userId = req.user.id;

            let profile = null;
            let role = null;

            // =====================================================
            // 1. ADMIN / SUPERADMIN
            // =====================================================

            const {
                data: adminUser,
                error: adminError,
            } = await supabaseAdmin
                .from("third_party_users")
                .select(
                    `
                    id,
                    email,
                    company_name,
                    role,
                    status,
                    is_active,
                    auth_user_id,
                    client_id
                    `
                )
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

            // =====================================================
            // 2. CLIENT
            // =====================================================

            if (!profile) {
                const {
                    data: clientUser,
                    error: clientError,
                } = await supabaseAdmin
                    .from("client_users")
                    .select(
                        `
                        id,
                        user_id,
                        client_id,
                        name,
                        email,
                        role,
                        status
                        `
                    )
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

            // =====================================================
            // 3. EMPLOYEE
            // =====================================================

            if (!profile) {
                const {
                    data: employeeUser,
                    error: employeeError,
                } = await supabaseAdmin
                    .from("employee_users")
                    .select(
                        `
                        id,
                        user_id,
                        employee_id,
                        name,
                        email,
                        role,
                        status
                        `
                    )
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

            // =====================================================
            // PROFILE NOT FOUND
            // =====================================================

            if (!profile) {
                return res.status(403).json({
                    success: false,
                    message:
                        "User profile was not found.",
                });
            }

            // =====================================================
            // NORMALIZE ROLE
            // =====================================================

            role = String(role || "")
                .trim()
                .toLowerCase();

            // =====================================================
            // PERMISSION CHECK
            // =====================================================

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

            // =====================================================
            // SUPERADMIN
            // =====================================================

            if (role === "superadmin") {
                const superAdminEmail = String(
                    profile.email || ""
                )
                    .trim()
                    .toLowerCase();

                if (!ADMIN_EMAIL) {
                    console.error(
                        "ADMIN_EMAIL env var is not set."
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Server misconfiguration: super admin email not set.",
                    });
                }

                if (
                    superAdminEmail !==
                    ADMIN_EMAIL
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

            // =====================================================
            // NORMAL ADMIN
            // =====================================================

            if (role === "admin") {
                const status = String(
                    profile.status || ""
                )
                    .trim()
                    .toLowerCase();

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
                    )
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Your admin account is not active.",
                    });
                }

                if (
                    profile.is_active !== true
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            "Your admin account is inactive.",
                    });
                }
            }

            // =====================================================
            // CLIENT
            // =====================================================

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

            // =====================================================
            // EMPLOYEE
            // =====================================================

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

            // =====================================================
            // ATTACH PROFILE TO REQUEST
            // =====================================================

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