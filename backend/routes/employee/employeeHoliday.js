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

// =====================================================
// GET EMPLOYEE HOLIDAYS
// GET /api/employee/holidays
// =====================================================

router.get("/", async (req, res) => {
    try {
        const employee =
            await getEmployeeContext(req);

        const {
            data: deployments,
            error: deploymentError,
        } = await supabaseAdmin
            .from("deployments")
            .select("id, client_id")
            .eq(
                "candidate_id",
                employee.employee_id
            );

        if (deploymentError) {
            throw deploymentError;
        }

        const clientIds = [
            ...new Set(
                (deployments || [])
                    .map(
                        (deployment) =>
                            deployment.client_id
                    )
                    .filter(Boolean)
            ),
        ];

        if (clientIds.length === 0) {
            return res.json([]);
        }

        let query = supabaseAdmin
            .from("holiday_calendar")
            .select("*")
            .in("client_id", clientIds)
            .order("holiday_date", {
                ascending: true,
            });

        if (req.query.from) {
            query = query.gte(
                "holiday_date",
                req.query.from
            );
        }

        if (req.query.to) {
            query = query.lte(
                "holiday_date",
                req.query.to
            );
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        console.error(
            "GET EMPLOYEE HOLIDAYS ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to fetch employee holidays.",
            details: error.message,
        });
    }
});

module.exports = router;