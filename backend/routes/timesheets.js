const express = require("express");
const router = express.Router();

const  supbase  = require("../supabaseClient").default;

// =========================================================
// HELPER
// =========================================================

const getId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

const sendError = (res, status, message) => {
    return res.status(status).json({
        success: false,
        message,
    });
};

// =========================================================
// GET TIMESHEETS
// GET /api/timesheets
// GET /api/timesheets?client_id=1
// GET /api/timesheets?billing_month=2026-09
// =========================================================

router.get("/", async (req, res) => {
    try {
        const clientId = req.query.client_id;
        const billingMonth = req.query.billing_month;

        let query = supabase
            .from("timesheets")
            .select(`
                *,
                deployments (
                    id,
                    project_name,
                    candidate_id,
                    client_id,
                    candidates (
                        id,
                        full_name,
                        designation
                    ),
                    clients (
                        id,
                        company_name
                    )
                )
            `)
            .order("id", { ascending: false });

        // Filter by billing month
        if (billingMonth) {
            query = query.eq(
                "billing_month",
                billingMonth
            );
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        let formattedData = data || [];

        // Filter by client
        if (clientId) {
            const id = getId(clientId);

            if (!id) {
                return sendError(
                    res,
                    400,
                    "Invalid client_id"
                );
            }

            formattedData = formattedData.filter(
                (row) =>
                    Number(
                        row.deployments?.client_id
                    ) === id
            );
        }

        // Format response
        formattedData = formattedData.map(
            (row) => ({
                ...row,

                employee_name:
                    row.deployments?.candidates
                        ?.full_name || "N/A",

                designation:
                    row.deployments?.candidates
                        ?.designation || "N/A",

                company_name:
                    row.deployments?.clients
                        ?.company_name || "N/A",

                project_name:
                    row.deployments?.project_name ||
                    "N/A",
            })
        );

        res.json({
            success: true,
            data: formattedData,
        });

    } catch (err) {
        console.error(
            "GET /api/timesheets:",
            err.message
        );

        sendError(
            res,
            500,
            err.message
        );
    }
});

// =========================================================
// CREATE TIMESHEET
// POST /api/timesheets
// =========================================================

router.post("/", async (req, res) => {
    try {
        const {
            deployment_id,
            billing_month,
            total_working_days,
            days_worked,
            lop_days,
            overtime_hours,
            approval_status,
            approved_by,
        } = req.body;

        const deploymentId =
            getId(deployment_id);

        // Validation
        if (
            !deploymentId ||
            !billing_month
        ) {
            return sendError(
                res,
                400,
                "deployment_id and billing_month are required"
            );
        }

        const finalStatus =
            approval_status || "Pending";

        // Create timesheet
        const { data, error } =
            await supabase
                .from("timesheets")
                .insert([
                    {
                        deployment_id:
                            deploymentId,

                        billing_month:
                            billing_month,

                        total_working_days:
                            Number(
                                total_working_days || 22
                            ),

                        days_worked:
                            Number(
                                days_worked || 0
                            ),

                        lop_days:
                            Number(
                                lop_days || 0
                            ),

                        overtime_hours:
                            Number(
                                overtime_hours || 0
                            ),

                        approval_status:
                            finalStatus,

                        approved_by:
                            finalStatus ===
                            "Approved"
                                ? approved_by ||
                                  "Admin"
                                : null,

                        approved_at:
                            finalStatus ===
                            "Approved"
                                ? new Date().toISOString()
                                : null,
                    },
                ])
                .select()
                .single();

        if (error) {
            throw error;
        }

        res.status(201).json({
            success: true,
            message:
                "Timesheet created successfully",
            data,
        });

    } catch (err) {
        console.error(
            "POST /api/timesheets:",
            err.message
        );

        sendError(
            res,
            500,
            err.message
        );
    }
});

// =========================================================
// UPDATE TIMESHEET STATUS
// PATCH /api/timesheets/:id/status
// =========================================================

router.patch(
    "/:id/status",
    async (req, res) => {
        try {
            const id =
                getId(req.params.id);

            const {
                approval_status,
                approved_by,
            } = req.body;

            // Validate ID
            if (!id) {
                return sendError(
                    res,
                    400,
                    "Invalid timesheet ID"
                );
            }

            // Validate status
            if (!approval_status) {
                return sendError(
                    res,
                    400,
                    "approval_status is required"
                );
            }

            const updates = {
                approval_status,
            };

            // Approved
            if (
                approval_status ===
                "Approved"
            ) {
                updates.approved_by =
                    approved_by || "Admin";

                updates.approved_at =
                    new Date().toISOString();
            }

            // Pending / Rejected
            else {
                updates.approved_by = null;
                updates.approved_at = null;
            }

            const {
                data,
                error,
            } = await supabase
                .from("timesheets")
                .update(updates)
                .eq("id", id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            res.json({
                success: true,
                message:
                    "Timesheet status updated successfully",
                data,
            });

        } catch (err) {
            console.error(
                "PATCH /api/timesheets/:id/status:",
                err.message
            );

            sendError(
                res,
                500,
                err.message
            );
        }
    }
);

// =========================================================
// EXPORT
// =========================================================

module.exports = router;