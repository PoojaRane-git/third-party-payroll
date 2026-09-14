const express = require("express");
const router = express.Router();

const supabaseAdmin = require("../config/supabaseAdmin");

const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

// ============================================================
// ROLES THAT REQUIRE PER-LOGIN APPROVAL
//
// Superadmin is deliberately excluded — they must always be
// able to log in unassisted, since they're the one who
// approves everyone else.
// ============================================================

const APPROVAL_REQUIRED_ROLES = [
    "admin",
    "client",
    "employee",
];

// ============================================================
// EXPIRY WINDOW
//
// A pending request older than this is treated as expired
// rather than approvable, so a stale click days later can't
// silently log someone in.
// ============================================================

const EXPIRY_MINUTES = 15;

function isExpired(requestedAt) {
    const ageMs = Date.now() - new Date(requestedAt).getTime();
    return ageMs > EXPIRY_MINUTES * 60 * 1000;
}

// ============================================================
// HELPER — CALLED FROM auth.js AFTER OTP VERIFICATION SUCCEEDS
//
// Creates a pending login_requests row for roles that need
// approval. Returns null for roles that don't (e.g. superadmin),
// meaning the caller should proceed with normal login.
// ============================================================

async function createLoginRequestIfNeeded({ userId, role, email }) {
    const normalizedRole = String(role || "").trim().toLowerCase();

    if (!APPROVAL_REQUIRED_ROLES.includes(normalizedRole)) {
        return null;
    }

    const { data, error } = await supabaseAdmin
        .from("login_requests")
        .insert({
            user_id: userId,
            role: normalizedRole,
            email: String(email || "").trim().toLowerCase(),
        })
        .select("id, status, requested_at")
        .single();

    if (error) {
        console.error("❌ Unable to create login request:", error);
        throw error;
    }

    return data;
}

// ============================================================
// POLL LOGIN REQUEST STATUS
//
// GET /api/login-requests/:id/status
//
// Called repeatedly by the frontend while a user waits for
// admin approval after OTP verification.
// ============================================================

router.get(
    "/:id/status",
    authenticate,
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid login request ID.",
                });
            }

            const { data: loginRequest, error } = await supabaseAdmin
                .from("login_requests")
                .select("id, user_id, role, email, status, requested_at")
                .eq("id", id)
                .eq("user_id", req.user.id) // users can only poll their own request
                .maybeSingle();

            if (error) {
                console.error("Login request lookup error:", error);
                return res.status(500).json({
                    success: false,
                    message: "Unable to check login request status.",
                });
            }

            if (!loginRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Login request not found.",
                });
            }

            // --------------------------------------------------
            // AUTO-EXPIRE STALE PENDING REQUESTS
            // --------------------------------------------------

            if (
                loginRequest.status === "pending" &&
                isExpired(loginRequest.requested_at)
            ) {
                await supabaseAdmin
                    .from("login_requests")
                    .update({
                        status: "expired",
                        resolved_at: new Date().toISOString(),
                    })
                    .eq("id", id)
                    .eq("status", "pending"); // avoid racing a concurrent approval

                return res.status(200).json({
                    success: true,
                    status: "expired",
                });
            }

            return res.status(200).json({
                success: true,
                status: loginRequest.status,
            });

        } catch (error) {
            console.error("Login request status error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to check login request status.",
            });
        }
    }
);

// ============================================================
// LIST PENDING LOGIN REQUESTS
//
// GET /api/login-requests/pending
//
// Admin-facing — powers a notification panel.
// ============================================================

router.get(
    "/pending",
    authenticate,
    authorize("admin"),
    async (req, res) => {
        try {
            const { data, error } = await supabaseAdmin
                .from("login_requests")
                .select("id, user_id, role, email, status, requested_at")
                .eq("status", "pending")
                .order("requested_at", { ascending: false });

            if (error) {
                console.error("Pending login requests error:", error);
                return res.status(500).json({
                    success: false,
                    message: "Unable to fetch pending login requests.",
                    error: error.message,
                });
            }

            // Filter out anything that's aged past expiry but hasn't
            // been flushed by a poll yet, so the admin list stays clean.
            const stillValid = (data || []).filter(
                (request) => !isExpired(request.requested_at)
            );

            return res.status(200).json({
                success: true,
                requests: stillValid,
                count: stillValid.length,
            });

        } catch (error) {
            console.error("Pending login requests exception:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to fetch pending login requests.",
                error: error.message,
            });
        }
    }
);

// ============================================================
// APPROVE LOGIN REQUEST
//
// PATCH /api/login-requests/:id/approve
// ============================================================

router.patch(
    "/:id/approve",
    authenticate,
    authorize("admin"),
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid login request ID.",
                });
            }

            const { data: updated, error } = await supabaseAdmin
                .from("login_requests")
                .update({
                    status: "approved",
                    resolved_at: new Date().toISOString(),
                    resolved_by: req.user.id,
                })
                .eq("id", id)
                .eq("status", "pending") // can't approve something already resolved
                .select("id, user_id, role, email, status")
                .single();

            if (error || !updated) {
                return res.status(404).json({
                    success: false,
                    message: "Pending login request not found or already resolved.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Login approved.",
                request: updated,
            });

        } catch (error) {
            console.error("Approve login request error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to approve login request.",
                error: error.message,
            });
        }
    }
);

// ============================================================
// REJECT LOGIN REQUEST
//
// PATCH /api/login-requests/:id/reject
// ============================================================

router.patch(
    "/:id/reject",
    authenticate,
    authorize("admin"),
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid login request ID.",
                });
            }

            const { data: updated, error } = await supabaseAdmin
                .from("login_requests")
                .update({
                    status: "rejected",
                    resolved_at: new Date().toISOString(),
                    resolved_by: req.user.id,
                })
                .eq("id", id)
                .eq("status", "pending")
                .select("id, user_id, role, email, status")
                .single();

            if (error || !updated) {
                return res.status(404).json({
                    success: false,
                    message: "Pending login request not found or already resolved.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Login rejected.",
                request: updated,
            });

        } catch (error) {
            console.error("Reject login request error:", error);
            return res.status(500).json({
                success: false,
                message: "Unable to reject login request.",
                error: error.message,
            });
        }
    }
);

module.exports = router;
module.exports.createLoginRequestIfNeeded = createLoginRequestIfNeeded;