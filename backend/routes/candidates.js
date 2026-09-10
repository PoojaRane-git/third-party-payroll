const express = require("express");
const router = express.Router();

const supabase = require("../supabaseClient");

// =========================================================
// GET ALL CANDIDATES
// GET /api/candidates
// =========================================================

router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("candidates")
            .select("*")
            .order("id", { ascending: true });

        if (error) {
            throw error;
        }

        return res.json({
            success: true,
            data: data || [],
        });

    } catch (err) {
        console.error(
            "GET /api/candidates:",
            err.message
        );

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});


// =========================================================
// GET SINGLE CANDIDATE
// GET /api/candidates/:id
// =========================================================

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(Number(id))) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee ID",
            });
        }

        const employeeId = Number(id);

        const { data, error } = await supabase
            .from("candidates")
            .select("*")
            .eq("id", employeeId)
            .single();

        if (error) {

            // Supabase: no row found
            if (error.code === "PGRST116") {
                return res.status(404).json({
                    success: false,
                    message: "Employee not found",
                });
            }

            throw error;
        }

        return res.json({
            success: true,
            data,
        });

    } catch (err) {
        console.error(
            "GET /api/candidates/:id:",
            err.message
        );

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});


// =========================================================
// CREATE CANDIDATE
// POST /api/candidates
// =========================================================

router.post("/", async (req, res) => {
    try {

        const {
            full_name,
            email,
            phone,
            pan_number,
            bank_account_number,
            ifsc_code,
            bank_name,
            uan_number,
            esic_number,
            date_of_joining,
            employment_status,

            // New employee fields
            employee_code,
            dob,
            gender,
            address,
            city,
            state,
            pincode,
            designation,
            department,
            employment_type,
            work_location,
            skills,
            experience,
            education,
            pay_rate,
            pf_applicable,
            esic_applicable,
            emergency_contact_name,
            emergency_contact_phone,
            deployment_id,
        } = req.body;


        // =====================================================
        // VALIDATION
        // =====================================================

        if (!full_name || !email) {
            return res.status(400).json({
                success: false,
                message:
                    "full_name and email are required",
            });
        }


        // =====================================================
        // CREATE CANDIDATE
        // =====================================================

        const { data, error } = await supabase
            .from("candidates")
            .insert([
                {
                    full_name,
                    email,

                    phone:
                        phone || null,

                    pan_number:
                        pan_number || null,

                    bank_account_number:
                        bank_account_number || null,

                    ifsc_code:
                        ifsc_code || null,

                    bank_name:
                        bank_name || null,

                    uan_number:
                        uan_number || null,

                    esic_number:
                        esic_number || null,

                    date_of_joining:
                        date_of_joining || null,

                    employment_status:
                        employment_status || "Available",

                    employee_code:
                        employee_code || null,

                    dob:
                        dob || null,

                    gender:
                        gender || null,

                    address:
                        address || null,

                    city:
                        city || null,

                    state:
                        state || null,

                    pincode:
                        pincode || null,

                    designation:
                        designation || null,

                    department:
                        department || null,

                    employment_type:
                        employment_type || null,

                    work_location:
                        work_location || null,

                    skills:
                        skills || null,

                    experience:
                        experience || null,

                    education:
                        education || null,

                    pay_rate:
                        pay_rate !== undefined &&
                        pay_rate !== ""
                            ? Number(pay_rate)
                            : null,

                    pf_applicable:
                        Boolean(pf_applicable),

                    esic_applicable:
                        Boolean(esic_applicable),

                    emergency_contact_name:
                        emergency_contact_name || null,

                    emergency_contact_phone:
                        emergency_contact_phone || null,

                    // IMPORTANT:
                    // New employee is unassigned
                    deployment_id:
                        deployment_id || null,

                    // Login account is NOT created here
                    auth_user_id: null,
                },
            ])
            .select("*")
            .single();


        if (error) {
            throw error;
        }


        // =====================================================
        // RESPONSE
        // =====================================================

        return res.status(201).json({
            success: true,
            message:
                "Employee created successfully",
            data,
        });

    } catch (err) {

        console.error(
            "POST /api/candidates:",
            err.message
        );

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});


module.exports = router;