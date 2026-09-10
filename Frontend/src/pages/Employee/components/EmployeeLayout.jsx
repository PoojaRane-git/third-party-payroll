import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import EmployeeNavbar from "./EmployeeNavbar";
import EmployeeSidebar from "./EmployeeSidebar";

import api from "../../services/api";

const EmployeeLayout = ({ children }) => {
  const navigate = useNavigate();

  const [employeeName, setEmployeeName] =
    useState("Employee");

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const response =
          await api.get("/auth/me");

        const user =
          response.data?.user;

        if (!user) {
          throw new Error(
            "Employee session not found."
          );
        }

        if (user.role !== "employee") {
          navigate("/login", {
            replace: true,
          });

          return;
        }

        setEmployeeName(
          user.name ||
          user.full_name ||
          "Employee"
        );

      } catch (error) {
        console.error(
          "Employee authentication error:",
          error
        );

        navigate("/login", {
          replace: true,
        });

      } finally {
        setLoading(false);
      }
    };

    loadEmployee();
  }, [navigate]);

  if (loading) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
        }}
      >
        Loading Employee Portal...
      </div>
    );
  }

  return (
    <div className="employee-layout">

      {/* SIDEBAR */}
      <EmployeeSidebar />

      {/* MAIN */}
      <div className="employee-main">

        {/* NAVBAR */}
        <EmployeeNavbar
          employeeName={employeeName}
        />

        {/* PAGE */}
        <main className="employee-content">
          {children}
        </main>

      </div>

    </div>
  );
};

export default EmployeeLayout;