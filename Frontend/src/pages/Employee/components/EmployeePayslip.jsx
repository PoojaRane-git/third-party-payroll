import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

// =====================================================
// NUMBER TO WORDS - INDIAN FORMAT
// =====================================================

const numberToWordsIndian = (num) => {
  const value = Math.floor(Number(num || 0));

  if (value === 0) return "Zero";

  const units = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  ];

  const teens = [
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];

  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  const convertLessThanThousand = (n) => {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${units[n % 10]}`.trim();
    return `${units[Math.floor(n / 100)]} Hundred ${convertLessThanThousand(n % 100)}`.trim();
  };

  let crore = Math.floor(value / 10000000);
  let lakh = Math.floor((value % 10000000) / 100000);
  let thousand = Math.floor((value % 100000) / 1000);
  let remainder = value % 1000;

  const result = [];
  if (crore > 0) result.push(`${convertLessThanThousand(crore)} Crore`);
  if (lakh > 0) result.push(`${convertLessThanThousand(lakh)} Lakh`);
  if (thousand > 0) result.push(`${convertLessThanThousand(thousand)} Thousand`);
  if (remainder > 0) result.push(convertLessThanThousand(remainder));

  return result.join(" ");
};

// =====================================================
// DATE-RANGE HELPER — turns "2025-08" (or any parseable date) into
// { label: "1 Aug 2025 to 31 Aug 2025" }
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
// PAYSLIP PDF GENERATOR
// Rebuilt to match the approved reference layout exactly:
// no logo, boxed border, and an extra "Gross Salary" column
// alongside "Amount" for both Earnings and Deductions.
// =====================================================

const generatePayslipPDF = (employee, salary, periodLabel, filename) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  const formatCurrency = (num) => {
    if (num == null) return "0.00";
    const str = Number(num).toFixed(2).toString();
    const parts = str.split(".");
    let integerPart = parts[0];
    const fractionPart = parts[1];
    const lastThree =
      integerPart.length > 3 ? integerPart.slice(integerPart.length - 3) : integerPart;
    const otherNumbers = integerPart.slice(0, integerPart.length - 3);
    const formattedOtherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    const finalInteger = otherNumbers ? formattedOtherNumbers + "," + lastThree : lastThree;
    return `${finalInteger}.${fractionPart}`;
  };

  // ---------------------------------------------------
  // 1. Header — text only, left-aligned, no logo
  // ---------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Talent Corner HR Services Pvt Ltd.", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("708/709, Bhaveshwar Arcade NX", margin, y);
  y += 5;
  doc.text("Opp Shreyas Cinema, LBS Marg, Ghatkopar(W),", margin, y);
  y += 5;
  doc.text("Mumbai-400086", margin, y);
  y += 5;
  doc.text("UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)", margin, y);
  y += 5;
  doc.text("E-Mail : accounts@talentcorner.in", margin, y);
  y += 8;

  const boxTop = y;
  const innerX = margin + 3;

  // ---------------------------------------------------
  // 2. Title block
  // ---------------------------------------------------
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Pay Slip", innerX, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`for ${periodLabel}`, innerX, y + 5);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Pay Slip for ${periodLabel}`, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(13);
  doc.text((employee.name || "N/A").toUpperCase(), pageWidth / 2, y, { align: "center" });
  y += 9;

  // ---------------------------------------------------
  // 3. Employee details (two independent columns)
  // ---------------------------------------------------
  const col1X = innerX;
  const col2X = pageWidth / 2 + 10;
  const rowHeight = 5;
  doc.setFontSize(9);

  const drawRow = (x, labelWidth, valueX, label, value, rowY) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, x, rowY);
    doc.text(":", x + labelWidth, rowY);
    doc.setFont("helvetica", "bold");
    doc.text(String(value ?? "N/A"), valueX, rowY);
  };

  let leftY = y;
  const leftLabelWidth = 32;
  const leftValueX = col1X + leftLabelWidth + 3;

  drawRow(col1X, leftLabelWidth, leftValueX, "Employee Number", employee.id, leftY);
  leftY += rowHeight;
  drawRow(col1X, leftLabelWidth, leftValueX, "Function", employee.department, leftY);
  leftY += rowHeight;
  drawRow(col1X, leftLabelWidth, leftValueX, "Designation", employee.designation, leftY);
  leftY += rowHeight;
  drawRow(col1X, leftLabelWidth, leftValueX, "Location", employee.branchOfficeName, leftY);
  leftY += rowHeight;

  // Bank Details — label once, then 4 stacked value lines
  doc.setFont("helvetica", "normal");
  doc.text("Bank Details", col1X, leftY);
  doc.text(":", col1X + leftLabelWidth, leftY);
  doc.setFont("helvetica", "bold");
  doc.text(`Name - ${employee.bankAccountName || "N/A"}`, leftValueX, leftY);
  leftY += rowHeight;
  doc.text(`BRANCH - ${employee.bankBranch || "N/A"}`, leftValueX, leftY);
  leftY += rowHeight;
  doc.text(`IFSC code - ${employee.ifscCode || "N/A"}`, leftValueX, leftY);
  leftY += rowHeight;
  doc.text(`ACC NO. ${employee.bankACNumber || "N/A"}`, leftValueX, leftY);
  leftY += rowHeight;

  drawRow(
    col1X,
    leftLabelWidth,
    leftValueX,
    "Date of joining",
    employee.joiningDate
      ? new Date(employee.joiningDate)
          .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
          .replace(/ /g, "-")
      : "N/A",
    leftY
  );
  leftY += rowHeight;

  let rightY = y;
  const rightLabelWidth = 45;
  const rightValueX = col2X + rightLabelWidth + 3;

  drawRow(col2X, rightLabelWidth, rightValueX, "Tax Regime", "Regular Tax Regime", rightY);
  rightY += rowHeight;
  drawRow(col2X, rightLabelWidth, rightValueX, "Income Tax Number (PAN)", employee.panCard, rightY);
  rightY += rowHeight;
  drawRow(
    col2X,
    rightLabelWidth,
    rightValueX,
    "Universal Account Number (UAN)",
    employee.uanNumber,
    rightY
  );
  rightY += rowHeight;
  drawRow(col2X, rightLabelWidth, rightValueX, "PF account number", employee.pfACNumber, rightY);
  rightY += rowHeight;
  drawRow(col2X, rightLabelWidth, rightValueX, "ESI Number", employee.esiRegistrationNumber, rightY);
  rightY += rowHeight;
  drawRow(
    col2X,
    rightLabelWidth,
    rightValueX,
    "PR Account Number (PRAN)",
    employee.pran,
    rightY
  );
  rightY += rowHeight;

  y = Math.max(leftY, rightY) + 6;

  // ---------------------------------------------------
  // 4. Earnings & Deductions table (with Gross Salary column)
  // ---------------------------------------------------
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  const earningX = innerX;
  const earningAmtX = margin + 72;
  const earningGrossX = margin + 98;
  const deductionX = margin + 108;
  const deductionAmtX = margin + 168;
  const deductionGrossX = pageWidth - margin - 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Earnings", earningX, y);
  doc.text("Amount", earningAmtX, y, { align: "right" });
  doc.text("Gross Salary", earningGrossX, y, { align: "right" });
  doc.text("Deductions", deductionX, y);
  doc.text("Amount", deductionAmtX, y, { align: "right" });
  doc.text("Gross Salary", deductionGrossX, y, { align: "right" });
  y += 5;

  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  const earningsRows = [
    { label: "Basic Salary", amount: salary.basicSalary, gross: salary.fixedGrossSalary },
    { label: "HRA", amount: salary.hra, gross: salary.hra },
    { label: "Convenyance Expenses", amount: salary.conveyance, gross: salary.conveyance },
    { label: "Medical Allowance", amount: salary.medicalAllowance, gross: salary.medicalAllowance },
    { label: "Other Expenses", amount: salary.otherAllowance, gross: salary.otherAllowance },
    { label: "Gratuity", amount: salary.gratuity, gross: 0 },
  ];
  const deductionRows = [
    { label: "Provident Fund", amount: salary.pf, gross: null },
    { label: "Professional Tax", amount: salary.pt, gross: null },
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const tableRowHeight = 5.5;
  const numRows = Math.max(earningsRows.length, deductionRows.length);

  for (let i = 0; i < numRows; i++) {
    if (i < earningsRows.length) {
      const row = earningsRows[i];
      doc.text(row.label, earningX, y);
      doc.text(formatCurrency(row.amount), earningAmtX, y, { align: "right" });
      doc.text(formatCurrency(row.gross), earningGrossX, y, { align: "right" });
    }
    if (i < deductionRows.length) {
      const row = deductionRows[i];
      doc.text(row.label, deductionX, y);
      doc.text(formatCurrency(row.amount), deductionAmtX, y, { align: "right" });
      doc.text(row.gross == null ? "-" : formatCurrency(row.gross), deductionGrossX, y, {
        align: "right",
      });
    }
    y += tableRowHeight;
  }

  const totalEarnings = earningsRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const totalDeductions = deductionRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const netPayable = totalEarnings - totalDeductions;

  // ---------------------------------------------------
  // 5. Totals
  // ---------------------------------------------------
  y += 1;
  doc.setLineWidth(0.3);
  doc.line(margin, y, earningGrossX, y);
  doc.line(deductionX - 2, y, deductionGrossX, y);
  y += 5.5;

  doc.setFont("helvetica", "bold");
  doc.text("Total Earnings", earningX, y);
  doc.text(formatCurrency(totalEarnings), earningAmtX, y, { align: "right" });
  doc.text(formatCurrency(totalEarnings), earningGrossX, y, { align: "right" });
  doc.text("Total Deductions", deductionX, y);
  doc.text(formatCurrency(totalDeductions), deductionAmtX, y, { align: "right" });
  doc.text(formatCurrency(totalDeductions), deductionGrossX, y, { align: "right" });
  y += 7;

  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5.5;
  doc.text("Net Amount", deductionX, y);
  doc.text(formatCurrency(netPayable), deductionAmtX, y, { align: "right" });
  doc.text(formatCurrency(netPayable), deductionGrossX, y, { align: "right" });
  y += 8;

  // ---------------------------------------------------
  // 6. Amount in words
  // ---------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Amount (in words):", innerX, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const amountInWords = `INR ${numberToWordsIndian(Math.round(netPayable))} only`;
  const textLines = doc.splitTextToSize(amountInWords, pageWidth - margin * 2 - 6);
  doc.text(textLines, innerX, y);
  y += textLines.length * 5 + 4;

  // ---------------------------------------------------
  // Outer box around the whole payslip block
  // ---------------------------------------------------
  doc.setLineWidth(0.4);
  doc.rect(margin, boxTop, pageWidth - margin * 2, y - boxTop);

  // ---------------------------------------------------
  // 7. Signature line (text only — no signature/stamp image)
  // ---------------------------------------------------
  const footerY = y + 25;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Authorised Signatory", pageWidth - margin - 3, footerY, { align: "right" });

  doc.save(filename);
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
      // `salary` shapes generatePayslipPDF expects.
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

      const salary = {
        // "Gross Salary" column for Basic Salary should be the fixed
        // monthly gross salary (before proration). Add fixed_gross_salary
        // to the payslip API for accuracy — falls back to gross_salary.
        fixedGrossSalary: Number(payslip.fixed_gross_salary ?? payslip.gross_salary ?? 0),
        basicSalary: Number(payslip.basic_salary || 0),
        hra: Number(payslip.hra || 0), // TODO: add to payslip API response
        conveyance: Number(payslip.conveyance || 0), // TODO: add to payslip API response
        medicalAllowance: Number(payslip.medical_allowance || 0), // TODO: add to payslip API response
        otherAllowance: Number(payslip.other_allowance ?? payslip.allowances ?? 0),
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