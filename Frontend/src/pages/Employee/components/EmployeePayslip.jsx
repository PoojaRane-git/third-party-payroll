import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

import logo from "../../../assets/logo.jpeg";

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
// LOAD IMAGE
// =====================================================

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    img.src = src;
  });
};

// =====================================================
// PAYSLIP PDF GENERATOR
// Ported EXACTLY (layout + calc logic) from PaySlip.jsx — the approved format.
// Only the logo source was swapped to use the bundled asset import instead
// of a public/ path, since that's how this project already loads it.
// =====================================================

const generatePayslipPDF = async (employee, salary, period, filename) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // Custom robust currency formatter for Indian locale
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

  // 1. Logo and Header
  try {
    const img = await loadImage(logo);
    const logoWidth = 35;
    const aspectRatio = img.width / img.height;
    const logoHeight = logoWidth / aspectRatio;
    doc.addImage(img, "JPEG", margin, y, logoWidth, logoHeight);
  } catch (error) {
    console.warn("Payslip logo could not be loaded, skipping...", error);
  }

  const headerTextX = pageWidth / 2 + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Talent Corner HR Services Pvt. Ltd.", headerTextX, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("708/709, Bhaveshwar Arcade NX, Opp Shreyas Cinema, LBS Marg", headerTextX, y + 11, { align: "center" });
  doc.text("Ghatkopar(W), Mumbai-400086", headerTextX, y + 16, { align: "center" });
  doc.text("GSTIN : 27AACCT6635P1ZP", headerTextX, y + 21, { align: "center" });
  doc.text("UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)", headerTextX, y + 26, { align: "center" });
  doc.text("E-Mail : accounts@talentcorner.in", headerTextX, y + 31, { align: "center" });
  y += 40;

  // 2. Title and Period
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Pay Slip", pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`for ${period}`, pageWidth / 2, y, { align: "center" });
  y += 10;

  // 3. Employee Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text((employee.name || "N/A").toUpperCase(), pageWidth / 2, y, { align: "center" });
  y += 12;

  // 4. Details Section with Text Wrapping
  const col1X = margin;
  const col2X = pageWidth / 2 + 10;
  const detailLineHeight = 5;
  doc.setFontSize(10);

  const detailsLeft = [
    { label: "Employee Number", value: employee.id || "N/A" },
    { label: "Function", value: employee.department || "N/A" },
    { label: "Designation", value: employee.designation || "N/A" },
    { label: "Location", value: employee.branchOfficeName || "N/A" },
    {
      label: "Bank Details",
      value: `${employee.bankACNumber || ""}, ${employee.bankName || ""}`.replace(/^, /, "") || "N/A",
    },
    {
      label: "Date of joining",
      value: employee.joiningDate
        ? new Date(employee.joiningDate)
            .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
            .replace(/ /g, "-")
        : "N/A",
    },
  ];
  const detailsRight = [
    { label: "Tax Regime", value: "Regular Tax Regime" },
    { label: "Income Tax Number (PAN)", value: employee.panCard || "N/A" },
    { label: "Universal Account Number (UAN)", value: employee.uanNumber || "N/A" },
    { label: "PF account number", value: employee.pfACNumber || "N/A" },
    { label: "ESI Number", value: employee.esiRegistrationNumber || "N/A" },
    { label: "PR Account Number (PRAN)", value: employee.pran || "N/A" },
  ];

  const leftLabelMaxWidth = 45;
  const rightLabelMaxWidth = 45;
  const leftValueX = col1X + leftLabelMaxWidth;
  const rightValueX = col2X + rightLabelMaxWidth;
  const leftValueMaxWidth = col2X - leftValueX - 2;
  const rightValueMaxWidth = pageWidth - rightValueX - margin;

  for (let i = 0; i < Math.max(detailsLeft.length, detailsRight.length); i++) {
    const currentY = y;
    let leftLabelLines = [""],
      leftValueLines = [""],
      rightLabelLines = [""],
      rightValueLines = [""];

    if (detailsLeft[i]) {
      leftLabelLines = doc.splitTextToSize(detailsLeft[i].label, leftLabelMaxWidth);
      leftValueLines = doc.splitTextToSize(String(detailsLeft[i].value), leftValueMaxWidth);
    }
    if (detailsRight[i]) {
      rightLabelLines = doc.splitTextToSize(detailsRight[i].label, rightLabelMaxWidth);
      rightValueLines = doc.splitTextToSize(String(detailsRight[i].value), rightValueMaxWidth);
    }

    const maxLines = Math.max(
      leftLabelLines.length,
      leftValueLines.length,
      rightLabelLines.length,
      rightValueLines.length
    );

    if (detailsLeft[i]) {
      doc.setFont("helvetica", "normal");
      doc.text(leftLabelLines, col1X, currentY);
      doc.text(":", leftValueX - 5, currentY);
      doc.setFont("helvetica", "bold");
      doc.text(leftValueLines, leftValueX, currentY);
    }
    if (detailsRight[i]) {
      doc.setFont("helvetica", "normal");
      doc.text(rightLabelLines, col2X, currentY);
      doc.text(":", rightValueX - 5, currentY);
      doc.setFont("helvetica", "bold");
      doc.text(rightValueLines, rightValueX, currentY);
    }

    y += maxLines * detailLineHeight + 1;
  }
  y += 5;

  // 5. Earnings & Deductions Table
  const epsContribution =
    salary.employerPf > 0 ? Math.min(Math.round(salary.pfWages * 0.0833), 1250) : 0;
  const epfContribution = salary.employerPf > 0 ? salary.employerPf - epsContribution : 0;
  const displayGratuity = salary.gratuity > 0 ? -Math.abs(salary.gratuity) : 0;

  const earningsData = [
    { label: "Basic Salary", value: salary.earnBasicSalary },
    { label: "HRA", value: salary.earnHRA },
    { label: "Convenyance Expenses", value: salary.earnConveyance },
    { label: "Medical Allowance", value: salary.earnMedicalAllowance },
    { label: "Other Expenses", value: salary.earnOtherAllowance },
    { label: "EPS@8.33%", value: epsContribution },
    { label: "EPF@3.67%", value: epfContribution },
    { label: "Gratuity", value: displayGratuity },
  ];
  const deductionsData = [
    { label: "Provident Fund Employee@12%", value: salary.pf },
    { label: "Professional Tax", value: salary.pt },
  ];

  const totalEarnings = earningsData.reduce((sum, item) => sum + (item.value || 0), 0);
  const totalDeductions = deductionsData.reduce(
    (sum, item) => sum + (item.value > 0 ? item.value : 0),
    0
  );
  const netPayable = totalEarnings - totalDeductions;

  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  const earningX = margin + 2,
    earningAmtX = margin + 90,
    deductionX = margin + 100,
    deductionAmtX = pageWidth - margin - 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Earnings", earningX, y);
  doc.text("Amount", earningAmtX, y, { align: "right" });
  doc.text("Deductions", deductionX, y);
  doc.text("Amount", deductionAmtX, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const tableLineHeight = 6;
  const numRows = Math.max(earningsData.length, deductionsData.length);
  for (let i = 0; i < numRows; i++) {
    if (i < earningsData.length && earningsData[i].value !== 0) {
      const item = earningsData[i];
      const valueStr =
        item.label === "Gratuity"
          ? `(-) ${formatCurrency(Math.abs(item.value))}`
          : formatCurrency(item.value);
      doc.text(item.label, earningX, y);
      doc.text(valueStr, earningAmtX, y, { align: "right" });
    }
    if (
      i < deductionsData.length &&
      (deductionsData[i].label === "Professional Tax" || deductionsData[i].value !== 0)
    ) {
      const item = deductionsData[i];
      doc.text(item.label, deductionX, y);
      doc.text(formatCurrency(item.value), deductionAmtX, y, { align: "right" });
    }
    y += tableLineHeight;
  }

  // 6. Totals
  y += 2;
  doc.setLineWidth(0.4);
  doc.line(margin, y, earningAmtX, y);
  doc.line(deductionX - 2, y, deductionAmtX + 2, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total Earnings", earningX, y);
  doc.text(formatCurrency(totalEarnings), earningAmtX, y, { align: "right" });
  doc.text("Total Deductions", deductionX, y);
  doc.text(formatCurrency(totalDeductions), deductionAmtX, y, { align: "right" });
  y += 8;

  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.text("Net Amount", margin, y);
  doc.text(formatCurrency(netPayable), deductionAmtX, y, { align: "right" });
  y += 8;

  // 7. Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const amountInWords = `Amount (in words): INR ${numberToWordsIndian(Math.round(netPayable))} Only`;
  const textLines = doc.splitTextToSize(amountInWords, pageWidth - margin * 2);
  doc.text(textLines, margin, y);

  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.text(`for Talent Corner HR Services Pvt. Ltd.`, pageWidth - margin, footerY, { align: "right" });
  doc.text("Authorised Signatory", pageWidth - margin, footerY + 15, { align: "right" });

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

  const downloadPayslip = async (payslip) => {
    try {
      setDownloading(payslip.id);

      // ---------------------------------------------------
      // Map the flat `payslip` record from the API into the
      // `employee` + `salary` shapes that generatePayslipPDF
      // (ported from PaySlip.jsx) expects.
      //
      // Fields marked TODO don't exist yet on the payslip
      // object returned by /employee/payroll/me — add them
      // to that API response / DB record to make the PDF
      // fully accurate. Until then they safely fall back to
      // "N/A" / 0.
      // ---------------------------------------------------
      const employee = {
        name: payslip.employee_name,
        id: payslip.employee_ref_id,
        department: payslip.department,
        designation: payslip.designation,
        branchOfficeName: payslip.branch_office_name,
        bankACNumber: payslip.account_number,
        bankName: payslip.bank_name,
        joiningDate: payslip.joining_date, // TODO: add to payslip API response
        panCard: payslip.pan_card,
        uanNumber: payslip.uan_number,
        pfACNumber: payslip.pf_ac_number,
        esiRegistrationNumber: payslip.esi_number,
        pran: payslip.pran, // TODO: add to payslip API response
      };

      const salary = {
        earnBasicSalary: Number(payslip.basic_salary || 0),
        earnHRA: Number(payslip.hra || 0), // TODO: add to payslip API response
        earnConveyance: Number(payslip.conveyance || 0), // TODO: add to payslip API response
        earnMedicalAllowance: Number(payslip.medical_allowance || 0), // TODO: add to payslip API response
        // Falls back to the lump "allowances" field until HRA/Conveyance/
        // Medical are split out server-side, so nothing is silently dropped.
        earnOtherAllowance: Number(payslip.other_allowance ?? payslip.allowances ?? 0),
        pfWages: Number(payslip.pf_wages || payslip.gross_salary || 0), // TODO: ideally gross - HRA
        pf: Number(payslip.pf || 0),
        pt: Number(payslip.professional_tax || 0),
        gratuity: Number(payslip.gratuity || 0), // TODO: add to payslip API response
        employerPf: Number(payslip.employer_pf || 0),
      };

      const period = formatSalaryMonth(payslip.salary_month);
      const monthSlug = String(payslip.salary_month || "payslip").replace(/[^a-zA-Z0-9-_]/g, "-");
      const employeeSlug = String(payslip.employee_name || "Employee")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_");

      await generatePayslipPDF(employee, salary, period, `${employeeSlug}_Payslip_${monthSlug}.pdf`);
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