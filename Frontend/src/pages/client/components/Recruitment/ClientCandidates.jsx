import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  UserCheck,
  X,
  Mail,
  Phone,
  Briefcase,
  Filter,
  Search,
  MapPin,
  Building2,
  Calendar,
  Hash,
  BadgeCheck,
  RefreshCw,
  User,
  FileText,
  CreditCard,
  ShieldCheck,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";
import api from "../../../services/api";

function ClientCandidates({ activeTab, setActiveTab }) {
  // =====================================================
  // STATE
  // =====================================================

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [clientName, setClientName] = useState("Company");
  const [clientId, setClientId] = useState("");

  // =====================================================
  // GET CLIENT SESSION
  // =====================================================

  const getClientSession = () => {
    let storedClientId = "";
    let storedCompanyName = "";

    // -----------------------------------------------------
    // 1. Direct client_id
    // -----------------------------------------------------

    storedClientId =
      sessionStorage.getItem("client_id") || "";

    // -----------------------------------------------------
    // 2. clientId fallback
    // -----------------------------------------------------

    if (!storedClientId) {
      storedClientId =
        sessionStorage.getItem("clientId") || "";
    }

    // -----------------------------------------------------
    // 3. Stored user
    // -----------------------------------------------------

    const storedUser =
      sessionStorage.getItem("user");

    if (storedUser) {
      try {
        const user =
          JSON.parse(storedUser);

        if (!storedClientId) {
          storedClientId =
            user?.client_id ||
            user?.clientId ||
            user?.profile?.client_id ||
            user?.profile?.clientId ||
            "";
        }

        storedCompanyName =
          user?.company_name ||
          user?.companyName ||
          user?.profile?.company_name ||
          user?.profile?.companyName ||
          user?.name ||
          "";
      } catch (err) {
        console.error(
          "Unable to parse stored user:",
          err
        );
      }
    }

    // -----------------------------------------------------
    // 4. Stored client
    // -----------------------------------------------------

    if (!storedClientId) {
      const storedClient =
        sessionStorage.getItem("client");

      if (storedClient) {
        try {
          const client =
            JSON.parse(storedClient);

          storedClientId =
            client?.id ||
            client?.client_id ||
            client?.clientId ||
            "";

          if (!storedCompanyName) {
            storedCompanyName =
              client?.company_name ||
              client?.companyName ||
              "";
          }
        } catch (err) {
          console.error(
            "Unable to parse stored client:",
            err
          );
        }
      }
    }

    // -----------------------------------------------------
    // 5. Stored profile
    // -----------------------------------------------------

    if (!storedClientId) {
      const storedProfile =
        sessionStorage.getItem("profile");

      if (storedProfile) {
        try {
          const profile =
            JSON.parse(storedProfile);

          storedClientId =
            profile?.client_id ||
            profile?.clientId ||
            "";

          if (!storedCompanyName) {
            storedCompanyName =
              profile?.company_name ||
              profile?.companyName ||
              profile?.name ||
              "";
          }
        } catch (err) {
          console.error(
            "Unable to parse stored profile:",
            err
          );
        }
      }
    }

    // -----------------------------------------------------
    // 6. Company name fallback
    // -----------------------------------------------------

    if (!storedCompanyName) {
      storedCompanyName =
        sessionStorage.getItem("company_name") ||
        sessionStorage.getItem("companyName") ||
        "";
    }

    return {
      clientId: storedClientId,
      companyName: storedCompanyName,
    };
  };

  // =====================================================
  // LOAD CLIENT
  // =====================================================

  useEffect(() => {
    const loadClient = async () => {
      try {
        setLoading(true);
        setError("");

        const {
          clientId: storedClientId,
          companyName: storedCompanyName,
        } = getClientSession();

        console.log(
          "================================="
        );
        console.log(
          "Client Employees - client_id:",
          storedClientId
        );
        console.log(
          "Client Employees - company:",
          storedCompanyName
        );
        console.log(
          "================================="
        );

        // -------------------------------------------------
        // Client ID required
        // -------------------------------------------------

        if (!storedClientId) {
          setError(
            "Client ID not found. Please logout and login again using your client account."
          );

          setLoading(false);
          return;
        }

        // -------------------------------------------------
        // Validate client ID
        // -------------------------------------------------

        const numericClientId =
          Number(storedClientId);

        if (
          !Number.isInteger(numericClientId) ||
          numericClientId <= 0
        ) {
          setError(
            "Invalid client ID. Please logout and login again."
          );

          setLoading(false);
          return;
        }

        // -------------------------------------------------
        // Store normalized client information
        // -------------------------------------------------

        const normalizedClientId =
          String(numericClientId);

        setClientId(normalizedClientId);

        if (storedCompanyName) {
          setClientName(
            storedCompanyName
          );

          sessionStorage.setItem(
            "company_name",
            storedCompanyName
          );
        }

        sessionStorage.setItem(
          "client_id",
          normalizedClientId
        );

        // -------------------------------------------------
        // Fetch employees
        // -------------------------------------------------

        await fetchEmployees(
          normalizedClientId
        );
      } catch (err) {
        console.error(
          "Client employee page error:",
          err
        );

        setError(
          "Unable to load client information. Please login again."
        );

        setLoading(false);
      }
    };

    loadClient();
  }, []);

  // =====================================================
  // FETCH EMPLOYEES
  // =====================================================

  const fetchEmployees = async (
    currentClientId
  ) => {
    try {
      setLoading(true);
      setError("");

      if (!currentClientId) {
        throw new Error(
          "Client ID is missing. Please login again."
        );
      }

      const numericClientId =
        Number(currentClientId);

      if (
        !Number.isInteger(numericClientId) ||
        numericClientId <= 0
      ) {
        throw new Error(
          "Invalid client ID."
        );
      }

      // -------------------------------------------------
      // Access token
      // -------------------------------------------------

      const accessToken =
        sessionStorage.getItem(
          "access_token"
        );

      // -------------------------------------------------
      // API request
      // -------------------------------------------------

    const response = await api.get("/employees", {
    params: {
        client_id: numericClientId,
    },
});

      console.log(
        "Employees API response:",
        response.data
      );

      // -------------------------------------------------
      // Check response
      // -------------------------------------------------

      if (!response.data?.success) {
        throw new Error(
          response.data?.error ||
            response.data?.message ||
            "Failed to load company employees."
        );
      }

      // =================================================
      // IMPORTANT
      //
      // Backend returns:
      //
      // {
      //   success: true,
      //   employees: [...]
      // }
      //
      // NOT:
      //
      // {
      //   data: [...]
      // }
      // =================================================

      const employeeData =
        Array.isArray(
          response.data?.employees
        )
          ? response.data.employees
          : [];

      console.log(
        "Employees received:",
        employeeData.length
      );

      console.log(
        "Employee records:",
        employeeData
      );

      setEmployees(
        employeeData
      );

      // -------------------------------------------------
      // Company name from first employee if available
      // -------------------------------------------------

      if (
        employeeData.length > 0
      ) {
        const firstEmployee =
          employeeData[0];

        if (
          firstEmployee?.company_name
        ) {
          setClientName(
            firstEmployee.company_name
          );

          sessionStorage.setItem(
            "company_name",
            firstEmployee.company_name
          );
        }
      }
    } catch (err) {
      console.error(
        "Employee fetch error:",
        err
      );

      let message =
        "Unable to load company employees.";

      if (
        err.response?.status === 401
      ) {
        message =
          "Your login session has expired. Please login again.";
      } else if (
        err.response?.status === 403
      ) {
        message =
          err.response?.data?.error ||
          "You are not authorized to access this company.";
      } else if (
        err.response?.data?.error
      ) {
        message =
          err.response.data.error;
      } else if (
        err.response?.data?.message
      ) {
        message =
          err.response.data.message;
      } else if (err.message) {
        message =
          err.message;
      }

      setError(message);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // EMPLOYEE HELPERS
  // =====================================================

  // Your API returns FLAT employee records.
  // These helpers normalize them for the UI.

  const getEmployee = (record) => ({
    id:
      record?.employee_id ??
      record?.id ??
      null,

    full_name:
      record?.full_name ||
      record?.employee_name ||
      "",

    email:
      record?.email || "",

    phone:
      record?.phone || "",

    date_of_joining:
      record?.date_of_joining ||
      "",

    employment_status:
      record?.employment_status ||
      record?.status ||
      "",

    designation:
      record?.designation ||
      "",
  });

  const getDeployment = (
    record
  ) => ({
    id:
      record?.deployment_id ??
      null,

    candidate_id:
      record?.candidate_id ??
      null,

    contract_id:
      record?.contract_id ??
      null,

    project_name:
      record?.project_name ||
      "",

    pay_rate:
      record?.pay_rate ??
      null,

    bill_rate:
      record?.bill_rate ??
      null,

    billing_model:
      record?.billing_model ||
      "",

    start_date:
      record?.start_date ||
      null,

    end_date:
      record?.end_date ||
      null,

    status:
      record?.status ||
      "",
  });

  const getCompany = (
    record
  ) => ({
    id:
      record?.client_id ??
      clientId ??
      null,

    company_name:
      record?.company_name ||
      clientName ||
      "",

    billing_address:
      record?.billing_address ||
      "",

    email:
      record?.company_email ||
      "",

    phone:
      record?.company_phone ||
      "",

    contact_person:
      record?.contact_person ||
      "",

    credit_terms:
      record?.credit_terms ||
      "",

    status:
      record?.company_status ||
      "",
  });

  // =====================================================
  // EMPLOYEE NAME
  // =====================================================

  const getName = (
    record
  ) => {
    const employee =
      getEmployee(record);

    return (
      employee.full_name ||
      "Unnamed Employee"
    );
  };

  // =====================================================
  // EMPLOYEE ROLE
  // =====================================================

  const getRole = (
    record
  ) => {
    const employee =
      getEmployee(record);

    const deployment =
      getDeployment(record);

    return (
      employee.designation ||
      deployment.project_name ||
      "Not Assigned"
    );
  };

  // =====================================================
  // EMPLOYEE STATUS
  // =====================================================

  const getStatus = (
    record
  ) => {
    const employee =
      getEmployee(record);

    const deployment =
      getDeployment(record);

    return (
      deployment.status ||
      employee.employment_status ||
      "Unknown"
    );
  };

  // =====================================================
  // FILTERED EMPLOYEES
  // =====================================================

  const filteredEmployees =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      return employees.filter(
        (record) => {
          const employee =
            getEmployee(record);

          const deployment =
            getDeployment(record);

          const name =
            employee.full_name
              ?.toLowerCase() ||
            "";

          const email =
            employee.email
              ?.toLowerCase() ||
            "";

          const phone =
            employee.phone
              ?.toLowerCase() ||
            "";

          const designation =
            employee.designation
              ?.toLowerCase() ||
            "";

          const project =
            deployment.project_name
              ?.toLowerCase() ||
            "";

          const matchesSearch =
            !search ||
            name.includes(search) ||
            email.includes(search) ||
            phone.includes(search) ||
            designation.includes(search) ||
            project.includes(search);

          const matchesRole =
            roleFilter === "All" ||
            getRole(record) ===
              roleFilter;

          const matchesStatus =
            statusFilter === "All" ||
            getStatus(record) ===
              statusFilter;

          return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
          );
        }
      );
    }, [
      employees,
      searchTerm,
      roleFilter,
      statusFilter,
    ]);

  // =====================================================
  // UNIQUE ROLES
  // =====================================================

  const uniqueRoles =
    useMemo(() => {
      const roles =
        employees
          .map((record) =>
            getRole(record)
          )
          .filter(Boolean);

      return [
        "All",
        ...new Set(roles),
      ];
    }, [employees]);

  // =====================================================
  // UNIQUE STATUSES
  // =====================================================

  const uniqueStatuses =
    useMemo(() => {
      const statuses =
        employees
          .map((record) =>
            getStatus(record)
          )
          .filter(Boolean);

      return [
        "All",
        ...new Set(statuses),
      ];
    }, [employees]);

  // =====================================================
  // SUMMARY
  // =====================================================

  const activeEmployees =
    employees.filter(
      (record) =>
        String(
          getStatus(record)
        ).toLowerCase() ===
        "active"
    ).length;

  const inactiveEmployees =
    employees.filter(
      (record) =>
        String(
          getStatus(record)
        ).toLowerCase() ===
        "inactive"
    ).length;

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = () => {
    sessionStorage.clear();

    window.location.href =
      "/login";
  };

  // =====================================================
  // STATUS STYLE
  // =====================================================

  const getStatusClass = (
    status
  ) => {
    switch (
      String(status).toLowerCase()
    ) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

      case "inactive":
        return "bg-slate-100 text-slate-600 border-slate-200";

      case "completed":
        return "bg-blue-50 text-blue-700 border-blue-200";

      case "available":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";

      case "terminated":
        return "bg-red-50 text-red-700 border-red-200";

      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (
    value
  ) => {
    if (!value) {
      return "Not provided";
    }

    const date =
      new Date(value);

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
  // FORMAT MONEY
  // =====================================================

  const formatMoney = (
    value
  ) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "Not provided";
    }

    const number =
      Number(value);

    if (
      Number.isNaN(number)
    ) {
      return String(value);
    }

    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }
    ).format(number);
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* SIDEBAR */}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        clientName={clientName}
        onLogout={handleLogout}
      />

      {/* MAIN */}

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">

        <div className="max-w-[1600px] mx-auto space-y-6">

          {/* HEADER */}

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">

              <div>

                <div className="flex items-center gap-3">

                  <div className="p-3 bg-blue-50 rounded-xl">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>

                  <div>

                    <h1 className="text-2xl font-bold text-slate-900">
                      Company Employees
                    </h1>

                    <p className="text-sm text-slate-500 mt-1">
                      Employees currently associated with{" "}
                      <span className="font-semibold text-slate-700">
                        {clientName}
                      </span>
                    </p>

                  </div>

                </div>

                {clientId && (
                  <p className="text-[11px] text-slate-400 mt-3 font-mono">
                    Client ID: {clientId}
                  </p>
                )}

              </div>

              <button
                type="button"
                onClick={() => {
                  if (clientId) {
                    fetchEmployees(
                      clientId
                    );
                  }
                }}
                disabled={
                  loading ||
                  !clientId
                }
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition"
              >

                <RefreshCw
                  className={`h-4 w-4 ${
                    loading
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Refresh

              </button>

            </div>

          </div>

          {/* SUMMARY */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <SummaryCard
              label="Total Employees"
              value={employees.length}
              icon={UserCheck}
              iconClass="bg-blue-50 text-blue-600"
              valueClass="text-slate-900"
            />

            <SummaryCard
              label="Active"
              value={activeEmployees}
              icon={BadgeCheck}
              iconClass="bg-emerald-50 text-emerald-600"
              valueClass="text-emerald-600"
            />

            <SummaryCard
              label="Inactive"
              value={inactiveEmployees}
              icon={User}
              iconClass="bg-slate-100 text-slate-500"
              valueClass="text-slate-600"
            />

            <SummaryCard
              label="Displayed"
              value={
                filteredEmployees.length
              }
              icon={Filter}
              iconClass="bg-blue-50 text-blue-600"
              valueClass="text-blue-600"
            />

          </div>

          {/* FILTERS */}

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">

            <div className="flex flex-col lg:flex-row gap-3">

              <div className="relative flex-1">

                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                <input
                  type="text"
                  placeholder="Search employee, email, phone, designation or project..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

              </div>

              <select
                value={roleFilter}
                onChange={(e) =>
                  setRoleFilter(
                    e.target.value
                  )
                }
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >

                {uniqueRoles.map(
                  (role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      Role: {role}
                    </option>
                  )
                )}

              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value
                  )
                }
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >

                {uniqueStatuses.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      Status: {status}
                    </option>
                  )
                )}

              </select>

              {(searchTerm ||
                roleFilter !== "All" ||
                statusFilter !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setRoleFilter("All");
                    setStatusFilter("All");
                  }}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold"
                >
                  Clear Filters
                </button>
              )}

            </div>

          </div>

          {/* ERROR */}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">

              <div className="flex items-start gap-3">

                <X className="h-5 w-5 text-red-600 mt-0.5" />

                <div>

                  <p className="text-sm font-bold text-red-700">
                    Unable to load employees
                  </p>

                  <p className="text-xs text-red-600 mt-1">
                    {error}
                  </p>

                </div>

              </div>

            </div>
          )}

          {/* LOADING */}

          {loading ? (

            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">

              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto" />

              <p className="text-sm text-slate-500 mt-3">
                Loading company employees...
              </p>

            </div>

          ) : filteredEmployees.length === 0 ? (

            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">

              <User className="h-12 w-12 text-slate-300 mx-auto" />

              <h3 className="text-sm font-bold text-slate-700 mt-4">
                No employees found
              </h3>

              <p className="text-xs text-slate-400 mt-1">
                No employees are currently associated with this company.
              </p>

            </div>

          ) : (

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

              <div className="px-5 py-4 border-b border-slate-200">

                <div className="flex items-center justify-between">

                  <div>

                    <h2 className="text-sm font-black text-slate-900">
                      Employees
                    </h2>

                    <p className="text-xs text-slate-400 mt-1">
                      Employees deployed to your company
                    </p>

                  </div>

                  <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                    {filteredEmployees.length} Records
                  </span>

                </div>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead className="bg-slate-50 border-b border-slate-200">

                    <tr>

                      <th className="text-left px-5 py-4 text-[10px] font-black uppercase text-slate-400">
                        Employee
                      </th>

                      <th className="text-left px-5 py-4 text-[10px] font-black uppercase text-slate-400">
                        Contact
                      </th>

                      <th className="text-left px-5 py-4 text-[10px] font-black uppercase text-slate-400">
                        Designation
                      </th>

                      <th className="text-left px-5 py-4 text-[10px] font-black uppercase text-slate-400">
                        Project
                      </th>

                      <th className="text-left px-5 py-4 text-[10px] font-black uppercase text-slate-400">
                        Joining
                      </th>

                      <th className="text-left px-5 py-4 text-[10px] font-black uppercase text-slate-400">
                        Status
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {filteredEmployees.map(
                      (record) => {
                        const employee =
                          getEmployee(
                            record
                          );

                        const deployment =
                          getDeployment(
                            record
                          );

                        const status =
                          getStatus(
                            record
                          );

                        return (
                          <tr
                            key={
                              record.id
                            }
                            onClick={() =>
                              setSelectedEmployee(
                                record
                              )
                            }
                            className="hover:bg-slate-50 cursor-pointer transition"
                          >

                            {/* EMPLOYEE */}

                            <td className="px-5 py-4">

                              <div className="flex items-center gap-3">

                                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">

                                  <User className="h-5 w-5 text-blue-600" />

                                </div>

                                <div>

                                  <p className="text-sm font-bold text-slate-900">
                                    {getName(
                                      record
                                    )}
                                  </p>

                                  <p className="text-[10px] text-slate-400 font-mono">
                                    Employee ID:{" "}
                                    {employee.id ||
                                      "N/A"}
                                  </p>

                                </div>

                              </div>

                            </td>

                            {/* CONTACT */}

                            <td className="px-5 py-4">

                              <div className="space-y-1">

                                <p className="text-xs text-slate-600 flex items-center gap-1.5">

                                  <Mail className="h-3 w-3 text-slate-400" />

                                  {employee.email ||
                                    "Not provided"}

                                </p>

                                <p className="text-xs text-slate-500 flex items-center gap-1.5">

                                  <Phone className="h-3 w-3 text-slate-400" />

                                  {employee.phone ||
                                    "Not provided"}

                                </p>

                              </div>

                            </td>

                            {/* DESIGNATION */}

                            <td className="px-5 py-4">

                              <div className="flex items-center gap-2">

                                <Briefcase className="h-4 w-4 text-slate-400" />

                                <p className="text-xs font-bold text-slate-800">
                                  {employee.designation ||
                                    "Not specified"}
                                </p>

                              </div>

                            </td>

                            {/* PROJECT */}

                            <td className="px-5 py-4">

                              <p className="text-xs font-semibold text-slate-700">
                                {deployment.project_name ||
                                  "Not assigned"}
                              </p>

                              <p className="text-[10px] text-slate-400 mt-1">
                                Deployment ID:{" "}
                                {deployment.id ||
                                  "N/A"}
                              </p>

                            </td>

                            {/* JOINING */}

                            <td className="px-5 py-4">

                              <div className="flex items-center gap-1.5">

                                <Calendar className="h-3.5 w-3.5 text-slate-400" />

                                <span className="text-xs text-slate-600">
                                  {formatDate(
                                    employee.date_of_joining ||
                                      deployment.start_date
                                  )}
                                </span>

                              </div>

                            </td>

                            {/* STATUS */}

                            <td className="px-5 py-4">

                              <span
                                className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-bold ${getStatusClass(
                                  status
                                )}`}
                              >
                                {status}
                              </span>

                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>

            </div>
          )}

        </div>

      </main>

      {/* =====================================================
          EMPLOYEE DETAILS MODAL
      ===================================================== */}

      {selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
          onClick={() =>
            setSelectedEmployee(null)
          }
        >

          <div
            className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-6">

              <button
                type="button"
                onClick={() =>
                  setSelectedEmployee(null)
                }
                className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-4 pr-10">

                <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center">

                  <UserCheck className="h-7 w-7 text-blue-600" />

                </div>

                <div>

                  <h2 className="text-xl font-black text-slate-900">
                    {getName(
                      selectedEmployee
                    )}
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    {getEmployee(
                      selectedEmployee
                    ).designation ||
                      "Employee"}
                  </p>

                  <span
                    className={`inline-flex mt-2 px-2.5 py-1 rounded-full border text-[10px] font-bold ${getStatusClass(
                      getStatus(
                        selectedEmployee
                      )
                    )}`}
                  >
                    {getStatus(
                      selectedEmployee
                    )}
                  </span>

                </div>

              </div>

            </div>

            {/* BODY */}

            <div className="p-6 space-y-6">

              {/* PERSONAL */}

              <section>

                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <Detail
                    icon={Hash}
                    label="Employee ID"
                    value={
                      getEmployee(
                        selectedEmployee
                      ).id
                    }
                  />

                  <Detail
                    icon={User}
                    label="Full Name"
                    value={
                      getEmployee(
                        selectedEmployee
                      ).full_name
                    }
                  />

                  <Detail
                    icon={Mail}
                    label="Email"
                    value={
                      getEmployee(
                        selectedEmployee
                      ).email
                    }
                  />

                  <Detail
                    icon={Phone}
                    label="Phone"
                    value={
                      getEmployee(
                        selectedEmployee
                      ).phone
                    }
                  />

                  <Detail
                    icon={Calendar}
                    label="Date of Joining"
                    value={formatDate(
                      getEmployee(
                        selectedEmployee
                      ).date_of_joining
                    )}
                  />

                  <Detail
                    icon={BadgeCheck}
                    label="Employment Status"
                    value={
                      getEmployee(
                        selectedEmployee
                      ).employment_status
                    }
                  />

                </div>

              </section>

              {/* PROFESSIONAL */}

              <section>

                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Professional Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <Detail
                    icon={Briefcase}
                    label="Designation"
                    value={
                      getEmployee(
                        selectedEmployee
                      ).designation
                    }
                  />

                  <Detail
                    icon={FileText}
                    label="Employment Status"
                    value={
                      getStatus(
                        selectedEmployee
                      )
                    }
                  />

                  <Detail
                    icon={Building2}
                    label="Project"
                    value={
                      getDeployment(
                        selectedEmployee
                      ).project_name
                    }
                  />

                  <Detail
                    icon={Hash}
                    label="Deployment ID"
                    value={
                      getDeployment(
                        selectedEmployee
                      ).id
                    }
                  />

                </div>

              </section>

              {/* DEPLOYMENT */}

              <section>

                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Deployment Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <Detail
                    icon={Hash}
                    label="Deployment ID"
                    value={
                      getDeployment(
                        selectedEmployee
                      ).id
                    }
                  />

                  <Detail
                    icon={Hash}
                    label="Contract ID"
                    value={
                      getDeployment(
                        selectedEmployee
                      ).contract_id
                    }
                  />

                  <Detail
                    icon={Briefcase}
                    label="Project Name"
                    value={
                      getDeployment(
                        selectedEmployee
                      ).project_name
                    }
                  />

                  <Detail
                    icon={CreditCard}
                    label="Billing Model"
                    value={
                      getDeployment(
                        selectedEmployee
                      ).billing_model
                    }
                  />

                  <Detail
                    icon={Calendar}
                    label="Deployment Start"
                    value={formatDate(
                      getDeployment(
                        selectedEmployee
                      ).start_date
                    )}
                  />

                  <Detail
                    icon={Calendar}
                    label="Deployment End"
                    value={formatDate(
                      getDeployment(
                        selectedEmployee
                      ).end_date
                    )}
                  />

                  <Detail
                    icon={BadgeCheck}
                    label="Deployment Status"
                    value={
                      getDeployment(
                        selectedEmployee
                      ).status
                    }
                  />

                </div>

              </section>

              {/* COMPANY */}

              <section>

                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Company Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <Detail
                    icon={Building2}
                    label="Company"
                    value={
                      getCompany(
                        selectedEmployee
                      ).company_name
                    }
                  />

                  <Detail
                    icon={Hash}
                    label="Client ID"
                    value={
                      getCompany(
                        selectedEmployee
                      ).id
                    }
                  />

                  <Detail
                    icon={MapPin}
                    label="Billing Address"
                    value={
                      getCompany(
                        selectedEmployee
                      ).billing_address
                    }
                  />

                  <Detail
                    icon={Mail}
                    label="Company Email"
                    value={
                      getCompany(
                        selectedEmployee
                      ).email
                    }
                  />

                  <Detail
                    icon={Phone}
                    label="Company Phone"
                    value={
                      getCompany(
                        selectedEmployee
                      ).phone
                    }
                  />

                  <Detail
                    icon={User}
                    label="Contact Person"
                    value={
                      getCompany(
                        selectedEmployee
                      ).contact_person
                    }
                  />

                  <Detail
                    icon={FileText}
                    label="Credit Terms"
                    value={
                      getCompany(
                        selectedEmployee
                      ).credit_terms
                    }
                  />

                  <Detail
                    icon={BadgeCheck}
                    label="Company Status"
                    value={
                      getCompany(
                        selectedEmployee
                      ).status
                    }
                  />

                </div>

              </section>

              {/* BILLING */}

              <section>

                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Deployment Billing
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                  <Detail
                    icon={CreditCard}
                    label="Bill Rate"
                    value={formatMoney(
                      getDeployment(
                        selectedEmployee
                      ).bill_rate
                    )}
                  />

                  <Detail
                    icon={FileText}
                    label="Billing Model"
                    value={
                      getDeployment(
                        selectedEmployee
                      ).billing_model
                    }
                  />

                </div>

                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">

                  <p className="text-[10px] text-blue-700 font-semibold">
                    Employee pay-rate information is not displayed
                    to the client. Only billing information applicable
                    to this company is shown.
                  </p>

                </div>

              </section>

              {/* SECURITY */}

              <section>

                <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">

                  <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5" />

                  <div>

                    <p className="text-xs font-bold text-slate-700">
                      Protected Employee Information
                    </p>

                    <p className="text-[11px] text-slate-500 mt-1">
                      PAN, bank account number, IFSC, UAN, ESIC
                      and employee password are intentionally hidden
                      from the client portal.
                    </p>

                  </div>

                </div>

              </section>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

// =====================================================
// SUMMARY CARD
// =====================================================

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconClass,
  valueClass,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-xs font-bold text-slate-400 uppercase">
            {label}
          </p>

          <p
            className={`text-2xl font-black mt-2 ${valueClass}`}
          >
            {value}
          </p>

        </div>

        <div
          className={`p-3 rounded-xl ${iconClass}`}
        >
          <Icon className="h-6 w-6" />
        </div>

      </div>

    </div>
  );
}

// =====================================================
// DETAIL COMPONENT
// =====================================================

function Detail({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">

      <div className="flex items-center gap-2 mb-1">

        <Icon className="h-3.5 w-3.5 text-blue-600" />

        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>

      </div>

      <p className="text-xs font-semibold text-slate-800 break-words">
        {value !== null &&
        value !== undefined &&
        value !== ""
          ? String(value)
          : "Not provided"}
      </p>

    </div>
  );
}

export default ClientCandidates;