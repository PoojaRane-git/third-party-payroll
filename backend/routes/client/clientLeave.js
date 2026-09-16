const express = require("express");
const router = express.Router();

const supabaseAdmin = require("../../config/supabaseAdmin");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

router.use(authenticate);
router.use(authorize("client"));

// =====================================================
// HELPER
// =====================================================

async function getClientContext(req) {
    const { data, error } = await supabaseAdmin
        .from("client_users")
        .select("id, client_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

    if (error) throw error;

    if (!data?.client_id) {
        throw new Error("Client profile not found.");
    }

    return data;
}

function calculateLeaveDays(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    return (
        Math.floor(
            (end.getTime() - start.getTime()) /
                (1000 * 60 * 60 * 24)
        ) + 1
    );
}

// =====================================================
// GET PENDING LEAVE REQUESTS
// GET /api/client/leave/pending
// =====================================================

router.get("/pending", async (req, res) => {
    try {
        const client = await getClientContext(req);

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("leave_applications")
            .select("*")
            .eq("client_id", client.client_id)
            .eq("status", "Pending")
            .order("applied_at", {
                ascending: false,
            });

        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        console.error("GET PENDING LEAVE ERROR:", error);

        return res.status(500).json({
            error: "Failed to fetch pending leave requests.",
            details: error.message,
        });
    }
});

// =====================================================
// APPROVE LEAVE
// PATCH /api/client/leave/:id/approve
// =====================================================

router.patch("/:id/approve", async (req, res) => {
    try {
        const leaveId = Number(req.params.id);

        if (!Number.isInteger(leaveId) || leaveId <= 0) {
            return res.status(400).json({
                error: "Invalid leave application ID.",
            });
        }

        const client = await getClientContext(req);

        const {
            data: leave,
            error: leaveError,
        } = await supabaseAdmin
            .from("leave_applications")
            .select("*")
            .eq("id", leaveId)
            .eq("client_id", client.client_id)
            .maybeSingle();

        if (leaveError) throw leaveError;

        if (!leave) {
            return res.status(404).json({
                error: "Leave application not found.",
            });
        }

        if (leave.status !== "Pending") {
            return res.status(400).json({
                error: `Leave is already ${leave.status}.`,
            });
        }

        const startYear = new Date(
            `${leave.start_date}T00:00:00`
        ).getFullYear();

        const endYear = new Date(
            `${leave.end_date}T00:00:00`
        ).getFullYear();

        if (startYear !== endYear) {
            return res.status(400).json({
                error: "Leave spanning multiple years is not supported in one application.",
            });
        }

        const leaveDays = calculateLeaveDays(
            leave.start_date,
            leave.end_date
        );

        const leaveType = String(
            leave.leave_type || ""
        ).toLowerCase();

        const isUnpaid =
            leaveType.includes("lop") ||
            leaveType.includes("unpaid");

        let oldBalance = null;

        // Paid leave requires sufficient balance
        if (!isUnpaid) {
            const {
                data: balance,
                error: balanceError,
            } = await supabaseAdmin
                .from("employee_leave_balance")
                .select("*")
                .eq("employee_id", leave.employee_id)
                .eq("leave_type", leave.leave_type)
                .eq("accrual_year", startYear)
                .maybeSingle();

            if (balanceError) throw balanceError;

            if (!balance) {
                return res.status(400).json({
                    error: `No ${leave.leave_type} leave balance configured for this employee.`,
                });
            }

            const availableBalance =
                Number(balance.balance);

            if (availableBalance < leaveDays) {
                return res.status(400).json({
                    error: `Insufficient leave balance. Available: ${availableBalance}, Required: ${leaveDays}.`,
                });
            }

            oldBalance = availableBalance;

            const {
                error: balanceUpdateError,
            } = await supabaseAdmin
                .from("employee_leave_balance")
                .update({
                    balance:
                        availableBalance - leaveDays,
                    updated_at:
                        new Date().toISOString(),
                })
                .eq("id", balance.id);

            if (balanceUpdateError) {
                throw balanceUpdateError;
            }
        }

        // Get client profile
        const {
            data: clientUser,
        } = await supabaseAdmin
            .from("client_users")
            .select("id")
            .eq("user_id", req.user.id)
            .maybeSingle();

        // Approve leave
        const {
            data: updatedLeave,
            error: updateError,
        } = await supabaseAdmin
            .from("leave_applications")
            .update({
                status: "Approved",
                approved_by: clientUser?.id || null,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", leaveId)
            .select()
            .single();

        if (updateError) {
            // Attempt balance rollback
            if (!isUnpaid && oldBalance !== null) {
                await supabaseAdmin
                    .from("employee_leave_balance")
                    .update({
                        balance: oldBalance,
                        updated_at:
                            new Date().toISOString(),
                    })
                    .eq("employee_id", leave.employee_id)
                    .eq("leave_type", leave.leave_type)
                    .eq("accrual_year", startYear);
            }

            throw updateError;
        }

        return res.json({
            message: "Leave approved successfully.",
            leave: updatedLeave,
            leave_days: leaveDays,
        });
    } catch (error) {
        console.error("APPROVE LEAVE ERROR:", error);

        return res.status(500).json({
            error: "Failed to approve leave.",
            details: error.message,
        });
    }
});

// =====================================================
// REJECT LEAVE
// PATCH /api/client/leave/:id/reject
// =====================================================

router.patch("/:id/reject", async (req, res) => {
    try {
        const leaveId = Number(req.params.id);

        if (!Number.isInteger(leaveId) || leaveId <= 0) {
            return res.status(400).json({
                error: "Invalid leave application ID.",
            });
        }

        const client = await getClientContext(req);

        const {
            data: leave,
            error: leaveError,
        } = await supabaseAdmin
            .from("leave_applications")
            .select("*")
            .eq("id", leaveId)
            .eq("client_id", client.client_id)
            .maybeSingle();

        if (leaveError) throw leaveError;

        if (!leave) {
            return res.status(404).json({
                error: "Leave application not found.",
            });
        }

        if (leave.status !== "Pending") {
            return res.status(400).json({
                error: `Leave is already ${leave.status}.`,
            });
        }

        const {
            data: clientUser,
        } = await supabaseAdmin
            .from("client_users")
            .select("id")
            .eq("user_id", req.user.id)
            .maybeSingle();

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("leave_applications")
            .update({
                status: "Rejected",
                approved_by: clientUser?.id || null,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", leaveId)
            .select()
            .single();

        if (error) throw error;

        return res.json({
            message: "Leave rejected successfully.",
            leave: data,
        });
    } catch (error) {
        console.error("REJECT LEAVE ERROR:", error);

        return res.status(500).json({
            error: "Failed to reject leave.",
            details: error.message,
        });
    }
});

module.exports = router;