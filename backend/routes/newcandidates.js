const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// ============================================================
// POST /api/candidates
// CREATE EMPLOYEE
// ============================================================

router.post("/candidates", async (req, res) => {
  try {
    const {
      // ========================================================
      // EMPLOYEE DETAILS
      // ========================================================

      first_name,
      last_name,
      full_name,
      email,
      phone,

      // ========================================================
      // PERSONAL
      // ========================================================

      dob,
      gender,
      address,
      city,
      state,
      pincode,

      // ========================================================
      // EMPLOYMENT
      // ========================================================

      designation,
      department,
      employment_type,
      work_location,
      skills,
      experience,
      education,
      date_of_joining,

      // ========================================================
      // PAYROLL
      // ========================================================

      pay_rate,
      pf_applicable,
      esic_applicable,

      // ========================================================
      // DEPLOYMENT
      // ========================================================

      deployment_id,
      employment_status,

      // ========================================================
      // EMERGENCY CONTACT
      // ========================================================

      emergency_contact_name,
      emergency_contact_phone,
    } = req.body;

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!first_name || !first_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "First name is required.",
      });
    }

    if (!last_name || !last_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Last name is required.",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone is required.",
      });
    }

    if (!designation || !designation.trim()) {
      return res.status(400).json({
        success: false,
        message: "Designation is required.",
      });
    }

    if (!date_of_joining) {
      return res.status(400).json({
        success: false,
        message: "Joining date is required.",
      });
    }

    if (
      pay_rate === undefined ||
      pay_rate === null ||
      pay_rate === "" ||
      Number.isNaN(Number(pay_rate))
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid pay rate is required.",
      });
    }

    // ==========================================================
    // NORMALIZE VALUES
    // ==========================================================

    const cleanEmail = email.trim().toLowerCase();

    const cleanFirstName = first_name.trim();

    const cleanLastName = last_name.trim();

    const cleanFullName =
      full_name?.trim() ||
      `${cleanFirstName} ${cleanLastName}`;

    // ==========================================================
    // CHECK DUPLICATE EMAIL
    // ==========================================================

    const {
      data: existingEmployee,
      error: existingError,
    } = await supabase
      .from("candidates")
      .select("id, email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingError) {
      console.error(
        "CHECK EXISTING EMPLOYEE ERROR:",
        existingError
      );

      return res.status(500).json({
        success: false,
        message: "Failed to check existing employee.",
        error: existingError.message,
      });
    }

    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        message:
          "An employee with this email already exists.",
      });
    }

    // ==========================================================
    // GENERATE EMPLOYEE CODE
    // ==========================================================

    const {
      data: lastEmployee,
      error: lastEmployeeError,
    } = await supabase
      .from("candidates")
      .select("employee_code")
      .not("employee_code", "is", null)
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (lastEmployeeError) {
      console.error(
        "GET LAST EMPLOYEE ERROR:",
        lastEmployeeError
      );

      return res.status(500).json({
        success: false,
        message: "Failed to generate employee code.",
        error: lastEmployeeError.message,
      });
    }

    let nextNumber = 1;

    if (lastEmployee?.employee_code) {
      const match =
        lastEmployee.employee_code.match(/EMP(\d+)/i);

      if (match) {
        nextNumber = Number(match[1]) + 1;
      }
    }

    const employeeCode =
      `EMP${String(nextNumber).padStart(3, "0")}`;

    // ==========================================================
    // EMPLOYEE INITIAL STATUS
    //
    // New employee is NOT deployed.
    //
    // deployment_id = NULL
    // employment_status = Available
    // ==========================================================

    const employeeData = {
      // ========================================================
      // EMPLOYEE
      // ========================================================

      employee_code: employeeCode,

      full_name: cleanFullName,

      email: cleanEmail,

      phone: phone.trim(),

      // ========================================================
      // PERSONAL
      // ========================================================

      dob: dob || null,

      gender: gender || null,

      address: address?.trim() || null,

      city: city?.trim() || null,

      state: state?.trim() || null,

      pincode: pincode?.trim() || null,

      // ========================================================
      // EMPLOYMENT
      // ========================================================

      designation: designation.trim(),

      department:
        department?.trim() || null,

      employment_type:
        employment_type || "Contract",

      work_location:
        work_location?.trim() || null,

      skills:
        skills?.trim() || null,

      experience:
        experience?.trim() || null,

      education:
        education?.trim() || null,

      date_of_joining,

      // ========================================================
      // PAYROLL
      // ========================================================

      pay_rate: Number(pay_rate),

      pf_applicable:
        Boolean(pf_applicable),

      esic_applicable:
        Boolean(esic_applicable),

      // ========================================================
      // EMERGENCY CONTACT
      // ========================================================

      emergency_contact_name:
        emergency_contact_name?.trim() || null,

      emergency_contact_phone:
        emergency_contact_phone?.trim() || null,

      // ========================================================
      // DEPLOYMENT
      // ========================================================

      // IMPORTANT:
      // New employee should remain unassigned.

      deployment_id:
        deployment_id || null,

      employment_status:
        employment_status || "Available",

      // ========================================================
      // AUTH
      // ========================================================

      // auth_user_id is intentionally NOT included.
      // Login account will be created separately.
    };

    // ==========================================================
    // LOG
    // ==========================================================

    console.log(
      "CREATING EMPLOYEE:",
      employeeData
    );

    // ==========================================================
    // INSERT EMPLOYEE
    // ==========================================================

    const {
      data: employee,
      error: insertError,
    } = await supabase
      .from("candidates")
      .insert([employeeData])
      .select("*")
      .single();

    // ==========================================================
    // INSERT ERROR
    // ==========================================================

    if (insertError) {
      console.error(
        "CREATE EMPLOYEE ERROR:",
        insertError
      );

      return res.status(500).json({
        success: false,
        message: "Failed to create employee.",
        error: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });
    }

    // ==========================================================
    // SUCCESS
    // ==========================================================

    return res.status(201).json({
      success: true,

      message:
        "Employee created successfully.",

      employee_code:
        employee.employee_code,

      employee,
    });

  } catch (error) {
    // ==========================================================
    // SERVER ERROR
    // ==========================================================

    console.error(
      "POST /candidates ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
});

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;