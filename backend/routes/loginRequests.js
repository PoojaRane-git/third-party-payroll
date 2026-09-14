
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
    const requestedTime = new Date(requestedAt).getTime();

    if (Number.isNaN(requestedTime)) {
        return true;
    }

    const ageMs = Date.now() - requestedTime;

    return ageMs > EXPIRY_MINUTES * 60 * 1000;
}

// ============================================================
// HELPER — CALLED FROM auth.js AFTER OTP VERIFICATION SUCCEEDS
//
// Creates a pending login_requests row for roles that need
// approval.
//
// IMPORTANT:
// If the same user already has a pending request, return that
// request instead of creating another duplicate request.
//
// Returns null for roles that don't require approval
// (e.g. superadmin).
// ============================================================

async function createLoginRequestIfNeeded({
    userId,
    role,
    email,
}) {
    const normalizedRole = String(role || "")
        .trim()
        .toLowerCase();

    const normalizedEmail = String(email || "")
        .trim()
        .toLowerCase();

    // --------------------------------------------------------
    // SUPERADMIN DOES NOT REQUIRE APPROVAL
    // --------------------------------------------------------

    if (!APPROVAL_REQUIRED_ROLES.includes(normalizedRole)) {
        return null;
    }

    // --------------------------------------------------------
    // CHECK FOR AN EXISTING PENDING REQUEST
    //
    // This prevents:
    //
    // ID 6 -> pending
    // ID 7 -> pending
    // ID 8 -> pending
    //
    // for the same login attempt/user.
    // --------------------------------------------------------

    const {
        data: existingRequest,
        error: existingError,
    } = await supabaseAdmin
        .from("login_requests")
        .select("id, user_id, role, email, status, requested_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("requested_at", {
            ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (existingError) {
        console.error(
            "❌ Unable to check existing login request:",
            existingError
        );

        throw existingError;
    }

    // --------------------------------------------------------
    // IF AN ACTIVE PENDING REQUEST EXISTS
    // --------------------------------------------------------

    if (existingRequest) {
        // ----------------------------------------------------
        // If it is still valid, reuse it.
        // ----------------------------------------------------

        if (!isExpired(existingRequest.requested_at)) {
            console.log(
                "ℹ️ Existing pending login request reused:",
                existingRequest.id
            );

            return existingRequest;
        }

        // ----------------------------------------------------
        // Existing request is expired.
        // Mark it expired before creating a fresh request.
        // ----------------------------------------------------

        const {
            error: expireError,
        } = await supabaseAdmin
            .from("login_requests")
            .update({
                status: "expired",
                resolved_at: new Date().toISOString(),
            })
            .eq("id", existingRequest.id)
            .eq("status", "pending");

        if (expireError) {
            console.error(
                "❌ Unable to expire old login request:",
                expireError
            );

            throw expireError;
        }
    }

    // --------------------------------------------------------
    // CREATE A NEW PENDING REQUEST
    // --------------------------------------------------------

    const {
        data,
        error,
    } = await supabaseAdmin
        .from("login_requests")
        .insert({
            user_id: userId,
            role: normalizedRole,
            email: normalizedEmail,
        })
        .select(
            "id, user_id, role, email, status, requested_at"
        )
        .single();

    if (error) {
        console.error(
            "❌ Unable to create login request:",
            error
        );

        throw error;
    }

    console.log(
        "✅ New login approval request created:",
        data.id
    );

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

            const {
                data: loginRequest,
                error,
            } = await supabaseAdmin
                .from("login_requests")
                .select(
                    "id, user_id, role, email, status, requested_at"
                )
                .eq("id", id)
                .eq("user_id", req.user.id)
                .maybeSingle();

            if (error) {
                console.error(
                    "Login request lookup error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to check login request status.",
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
                const {
                    data: expiredRequest,
                    error: expireError,
                } = await supabaseAdmin
                    .from("login_requests")
                    .update({
                        status: "expired",
                        resolved_at:
                            new Date().toISOString(),
                    })
                    .eq("id", id)
                    .eq("status", "pending")
                    .select(
                        "id, status, requested_at, resolved_at"
                    )
                    .maybeSingle();

                if (expireError) {
                    console.error(
                        "Login request expiry error:",
                        expireError
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Unable to expire login request.",
                    });
                }

                return res.status(200).json({
                    success: true,
                    status:
                        expiredRequest?.status ||
                        "expired",
                });
            }

            return res.status(200).json({
                success: true,
                status: loginRequest.status,
            });
        } catch (error) {
            console.error(
                "Login request status error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to check login request status.",
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
            const {
                data,
                error,
            } = await supabaseAdmin
                .from("login_requests")
                .select(
                    "id, user_id, role, email, status, requested_at"
                )
                .eq("status", "pending")
                .order("requested_at", {
                    ascending: false,
                });

            if (error) {
                console.error(
                    "Pending login requests error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to fetch pending login requests.",
                    error: error.message,
                });
            }

            // --------------------------------------------------
            // FILTER OUT EXPIRED REQUESTS
            // --------------------------------------------------

            const stillValid = (data || []).filter(
                (request) =>
                    !isExpired(request.requested_at)
            );

            return res.status(200).json({
                success: true,
                requests: stillValid,
                count: stillValid.length,
            });
        } catch (error) {
            console.error(
                "Pending login requests exception:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to fetch pending login requests.",
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

            // --------------------------------------------------
            // FIRST FETCH THE REQUEST
            //
            // This lets us verify that it has not expired before
            // approving it.
            // --------------------------------------------------

            const {
                data: loginRequest,
                error: lookupError,
            } = await supabaseAdmin
                .from("login_requests")
                .select(
                    "id, user_id, role, email, status, requested_at"
                )
                .eq("id", id)
                .maybeSingle();

            if (lookupError) {
                console.error(
                    "Approve request lookup error:",
                    lookupError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find login request.",
                });
            }

            if (!loginRequest) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Login request not found.",
                });
            }

            if (loginRequest.status !== "pending") {
                return res.status(404).json({
                    success: false,
                    message:
                        "Pending login request not found or already resolved.",
                });
            }

            // --------------------------------------------------
            // DO NOT APPROVE EXPIRED REQUEST
            // --------------------------------------------------

            if (
                isExpired(loginRequest.requested_at)
            ) {
                const {
                    error: expireError,
                } = await supabaseAdmin
                    .from("login_requests")
                    .update({
                        status: "expired",
                        resolved_at:
                            new Date().toISOString(),
                    })
                    .eq("id", id)
                    .eq("status", "pending");

                if (expireError) {
                    console.error(
                        "Expire before approval error:",
                        expireError
                    );
                }

                return res.status(400).json({
                    success: false,
                    message:
                        "This login request has expired. The user must log in again.",
                });
            }

            // --------------------------------------------------
            // APPROVE
            // --------------------------------------------------

            const {
                data: updated,
                error,
            } = await supabaseAdmin
                .from("login_requests")
                .update({
                    status: "approved",
                    resolved_at:
                        new Date().toISOString(),
                    resolved_by: req.user.id,
                })
                .eq("id", id)
                .eq("status", "pending")
                .select(
                    "id, user_id, role, email, status"
                )
                .single();

            if (error || !updated) {
                console.error(
                    "Approve login request update error:",
                    error
                );

                return res.status(404).json({
                    success: false,
                    message:
                        "Pending login request not found or already resolved.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Login approved.",
                request: updated,
            });
        } catch (error) {
            console.error(
                "Approve login request error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to approve login request.",
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

            const {
                data: updated,
                error,
            } = await supabaseAdmin
                .from("login_requests")
                .update({
                    status: "rejected",
                    resolved_at:
                        new Date().toISOString(),
                    resolved_by: req.user.id,
                })
                .eq("id", id)
                .eq("status", "pending")
                .select(
                    "id, user_id, role, email, status"
                )
                .single();

            if (error || !updated) {
                console.error(
                    "Reject login request update error:",
                    error
                );

                return res.status(404).json({
                    success: false,
                    message:
                        "Pending login request not found or already resolved.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Login rejected.",
                request: updated,
            });
        } catch (error) {
            console.error(
                "Reject login request error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to reject login request.",
                error: error.message,
            });
        }
    }
);

// ============================================================
// EXPORTS
// ============================================================

module.exports = router;
module.exports.createLoginRequestIfNeeded =
    createLoginRequestIfNeeded;
