// =========================================================
// JOB REQUIREMENTS ROUTES
// =========================================================

const express = require("express");
const router = express.Router();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =========================================================
// GET ALL JOB REQUIREMENTS
// GET /api/job-requirements
// =========================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("job_requirements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Job requirements fetch error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch job requirements",
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("GET /job-requirements error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// =========================================================
// GET SINGLE JOB REQUIREMENT
// GET /api/job-requirements/:id
// =========================================================

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid job requirement ID",
      });
    }

    const { data, error } = await supabase
      .from("job_requirements")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Job requirement fetch error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch job requirement",
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Job requirement not found",
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET /job-requirements/:id error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// =========================================================
// ASSIGN CANDIDATE
// POST /api/job-requirements/:id/assign
// =========================================================

router.post("/:id/assign", async (req, res) => {
  try {
    const jobRequirementId = Number(req.params.id);
    const candidateId = Number(req.body?.candidate_id);

    if (!Number.isInteger(jobRequirementId) || jobRequirementId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid job requirement ID",
      });
    }

    if (!Number.isInteger(candidateId) || candidateId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid candidate_id is required",
      });
    }

    // -----------------------------------------------------
    // Check job requirement exists
    // -----------------------------------------------------

    const { data: job, error: jobError } = await supabase
      .from("job_requirements")
      .select("*")
      .eq("id", jobRequirementId)
      .maybeSingle();

    if (jobError) {
      console.error("Job lookup error:", jobError);

      return res.status(500).json({
        success: false,
        message: "Failed to find job requirement",
        error: jobError.message,
      });
    }

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job requirement not found",
      });
    }

    // -----------------------------------------------------
    // Check candidate exists
    // -----------------------------------------------------

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError) {
      console.error("Candidate lookup error:", candidateError);

      return res.status(500).json({
        success: false,
        message: "Failed to find candidate",
        error: candidateError.message,
      });
    }

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    // -----------------------------------------------------
    // Check assignment table
    // -----------------------------------------------------

    const { data: existingAssignment, error: existingError } =
      await supabase
        .from("candidate_job_assignments")
        .select("*")
        .eq("job_requirement_id", jobRequirementId)
        .eq("candidate_id", candidateId)
        .maybeSingle();

    if (existingError) {
      console.error("Assignment lookup error:", existingError);

      return res.status(500).json({
        success: false,
        message: "Failed to check existing assignment",
        error: existingError.message,
      });
    }

    if (existingAssignment) {
      return res.status(409).json({
        success: false,
        message: "Candidate is already assigned to this job requirement",
      });
    }

    // -----------------------------------------------------
    // Create assignment
    // -----------------------------------------------------

    const { data: assignment, error: assignmentError } = await supabase
      .from("candidate_job_assignments")
      .insert({
        job_requirement_id: jobRequirementId,
        candidate_id: candidateId,
        assigned_at: new Date().toISOString(),
        assigned_by: "Admin",
        status: "Assigned",
      })
      .select("*")
      .single();

    if (assignmentError) {
      console.error("Assignment insert error:", assignmentError);

      return res.status(500).json({
        success: false,
        message: "Failed to assign candidate",
        error: assignmentError.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Candidate successfully assigned",
      data: assignment,
    });
  } catch (error) {
    console.error("POST /job-requirements/:id/assign error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;