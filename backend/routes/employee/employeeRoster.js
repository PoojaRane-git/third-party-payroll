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
// GET MY ROSTER
// GET /api/employee/roster
// =====================================================

router.get("/", async (req, res) => {
    try {
        const employee =
            await getEmployeeContext(req);

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("employee_roster")
            .select("*")
            .eq(
                "employee_id",
                employee.employee_id
            )
            .order("effective_from", {
                ascending: false,
            });

        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        console.error(
            "GET EMPLOYEE ROSTER ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to fetch employee roster.",
            details: error.message,
        });
    }
});

module.exports = router;