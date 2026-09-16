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

const defaultRoster = {
    roster_name: "General Shift",
    monday_working: true,
    tuesday_working: true,
    wednesday_working: true,
    thursday_working: true,
    friday_working: true,
    saturday_working: true,
    sunday_working: false,
};

// =====================================================
// GET ROSTER
// GET /api/client/roster
// =====================================================

router.get("/", async (req, res) => {
    try {
        const client = await getClientContext(req);

        const { data, error } = await supabaseAdmin
            .from("employee_roster")
            .select("*")
            .eq("client_id", client.client_id)
            .order("effective_from", {
                ascending: false,
            });

        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        console.error("GET ROSTER ERROR:", error);

        return res.status(500).json({
            error: "Failed to fetch roster.",
            details: error.message,
        });
    }
});

// =====================================================
// CREATE ROSTER
// POST /api/client/roster
// =====================================================

router.post("/", async (req, res) => {
    try {
        const client = await getClientContext(req);

        const {
            employee_id,
            deployment_id,
            roster_name,
            monday_working,
            tuesday_working,
            wednesday_working,
            thursday_working,
            friday_working,
            saturday_working,
            sunday_working,
            effective_from,
            effective_to,
        } = req.body;

        if (
            !employee_id ||
            !deployment_id ||
            !effective_from
        ) {
            return res.status(400).json({
                error:
                    "employee_id, deployment_id and effective_from are required.",
            });
        }

        // Verify deployment belongs to client
        const {
            data: deployment,
            error: deploymentError,
        } = await supabaseAdmin
            .from("deployments")
            .select("id, candidate_id, client_id")
            .eq("id", deployment_id)
            .eq("client_id", client.client_id)
            .maybeSingle();

        if (deploymentError) throw deploymentError;

        if (!deployment) {
            return res.status(403).json({
                error:
                    "Deployment does not belong to this client.",
            });
        }

        if (
            Number(deployment.candidate_id) !==
            Number(employee_id)
        ) {
            return res.status(400).json({
                error:
                    "Employee does not belong to the selected deployment.",
            });
        }

        const rosterData = {
            employee_id,
            deployment_id,
            client_id: client.client_id,
            ...defaultRoster,

            roster_name:
                roster_name ||
                defaultRoster.roster_name,

            monday_working:
                monday_working ??
                defaultRoster.monday_working,

            tuesday_working:
                tuesday_working ??
                defaultRoster.tuesday_working,

            wednesday_working:
                wednesday_working ??
                defaultRoster.wednesday_working,

            thursday_working:
                thursday_working ??
                defaultRoster.thursday_working,

            friday_working:
                friday_working ??
                defaultRoster.friday_working,

            saturday_working:
                saturday_working ??
                defaultRoster.saturday_working,

            sunday_working:
                sunday_working ??
                defaultRoster.sunday_working,

            effective_from,
            effective_to:
                effective_to || null,
        };

        const { data, error } = await supabaseAdmin
            .from("employee_roster")
            .insert(rosterData)
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            message: "Roster created successfully.",
            roster: data,
        });
    } catch (error) {
        console.error("CREATE ROSTER ERROR:", error);

        return res.status(500).json({
            error: "Failed to create roster.",
            details: error.message,
        });
    }
});

// =====================================================
// UPDATE ROSTER
// PUT /api/client/roster/:id
// =====================================================

router.put("/:id", async (req, res) => {
    try {
        const rosterId = Number(req.params.id);

        if (!Number.isInteger(rosterId) || rosterId <= 0) {
            return res.status(400).json({
                error: "Invalid roster ID.",
            });
        }

        const client = await getClientContext(req);

        const allowedFields = [
            "roster_name",
            "monday_working",
            "tuesday_working",
            "wednesday_working",
            "thursday_working",
            "friday_working",
            "saturday_working",
            "sunday_working",
            "effective_from",
            "effective_to",
        ];

        const updateData = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        updateData.updated_at =
            new Date().toISOString();

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("employee_roster")
            .update(updateData)
            .eq("id", rosterId)
            .eq("client_id", client.client_id)
            .select()
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                error: "Roster not found.",
            });
        }

        return res.json({
            message: "Roster updated successfully.",
            roster: data,
        });
    } catch (error) {
        console.error("UPDATE ROSTER ERROR:", error);

        return res.status(500).json({
            error: "Failed to update roster.",
            details: error.message,
        });
    }
});

module.exports = router;