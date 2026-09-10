
import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

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
      return "--";
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
  // =====================================================

  const downloadPayslip = (payslip) => {
    try {
      setDownloading(payslip.id);

      const pdf = new jsPDF();

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      let y = 20;

      // =================================================
      // HEADER
      // =================================================

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(20);

      pdf.text(
        "TALENT CORNER",
        pageWidth / 2,
        y,
        {
          align: "center",
        }
      );

      y += 8;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(13);

      pdf.text(
        "EMPLOYEE PAYSLIP",
        pageWidth / 2,
        y,
        {
          align: "center",
        }
      );

      y += 15;

      // =================================================
      // EMPLOYEE INFORMATION
      // =================================================

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(11);

      pdf.text(
        "Employee Information",
        15,
        y
      );

      y += 8;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      const employeeName =
        payslip.employee_name ||
        "Employee";

      const employeeId =
        payslip.employee_ref_id ||
        "--";

      const salaryMonth =
        formatSalaryMonth(
          payslip.salary_month
        );

      const status =
        payslip.status ||
        "--";

      pdf.text(
        `Employee Name: ${employeeName}`,
        15,
        y
      );

      y += 6;

      pdf.text(
        `Employee ID: ${employeeId}`,
        15,
        y
      );

      y += 6;

      pdf.text(
        `Salary Month: ${salaryMonth}`,
        15,
        y
      );

      y += 6;

      pdf.text(
        `Payslip ID: ${payslip.id || "--"}`,
        15,
        y
      );

      y += 6;

      pdf.text(
        `Status: ${status}`,
        15,
        y
      );

      y += 12;

      // =================================================
      // EARNINGS
      // =================================================

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.text(
        "Earnings",
        15,
        y
      );

      y += 8;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      const earnings = [
        [
          "Basic Salary",
          payslip.basic_salary,
        ],
        [
          "Allowances",
          payslip.allowances,
        ],
        [
          "Overtime",
          payslip.overtime,
        ],
        [
          "Bonus",
          payslip.bonus,
        ],
        [
          "Gross Salary",
          payslip.gross_salary,
        ],
      ];

      earnings.forEach(
        ([label, value]) => {

          pdf.text(
            label,
            15,
            y
          );

          pdf.text(
            `Rs. ${money(value)}`,
            pageWidth - 15,
            y,
            {
              align: "right",
            }
          );

          y += 7;
        }
      );

      y += 5;

      // =================================================
      // DEDUCTIONS
      // =================================================

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.text(
        "Employee Deductions",
        15,
        y
      );

      y += 8;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      const deductions = [
        [
          "Employee PF",
          payslip.pf,
        ],
        [
          "ESIC",
          payslip.esic,
        ],
        [
          "Tax / TDS",
          payslip.tax,
        ],
        [
          "Professional Tax",
          payslip.professional_tax,
        ],
        [
          "LOP Deduction",
          payslip.lop,
        ],
        [
          "Total Deductions",
          payslip.total_deductions,
        ],
      ];

      deductions.forEach(
        ([label, value]) => {

          pdf.text(
            label,
            15,
            y
          );

          pdf.text(
            `Rs. ${money(value)}`,
            pageWidth - 15,
            y,
            {
              align: "right",
            }
          );

          y += 7;
        }
      );

      y += 5;

      // =================================================
      // NET SALARY
      // =================================================

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(13);

      pdf.text(
        "NET SALARY",
        15,
        y
      );

      pdf.text(
        `Rs. ${money(
          payslip.net_salary
        )}`,
        pageWidth - 15,
        y,
        {
          align: "right",
        }
      );

      y += 15;

      // =================================================
      // EMPLOYER CONTRIBUTION
      // =================================================

      pdf.setFontSize(11);

      pdf.text(
        "Employer Contribution",
        15,
        y
      );

      y += 8;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      const employerDetails = [
        [
          "Employer PF",
          payslip.employer_pf,
        ],
        [
          "Employer ESIC",
          payslip.employer_esic,
        ],
        [
          "Total Employer Contribution",
          payslip.total_employer_contribution,
        ],
        [
          "Total Employer Cost",
          payslip.total_employer_cost,
        ],
      ];

      employerDetails.forEach(
        ([label, value]) => {

          pdf.text(
            label,
            15,
            y
          );

          pdf.text(
            `Rs. ${money(value)}`,
            pageWidth - 15,
            y,
            {
              align: "right",
            }
          );

          y += 7;
        }
      );

      y += 8;

      // =================================================
      // BANK DETAILS
      // =================================================

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.text(
        "Bank Details",
        15,
        y
      );

      y += 8;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.text(
        `Bank Name: ${display(
          payslip.bank_name
        )}`,
        15,
        y
      );

      y += 6;

      pdf.text(
        `Account Number: ${display(
          payslip.account_number
        )}`,
        15,
        y
      );

      y += 6;

      pdf.text(
        `IFSC Code: ${display(
          payslip.ifsc_code
        )}`,
        15,
        y
      );

      y += 15;

      // =================================================
      // FOOTER
      // =================================================

      pdf.setFontSize(9);

      pdf.text(
        "This is a system-generated payslip.",
        pageWidth / 2,
        y,
        {
          align: "center",
        }
      );

      pdf.text(
        "Talent Corner",
        pageWidth / 2,
        pageHeight - 10,
        {
          align: "center",
        }
      );

      // =================================================
      // FILE NAME
      // =================================================

      const month =
        String(
          payslip.salary_month ||
          "payslip"
        ).replace(
          /[^a-zA-Z0-9-_]/g,
          "-"
        );

      const employee =
        String(
          payslip.employee_name ||
          "Employee"
        )
          .replace(
            /[^a-zA-Z0-9]/g,
            "_"
          )
          .replace(
            /_+/g,
            "_"
          );

      pdf.save(
        `${employee}_Payslip_${month}.pdf`
      );

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

