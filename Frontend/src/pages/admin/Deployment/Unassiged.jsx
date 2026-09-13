import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  UserX,
  Search,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  RefreshCw,
  Eye,
  UserPlus,
  X,
  Loader2,
  Building2,
  IndianRupee,
  CalendarDays,
  FileText,
  Plus,
  CheckCircle2,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";
import api from "../../services/api";

const ACTIVE_STATUSES = [
  "active",
  "ongoing",
  "current",
];

export default function Unassigned() {
  const navigate = useNavigate();

  // =========================================================
  // STATE
  // =========================================================

  const [candidates, setCandidates] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [clients, setClients] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  const [error, setError] = useState("");

  // =========================================================
  // DEPLOY MODAL
  // =========================================================

  const [showDeployModal, setShowDeployModal] =
    useState(false);

  const [selectedEmployee, setSelectedEmployee] =
    useState(null);

  const [deployForm, setDeployForm] = useState({
    clientId: "",
    contractId: "",
    projectName: "",
    payRate: "",
    startDate: "",
  });

  // =========================================================
  // CONTRACTS
  // =========================================================

  const [contracts, setContracts] = useState([]);

  const [loadingContracts, setLoadingContracts] =
    useState(false);

  // =========================================================
  // CREATE CONTRACT MODAL
  // =========================================================

  const [showContractModal, setShowContractModal] =
    useState(false);

  const [creatingContract, setCreatingContract] =
    useState(false);

  const [contractForm, setContractForm] = useState({
    contractNumber: "",
    contractTitle: "",
    billingModel: "Percentage Markup",
    markupPercentage: "",
    perHeadFee: "",
    creditTerms: "Net 30",
    gstType: "Inter-State (IGST)",
  });

  // =========================================================
  // FETCH DATA ON LOAD
  // =========================================================

  useEffect(() => {
    fetchData();
  }, []);

  // =========================================================
  // FETCH EMPLOYEES / DEPLOYMENTS / CLIENTS
  // =========================================================

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        candidatesResponse,
        deploymentsResponse,
        clientsResponse,
      ] = await Promise.all([
        api.get("/candidates"),
        api.get("/deployments"),
        api.get("/clients"),
      ]);

      // Axios response
      const candidatesData =
        candidatesResponse?.data;

      const deploymentsData =
        deploymentsResponse?.data;

      const clientsData =
        clientsResponse?.data;

      // =====================================================
      // CANDIDATES
      // =====================================================

      const candidateList =
        Array.isArray(candidatesData)
          ? candidatesData
          : Array.isArray(
              candidatesData?.data
            )
          ? candidatesData.data
          : Array.isArray(
              candidatesData?.candidates
            )
          ? candidatesData.candidates
          : [];

      // =====================================================
      // DEPLOYMENTS
      // =====================================================

      const deploymentList =
        Array.isArray(deploymentsData)
          ? deploymentsData
          : Array.isArray(
              deploymentsData?.data
            )
          ? deploymentsData.data
          : Array.isArray(
              deploymentsData?.deployments
            )
          ? deploymentsData.deployments
          : [];

      // =====================================================
      // CLIENTS
      // =====================================================

      const clientList =
        Array.isArray(clientsData)
          ? clientsData
          : Array.isArray(
              clientsData?.data
            )
          ? clientsData.data
          : Array.isArray(
              clientsData?.clients
            )
          ? clientsData.clients
          : [];

      console.log(
        "UNASSIGNED - CANDIDATES:",
        candidateList
      );

      console.log(
        "UNASSIGNED - DEPLOYMENTS:",
        deploymentList
      );

      console.log(
        "UNASSIGNED - CLIENTS:",
        clientList
      );

      setCandidates(candidateList);
      setDeployments(deploymentList);
      setClients(clientList);
    } catch (err) {
      console.error(
        "UNASSIGNED EMPLOYEES ERROR:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to load employees"
      );

      setCandidates([]);
      setDeployments([]);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // EMPLOYEE ID
  // =========================================================

  const getEmployeeId = (employee) => {
    const id = Number(
      employee?.id ??
        employee?.candidate_id ??
        employee?.employee_id
    );

    return Number.isInteger(id) && id > 0
      ? id
      : null;
  };

  // =========================================================
  // DEPLOYMENT EMPLOYEE ID
  // =========================================================

  const getDeploymentEmployeeId = (
    deployment
  ) => {
    const id = Number(
      deployment?.candidate_id ??
        deployment?.employee_id ??
        deployment?.employee_ref_id
    );

    return Number.isInteger(id) && id > 0
      ? id
      : null;
  };

  // =========================================================
  // ACTIVE DEPLOYMENT EMPLOYEE IDS
  // =========================================================

  const activeDeploymentEmployeeIds =
    useMemo(() => {
      const ids = new Set();

      deployments.forEach(
        (deployment) => {
          const status = String(
            deployment?.status || ""
          )
            .trim()
            .toLowerCase();

          const employeeId =
            getDeploymentEmployeeId(
              deployment
            );

          if (
            employeeId &&
            ACTIVE_STATUSES.includes(
              status
            )
          ) {
            ids.add(employeeId);
          }
        }
      );

      return ids;
    }, [deployments]);

  // =========================================================
  // UNASSIGNED EMPLOYEES
  // =========================================================

  const unassignedEmployees =
    useMemo(() => {
      return candidates.filter(
        (candidate) => {
          const employeeId =
            getEmployeeId(candidate);

          // Candidate should not already have
          // deployment_id
          const hasCandidateDeployment =
            candidate?.deployment_id !==
              null &&
            candidate?.deployment_id !==
              undefined &&
            candidate?.deployment_id !==
              "";

          // Candidate should not have active deployment
          const hasActiveDeployment =
            employeeId &&
            activeDeploymentEmployeeIds.has(
              employeeId
            );

          return (
            !hasCandidateDeployment &&
            !hasActiveDeployment
          );
        }
      );
    }, [
      candidates,
      activeDeploymentEmployeeIds,
    ]);

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredEmployees =
    useMemo(() => {
      const search =
        searchQuery
          .trim()
          .toLowerCase();

      if (!search) {
        return unassignedEmployees;
      }

      return unassignedEmployees.filter(
        (employee) => {
          const name =
            String(
              employee?.full_name || ""
            ).toLowerCase();

          const email =
            String(
              employee?.email || ""
            ).toLowerCase();

          const phone =
            String(
              employee?.phone || ""
            ).toLowerCase();

          const designation =
            String(
              employee?.designation || ""
            ).toLowerCase();

          const employeeCode =
            String(
              employee?.employee_code || ""
            ).toLowerCase();

          return (
            name.includes(search) ||
            email.includes(search) ||
            phone.includes(search) ||
            designation.includes(search) ||
            employeeCode.includes(search)
          );
        }
      );
    }, [
      unassignedEmployees,
      searchQuery,
    ]);

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (date) => {
    if (!date) {
      return "N/A";
    }

    try {
      return new Date(
        date
      ).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return date;
    }
  };

  // =========================================================
  // OPEN DEPLOY MODAL
  // =========================================================

  const openDeployModal = (
    employee
  ) => {
    setSelectedEmployee(employee);

    setDeployForm({
      clientId: "",
      contractId: "",
      projectName: "",
      payRate:
        employee?.pay_rate !==
          null &&
        employee?.pay_rate !==
          undefined
          ? String(
              employee.pay_rate
            )
          : "",
      startDate: "",
    });

    setContracts([]);

    setError("");

    setShowDeployModal(true);
  };

  // =========================================================
  // CLOSE DEPLOY MODAL
  // =========================================================

  const closeDeployModal = () => {
    if (deploying) {
      return;
    }

    setShowDeployModal(false);

    setSelectedEmployee(null);

    setContracts([]);

    setDeployForm({
      clientId: "",
      contractId: "",
      projectName: "",
      payRate: "",
      startDate: "",
    });
  };

  // =========================================================
  // FETCH CONTRACTS FOR SELECTED CLIENT
  // =========================================================

  const fetchContractsForClient =
    async (clientId) => {
      if (!clientId) {
        setContracts([]);
        return;
      }

      try {
        setLoadingContracts(true);
        setError("");

        // IMPORTANT:
        // This is GET, not POST.
        //
        // Backend:
        // GET /api/deployments/contracts/client/:clientId

        const response =
          await api.get(
            `/deployments/contracts/client/${clientId}`
          );

        const data =
          response?.data;

        const contractList =
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.data
              )
            ? data.data
            : Array.isArray(
                data?.contracts
              )
            ? data.contracts
            : [];

        console.log(
          "CONTRACTS FOR CLIENT:",
          contractList
        );

        setContracts(
          contractList
        );
      } catch (err) {
        console.error(
          "FETCH CONTRACTS ERROR:",
          err
        );

        setContracts([]);

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Failed to load contracts."
        );
      } finally {
        setLoadingContracts(
          false
        );
      }
    };

  // =========================================================
  // HANDLE DEPLOY FORM CHANGE
  // =========================================================

  const handleDeployChange =
    async (e) => {
      const {
        name,
        value,
      } = e.target;

      setDeployForm(
        (prev) => ({
          ...prev,
          [name]: value,

          ...(name ===
          "clientId"
            ? {
                contractId:
                  "",
              }
            : {}),
        })
      );

      if (
        name ===
        "clientId"
      ) {
        await fetchContractsForClient(
          value
        );
      }
    };

  // =========================================================
  // SELECTED CONTRACT
  // =========================================================

  const selectedContract =
    useMemo(() => {
      if (
        !deployForm.contractId
      ) {
        return null;
      }

      return (
        contracts.find(
          (contract) =>
            Number(
              contract?.id
            ) ===
            Number(
              deployForm.contractId
            )
        ) || null
      );
    }, [
      contracts,
      deployForm.contractId,
    ]);

  // =========================================================
  // CALCULATE BILL RATE PREVIEW
  // =========================================================

  const calculatedBillRate =
    useMemo(() => {
      const payRate =
        Number(
          deployForm.payRate || 0
        );

      if (
        !selectedContract ||
        !Number.isFinite(
          payRate
        ) ||
        payRate < 0
      ) {
        return 0;
      }

      // =====================================================
      // PERCENTAGE MARKUP
      // =====================================================

      if (
        selectedContract.billing_model ===
        "Percentage Markup"
      ) {
        const markup =
          Number(
            selectedContract.markup_percentage ||
              0
          );

        if (
          !Number.isFinite(
            markup
          )
        ) {
          return 0;
        }

        return Number(
          (
            payRate +
            (payRate *
              markup) /
              100
          ).toFixed(2)
        );
      }

      // =====================================================
      // FIXED PER-HEAD FEE
      // =====================================================

      if (
        selectedContract.billing_model ===
        "Fixed Per-Head Fee"
      ) {
        const fee =
          Number(
            selectedContract.per_head_fee ||
              0
          );

        if (
          !Number.isFinite(
            fee
          )
        ) {
          return 0;
        }

        return Number(
          (
            payRate +
            fee
          ).toFixed(2)
        );
      }

      return 0;
    }, [
      deployForm.payRate,
      selectedContract,
    ]);

  // =========================================================
  // OPEN CONTRACT MODAL
  // =========================================================

  const openContractModal =
    () => {
      if (
        !deployForm.clientId
      ) {
        alert(
          "Please select a client first."
        );
        return;
      }

      setContractForm({
        contractNumber: "",
        contractTitle: "",
        billingModel:
          "Percentage Markup",
        markupPercentage: "",
        perHeadFee: "",
        creditTerms:
          "Net 30",
        gstType:
          "Inter-State (IGST)",
      });

      setShowContractModal(
        true
      );
    };

  // =========================================================
  // CLOSE CONTRACT MODAL
  // =========================================================

  const closeContractModal =
    () => {
      if (
        creatingContract
      ) {
        return;
      }

      setShowContractModal(
        false
      );
    };

  // =========================================================
  // CONTRACT FORM CHANGE
  // =========================================================

  const handleContractChange =
    (e) => {
      const {
        name,
        value,
      } = e.target;

      setContractForm(
        (prev) => ({
          ...prev,
          [name]: value,

          ...(name ===
          "billingModel"
            ? {
                markupPercentage:
                  value ===
                  "Percentage Markup"
                    ? prev.markupPercentage
                    : "",

                perHeadFee:
                  value ===
                  "Fixed Per-Head Fee"
                    ? prev.perHeadFee
                    : "",
              }
            : {}),
        })
      );
    };

  // =========================================================
  // CREATE CONTRACT
  // =========================================================

  const handleCreateContract =
    async (e) => {
      e.preventDefault();

      if (
        !deployForm.clientId
      ) {
        alert(
          "Please select a client first."
        );
        return;
      }

      if (
        !contractForm.contractNumber.trim()
      ) {
        alert(
          "Please enter contract number."
        );
        return;
      }

      if (
        !contractForm.contractTitle.trim()
      ) {
        alert(
          "Please enter contract title."
        );
        return;
      }

      if (
        contractForm.billingModel ===
          "Percentage Markup" &&
        contractForm.markupPercentage ===
          ""
      ) {
        alert(
          "Please enter markup percentage."
        );
        return;
      }

      if (
        contractForm.billingModel ===
          "Fixed Per-Head Fee" &&
        contractForm.perHeadFee ===
          ""
      ) {
        alert(
          "Please enter per-head fee."
        );
        return;
      }

      try {
        setCreatingContract(
          true
        );

        setError("");

        // ===================================================
        // IMPORTANT
        //
        // Correct endpoint:
        //
        // POST /api/deployments/contracts
        //
        // NOT:
        // POST /api/deployments
        // ===================================================

        const payload = {
          client_id:
            Number(
              deployForm.clientId
            ),

          contract_number:
            contractForm.contractNumber.trim(),

          contract_title:
            contractForm.contractTitle.trim(),

          billing_model:
            contractForm.billingModel,

          markup_percentage:
            contractForm.billingModel ===
            "Percentage Markup"
              ? Number(
                  contractForm.markupPercentage
                )
              : 0,

          per_head_fee:
            contractForm.billingModel ===
            "Fixed Per-Head Fee"
              ? Number(
                  contractForm.perHeadFee
                )
              : 0,

          credit_terms:
            contractForm.creditTerms,

          gst_type:
            contractForm.gstType,

          contract_status:
            "Active",
        };

        console.log(
          "CREATE CONTRACT PAYLOAD:",
          payload
        );

        const response =
          await api.post(
            "/deployments/contracts",
            payload
          );

        const data =
          response?.data;

        console.log(
          "CREATE CONTRACT RESPONSE:",
          data
        );

        const createdContract =
          data?.data ||
          data?.contract ||
          data;

        if (
          !createdContract ||
          !createdContract.id
        ) {
          throw new Error(
            "Contract was created but no contract data was returned."
          );
        }

        // ===================================================
        // ADD NEW CONTRACT TO LIST
        // ===================================================

        setContracts(
          (prev) => [
            createdContract,
            ...prev,
          ]
        );

        // ===================================================
        // SELECT NEW CONTRACT
        // ===================================================

        setDeployForm(
          (prev) => ({
            ...prev,
            contractId:
              String(
                createdContract.id
              ),
          })
        );

        // ===================================================
        // CLOSE MODAL
        // ===================================================

        setShowContractModal(
          false
        );

        alert(
          "Contract created successfully."
        );
      } catch (err) {
        console.error(
          "CREATE CONTRACT ERROR:",
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Failed to create contract."
        );
      } finally {
        setCreatingContract(
          false
        );
      }
    };

  // =========================================================
  // DEPLOY EMPLOYEE
  // =========================================================

  const handleDeploy =
    async (e) => {
      e.preventDefault();

      if (
        !selectedEmployee
      ) {
        alert(
          "Please select an employee."
        );
        return;
      }

      if (
        !deployForm.clientId
      ) {
        alert(
          "Please select a client."
        );
        return;
      }

      if (
        !deployForm.contractId
      ) {
        alert(
          "Please select a contract."
        );
        return;
      }

      if (
        !deployForm.projectName.trim()
      ) {
        alert(
          "Please enter project name."
        );
        return;
      }

      if (
        !deployForm.payRate
      ) {
        alert(
          "Employee pay rate is missing."
        );
        return;
      }

      if (
        !deployForm.startDate
      ) {
        alert(
          "Please select start date."
        );
        return;
      }

      if (
        !calculatedBillRate
      ) {
        alert(
          "Bill rate could not be calculated from the selected contract."
        );
        return;
      }

      try {
        setDeploying(true);
        setError("");

        const employeeId =
          getEmployeeId(
            selectedEmployee
          );

        if (!employeeId) {
          throw new Error(
            "Invalid employee ID."
          );
        }

        // ===================================================
        // IMPORTANT
        //
        // Use Axios API.
        //
        // Do NOT use:
        // fetch()
        // API_BASE
        //
        // Backend decides:
        // - pay_rate
        // - bill_rate
        // - billing_model
        // - end_date
        // ===================================================

        const payload = {
          candidate_id:
            employeeId,

          client_id:
            Number(
              deployForm.clientId
            ),

          contract_id:
            Number(
              deployForm.contractId
            ),

          project_name:
            deployForm.projectName.trim(),

          start_date:
            deployForm.startDate,

          status:
            "Active",
        };

        console.log(
          "DEPLOY EMPLOYEE PAYLOAD:",
          payload
        );

        const response =
          await api.post(
            "/deployments",
            payload
          );

        console.log(
          "DEPLOY EMPLOYEE RESPONSE:",
          response?.data
        );

        alert(
          `${selectedEmployee.full_name} has been deployed successfully.`
        );

        // Close modal
        closeDeployModal();

        // Reload employees/deployments
        await fetchData();
      } catch (err) {
        console.error(
          "DEPLOY EMPLOYEE ERROR:",
          err
        );

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Failed to deploy employee."
        );
      } finally {
        setDeploying(false);
      }
    };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="flex min-h-screen bg-slate-50/50">

      <Sidebar />

      <main className="flex-1 p-8 space-y-6 overflow-y-auto">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

          <div>

            <div className="flex items-center gap-2">

              <UserX className="h-6 w-6 text-orange-500" />

              <h2 className="text-2xl font-bold text-slate-900">
                Unassigned Employees
              </h2>

            </div>

            <p className="text-sm text-slate-500 mt-1">
              Employees who are currently not assigned
              to any client deployment.
            </p>

          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">

            <div className="relative w-full sm:w-64">

              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />

            </div>

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600"
              title="Refresh"
            >

              <RefreshCw
                className={`h-4 w-4 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
              />

            </button>

          </div>

        </div>

        {/* ===================================================
            SUMMARY
        =================================================== */}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Unassigned Employees
                </p>

                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {
                    unassignedEmployees.length
                  }
                </p>

              </div>

              <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center">

                <UserX className="h-5 w-5 text-orange-500" />

              </div>

            </div>

          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Assigned Employees
                </p>

                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {Math.max(
                    0,
                    candidates.length -
                      unassignedEmployees.length
                  )}
                </p>

              </div>

              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">

                <Briefcase className="h-5 w-5 text-emerald-500" />

              </div>

            </div>

          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Employees
                </p>

                <p className="text-3xl font-bold text-slate-900 mt-2">
                  {
                    candidates.length
                  }
                </p>

              </div>

              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">

                <UserPlus className="h-5 w-5 text-indigo-500" />

              </div>

            </div>

          </div>

        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* ===================================================
            TABLE
        =================================================== */}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">

            <div>

              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Available for Deployment
              </p>

              <p className="text-xs text-slate-500 mt-1">
                {
                  filteredEmployees.length
                }{" "}
                employee
                {filteredEmployees.length !==
                1
                  ? "s"
                  : ""}{" "}
                found
              </p>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-left">

              <thead>

                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase bg-slate-50/30">

                  <th className="p-4">
                    Employee
                  </th>

                  <th className="p-4">
                    Designation
                  </th>

                  <th className="p-4">
                    Email
                  </th>

                  <th className="p-4">
                    Phone
                  </th>

                  <th className="p-4">
                    Joining Date
                  </th>

                  <th className="p-4">
                    Status
                  </th>

                  <th className="p-4">
                    Deployment
                  </th>

                  <th className="p-4 text-right">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                {loading ? (

                  <tr>

                    <td
                      colSpan="8"
                      className="p-10 text-center"
                    >

                      <div className="flex flex-col items-center gap-3">

                        <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />

                        <span className="text-sm text-slate-500">
                          Loading employees...
                        </span>

                      </div>

                    </td>

                  </tr>

                ) : filteredEmployees.length >
                  0 ? (

                  filteredEmployees.map(
                    (employee) => {

                      const employeeId =
                        getEmployeeId(
                          employee
                        );

                      return (
                        <tr
                          key={
                            employeeId
                          }
                          className="hover:bg-slate-50 transition"
                        >

                          <td className="p-4">

                            <div className="flex items-center gap-3">

                              <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">

                                {(
                                  employee.full_name ||
                                  "U"
                                )
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}

                              </div>

                              <div>

                                <p className="font-semibold text-slate-900">
                                  {
                                    employee.full_name ||
                                    "N/A"
                                  }
                                </p>

                                <p className="text-[10px] text-slate-400">
                                  Employee ID:{" "}
                                  {
                                    employee.employee_code ||
                                    (employeeId ??
                                      "N/A")
                                  }
                                </p>

                              </div>

                            </div>

                          </td>

                          <td className="p-4">

                            <div className="flex items-center gap-2">

                              <Briefcase className="h-4 w-4 text-indigo-400" />

                              <span className="text-sm text-slate-700">
                                {
                                  employee.designation ||
                                  "N/A"
                                }
                              </span>

                            </div>

                          </td>

                          <td className="p-4">

                            <div className="flex items-center gap-2">

                              <Mail className="h-4 w-4 text-slate-400" />

                              <span className="text-xs text-slate-600">
                                {
                                  employee.email ||
                                  "N/A"
                                }
                              </span>

                            </div>

                          </td>

                          <td className="p-4">

                            <div className="flex items-center gap-2">

                              <Phone className="h-4 w-4 text-slate-400" />

                              <span className="text-xs text-slate-600">
                                {
                                  employee.phone ||
                                  "N/A"
                                }
                              </span>

                            </div>

                          </td>

                          <td className="p-4">

                            <div className="flex items-center gap-2">

                              <Calendar className="h-4 w-4 text-slate-400" />

                              <span className="text-xs text-slate-600">
                                {formatDate(
                                  employee.date_of_joining
                                )}
                              </span>

                            </div>

                          </td>

                          <td className="p-4">

                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
                              {
                                employee.employment_status ||
                                "Available"
                              }
                            </span>

                          </td>

                          <td className="p-4">

                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600">
                              Not Assigned
                            </span>

                          </td>

                          <td className="p-4">

                            <div className="flex items-center justify-end gap-2">

                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/employee/details/${employeeId}`
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold"
                              >

                                <Eye className="h-3.5 w-3.5" />

                                View

                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openDeployModal(
                                    employee
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold"
                              >

                                <Briefcase className="h-3.5 w-3.5" />

                                Deploy

                              </button>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )

                ) : (

                  <tr>

                    <td
                      colSpan="8"
                      className="p-12 text-center"
                    >

                      <div className="flex flex-col items-center">

                        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">

                          <Briefcase className="h-6 w-6 text-emerald-500" />

                        </div>

                        <h3 className="font-bold text-slate-800">
                          No Unassigned Employees
                        </h3>

                        <p className="text-sm text-slate-500 mt-1">
                          All employees are currently
                          assigned to deployments.
                        </p>

                      </div>

                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </div>

      </main>

      {/* =====================================================
          DEPLOY MODAL
      ====================================================== */}

      {showDeployModal &&
        selectedEmployee && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

            <div
              className="absolute inset-0 bg-black/40"
              onClick={
                closeDeployModal
              }
            />

            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">

              {/* HEADER */}

              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">

                <div>

                  <h2 className="text-lg font-bold text-slate-900">
                    Deploy{" "}
                    {
                      selectedEmployee.full_name
                    }
                  </h2>

                  <p className="text-xs text-slate-500 mt-1">
                    Select a client and contract to
                    calculate the billing rate.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={
                    closeDeployModal
                  }
                  disabled={
                    deploying
                  }
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
                >

                  <X className="h-5 w-5" />

                </button>

              </div>

              {/* FORM */}

              <form
                onSubmit={
                  handleDeploy
                }
                className="p-6 space-y-5"
              >

                {/* EMPLOYEE */}

                <div className="bg-slate-50 rounded-xl p-4">

                  <p className="text-xs font-semibold text-slate-400 uppercase">
                    Employee
                  </p>

                  <div className="flex items-center gap-3 mt-2">

                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      {selectedEmployee.full_name
                        ?.charAt(0)
                        ?.toUpperCase()}
                    </div>

                    <div>

                      <p className="font-bold text-slate-900">
                        {
                          selectedEmployee.full_name
                        }
                      </p>

                      <p className="text-xs text-slate-500">
                        {
                          selectedEmployee.designation ||
                          "Employee"
                        }
                      </p>

                    </div>

                  </div>

                </div>

                {/* CLIENT */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Client *
                  </label>

                  <div className="relative">

                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                    <select
                      name="clientId"
                      value={
                        deployForm.clientId
                      }
                      onChange={
                        handleDeployChange
                      }
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    >

                      <option value="">
                        Select Client
                      </option>

                      {clients.map(
                        (client) => (
                          <option
                            key={
                              client.id
                            }
                            value={
                              client.id
                            }
                          >
                            {
                              client.company_name ||
                              client.name ||
                              `Client ${client.id}`
                            }
                          </option>
                        )
                      )}

                    </select>

                  </div>

                </div>

                {/* CONTRACT */}

                <div>

                  <div className="flex items-center justify-between mb-1.5">

                    <label className="block text-xs font-bold text-slate-600">
                      Contract *
                    </label>

                    {deployForm.clientId && (
                      <button
                        type="button"
                        onClick={
                          openContractModal
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >

                        <Plus className="h-3.5 w-3.5" />

                        Create New Contract

                      </button>
                    )}

                  </div>

                  <div className="relative">

                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                    <select
                      name="contractId"
                      value={
                        deployForm.contractId
                      }
                      onChange={
                        handleDeployChange
                      }
                      required
                      disabled={
                        !deployForm.clientId ||
                        loadingContracts
                      }
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    >

                      <option value="">
                        {!deployForm.clientId
                          ? "Select client first"
                          : loadingContracts
                          ? "Loading contracts..."
                          : contracts.length ===
                            0
                          ? "No active contracts"
                          : "Select Contract"}
                      </option>

                      {contracts.map(
                        (contract) => (
                          <option
                            key={
                              contract.id
                            }
                            value={
                              contract.id
                            }
                          >
                            {
                              contract.contract_number
                            }
                            {" — "}
                            {
                              contract.contract_title ||
                              "Contract"
                            }
                          </option>
                        )
                      )}

                    </select>

                  </div>

                  {deployForm.clientId &&
                    !loadingContracts &&
                    contracts.length ===
                      0 && (

                    <p className="text-xs text-orange-600 mt-2">
                      No active contract found for
                      this client. Create a new
                      contract before deploying.
                    </p>

                  )}

                </div>

                {/* CONTRACT DETAILS */}

                {selectedContract && (

                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">

                    <div className="flex items-center gap-2 mb-3">

                      <CheckCircle2 className="h-4 w-4 text-indigo-600" />

                      <p className="text-xs font-bold text-indigo-800">
                        {
                          selectedContract.contract_number
                        }
                      </p>

                    </div>

                    <p className="text-sm font-semibold text-indigo-900 mb-3">
                      {
                        selectedContract.contract_title ||
                        "Staffing Agreement"
                      }
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

                      <div>

                        <p className="text-[10px] uppercase font-semibold text-indigo-400">
                          Billing
                        </p>

                        <p className="text-xs font-semibold text-indigo-900 mt-1">
                          {
                            selectedContract.billing_model ||
                            "N/A"
                          }
                        </p>

                      </div>

                      {selectedContract.billing_model ===
                        "Percentage Markup" && (

                        <div>

                          <p className="text-[10px] uppercase font-semibold text-indigo-400">
                            Markup
                          </p>

                          <p className="text-xs font-semibold text-indigo-900 mt-1">
                            {Number(
                              selectedContract.markup_percentage ||
                                0
                            )}
                            %
                          </p>

                        </div>

                      )}

                      {selectedContract.billing_model ===
                        "Fixed Per-Head Fee" && (

                        <div>

                          <p className="text-[10px] uppercase font-semibold text-indigo-400">
                            Per Head Fee
                          </p>

                          <p className="text-xs font-semibold text-indigo-900 mt-1">
                            ₹
                            {Number(
                              selectedContract.per_head_fee ||
                                0
                            ).toLocaleString(
                              "en-IN"
                            )}
                          </p>

                        </div>

                      )}

                      <div>

                        <p className="text-[10px] uppercase font-semibold text-indigo-400">
                          Credit
                        </p>

                        <p className="text-xs font-semibold text-indigo-900 mt-1">
                          {
                            selectedContract.credit_terms ||
                            "N/A"
                          }
                        </p>

                      </div>

                    </div>

                  </div>

                )}

                {/* PROJECT */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Project Name *
                  </label>

                  <input
                    type="text"
                    name="projectName"
                    value={
                      deployForm.projectName
                    }
                    onChange={
                      handleDeployChange
                    }
                    required
                    placeholder="e.g. Enterprise Java Application Development"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />

                </div>

                {/* PAY + BILL */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* PAY RATE */}

                  <div>

                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Pay Rate / Month
                    </label>

                    <div className="relative">

                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                      <input
                        type="text"
                        value={
                          deployForm.payRate
                            ? `₹${Number(
                                deployForm.payRate
                              ).toLocaleString(
                                "en-IN"
                              )}`
                            : "Not available"
                        }
                        readOnly
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-700 cursor-not-allowed"
                      />

                    </div>

                    <p className="text-[10px] text-slate-400 mt-1">
                      Taken from employee master record.
                    </p>

                  </div>

                  {/* BILL RATE */}

                  <div>

                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Bill Rate / Month
                    </label>

                    <div className="relative">

                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />

                      <input
                        type="text"
                        value={
                          calculatedBillRate
                            ? `₹${calculatedBillRate.toLocaleString(
                                "en-IN",
                                {
                                  maximumFractionDigits: 2,
                                }
                              )}`
                            : "Select contract"
                        }
                        readOnly
                        className="w-full pl-9 pr-4 py-2.5 border border-emerald-200 rounded-xl text-sm bg-emerald-50 text-emerald-700 font-semibold cursor-not-allowed"
                      />

                    </div>

                    <p className="text-[10px] text-emerald-600 mt-1">
                      Automatically calculated from contract.
                    </p>

                  </div>

                </div>

                {/* START DATE */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Deployment Start Date *
                  </label>

                  <div className="relative">

                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                    <input
                      type="date"
                      name="startDate"
                      value={
                        deployForm.startDate
                      }
                      onChange={
                        handleDeployChange
                      }
                      required
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />

                  </div>

                </div>

                {/* INFO */}

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">

                  <p className="text-xs text-blue-700">
                    The selected contract controls
                    the bill rate. The backend will
                    calculate and save the final bill
                    rate when this employee is deployed.
                  </p>

                </div>

                {/* ACTIONS */}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">

                  <button
                    type="button"
                    onClick={
                      closeDeployModal
                    }
                    disabled={
                      deploying
                    }
                    className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      deploying ||
                      !deployForm.clientId ||
                      !deployForm.contractId ||
                      !deployForm.projectName.trim() ||
                      !deployForm.startDate ||
                      !calculatedBillRate
                    }
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                  >

                    {deploying && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {deploying
                      ? "Deploying..."
                      : "Deploy Employee"}

                  </button>

                </div>

              </form>

            </div>

          </div>
        )}

      {/* =====================================================
          CREATE CONTRACT MODAL
      ====================================================== */}

      {showContractModal && (

        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">

          <div
            className="absolute inset-0 bg-black/50"
            onClick={
              closeContractModal
            }
          />

          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">

            {/* HEADER */}

            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">

              <div>

                <h2 className="text-lg font-bold text-slate-900">
                  Create New Contract
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  This contract will be created for
                  the selected client.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  closeContractModal
                }
                disabled={
                  creatingContract
                }
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
              >

                <X className="h-5 w-5" />

              </button>

            </div>

            {/* FORM */}

            <form
              onSubmit={
                handleCreateContract
              }
              className="p-6 space-y-5"
            >

              {/* CONTRACT NUMBER */}

              <div>

                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Contract Number *
                </label>

                <input
                  type="text"
                  name="contractNumber"
                  value={
                    contractForm.contractNumber
                  }
                  onChange={
                    handleContractChange
                  }
                  required
                  placeholder="e.g. INF-MSA-2026-02"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />

              </div>

              {/* CONTRACT TITLE */}

              <div>

                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Contract Title *
                </label>

                <input
                  type="text"
                  name="contractTitle"
                  value={
                    contractForm.contractTitle
                  }
                  onChange={
                    handleContractChange
                  }
                  required
                  placeholder="e.g. Enterprise Staffing Agreement"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />

              </div>

              {/* BILLING MODEL */}

              <div>

                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Billing Model *
                </label>

                <select
                  name="billingModel"
                  value={
                    contractForm.billingModel
                  }
                  onChange={
                    handleContractChange
                  }
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >

                  <option value="Percentage Markup">
                    Percentage Markup
                  </option>

                  <option value="Fixed Per-Head Fee">
                    Fixed Per-Head Fee
                  </option>

                </select>

              </div>

              {/* MARKUP */}

              {contractForm.billingModel ===
                "Percentage Markup" && (

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Markup Percentage *
                  </label>

                  <div className="relative">

                    <input
                      type="number"
                      name="markupPercentage"
                      min="0"
                      step="0.01"
                      value={
                        contractForm.markupPercentage
                      }
                      onChange={
                        handleContractChange
                      }
                      required
                      placeholder="10"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">
                      %
                    </span>

                  </div>

                </div>
              )}

              {/* PER HEAD */}

              {contractForm.billingModel ===
                "Fixed Per-Head Fee" && (

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Per-Head Fee / Month *
                  </label>

                  <div className="relative">

                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                    <input
                      type="number"
                      name="perHeadFee"
                      min="0"
                      step="0.01"
                      value={
                        contractForm.perHeadFee
                      }
                      onChange={
                        handleContractChange
                      }
                      required
                      placeholder="2500"
                      className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    />

                  </div>

                </div>
              )}

              {/* CREDIT + GST */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Credit Terms
                  </label>

                  <select
                    name="creditTerms"
                    value={
                      contractForm.creditTerms
                    }
                    onChange={
                      handleContractChange
                    }
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                  >

                    <option value="Net 15">
                      Net 15
                    </option>

                    <option value="Net 30">
                      Net 30
                    </option>

                    <option value="Net 45">
                      Net 45
                    </option>

                    <option value="Net 60">
                      Net 60
                    </option>

                  </select>

                </div>

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    GST Type
                  </label>

                  <select
                    name="gstType"
                    value={
                      contractForm.gstType
                    }
                    onChange={
                      handleContractChange
                    }
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                  >

                    <option value="Intra-State (CGST+SGST)">
                      Intra-State (CGST+SGST)
                    </option>

                    <option value="Inter-State (IGST)">
                      Inter-State (IGST)
                    </option>

                  </select>

                </div>

              </div>

              {/* INFO */}

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">

                <p className="text-xs text-indigo-700">

                  This contract will be saved as{" "}
                  <strong>
                    Active
                  </strong>{" "}
                  and will immediately become available
                  for deployment.

                </p>

              </div>

              {/* ACTIONS */}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">

                <button
                  type="button"
                  onClick={
                    closeContractModal
                  }
                  disabled={
                    creatingContract
                  }
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    creatingContract
                  }
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                >

                  {creatingContract && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {creatingContract
                    ? "Creating..."
                    : "Create Contract"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}