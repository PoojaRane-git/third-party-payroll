import React, { useEffect, useState } from "react";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

// =====================================================
// COMPONENT
// =====================================================

const EmployeePayslip = () => {
  // =====================================================
  // STATE
  // =====================================================

  const [payslips, setPayslips] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [downloading, setDownloading] =
    useState(null);

  const [error, setError] =
    useState("");

  // NEW: selected monthly payslip for viewing
  const [selectedPayslip, setSelectedPayslip] =
    useState(null);

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
          Array.isArray(
            response.data?.payslips
          )
        ) {
          data =
            response.data.payslips;
        } else if (
          Array.isArray(
            response.data?.data
          )
        ) {
          data =
            response.data.data;
        } else if (
          Array.isArray(
            response.data
          )
        ) {
          data =
            response.data;
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
  // MONEY FORMATTER
  // =====================================================

  const money = (value) => {
    const amount = Number(
      value ?? 0
    );

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

  // =====================================================
  // DISPLAY
  // =====================================================

  const display = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "N/A";
    }

    return String(value);
  };

  // =====================================================
  // DATE FORMAT
  // =====================================================

  const formatDate = (value) => {
    if (!value) {
      return "N/A";
    }

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // =====================================================
  // SALARY MONTH FORMAT
  // =====================================================

  const formatSalaryMonth = (
    value
  ) => {
    if (!value) {
      return "--";
    }

    const text = String(value);

    if (
      /^\d{4}-\d{2}$/.test(
        text
      )
    ) {
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

    const date =
      new Date(text);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
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

  // =====================================================
  // DOWNLOAD PAYSLIP
  // USE BACKEND PAYSLIP PDF TEMPLATE
  // =====================================================

  const downloadPayslip =
    async (payslip) => {
      try {
        setDownloading(
          payslip.id
        );

        console.log(
          "Generating employee payslip PDF:",
          payslip.id
        );

        // ---------------------------------------------
        // GET PDF FROM EXISTING BACKEND ROUTE
        // ---------------------------------------------

        const response =
          await api.get(
            `/employee/employee/payroll/${payslip.id}/pdf`,
            {
              responseType: "blob",
            }
          );

        // ---------------------------------------------
        // CREATE DOWNLOAD BLOB
        // ---------------------------------------------

        const blob =
          response.data instanceof Blob
            ? response.data
            : new Blob(
                [response.data],
                {
                  type:
                    "application/pdf",
                }
              );

        // ---------------------------------------------
        // CREATE DOWNLOAD URL
        // ---------------------------------------------

        const url =
          window.URL.createObjectURL(
            blob
          );

        // ---------------------------------------------
        // FILE NAME
        // ---------------------------------------------

        const employeeFileName =
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

        const month =
          String(
            payslip.salary_month ||
              "payslip"
          ).replace(
            /[^a-zA-Z0-9-_]/g,
            "-"
          );

        // ---------------------------------------------
        // DOWNLOAD
        // ---------------------------------------------

        const link =
          document.createElement(
            "a"
          );

        link.href = url;

        link.download =
          `${employeeFileName}_Payslip_${month}.pdf`;

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        // ---------------------------------------------
        // CLEAN URL
        // ---------------------------------------------

        window.URL.revokeObjectURL(
          url
        );

      } catch (error) {
        console.error(
          "Payslip download error:",
          error
        );

        console.error(
          "Server response:",
          error.response?.data
        );

        alert(
          error.response?.data?.message ||
            "Unable to download payslip."
        );
      } finally {
        setDownloading(
          null
        );
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
            PAGE HEADER
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
              Your payroll records
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

                      {/* NEW: VIEW MONTHLY PAYSLIP */}

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPayslip(
                            payslip
                          )
                        }
                        style={{
                          padding:
                            "10px 16px",
                          border:
                            "1px solid #d1d5db",
                          borderRadius:
                            "8px",
                          cursor:
                            "pointer",
                          fontWeight:
                            "600",
                          background:
                            "#ffffff",
                        }}
                      >
                        View Payslip
                      </button>

                      {/* DOWNLOAD */}

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
                        HRA
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.hra
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Conveyance
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.conveyance
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Medical Allowance
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.medical_allowance
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Other Allowance
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.other_allowance
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
                      STATUTORY DETAILS
                  ================================================= */}

                  <h3
                    style={{
                      marginTop:
                        "25px",
                    }}
                  >
                    Statutory Details
                  </h3>

                  <div className="profile-grid">

                    <div>
                      <span>
                        PF Wages
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.pf_wages
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Gratuity
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.gratuity
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Joining Date
                      </span>

                      <strong>
                        {formatDate(
                          payslip.joining_date
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        PRAN
                      </span>

                      <strong>
                        {display(
                          payslip.pran
                        )}
                      </strong>
                    </div>

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

      {/* =====================================================
          VIEW MONTHLY PAYSLIP MODAL
      ===================================================== */}

      {selectedPayslip && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 9999,
          }}
          onClick={() =>
            setSelectedPayslip(null)
          }
        >

          <div
            style={{
              background: "#ffffff",
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "12px",
              padding: "30px",
              position: "relative",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                marginBottom: "25px",
              }}
            >

              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  {formatSalaryMonth(
                    selectedPayslip.salary_month
                  )}
                </h2>

                <p>
                  Payslip ID:{" "}
                  {display(
                    selectedPayslip.id
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedPayslip(null)
                }
                style={{
                  border: "none",
                  background:
                    "transparent",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>

            </div>

            {/* MODAL CONTENT */}

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
                    selectedPayslip.basic_salary
                  )}
                </strong>
              </div>

              <div>
                <span>
                  HRA
                </span>

                <strong>
                  ₹
                  {money(
                    selectedPayslip.hra
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Conveyance
                </span>

                <strong>
                  ₹
                  {money(
                    selectedPayslip.conveyance
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Medical Allowance
                </span>

                <strong>
                  ₹
                  {money(
                    selectedPayslip.medical_allowance
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Other Allowance
                </span>

                <strong>
                  ₹
                  {money(
                    selectedPayslip.other_allowance
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
                    selectedPayslip.overtime
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
                    selectedPayslip.bonus
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
                    selectedPayslip.gross_salary
                  )}
                </strong>
              </div>

            </div>

            {/* DEDUCTIONS */}

            <h3
              style={{
                marginTop: "25px",
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
                    selectedPayslip.pf
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
                    selectedPayslip.esic
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
                    selectedPayslip.tax
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
                    selectedPayslip.professional_tax
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
                    selectedPayslip.lop
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
                    selectedPayslip.total_deductions
                  )}
                </strong>
              </div>

            </div>

            {/* NET SALARY */}

            <div
              style={{
                marginTop: "25px",
                padding: "20px",
                borderRadius: "10px",
                background: "#f8fafc",
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
                  selectedPayslip.net_salary
                )}
              </h2>

            </div>

            {/* STATUTORY */}

            <h3
              style={{
                marginTop: "25px",
              }}
            >
              Statutory Details
            </h3>

            <div className="profile-grid">

              <div>
                <span>
                  PF Wages
                </span>

                <strong>
                  ₹
                  {money(
                    selectedPayslip.pf_wages
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Gratuity
                </span>

                <strong>
                  ₹
                  {money(
                    selectedPayslip.gratuity
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Joining Date
                </span>

                <strong>
                  {formatDate(
                    selectedPayslip.joining_date
                  )}
                </strong>
              </div>

              <div>
                <span>
                  PRAN
                </span>

                <strong>
                  {display(
                    selectedPayslip.pran
                  )}
                </strong>
              </div>

            </div>

            {/* EMPLOYER CONTRIBUTION */}

            <h3
              style={{
                marginTop: "25px",
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
                    selectedPayslip.employer_pf
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
                    selectedPayslip.employer_esic
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
                    selectedPayslip.total_employer_contribution
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
                    selectedPayslip.total_employer_cost
                  )}
                </strong>
              </div>

            </div>

            {/* BANK DETAILS */}

            <h3
              style={{
                marginTop: "25px",
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
                    selectedPayslip.bank_name
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Account Number
                </span>

                <strong>
                  {display(
                    selectedPayslip.account_number
                  )}
                </strong>
              </div>

              <div>
                <span>
                  IFSC Code
                </span>

                <strong>
                  {display(
                    selectedPayslip.ifsc_code
                  )}
                </strong>
              </div>

            </div>

            {/* MODAL FOOTER */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: "12px",
                marginTop: "30px",
                paddingTop: "20px",
                borderTop:
                  "1px solid #e5e7eb",
              }}
            >

              <button
                type="button"
                onClick={() =>
                  setSelectedPayslip(null)
                }
                style={{
                  padding:
                    "10px 18px",
                  border:
                    "1px solid #d1d5db",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  cursor:
                    "pointer",
                  fontWeight:
                    "600",
                }}
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  downloadPayslip(
                    selectedPayslip
                  );
                }}
                disabled={
                  downloading ===
                  selectedPayslip.id
                }
                style={{
                  padding:
                    "10px 18px",
                  border:
                    "none",
                  borderRadius:
                    "8px",
                  cursor:
                    downloading ===
                    selectedPayslip.id
                      ? "not-allowed"
                      : "pointer",
                  fontWeight:
                    "600",
                }}
              >
                {downloading ===
                selectedPayslip.id
                  ? "Generating..."
                  : "Download Payslip"}
              </button>

            </div>

          </div>

        </div>
      )}

    </EmployeeLayout>
  );
};

export default EmployeePayslip;