const supabaseAdmin = require("../config/supabaseAdmin");

const authenticate = async (req, res, next) => {
    try {
        // =====================================================
        // 1. Get Authorization Header
        // =====================================================

        const authHeader = req.headers.authorization;

        console.log(
            "Authorization Header:",
            authHeader ? "Bearer token received" : "Missing"
        );

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        // =====================================================
        // 2. Check Bearer Format
        // =====================================================

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format.",
            });
        }

        // =====================================================
        // 3. Extract JWT
        // =====================================================

        const token = authHeader.substring(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is missing.",
            });
        }

        // =====================================================
        // 4. Validate Supabase JWT
        // =====================================================

        const {
            data: { user },
            error,
        } = await supabaseAdmin.auth.getUser(token);

        // DO NOT print the complete user/token
        console.log("Supabase getUser response:", {
            user: user
                ? {
                      id: user.id,
                      email: user.email,
                  }
                : null,

            error: error
                ? {
                      message: error.message,
                      code: error.code,
                      status: error.status,
                  }
                : null,
        });

        // =====================================================
        // 5. Invalid / Deleted / Expired User
        // =====================================================

        if (error || !user) {
            console.error(
                "Supabase authentication failed:",
                error?.message || "User not found"
            );

            return res.status(401).json({
                success: false,
                message:
                    "Invalid or expired authentication token. Please login again.",
                code: error?.code || "AUTH_FAILED",
            });
        }

        // =====================================================
        // 6. Attach User To Request
        // =====================================================

        req.user = user;

        console.log("Authenticated user:", {
            id: user.id,
            email: user.email,
        });

        // =====================================================
        // 7. Continue
        // =====================================================

        next();

    } catch (error) {
        console.error(
            "Authentication middleware error:",
            error
        );

        return res.status(401).json({
            success: false,
            message:
                "Authentication failed. Please login again.",
        });
    }
};

module.exports = authenticate;