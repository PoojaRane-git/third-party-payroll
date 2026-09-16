const express = require("express");
const router = express.Router();

const supabaseAdmin = require("../../config/supabaseAdmin");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

router.use(authenticate);
router.use(authorize("employee"));

async function getEmployeeContext(req) {
    const { data, error } = await supabaseAdmin
        .from("employee_users")
        .select("id, employee_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

    if (error) throw error;

    if (!data?.employee_id) {
        throw new Error("Employee profile not found.");
    }

    return data;
}

function isValidDate(value) {
    if (!value) return false;

    return !Number.isNaN(
        new Date(`${value}T00:00:00`).getTime()
    );
}

function calculateDays(startDate, endDate) {
    const start = new Date(
        `${startDate}T00:00:00`
    );

    const end = new Date(
        `${endDate}T00:00:00`
    );

    return (
        Math.floor(
            (end.getTime() - start.getTime()) /
                (1000 * 60 * 60 * 24)
        ) + 1
    );
}

// =====================================================
// APPLY LEAVE
// POST /api/employee/leave/apply
// =====================================================

router.post("/apply", async (req, res) => {
    try {
        const employee =
            await getEmployeeContext(req);

        const {
            leave_type,
            start_date,
            end_date,
            reason,
            deployment_id,
        } = req.body;

        if (
            !leave_type ||
            !start_date ||
            !end_date ||
            !deployment_id
        ) {
            return res.status(400).json({
                error:
                    "leave_type, start_date, end_date and deployment_id are required.",
            });
        }

        if (
            !isValidDate(start_date) ||
            !isValidDate(end_date)
        ) {
            return res.status(400).json({
                error: "Invalid leave dates.",
            });
        }

        if (
            new Date(`${end_date}T00:00:00`) <
            new Date(`${start_date}T00:00:00`)
        ) {
            return res.status(400).json({
                error:
                    "End date cannot be before start date.",
            });
        }

        const startYear = new Date(
            `${start_date}T00:00:00`
        ).getFullYear();

        const endYear = new Date(
            `${end_date}T00:00:00`
        ).getFullYear();

        if (startYear !== endYear) {
            return res.status(400).json({
                error:
                    "Leave spanning multiple years is not supported in one application.",
            });
        }

        // Verify deployment belongs to employee
        const {
            data: deployment,
            error: deploymentError,
        } = await supabaseAdmin
            .from("deployments")
            .select(`
                id,
                candidate_id,
                client_id,
                status
            `)
            .eq("id", deployment_id)
            .eq(
                "candidate_id",
                employee.employee_id
            )
            .maybeSingle();

        if (deploymentError) {
            throw deploymentError;
        }

        if (!deployment) {
            return res.status(403).json({
                error:
                    "Selected deployment does not belong to you.",
            });
        }

        // Check overlapping Pending/Approved leave
        const {
            data: existingLeaves,
            error: overlapError,
        } = await supabaseAdmin
            .from("leave_applications")
            .select(`
                id,
                start_date,
                end_date,
                status
            `)
            .eq(
                "employee_id",
                employee.employee_id
            )
            .in("status", [
                "Pending",
                "Approved",
            ]);

        if (overlapError) throw overlapError;

        const requestedStart = new Date(
            `${start_date}T00:00:00`
        );

        const requestedEnd = new Date(
            `${end_date}T00:00:00`
        );

        const overlap = (existingLeaves || []).some(
            (leave) => {
                const existingStart = new Date(
                    `${leave.start_date}T00:00:00`
                );

                const existingEnd = new Date(
                    `${leave.end_date}T00:00:00`
                );

                return (
                    requestedStart <= existingEnd &&
                    requestedEnd >= existingStart
                );
            }
        );

        if (overlap) {
            return res.status(409).json({
                error:
                    "You already have a pending or approved leave overlapping these dates.",
            });
        }

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("leave_applications")
            .insert({
                employee_id:
                    employee.employee_id,
                client_id: deployment.client_id,
                deployment_id,
                leave_type:
                    String(leave_type).trim(),
                start_date,
                end_date,
                reason:
                    reason
                        ? String(reason).trim()
                        : null,
                status: "Pending",
                applied_at:
                    new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            message:
                "Leave application submitted successfully.",
            leave: data,
            leave_days: calculateDays(
                start_date,
                end_date
            ),
        });
    } catch (error) {
        console.error("APPLY LEAVE ERROR:", error);

        return res.status(500).json({
            error:
                "Failed to submit leave application.",
            details: error.message,
        });
    }
});

// =====================================================
// GET MY LEAVE REQUESTS
// GET /api/employee/leave
// =====================================================

router.get("/", async (req, res) => {
    try {
        const employee =
            await getEmployeeContext(req);

        let query = supabaseAdmin
            .from("leave_applications")
            .select("*")
            .eq(
                "employee_id",
                employee.employee_id
            )
            .order("applied_at", {
                ascending: false,
            });

        if (req.query.status) {
            query = query.eq(
                "status",
                req.query.status
            );
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        console.error(
            "GET EMPLOYEE LEAVE ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to fetch leave applications.",
            details: error.message,
        });
    }
});

// =====================================================
// GET LEAVE BALANCE
// GET /api/employee/leave/balance
// =====================================================

router.get("/balance", async (req, res) => {
    try {
        const employee =
            await getEmployeeContext(req);

        const currentYear =
            Number(req.query.year) ||
            new Date().getFullYear();

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("employee_leave_balance")
            .select("*")
            .eq(
                "employee_id",
                employee.employee_id
            )
            .eq(
                "accrual_year",
                currentYear
            )
            .order("leave_type", {
                ascending: true,
            });

        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        console.error(
            "GET LEAVE BALANCE ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to fetch leave balance.",
            details: error.message,
        });
    }
});

module.exports = router;