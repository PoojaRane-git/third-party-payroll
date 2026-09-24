import React, { useEffect, useState } from "react";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

// =====================================================
// FORMAT HELPERS
// =====================================================

const money = (value) => {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const rupee = (value) => `₹${money(value)}`;

const display = (value) => {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  return String(value);
};

const formatDate = (value) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatSalaryMonth = (value) => {
  if (!value) {
    return "--";
  }

  const text = String(value);

  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-");

    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
      "en-IN",
      { month: "long", year: "numeric" }
    );
  }

  const date = new Date(text);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }

  return text;
};

// =====================================================
// SMALL UI PIECES
// =====================================================

const Section = ({ title, fields, first = false }) => (
  <>
    <h3 style={first ? undefined : { marginTop: "25px" }}>{title}</h3>

    <div className="profile-grid">
      {fields.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  </>
);

// Used for both the month card and the "View Payslip" popup
const PayslipDetails = ({ payslip }) => (
  <>
    <Section
      first
      title="Earnings"
      fields={[
        ["Basic Salary", rupee(payslip.basic_salary)],
        ["HRA", rupee(payslip.hra)],
        ["Conveyance", rupee(payslip.conveyance)],
        ["Medical Allowance", rupee(payslip.medical_allowance)],
        ["Other Allowance", rupee(payslip.other_allowance)],
        ["Overtime", rupee(payslip.overtime)],
        ["Bonus", rupee(payslip.bonus)],
        ["Gross Salary", rupee(payslip.gross_salary)],
      ]}
    />

    <Section
      title="Deductions"
      fields={[
        ["Employee PF", rupee(payslip.pf)],
        ["ESIC", rupee(payslip.esic)],
        ["Tax / TDS", rupee(payslip.tax)],
        ["Professional Tax", rupee(payslip.professional_tax)],
        ["LOP Deduction", rupee(payslip.lop)],
        ["Total Deductions", rupee(payslip.total_deductions)],
      ]}
    />

    <div
      style={{
        marginTop: "25px",
        padding: "20px",
        borderRadius: "10px",
        background: "#f8fafc",
      }}
    >
      <span>Net Salary</span>

      <h2 style={{ margin: "5px 0 0" }}>{rupee(payslip.net_salary)}</h2>
    </div>

    <Section
      title="Statutory Details"
      fields={[
        ["PF Wages", rupee(payslip.pf_wages)],
        ["Gratuity", rupee(payslip.gratuity)],
        ["Joining Date", formatDate(payslip.joining_date)],
        ["PRAN", display(payslip.pran)],
      ]}
    />

    <Section
      title="Employer Contribution"
      fields={[
        ["Employer PF", rupee(payslip.employer_pf)],
        ["Employer ESIC", rupee(payslip.employer_esic)],
        [
          "Total Employer Contribution",
          rupee(payslip.total_employer_contribution),
        ],
        ["Total Employer Cost", rupee(payslip.total_employer_cost)],
      ]}
    />

    <Section
      title="Bank Details"
      fields={[
        ["Bank Name", display(payslip.bank_name)],
        ["Account Number", display(payslip.account_number)],
        ["IFSC Code", display(payslip.ifsc_code)],
      ]}
    />
  </>
);

const outlineButton = {
  padding: "10px 16px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
  background: "#ffffff",
};

// =====================================================
// COMPONENT
// =====================================================

const EmployeePayslip = () => {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState("");

  // Selected monthly payslip for viewing
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Selected salary month from calendar
  const [selectedMonth, setSelectedMonth] = useState("");

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
        console.error("Server response:", err.response?.data);

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
  // FILTER PAYSLIPS BY SELECTED MONTH
  // =====================================================

  const filteredPayslips = selectedMonth
    ? payslips.filter((payslip) =>
        String(payslip.salary_month || "").startsWith(selectedMonth)
      )
    : payslips;

  // =====================================================
  // DOWNLOAD PAYSLIP (PDF is built by the backend)
  // =====================================================

  const downloadPayslip = async (payslip) => {
    try {
      setDownloading(payslip.id);

      const response = await api.get(
        `/employee/payroll/${payslip.id}/pdf`,
        { responseType: "blob" }
      );

      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: "application/pdf" });

      const url = window.URL.createObjectURL(blob);

      const employeeFileName = String(payslip.employee_name || "Employee")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_");

      const month = String(payslip.salary_month || "payslip").replace(
        /[^a-zA-Z0-9-_]/g,
        "-"
      );

      const link = document.createElement("a");

      link.href = url;
      link.download = `${employeeFileName}_Payslip_${month}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Payslip download error:", err);
      console.error("Server response:", err.response?.data);

      alert(err.response?.data?.message || "Unable to download payslip.");
    } finally {
      setDownloading(null);
    }
  };

  const downloadButton = (payslip) => (
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
  );

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
        {/* PAGE HEADER */}

        <div className="page-header">
          <div>
            <h1>Payslips</h1>

            <p>View your complete salary and payslip records.</p>
          </div>
        </div>

        {/* ERROR */}

        {error && <div className="error-message">{error}</div>}

        {/* SALARY MONTH CALENDAR */}

        {payslips.length > 0 && (
          <div
            className="table-card"
            style={{ marginBottom: "25px", padding: "20px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>Salary Month</h3>

                <p style={{ margin: "5px 0 0", color: "#6b7280" }}>
                  Select a month to view your payslip.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                />

                {selectedMonth && (
                  <button
                    type="button"
                    onClick={() => setSelectedMonth("")}
                    style={outlineButton}
                  >
                    Show All Months
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PAYSLIP LIST */}

        {payslips.length === 0 ? (
          <div className="empty-state">
            <h3>No payslips available</h3>

            <p>Your payroll records will appear here.</p>
          </div>
        ) : filteredPayslips.length === 0 ? (
          <div className="empty-state">
            <h3>No payslip for selected month</h3>

            <p>
              There is no salary record available for{" "}
              <strong>{formatSalaryMonth(selectedMonth)}</strong>.
            </p>
          </div>
        ) : (
          <div>
            {filteredPayslips.map((payslip) => (
              <div
                key={payslip.id}
                className="table-card"
                style={{ marginBottom: "25px", padding: "25px" }}
              >
                {/* PAYSLIP HEADER */}

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
                    <h2 style={{ margin: 0 }}>
                      {formatSalaryMonth(payslip.salary_month)}
                    </h2>

                    <p>Payslip ID: {display(payslip.id)}</p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPayslip(payslip)}
                      style={outlineButton}
                    >
                      View Payslip
                    </button>

                    {downloadButton(payslip)}
                  </div>
                </div>

                <PayslipDetails payslip={payslip} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIEW MONTHLY PAYSLIP MODAL */}

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
          onClick={() => setSelectedPayslip(null)}
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
            onClick={(event) => event.stopPropagation()}
          >
            {/* MODAL HEADER */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "25px",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  {formatSalaryMonth(selectedPayslip.salary_month)}
                </h2>

                <p>Payslip ID: {display(selectedPayslip.id)}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* MODAL CONTENT */}

            <PayslipDetails payslip={selectedPayslip} />

            {/* MODAL FOOTER */}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "30px",
                paddingTop: "20px",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                style={outlineButton}
              >
                Close
              </button>

              {downloadButton(selectedPayslip)}
            </div>
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
};

export default EmployeePayslip;