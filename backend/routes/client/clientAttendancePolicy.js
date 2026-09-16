const express = require("express");
const router = express.Router();

const supabaseAdmin = require("../../config/supabaseAdmin");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

router.use(authenticate);
router.use(authorize("client"));

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

// =====================================================
// GET ATTENDANCE POLICY
// GET /api/client/attendance-policy
// =====================================================

router.get("/", async (req, res) => {
    try {
        const client = await getClientContext(req);

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("client_attendance_policy")
            .select("*")
            .eq("client_id", client.client_id)
            .maybeSingle();

        if (error) throw error;

        return res.json(
            data || {
                client_id: client.client_id,
                full_day_hours: 8,
                half_day_min_hours: 4,
                sandwich_rule_enabled: false,
                holiday_ot_enabled: true,
                weekly_off_ot_enabled: true,
                comp_off_enabled: true,
                ot_multiplier: 1.5,
            }
        );
    } catch (error) {
        console.error(
            "GET ATTENDANCE POLICY ERROR:",
            error
        );

        return res.status(500).json({
            error: "Failed to fetch attendance policy.",
            details: error.message,
        });
    }
});

// =====================================================
// CREATE / UPDATE POLICY
// PUT /api/client/attendance-policy
// =====================================================

router.put("/", async (req, res) => {
    try {
        const client = await getClientContext(req);

        const {
            full_day_hours = 8,
            half_day_min_hours = 4,
            sandwich_rule_enabled = false,
            holiday_ot_enabled = true,
            weekly_off_ot_enabled = true,
            comp_off_enabled = true,
            ot_multiplier = 1.5,
        } = req.body;

        if (
            Number(full_day_hours) <= 0 ||
            Number(half_day_min_hours) < 0 ||
            Number(ot_multiplier) <= 0
        ) {
            return res.status(400).json({
                error: "Invalid attendance policy values.",
            });
        }

        if (
            Number(half_day_min_hours) >=
            Number(full_day_hours)
        ) {
            return res.status(400).json({
                error:
                    "Half-day minimum hours must be less than full-day hours.",
            });
        }

        const policy = {
            client_id: client.client_id,
            full_day_hours: Number(full_day_hours),
            half_day_min_hours:
                Number(half_day_min_hours),
            sandwich_rule_enabled:
                Boolean(sandwich_rule_enabled),
            holiday_ot_enabled:
                Boolean(holiday_ot_enabled),
            weekly_off_ot_enabled:
                Boolean(weekly_off_ot_enabled),
            comp_off_enabled:
                Boolean(comp_off_enabled),
            ot_multiplier: Number(ot_multiplier),
            updated_at: new Date().toISOString(),
        };

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("client_attendance_policy")
            .upsert(policy, {
                onConflict: "client_id",
            })
            .select()
            .single();

        if (error) throw error;

        return res.json({
            message:
                "Attendance policy saved successfully.",
            policy: data,
        });
    } catch (error) {
        console.error(
            "UPDATE ATTENDANCE POLICY ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to save attendance policy.",
            details: error.message,
        });
    }
});

module.exports = router;