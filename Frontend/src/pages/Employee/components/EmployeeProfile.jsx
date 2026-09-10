
import React, { useEffect, useState } from "react";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

const EmployeeProfile = () => {
  // =====================================================
  // STATE
  // =====================================================

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =====================================================
  // FETCH LOGGED-IN EMPLOYEE
  // =====================================================

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");

        console.log(
          "Fetching logged-in employee profile..."
        );

        const response = await api.get(
          "/employee/me"
        );

        console.log(
          "Employee profile response:",
          response.data
        );

        const data =
          response.data?.employee ??
          response.data?.data ??
          response.data;

        if (!data) {
          throw new Error(
            "Employee profile not found."
          );
        }

        setEmployee(data);

      } catch (err) {
        console.error(
          "Employee profile error:",
          err
        );

        console.error(
          "Server response:",
          err.response?.data
        );

        setEmployee(null);

        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Unable to load employee profile."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // =====================================================
  // HELPERS
  // =====================================================

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

  const formatDate = (value) => {
    if (!value) {
      return "--";
    }

    try {
      const date = new Date(
        String(value).includes("T")
          ? value
          : `${value}T00:00:00`
      );

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }
      );
    } catch {
      return String(value);
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
            Loading profile...
          </h3>

          <p>
            Please wait while we load
            your employee information.
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
              My Profile
            </h1>

            <p>
              View your employee information.
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
            PROFILE
        ================================================= */}

        {!employee ? (

          <div className="empty-state">

            <h3>
              Employee profile not found
            </h3>

            <p>
              Unable to load your employee
              information.
            </p>

          </div>

        ) : (

          <div className="profile-card">

            {/* =================================================
                AVATAR
            ================================================= */}

            <div className="profile-avatar">

              {(
                employee.full_name ||
                employee.name ||
                "E"
              )
                .charAt(0)
                .toUpperCase()}

            </div>

            {/* =================================================
                NAME
            ================================================= */}

            <h2>
              {display(
                employee.full_name ||
                employee.name ||
                "Employee"
              )}
            </h2>

            {/* =================================================
                EMPLOYEE DETAILS
            ================================================= */}

            <div className="profile-grid">

              {/* EMPLOYEE ID */}

              <div>
                <span>
                  Employee ID
                </span>

                <strong>
                  {display(
                    employee.id ||
                    employee.employee_id
                  )}
                </strong>
              </div>

              {/* EMAIL */}

              <div>
                <span>
                  Email
                </span>

                <strong>
                  {display(
                    employee.email
                  )}
                </strong>
              </div>

              {/* PHONE */}

              <div>
                <span>
                  Phone
                </span>

                <strong>
                  {display(
                    employee.phone
                  )}
                </strong>
              </div>

              {/* EMPLOYMENT STATUS */}

              <div>
                <span>
                  Employment Status
                </span>

                <strong>
                  {display(
                    employee.employment_status
                  )}
                </strong>
              </div>

              {/* DATE OF JOINING */}

              <div>
                <span>
                  Date of Joining
                </span>

                <strong>
                  {formatDate(
                    employee.date_of_joining
                  )}
                </strong>
              </div>

              {/* PAN */}

              <div>
                <span>
                  PAN
                </span>

                <strong>
                  {display(
                    employee.pan_number ||
                    employee.pan
                  )}
                </strong>
              </div>

              {/* UAN */}

              <div>
                <span>
                  UAN
                </span>

                <strong>
                  {display(
                    employee.uan_number ||
                    employee.uan
                  )}
                </strong>
              </div>

              {/* ESIC */}

              <div>
                <span>
                  ESIC
                </span>

                <strong>
                  {display(
                    employee.esic_number ||
                    employee.esic
                  )}
                </strong>
              </div>

              {/* BANK NAME */}

              <div>
                <span>
                  Bank Name
                </span>

                <strong>
                  {display(
                    employee.bank_name
                  )}
                </strong>
              </div>

              {/* BANK ACCOUNT */}

              <div>
                <span>
                  Bank Account
                </span>

                <strong>
                  {display(
                    employee.bank_account_number
                  )}
                </strong>
              </div>

              {/* IFSC */}

              <div>
                <span>
                  IFSC Code
                </span>

                <strong>
                  {display(
                    employee.ifsc_code
                  )}
                </strong>
              </div>

            </div>

          </div>

        )}

      </div>
    </EmployeeLayout>
  );
};

export default EmployeeProfile;
