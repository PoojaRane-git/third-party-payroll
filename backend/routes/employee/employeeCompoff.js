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
// GET MY COMP-OFF
// GET /api/employee/compoff
// =====================================================

router.get("/", async (req, res) => {
    try {
        const employee =
            await getEmployeeContext(req);

        let query = supabaseAdmin
            .from("employee_compoff_ledger")
            .select("*")
            .eq(
                "employee_id",
                employee.employee_id
            )
            .order("earned_date", {
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
            "GET EMPLOYEE COMPOFF ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to fetch comp-off records.",
            details: error.message,
        });
    }
});

// =====================================================
// REDEEM COMP-OFF
// POST /api/employee/compoff/:id/redeem
// =====================================================

router.post("/:id/redeem", async (req, res) => {
    try {
        const compOffId = Number(req.params.id);

        if (
            !Number.isInteger(compOffId) ||
            compOffId <= 0
        ) {
            return res.status(400).json({
                error: "Invalid comp-off ID.",
            });
        }

        const employee =
            await getEmployeeContext(req);

        const {
            data: compOff,
            error: fetchError,
        } = await supabaseAdmin
            .from("employee_compoff_ledger")
            .select("*")
            .eq("id", compOffId)
            .eq(
                "employee_id",
                employee.employee_id
            )
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (!compOff) {
            return res.status(404).json({
                error: "Comp-off record not found.",
            });
        }

        if (compOff.status !== "Available") {
            return res.status(400).json({
                error:
                    `Comp-off cannot be redeemed because its status is ${compOff.status}.`,
            });
        }

        const redeemedDate =
            req.body.redeemed_date ||
            new Date()
                .toISOString()
                .split("T")[0];

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("employee_compoff_ledger")
            .update({
                status: "Redeemed",
                redeemed_date: redeemedDate,
            })
            .eq("id", compOffId)
            .eq(
                "employee_id",
                employee.employee_id
            )
            .select()
            .single();

        if (error) throw error;

        return res.json({
            message:
                "Comp-off redeemed successfully.",
            compoff: data,
        });
    } catch (error) {
        console.error(
            "REDEEM COMPOFF ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to redeem comp-off.",
            details: error.message,
        });
    }
});

module.exports = router;