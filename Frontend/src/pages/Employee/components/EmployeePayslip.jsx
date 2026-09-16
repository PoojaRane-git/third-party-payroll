import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import {logo} from '../../../../src/assets/logo.jpeg'

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

// =====================================================
// PDF HELPERS (mirrors PaySlip.jsx)
// =====================================================

// Convert numbers to Indian words
const numberToWordsIndian = (num) => {
  if (num === 0) return "Zero";
  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertLessThanThousand = (n) => {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${units[n % 10]}`.trim();
    return `${units[Math.floor(n / 100)]} Hundred ${convertLessThanThousand(n % 100)}`.trim();
  };

  let crore = Math.floor(num / 10000000);
  let lakh = Math.floor((num % 10000000) / 100000);
  let thousand = Math.floor((num % 100000) / 1000);
  let hundred = Math.floor(num % 1000);

  let result = [];
  if (crore > 0) result.push(`${convertLessThanThousand(crore)} Crore`);
  if (lakh > 0) result.push(`${convertLessThanThousand(lakh)} Lakh`);
  if (thousand > 0) result.push(`${convertLessThanThousand(thousand)} Thousand`);
  if (hundred > 0) result.push(convertLessThanThousand(hundred));

  return result.join(" ").trim() || "Zero";
};

// Load logo image for the PDF header
const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

const EmployeePayslip = () => {
  // =====================================================
  // STATE
  // =====================================================

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

        console.log(
          "Fetching payslips for logged-in employee..."
        );

        const response = await api.get(
          "/employee/payroll/me"
        );

        console.log(
          "Employee payslip response:",
          response.data
        );

        let data = [];

        if (
          Array.isArray(response.data?.payslips)
        ) {
          data = response.data.payslips;
        } else if (
          Array.isArray(response.data?.data)
        ) {
          data = response.data.data;
        } else if (
          Array.isArray(response.data)
        ) {
          data = response.data;
        }

        console.log(
          "Processed payslips:",
          data
        );

        setPayslips(data);

      } catch (err) {
        console.error(
          "Employee payslip error:",
          err
        );

        console.error(
          "Server response:",
          err.response?.data
        );

        setPayslips([]);

        setError(
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to load payslips."
        );

      } finally {
        setLoading(false);
      }
    };

    fetchPayslips();
  }, []);

  // =====================================================
  // HELPERS
  // =====================================================

  const money = (value) => {
    const amount = Number(value ?? 0);

    if (!Number.isFinite(amount)) {
      return "0.00";
    }

    return amount.toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  const display = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "N/A";
    }

    return value;
  };

  const formatSalaryMonth = (value) => {
    if (!value) {
      return "--";
    }

    const text = String(value);

    // Example: 2026-08
    if (/^\d{4}-\d{2}$/.test(text)) {
      const [year, month] =
        text.split("-");

      const date = new Date(
        Number(year),
        Number(month) - 1,
        1
      );

      return date.toLocaleDateString(
        "en-IN",
        {
          month: "long",
          year: "numeric",
        }
      );
    }

    const date = new Date(text);

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(
        "en-IN",
        {
          month: "long",
          year: "numeric",
        }
      );
    }

    return text;
  };

  const getStatusClass = (status) => {
    const value = String(
      status || ""
    )
      .toLowerCase()
      .trim();

    if (
      value === "approved" ||
      value === "locked" ||
      value === "paid"
    ) {
      return "status-badge status-approved";
    }

    if (
      value === "pending" ||
      value === "draft"
    ) {
      return "status-badge status-pending";
    }

    if (
      value === "rejected" ||
      value === "cancelled"
    ) {
      return "status-badge status-rejected";
    }

    return "status-badge";
  };

  // =====================================================
  // DOWNLOAD PAYSLIP
  // Same visual template as PaySlip.jsx:
  // logo + company header, title/period, employee name,
  // two-column details grid, bordered earnings/deductions
  // table, totals, amount in words, signatory footer.
  //
  // Field values are pulled from the employee's own
  // payslip record (third_party_payroll), not the
  // calculateSalary() shape used in PaySlip.jsx.
  // =====================================================

  const downloadPayslip = async (payslip) => {
    try {
      setDownloading(payslip.id);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const margin = 15;
      let y = 15;

      // Custom robust currency formatter (Indian grouping)
      const formatCurrency = (num) => {
        if (num == null) return "0.00";
        const str = Number(num).toFixed(2).toString();
        const parts = str.split(".");
        let integerPart = parts[0];
        const fractionPart = parts[1];
        const lastThree =
          integerPart.length > 3
            ? integerPart.slice(integerPart.length - 3)
            : integerPart;
        const otherNumbers = integerPart.slice(
          0,
          integerPart.length - 3
        );
        const formattedOtherNumbers = otherNumbers.replace(
          /\B(?=(\d{2})+(?!\d))/g,
          ","
        );
        const finalInteger = otherNumbers
          ? formattedOtherNumbers + "," + lastThree
          : lastThree;
        return `${finalInteger}.${fractionPart}`;
      };

      // =================================================
      // 1. LOGO + COMPANY HEADER
      // =================================================

      const logoUrl = "/assets/logo.jpeg";

      try {
        const img = await loadImage(logoUrl);
        const logoWidth = 35;
        const aspectRatio = img.width / img.height;
        const logoHeight = logoWidth / aspectRatio;
        doc.addImage(img, "PNG", margin, y, logoWidth, logoHeight);
      } catch (imgErr) {
        console.warn("Logo not found at /logo.png, skipping...");
      }

      const headerTextX = pageWidth / 2 + 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        "Talent Corner HR Services Pvt. Ltd.",
        headerTextX,
        y + 5,
        { align: "center" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        "708/709, Bhaveshwar Arcade NX, Opp Shreyas Cinema, LBS Marg",
        headerTextX,
        y + 11,
        { align: "center" }
      );
      doc.text(
        "Ghatkopar(W), Mumbai-400086",
        headerTextX,
        y + 16,
        { align: "center" }
      );
      doc.text(
        "GSTIN : 27AACCT6635P1ZP",
        headerTextX,
        y + 21,
        { align: "center" }
      );
      doc.text(
        "UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)",
        headerTextX,
        y + 26,
        { align: "center" }
      );
      doc.text(
        "E-Mail : accounts@talentcorner.in",
        headerTextX,
        y + 31,
        { align: "center" }
      );

      y += 40;

      // =================================================
      // 2. TITLE + PERIOD
      // =================================================

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Pay Slip", pageWidth / 2, y, { align: "center" });
      y += 6;

      const monthYearStr = `for the month of ${formatSalaryMonth(
        payslip.salary_month
      )}`;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(monthYearStr, pageWidth / 2, y, { align: "center" });
      y += 10;

      // =================================================
      // 3. EMPLOYEE NAME
      // =================================================

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(
        String(payslip.employee_name || "N/A").toUpperCase(),
        pageWidth / 2,
        y,
        { align: "center" }
      );
      y += 12;

      // =================================================
      // 4. DETAILS GRID (with text wrapping)
      // =================================================

      const col1X = margin;
      const col2X = pageWidth / 2 + 10;
      const detailLineHeight = 5;
      doc.setFontSize(10);

      const bankDetails = `${payslip.account_number || ""}${
        payslip.account_number && payslip.bank_name ? ", " : ""
      }${payslip.bank_name || ""}`;

      const detailsLeft = [
        { label: "Employee Number", value: display(payslip.employee_ref_id) },
        { label: "Function", value: display(payslip.department) },
        { label: "Designation", value: display(payslip.designation) },
        { label: "Location", value: display(payslip.branch_office_name) },
        { label: "Bank Details", value: bankDetails || "N/A" },
        { label: "Payslip ID", value: display(payslip.id) },
      ];

      const detailsRight = [
        { label: "Status", value: display(payslip.status) },
        { label: "Income Tax Number (PAN)", value: display(payslip.pan_card) },
        { label: "Universal Account Number (UAN)", value: display(payslip.uan_number) },
        { label: "PF account number", value: display(payslip.pf_ac_number) },
        { label: "ESI Number", value: display(payslip.esi_number) },
        { label: "IFSC Code", value: display(payslip.ifsc_code) },
      ];

      const leftLabelMaxWidth = 45;
      const rightLabelMaxWidth = 45;
      const leftValueX = col1X + leftLabelMaxWidth;
      const rightValueX = col2X + rightLabelMaxWidth;
      const leftValueMaxWidth = col2X - leftValueX - 2;
      const rightValueMaxWidth = pageWidth - rightValueX - margin;

      for (
        let i = 0;
        i < Math.max(detailsLeft.length, detailsRight.length);
        i++
      ) {
        const currentY = y;
        let leftLabelLines = [""],
          leftValueLines = [""],
          rightLabelLines = [""],
          rightValueLines = [""];

        if (detailsLeft[i]) {
          leftLabelLines = doc.splitTextToSize(
            detailsLeft[i].label,
            leftLabelMaxWidth
          );
          leftValueLines = doc.splitTextToSize(
            String(detailsLeft[i].value),
            leftValueMaxWidth
          );
        }
        if (detailsRight[i]) {
          rightLabelLines = doc.splitTextToSize(
            detailsRight[i].label,
            rightLabelMaxWidth
          );
          rightValueLines = doc.splitTextToSize(
            String(detailsRight[i].value),
            rightValueMaxWidth
          );
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

      // =================================================
      // 5. EARNINGS & DEDUCTIONS TABLE
      // =================================================

      const earningsData = [
        { label: "Basic Salary", value: Number(payslip.basic_salary || 0) },
        { label: "Allowances", value: Number(payslip.allowances || 0) },
        { label: "Overtime", value: Number(payslip.overtime || 0) },
        { label: "Bonus", value: Number(payslip.bonus || 0) },
        { label: "Employer PF", value: Number(payslip.employer_pf || 0) },
        { label: "Employer ESIC", value: Number(payslip.employer_esic || 0) },
      ];

      const deductionsData = [
        { label: "Employee PF", value: Number(payslip.pf || 0) },
        { label: "ESIC", value: Number(payslip.esic || 0) },
        { label: "Tax / TDS", value: Number(payslip.tax || 0) },
        { label: "Professional Tax", value: Number(payslip.professional_tax || 0) },
        { label: "LOP Deduction", value: Number(payslip.lop || 0) },
      ];

      const totalEarnings = Number(
        payslip.gross_salary ??
        earningsData
          .slice(0, 4)
          .reduce((sum, item) => sum + (item.value || 0), 0)
      );

      const totalDeductions = Number(
        payslip.total_deductions ??
        deductionsData.reduce((sum, item) => sum + (item.value || 0), 0)
      );

      const netPayable = Number(
        payslip.net_salary ?? totalEarnings - totalDeductions
      );

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
      const numRows = Math.max(
        earningsData.length,
        deductionsData.length
      );

      for (let i = 0; i < numRows; i++) {
        if (i < earningsData.length && earningsData[i].value !== 0) {
          const item = earningsData[i];
          doc.text(item.label, earningX, y);
          doc.text(
            formatCurrency(item.value),
            earningAmtX,
            y,
            { align: "right" }
          );
        }
        if (
          i < deductionsData.length &&
          (deductionsData[i].label === "Professional Tax" ||
            deductionsData[i].value !== 0)
        ) {
          const item = deductionsData[i];
          doc.text(item.label, deductionX, y);
          doc.text(
            formatCurrency(item.value),
            deductionAmtX,
            y,
            { align: "right" }
          );
        }
        y += tableLineHeight;
      }

      // =================================================
      // 6. TOTALS
      // =================================================

      y += 2;
      doc.setLineWidth(0.4);
      doc.line(margin, y, earningAmtX, y);
      doc.line(deductionX - 2, y, deductionAmtX + 2, y);
      y += 6;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Total Earnings", earningX, y);
      doc.text(formatCurrency(totalEarnings), earningAmtX, y, {
        align: "right",
      });
      doc.text("Total Deductions", deductionX, y);
      doc.text(formatCurrency(totalDeductions), deductionAmtX, y, {
        align: "right",
      });
      y += 8;

      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      doc.text("Net Amount", margin, y);
      doc.text(formatCurrency(netPayable), deductionAmtX, y, {
        align: "right",
      });
      y += 8;

      // =================================================
      // 7. FOOTER
      // =================================================

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const amountInWords = `Amount (in words): INR ${numberToWordsIndian(
        Math.round(netPayable)
      )} Only`;
      const textLines = doc.splitTextToSize(
        amountInWords,
        pageWidth - margin * 2
      );
      doc.text(textLines, margin, y);

      const footerY = doc.internal.pageSize.getHeight() - 30;
      doc.text(
        `for Talent Corner HR Services Pvt. Ltd.`,
        pageWidth - margin,
        footerY,
        { align: "right" }
      );
      doc.text(
        "Authorised Signatory",
        pageWidth - margin,
        footerY + 15,
        { align: "right" }
      );

      // =================================================
      // FILE NAME
      // =================================================

      const month = String(
        payslip.salary_month || "payslip"
      ).replace(/[^a-zA-Z0-9-_]/g, "-");

      const employee = String(
        payslip.employee_name || "Employee"
      )
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_");

      doc.save(`${employee}_Payslip_${month}.pdf`);

    } catch (error) {

      console.error(
        "Payslip download error:",
        error
      );

      alert(
        "Unable to download payslip."
      );

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

          <h3>
            Loading payslips...
          </h3>

          <p>
            Please wait while we load
            your salary records.
          </p>

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

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="page-header">

          <div>

            <h1>
              Payslips
            </h1>

            <p>
              View your complete salary
              and payslip records.
            </p>

          </div>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* =================================================
            NO PAYSLIPS
        ================================================= */}

        {payslips.length === 0 ? (

          <div className="empty-state">

            <h3>
              No payslips available
            </h3>

            <p>
              Your approved payroll records
              will appear here.
            </p>

          </div>

        ) : (

          <div>

            {payslips.map(
              (payslip) => (

                <div
                  key={payslip.id}
                  className="table-card"
                  style={{
                    marginBottom:
                      "25px",
                    padding:
                      "25px",
                  }}
                >

                  {/* =================================================
                      PAYSLIP HEADER
                  ================================================= */}

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap:
                        "15px",
                      flexWrap:
                        "wrap",
                      marginBottom:
                        "25px",
                    }}
                  >

                    <div>

                      <h2
                        style={{
                          margin: 0,
                        }}
                      >
                        {formatSalaryMonth(
                          payslip.salary_month
                        )}
                      </h2>

                      <p>
                        Payslip ID:{" "}
                        {display(
                          payslip.id
                        )}
                      </p>

                    </div>

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap:
                          "12px",
                      }}
                    >

                      <span
                        className={getStatusClass(
                          payslip.status
                        )}
                      >
                        {display(
                          payslip.status
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          downloadPayslip(
                            payslip
                          )
                        }
                        disabled={
                          downloading ===
                          payslip.id
                        }
                        style={{
                          padding:
                            "10px 16px",
                          border:
                            "none",
                          borderRadius:
                            "8px",
                          cursor:
                            downloading ===
                            payslip.id
                              ? "not-allowed"
                              : "pointer",
                          fontWeight:
                            "600",
                        }}
                      >
                        {downloading ===
                        payslip.id
                          ? "Generating..."
                          : "Download Payslip"}
                      </button>

                    </div>

                  </div>

                  {/* =================================================
                      EARNINGS
                  ================================================= */}

                  <h3>
                    Earnings
                  </h3>

                  <div className="profile-grid">

                    <div>
                      <span>
                        Basic Salary
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.basic_salary
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Allowances
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.allowances
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Overtime
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.overtime
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Bonus
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.bonus
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Gross Salary
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.gross_salary
                        )}
                      </strong>
                    </div>

                  </div>

                  {/* =================================================
                      DEDUCTIONS
                  ================================================= */}

                  <h3
                    style={{
                      marginTop:
                        "25px",
                    }}
                  >
                    Deductions
                  </h3>

                  <div className="profile-grid">

                    <div>
                      <span>
                        Employee PF
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.pf
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        ESIC
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.esic
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Tax / TDS
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.tax
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Professional Tax
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.professional_tax
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        LOP Deduction
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.lop
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Deductions
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.total_deductions
                        )}
                      </strong>
                    </div>

                  </div>

                  {/* =================================================
                      NET SALARY
                  ================================================= */}

                  <div
                    style={{
                      marginTop:
                        "25px",
                      padding:
                        "20px",
                      borderRadius:
                        "10px",
                      background:
                        "#f8fafc",
                    }}
                  >

                    <span>
                      Net Salary
                    </span>

                    <h2
                      style={{
                        margin:
                          "5px 0 0",
                      }}
                    >
                      ₹
                      {money(
                        payslip.net_salary
                      )}
                    </h2>

                  </div>

                  {/* =================================================
                      EMPLOYER CONTRIBUTION
                  ================================================= */}

                  <h3
                    style={{
                      marginTop:
                        "25px",
                    }}
                  >
                    Employer Contribution
                  </h3>

                  <div className="profile-grid">

                    <div>
                      <span>
                        Employer PF
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.employer_pf
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Employer ESIC
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.employer_esic
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Employer Contribution
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.total_employer_contribution
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Employer Cost
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.total_employer_cost
                        )}
                      </strong>
                    </div>

                  </div>

                  {/* =================================================
                      BANK DETAILS
                  ================================================= */}

                  <h3
                    style={{
                      marginTop:
                        "25px",
                    }}
                  >
                    Bank Details
                  </h3>

                  <div className="profile-grid">

                    <div>
                      <span>
                        Bank Name
                      </span>

                      <strong>
                        {display(
                          payslip.bank_name
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Account Number
                      </span>

                      <strong>
                        {display(
                          payslip.account_number
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        IFSC Code
                      </span>

                      <strong>
                        {display(
                          payslip.ifsc_code
                        )}
                      </strong>
                    </div>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </div>

    </EmployeeLayout>
  );
};

export default EmployeePayslip;