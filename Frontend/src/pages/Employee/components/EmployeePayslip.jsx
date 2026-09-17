import React, { useEffect, useState } from "react";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";
import { generatePayslipPDF } from "../../admin/PaySlip";

// =====================================================
// DATE-RANGE HELPER — turns "2025-08" (or any parseable date) into
// "1 Aug 2025 to 31 Aug 2025". Kept local to this page since the
// admin PaySlip.jsx builds its period label from a fiscal-year
// selector instead — the two aren't the same logic.
// =====================================================

const getMonthDateRangeLabel = (salaryMonth) => {
  if (!salaryMonth) return "N/A";

  const text = String(salaryMonth);
  let year, month; // month is 0-indexed

  if (/^\d{4}-\d{2}$/.test(text)) {
    const parts = text.split("-").map(Number);
    year = parts[0];
    month = parts[1] - 1;
  } else {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text;
    year = parsed.getFullYear();
    month = parsed.getMonth();
  }

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const fmt = (d) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return `${fmt(start)} to ${fmt(end)}`;
};

// =====================================================
// COMPONENT
// =====================================================

const EmployeePayslip = () => {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState("");

  // =====================================================
  // FETCH PAYSLIPS
  // =====================================================

  useEffect(() => {
    const fetchPayslips = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get("/employee/payroll/me");

        let data = [];
        if (Array.isArray(response.data?.payslips)) {
          data = response.data.payslips;
        } else if (Array.isArray(response.data?.data)) {
          data = response.data.data;
        } else if (Array.isArray(response.data)) {
          data = response.data;
        }

        setPayslips(data);
      } catch (err) {
        console.error("Employee payslip error:", err);
        setPayslips([]);
        setError(
          err.response?.data?.message || err.response?.data?.error || "Unable to load payslips."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPayslips();
  }, []);

  // =====================================================
  // MONEY FORMATTER
  // =====================================================

  const money = (value) => {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return "0.00";
    return amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const display = (value) => {
    if (value === null || value === undefined || value === "") return "N/A";
    return String(value);
  };

  const formatSalaryMonth = (value) => {
    if (!value) return "--";
    const text = String(value);

    if (/^\d{4}-\d{2}$/.test(text)) {
      const [year, month] = text.split("-");
      const date = new Date(Number(year), Number(month) - 1, 1);
      return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    }

    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    }

    return text;
  };

  const getStatusClass = (status) => {
    const value = String(status || "").toLowerCase().trim();
    if (["approved", "locked", "paid"].includes(value)) return "status-badge status-approved";
    if (["pending", "draft"].includes(value)) return "status-badge status-pending";
    if (["rejected", "cancelled"].includes(value)) return "status-badge status-rejected";
    return "status-badge";
  };

  // =====================================================
  // DOWNLOAD PAYSLIP
  // =====================================================

  const downloadPayslip = (payslip) => {
    try {
      setDownloading(payslip.id);

      // ---------------------------------------------------
      // Map the flat `payslip` record into the `employee` +
      // `salary` shapes the shared generatePayslipPDF expects.
      //
      // Fields marked TODO don't exist yet on the payslip
      // object returned by /employee/payroll/me — add them
      // to that API response / DB record for full accuracy.
      // Until then they safely fall back to "N/A" / 0.
      // ---------------------------------------------------
      const employee = {
        name: payslip.employee_name,
        id: payslip.employee_ref_id,
        department: payslip.department,
        designation: payslip.designation,
        branchOfficeName: payslip.branch_office_name,
        bankAccountName: payslip.employee_name,
        bankBranch: payslip.bank_branch, // TODO: add to payslip API response
        ifscCode: payslip.ifsc_code,
        bankACNumber: payslip.account_number,
        joiningDate: payslip.joining_date, // TODO: add to payslip API response
        panCard: payslip.pan_card,
        uanNumber: payslip.uan_number,
        pfACNumber: payslip.pf_ac_number,
        esiRegistrationNumber: payslip.esi_number,
        pran: payslip.pran, // TODO: add to payslip API response
      };

      // We only get one final figure per component from this API
      // (no separate "earned this month" vs "fixed monthly" pair),
      // so amount and gross use the same value except for Basic
      // Salary, where gross uses the overall fixed gross figure.
      const salary = {
        fixedGrossSalary: Number(payslip.fixed_gross_salary ?? payslip.gross_salary ?? 0),
        basicAmount: Number(payslip.basic_salary || 0),
        hraAmount: Number(payslip.hra || 0), // TODO: add to payslip API response
        hraGross: Number(payslip.hra || 0),
        conveyanceAmount: Number(payslip.conveyance || 0), // TODO: add to payslip API response
        conveyanceGross: Number(payslip.conveyance || 0),
        medicalAmount: Number(payslip.medical_allowance || 0), // TODO: add to payslip API response
        medicalGross: Number(payslip.medical_allowance || 0),
        otherAmount: Number(payslip.other_allowance ?? payslip.allowances ?? 0),
        otherGross: Number(payslip.other_allowance ?? payslip.allowances ?? 0),
        gratuity: Number(payslip.gratuity || 0), // TODO: add to payslip API response
        pf: Number(payslip.pf || 0),
        pt: Number(payslip.professional_tax || 0),
      };

      const periodLabel = getMonthDateRangeLabel(payslip.salary_month);
      const monthSlug = String(payslip.salary_month || "payslip").replace(/[^a-zA-Z0-9-_]/g, "-");
      const employeeSlug = String(payslip.employee_name || "Employee")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_");

      generatePayslipPDF(employee, salary, periodLabel, `${employeeSlug}_Payslip_${monthSlug}.pdf`);
    } catch (error) {
      console.error("Payslip download error:", error);
      alert("Unable to download payslip.");
    } finally {
      setDownloading(null);
    }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <EmployeeLayout>
        <div className="empty-state">
          <h3>Loading payslips...</h3>
          <p>Please wait while we load your salary records.</p>
        </div>
      </EmployeeLayout>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <EmployeeLayout>
      <div>
        <div className="page-header">
          <div>
            <h1>Payslips</h1>
            <p>View your complete salary and payslip records.</p>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {payslips.length === 0 ? (
          <div className="empty-state">
            <h3>No payslips available</h3>
            <p>Your approved payroll records will appear here.</p>
          </div>
        ) : (
          <div>
            {payslips.map((payslip) => (
              <div
                key={payslip.id}
                className="table-card"
                style={{ marginBottom: "25px", padding: "25px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "15px",
                    flexWrap: "wrap",
                    marginBottom: "25px",
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0 }}>{formatSalaryMonth(payslip.salary_month)}</h2>
                    <p>Payslip ID: {display(payslip.id)}</p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span className={getStatusClass(payslip.status)}>{display(payslip.status)}</span>

                    <button
                      type="button"
                      onClick={() => downloadPayslip(payslip)}
                      disabled={downloading === payslip.id}
                      style={{
                        padding: "10px 16px",
                        border: "none",
                        borderRadius: "8px",
                        cursor: downloading === payslip.id ? "not-allowed" : "pointer",
                        fontWeight: "600",
                      }}
                    >
                      {downloading === payslip.id ? "Generating..." : "Download Payslip"}
                    </button>
                  </div>
                </div>

                <h3>Earnings</h3>
                <div className="profile-grid">
                  <div>
                    <span>Basic Salary</span>
                    <strong>₹{money(payslip.basic_salary)}</strong>
                  </div>
                  <div>
                    <span>Allowances</span>
                    <strong>₹{money(payslip.allowances)}</strong>
                  </div>
                  <div>
                    <span>Overtime</span>
                    <strong>₹{money(payslip.overtime)}</strong>
                  </div>
                  <div>
                    <span>Bonus</span>
                    <strong>₹{money(payslip.bonus)}</strong>
                  </div>
                  <div>
                    <span>Gross Salary</span>
                    <strong>₹{money(payslip.gross_salary)}</strong>
                  </div>
                </div>

                <h3 style={{ marginTop: "25px" }}>Deductions</h3>
                <div className="profile-grid">
                  <div>
                    <span>Employee PF</span>
                    <strong>₹{money(payslip.pf)}</strong>
                  </div>
                  <div>
                    <span>ESIC</span>
                    <strong>₹{money(payslip.esic)}</strong>
                  </div>
                  <div>
                    <span>Tax / TDS</span>
                    <strong>₹{money(payslip.tax)}</strong>
                  </div>
                  <div>
                    <span>Professional Tax</span>
                    <strong>₹{money(payslip.professional_tax)}</strong>
                  </div>
                  <div>
                    <span>LOP Deduction</span>
                    <strong>₹{money(payslip.lop)}</strong>
                  </div>
                  <div>
                    <span>Total Deductions</span>
                    <strong>₹{money(payslip.total_deductions)}</strong>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "25px",
                    padding: "20px",
                    borderRadius: "10px",
                    background: "#f8fafc",
                  }}
                >
                  <span>Net Salary</span>
                  <h2 style={{ margin: "5px 0 0" }}>₹{money(payslip.net_salary)}</h2>
                </div>

                <h3 style={{ marginTop: "25px" }}>Employer Contribution</h3>
                <div className="profile-grid">
                  <div>
                    <span>Employer PF</span>
                    <strong>₹{money(payslip.employer_pf)}</strong>
                  </div>
                  <div>
                    <span>Employer ESIC</span>
                    <strong>₹{money(payslip.employer_esic)}</strong>
                  </div>
                  <div>
                    <span>Total Employer Contribution</span>
                    <strong>₹{money(payslip.total_employer_contribution)}</strong>
                  </div>
                  <div>
                    <span>Total Employer Cost</span>
                    <strong>₹{money(payslip.total_employer_cost)}</strong>
                  </div>
                </div>

                <h3 style={{ marginTop: "25px" }}>Bank Details</h3>
                <div className="profile-grid">
                  <div>
                    <span>Bank Name</span>
                    <strong>{display(payslip.bank_name)}</strong>
                  </div>
                  <div>
                    <span>Account Number</span>
                    <strong>{display(payslip.account_number)}</strong>
                  </div>
                  <div>
                    <span>IFSC Code</span>
                    <strong>{display(payslip.ifsc_code)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
};

export default EmployeePayslip;