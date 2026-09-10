
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  History,
  Plus,
  X,
  ShieldAlert,
  Loader2,
  RefreshCw,
  FileText,
  Ban,
  CalendarDays,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Eye,
  UserPlus,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";

import EmployeeCreateAccountModal
  from "./EmployeeCreateAccountModal";

const API_BASE = "http://localhost:5000/api";

// ============================================================
// ACTIVE DEPLOYMENT STATUSES
// ============================================================

const ACTIVE_STATUSES = ["active", "ongoing", "current"];

// ============================================================
// HELPERS
// ============================================================

const isActiveStatus = (status) => {
  return ACTIVE_STATUSES.includes(
    String(status || "").trim().toLowerCase()
  );
};

const getResponseList = (data, keys = []) => {
  if (Array.isArray(data)) {
    return data;
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const formatDate = (date) => {
  if (!date) return "N/A";

  try {
    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date;
  }
};

const formatCurrency = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "₹0";
  }

  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

// ============================================================
// GET CONTRACT START DATE
// ============================================================

const getContractStartDate = (contract) => {
  if (!contract) return null;

  return (
    contract.contract_start_date ||
    contract.start_date ||
    contract.valid_from ||
    contract.startDate ||
    null
  );
};

// ============================================================
// GET CONTRACT END DATE
// ============================================================

const getContractEndDate = (contract) => {
  if (!contract) return null;

  return (
    contract.contract_end_date ||
    contract.end_date ||
    contract.valid_until ||
    contract.endDate ||
    null
  );
};

// ============================================================
// DAYS LEFT
// ============================================================

const getDaysRemaining = (endDate) => {
  if (!endDate) return null;

  const today = new Date();
  const end = new Date(endDate);

  if (Number.isNaN(end.getTime())) {
    return null;
  }

  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const difference =
    end.getTime() - today.getTime();

  return Math.ceil(
    difference / (1000 * 60 * 60 * 24)
  );
};

// ============================================================
// CONTRACT HEALTH
// ============================================================

const getContractHealth = (contract) => {
  const status = String(
    contract?.contract_status || ""
  )
    .trim()
    .toLowerCase();

  const endDate = getContractEndDate(contract);

  if (status === "expired") {
    return {
      label: "Expired",
      className:
        "bg-red-50 text-red-600 border-red-100",
      icon: AlertTriangle,
    };
  }

  if (!endDate) {
    return {
      label: "No End Date",
      className:
        "bg-slate-50 text-slate-600 border-slate-200",
      icon: Clock3,
    };
  }

  const days = getDaysRemaining(endDate);

  if (days === null) {
    return {
      label: "Unknown",
      className:
        "bg-slate-50 text-slate-600 border-slate-200",
      icon: Clock3,
    };
  }

  if (days < 0) {
    return {
      label: "Expired",
      className:
        "bg-red-50 text-red-600 border-red-100",
      icon: AlertTriangle,
    };
  }

  if (days <= 30) {
    return {
      label: "Expiring Soon",
      className:
        "bg-amber-50 text-amber-700 border-amber-100",
      icon: AlertTriangle,
    };
  }

  return {
    label: "Active",
    className:
      "bg-emerald-50 text-emerald-600 border-emerald-100",
    icon: CheckCircle2,
  };
};

// ============================================================
// BILL RATE PREVIEW
// FRONTEND PREVIEW ONLY
// BACKEND IS FINAL AUTHORITY
// ============================================================

const calculateBillRatePreview = (
  payRate,
  contract
) => {
  const pay = Number(payRate || 0);

  if (!contract || !pay) {
    return 0;
  }

  const billingModel = String(
    contract.billing_model || ""
  )
    .trim()
    .toLowerCase();

  if (billingModel === "percentage markup") {
    const markup = Number(
      contract.markup_percentage || 0
    );

    return pay + (pay * markup) / 100;
  }

  if (billingModel === "fixed per-head fee") {
    const fee = Number(
      contract.per_head_fee || 0
    );

    return pay + fee;
  }

  return 0;
};

// ============================================================
// COMPONENT
// ============================================================

function EmployeeDeployment() {
  // ==========================================================
  // DATA
  // ==========================================================

  const [deployments, setDeployments] = useState([]);
  const [clients, setClients] = useState([]);
  const [candidates, setCandidates] = useState([]);

  // ==========================================================
  // EMPLOYEE ACCOUNTS
  // ==========================================================

  const [employeeAccounts, setEmployeeAccounts] =
    useState([]);

  const [accountEmployee, setAccountEmployee] =
    useState(null);

  // ==========================================================
  // CONTRACTS
  // ==========================================================

  const [assignContracts, setAssignContracts] =
    useState([]);

  const [transferContracts, setTransferContracts] =
    useState([]);

  const [
    loadingAssignContracts,
    setLoadingAssignContracts,
  ] = useState(false);

  const [
    loadingTransferContracts,
    setLoadingTransferContracts,
  ] = useState(false);

  // ==========================================================
  // LOADING / ERROR
  // ==========================================================

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================================
  // MODALS
  // ==========================================================

  const [showAssignModal, setShowAssignModal] =
    useState(false);

  const [showTransferModal, setShowTransferModal] =
    useState(false);

  const [showHistoryModal, setShowHistoryModal] =
    useState(false);

  const [showTerminateModal, setShowTerminateModal] =
    useState(false);

  const [showContractModal, setShowContractModal] =
    useState(false);

  const [selectedGroup, setSelectedGroup] =
    useState(null);

  const [selectedContractDetails, setSelectedContractDetails] =
    useState(null);

  // ==========================================================
  // ASSIGN FORM
  // ==========================================================

  const [formData, setFormData] = useState({
    candidateId: "",
    clientId: "",
    contractId: "",
    project: "",
    startDate: "",
  });

  const [assigning, setAssigning] =
    useState(false);

  // ==========================================================
  // TRANSFER FORM
  // ==========================================================

  const [transferData, setTransferData] =
    useState({
      newClientId: "",
      newContractId: "",
      newProject: "",
      effectiveDate: "",
    });

  const [transferring, setTransferring] =
    useState(false);

  // ==========================================================
  // TERMINATE FORM
  // ==========================================================

  const [terminateData, setTerminateData] =
    useState({
      effectiveDate: "",
    });

  const [terminating, setTerminating] =
    useState(false);

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    fetchAll();
  }, []);

  // ==========================================================
  // FETCH ALL
  // ==========================================================

  const fetchAll = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        depRes,
        clientRes,
        candRes,
        accountRes,
      ] = await Promise.all([
        fetch(`${API_BASE}/deployments`),
        fetch(`${API_BASE}/clients`),
        fetch(`${API_BASE}/candidates`),
        fetch(`${API_BASE}/employee-users`),
      ]);

      const depData = await depRes
        .json()
        .catch(() => ({}));

      const clientData = await clientRes
        .json()
        .catch(() => ({}));

      const candData = await candRes
        .json()
        .catch(() => ({}));

      const accountData = await accountRes
        .json()
        .catch(() => ({}));

      if (!depRes.ok) {
        throw new Error(
          depData?.message ||
          "Failed to fetch deployments"
        );
      }

      if (!clientRes.ok) {
        throw new Error(
          clientData?.message ||
          "Failed to fetch clients"
        );
      }

      if (!candRes.ok) {
        throw new Error(
          candData?.message ||
          "Failed to fetch candidates"
        );
      }

      if (!accountRes.ok) {
        console.warn(
          "Employee accounts could not be loaded:",
          accountData?.message
        );
      }

      const rawDepList = getResponseList(
        depData,
        ["deployments", "deployment"]
      );

      const clientList = getResponseList(
        clientData,
        ["clients", "client"]
      );

      const candList = getResponseList(
        candData,
        ["candidates", "candidate"]
      );

      const accountList = accountRes.ok
        ? getResponseList(
            accountData,
            [
              "employee_users",
              "employeeUsers",
              "accounts",
            ]
          )
        : [];

      // ======================================================
      // NORMALIZE DEPLOYMENTS
      // ======================================================

      const normalizedDeployments =
        rawDepList.map((deployment) => {
          const nestedCandidate =
            deployment.candidate ||
            deployment.candidates ||
            deployment.employee ||
            {};

          const candidateId =
            deployment.candidate_id ??
            deployment.employee_id ??
            deployment.candidateId ??
            nestedCandidate.id ??
            null;

          const candidateFromList =
            candList.find(
              (candidate) =>
                Number(candidate.id) ===
                Number(candidateId)
            ) || {};

          const nestedClient =
            deployment.client ||
            deployment.clients ||
            {};

          const clientId =
            deployment.client_id ??
            deployment.clientId ??
            nestedClient.id ??
            null;

          const clientFromList =
            clientList.find(
              (client) =>
                Number(client.id) ===
                Number(clientId)
            ) || {};

          const nestedContract =
            deployment.contract ||
            deployment.client_contract ||
            deployment.client_contracts ||
            {};

          return {
            ...deployment,

            // Candidate
            candidate_id: candidateId,

            employee_name:
              deployment.employee_name ||
              deployment.full_name ||
              nestedCandidate.full_name ||
              candidateFromList.full_name ||
              "Unknown Employee",

            email:
              deployment.email ||
              nestedCandidate.email ||
              candidateFromList.email ||
              null,

            phone:
              deployment.phone ||
              nestedCandidate.phone ||
              candidateFromList.phone ||
              null,

            designation:
              deployment.designation ||
              nestedCandidate.designation ||
              candidateFromList.designation ||
              null,

            // Client
            client_id: clientId,

            company_name:
              deployment.company_name ||
              nestedClient.company_name ||
              clientFromList.company_name ||
              "Unknown Client",

            // Contract
            contract_id:
              deployment.contract_id ??
              deployment.contractId ??
              nestedContract.id ??
              null,

            contract_number:
              deployment.contract_number ||
              nestedContract.contract_number ||
              null,

            contract_title:
              deployment.contract_title ||
              nestedContract.contract_title ||
              null,

            billing_model:
              deployment.billing_model ||
              nestedContract.billing_model ||
              null,

            markup_percentage:
              deployment.markup_percentage ??
              nestedContract.markup_percentage ??
              null,

            per_head_fee:
              deployment.per_head_fee ??
              nestedContract.per_head_fee ??
              null,

            credit_terms:
              deployment.credit_terms ||
              nestedContract.credit_terms ||
              null,

            gst_type:
              deployment.gst_type ||
              nestedContract.gst_type ||
              null,

            contract_status:
              deployment.contract_status ||
              nestedContract.contract_status ||
              null,

            contract_start_date:
              deployment.contract_start_date ||
              nestedContract.contract_start_date ||
              nestedContract.start_date ||
              nestedContract.valid_from ||
              nestedContract.startDate ||
              null,

            contract_end_date:
              deployment.contract_end_date ||
              nestedContract.contract_end_date ||
              nestedContract.end_date ||
              nestedContract.valid_until ||
              nestedContract.endDate ||
              null,
          };
        });

      setDeployments(normalizedDeployments);
      setClients(clientList);
      setCandidates(candList);
      setEmployeeAccounts(accountList);

      console.log(
        "NORMALIZED DEPLOYMENTS:",
        normalizedDeployments
      );

      console.log(
        "CANDIDATES:",
        candList
      );

      console.log(
        "EMPLOYEE ACCOUNTS:",
        accountList
      );
    } catch (err) {
      console.error(
        "Error fetching deployment data:",
        err
      );

      setError(
        `Failed to load deployment records: ${
          err?.message || "Unknown error"
        }`
      );

      setDeployments([]);
      setClients([]);
      setCandidates([]);
      setEmployeeAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // CANDIDATE LOOKUP
  // ==========================================================

  const getCandidate = (candidateId) => {
    return candidates.find(
      (candidate) =>
        Number(candidate.id) ===
        Number(candidateId)
    );
  };

  // ==========================================================
  // CLIENT LOOKUP
  // ==========================================================

  const getClient = (clientId) => {
    return clients.find(
      (client) =>
        Number(client.id) ===
        Number(clientId)
    );
  };

  // ==========================================================
  // EMPLOYEE ACCOUNT LOOKUP
  // ==========================================================

  const getEmployeeAccount = (candidateId) => {
    if (!candidateId) {
      return null;
    }

    return (
      employeeAccounts.find(
        (account) =>
          Number(account.employee_id) ===
          Number(candidateId)
      ) || null
    );
  };

  const hasEmployeeAccount = (candidateId) => {
    return Boolean(
      getEmployeeAccount(candidateId)
    );
  };

  // ==========================================================
  // CONTRACT LOOKUPS
  // ==========================================================

  const getAssignContract = () => {
    return assignContracts.find(
      (contract) =>
        Number(contract.id) ===
        Number(formData.contractId)
    );
  };

  const getTransferContract = () => {
    return transferContracts.find(
      (contract) =>
        Number(contract.id) ===
        Number(transferData.newContractId)
    );
  };

  // ==========================================================
  // FETCH CONTRACTS FOR ASSIGN CLIENT
  // ==========================================================

  const fetchContractsForAssignClient = async (
    clientId
  ) => {
    if (!clientId) {
      setAssignContracts([]);
      return;
    }

    try {
      setLoadingAssignContracts(true);

      const response = await fetch(
        `${API_BASE}/deployments/contracts/client/${clientId}`
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "Failed to load contracts"
        );
      }

      const list = getResponseList(
        data,
        ["contracts", "contract"]
      );

      setAssignContracts(list);
    } catch (err) {
      console.error(
        "Error fetching assign contracts:",
        err
      );

      setAssignContracts([]);

      alert(
        err?.message ||
        "Failed to load contracts for selected client."
      );
    } finally {
      setLoadingAssignContracts(false);
    }
  };

  // ==========================================================
  // FETCH CONTRACTS FOR TRANSFER CLIENT
  // ==========================================================

  const fetchContractsForTransferClient = async (
    clientId
  ) => {
    if (!clientId) {
      setTransferContracts([]);
      return;
    }

    try {
      setLoadingTransferContracts(true);

      const response = await fetch(
        `${API_BASE}/deployments/contracts/client/${clientId}`
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "Failed to load contracts"
        );
      }

      const list = getResponseList(
        data,
        ["contracts", "contract"]
      );

      setTransferContracts(list);
    } catch (err) {
      console.error(
        "Error fetching transfer contracts:",
        err
      );

      setTransferContracts([]);

      alert(
        err?.message ||
        "Failed to load contracts for selected client."
      );
    } finally {
      setLoadingTransferContracts(false);
    }
  };

  // ==========================================================
  // GROUP DEPLOYMENTS BY EMPLOYEE
  // ==========================================================

  const groupedByCandidate = useMemo(() => {
    const grouped = deployments.reduce(
      (acc, deployment) => {
        const candidateId = Number(
          deployment.candidate_id
        );

        if (!candidateId) {
          console.warn(
            "Deployment skipped because candidate_id is missing:",
            deployment
          );

          return acc;
        }

        if (!acc[candidateId]) {
          acc[candidateId] = [];
        }

        acc[candidateId].push(deployment);

        return acc;
      },
      {}
    );

    Object.values(grouped).forEach(
      (list) => {
        list.sort((a, b) => {
          const dateDifference =
            new Date(
              a.start_date || 0
            ) -
            new Date(
              b.start_date || 0
            );

          if (dateDifference !== 0) {
            return dateDifference;
          }

          return (
            Number(a.id || 0) -
            Number(b.id || 0)
          );
        });
      }
    );

    return grouped;
  }, [deployments]);

  // ==========================================================
  // CURRENT ACTIVE DEPLOYMENTS
  // ==========================================================

  const rows = Object.values(
    groupedByCandidate
  )
    .map((list) => {
      const current =
        list[list.length - 1];

      const previous =
        list.length > 1
          ? list[list.length - 2]
          : null;

      return {
        current,
        previous,
        history: list,
      };
    })
    .filter(({ current }) =>
      isActiveStatus(current?.status)
    );

  // ==========================================================
  // ACTIVE EMPLOYEE IDS
  // ==========================================================

  const activeCandidateIds = useMemo(() => {
    return new Set(
      deployments
        .filter((deployment) =>
          isActiveStatus(
            deployment.status
          )
        )
        .map((deployment) =>
          Number(
            deployment.candidate_id
          )
        )
        .filter(Boolean)
    );
  }, [deployments]);

  // ==========================================================
  // UNASSIGNED EMPLOYEES
  // ==========================================================

  const unassignedCandidates =
    candidates.filter(
      (candidate) =>
        !activeCandidateIds.has(
          Number(candidate.id)
        )
    );

  // ==========================================================
  // SELECTED ASSIGN CANDIDATE
  // ==========================================================

  const selectedAssignCandidate =
    getCandidate(
      formData.candidateId
    );

  // ==========================================================
  // SELECTED CONTRACT
  // ==========================================================

  const selectedAssignContract =
    getAssignContract();

  const selectedTransferContract =
    getTransferContract();

  // ==========================================================
  // BILL RATE PREVIEW
  // ==========================================================

  const assignBillRate =
    calculateBillRatePreview(
      selectedAssignCandidate?.pay_rate,
      selectedAssignContract
    );

  // ==========================================================
  // RESET ASSIGN
  // ==========================================================

  const resetAssignForm = () => {
    setFormData({
      candidateId: "",
      clientId: "",
      contractId: "",
      project: "",
      startDate: "",
    });

    setAssignContracts([]);
  };

  // ==========================================================
  // RESET TRANSFER
  // ==========================================================

  const resetTransferForm = () => {
    setTransferData({
      newClientId: "",
      newContractId: "",
      newProject: "",
      effectiveDate: "",
    });

    setTransferContracts([]);
  };

  // ==========================================================
  // RESET TERMINATE
  // ==========================================================

  const resetTerminateForm = () => {
    setTerminateData({
      effectiveDate: "",
    });
  };

  // ==========================================================
  // OPEN ASSIGN
  // ==========================================================

  const openAssignModal = () => {
    resetAssignForm();
    setShowAssignModal(true);
  };

  // ==========================================================
  // ASSIGN EMPLOYEE
  // ==========================================================

  const handleAssignSubmit = async (e) => {
    e.preventDefault();

    try {
      if (
        !formData.candidateId ||
        !formData.clientId ||
        !formData.contractId ||
        !formData.startDate
      ) {
        alert(
          "Please select employee, client, contract and start date."
        );
        return;
      }

      const selectedCandidate =
        getCandidate(
          formData.candidateId
        );

      if (!selectedCandidate) {
        alert(
          "Selected employee was not found."
        );
        return;
      }

      const selectedContract =
        getAssignContract();

      if (!selectedContract) {
        alert(
          "Selected contract was not found."
        );
        return;
      }

      if (
        String(
          selectedContract.contract_status ||
          ""
        ).toLowerCase() !== "active"
      ) {
        alert(
          "Only an active contract can be used."
        );
        return;
      }

      setAssigning(true);

      const response = await fetch(
        `${API_BASE}/deployments`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            candidate_id: Number(
              formData.candidateId
            ),

            client_id: Number(
              formData.clientId
            ),

            contract_id: Number(
              formData.contractId
            ),

            project_name:
              formData.project.trim() ||
              null,

            start_date:
              formData.startDate,

            status: "Active",
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "Failed to create deployment"
        );
      }

      await fetchAll();

      setShowAssignModal(false);
      resetAssignForm();

      alert(
        `${
          selectedCandidate.full_name ||
          "Employee"
        } assigned successfully.`
      );
    } catch (err) {
      console.error(
        "Error saving assignment:",
        err
      );

      alert(
        `Failed to save assignment: ${
          err?.message || "Unknown error"
        }`
      );
    } finally {
      setAssigning(false);
    }
  };

  // ==========================================================
  // OPEN TRANSFER
  // ==========================================================

  const openTransferModal = (group) => {
    const current = group?.current;

    if (!current) {
      alert(
        "No active deployment selected."
      );
      return;
    }

    setSelectedGroup(group);

    setTransferData({
      newClientId: "",
      newContractId: "",
      newProject:
        current.project_name || "",
      effectiveDate: "",
    });

    setTransferContracts([]);
    setShowTransferModal(true);
  };

  // ==========================================================
  // TRANSFER EMPLOYEE
  // ==========================================================

  const handleTransferSubmit = async (e) => {
    e.preventDefault();

    let oldDeploymentClosed = false;

    try {
      if (!selectedGroup?.current) {
        alert(
          "No employee selected."
        );
        return;
      }

      const current =
        selectedGroup.current;

      if (
        !transferData.newClientId ||
        !transferData.newContractId ||
        !transferData.newProject.trim() ||
        !transferData.effectiveDate
      ) {
        alert(
          "Please select new client, new contract, project and effective transfer date."
        );
        return;
      }

      const selectedContract =
        getTransferContract();

      if (!selectedContract) {
        alert(
          "Selected contract was not found."
        );
        return;
      }

      if (
        String(
          selectedContract.contract_status ||
          ""
        ).toLowerCase() !== "active"
      ) {
        alert(
          "Only an active contract can be used."
        );
        return;
      }

      if (
        Number(
          transferData.newClientId
        ) === Number(current.client_id)
      ) {
        alert(
          "Please select a different client for the transfer."
        );
        return;
      }

      if (
        current.start_date &&
        new Date(
          transferData.effectiveDate
        ) <
          new Date(
            current.start_date
          )
      ) {
        alert(
          "Transfer date cannot be before the current deployment start date."
        );
        return;
      }

      setTransferring(true);

      // ======================================================
      // CLOSE OLD DEPLOYMENT
      // ======================================================

      const closeResponse =
        await fetch(
          `${API_BASE}/deployments/${current.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              end_date:
                transferData.effectiveDate,
              status: "Transferred",
            }),
          }
        );

      const closeData =
        await closeResponse
          .json()
          .catch(() => ({}));

      if (!closeResponse.ok) {
        throw new Error(
          closeData?.message ||
          "Failed to close previous deployment"
        );
      }

      oldDeploymentClosed = true;

      // ======================================================
      // CREATE NEW DEPLOYMENT
      // ======================================================

      const createResponse =
        await fetch(
          `${API_BASE}/deployments`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              candidate_id: Number(
                current.candidate_id
              ),

              client_id: Number(
                transferData.newClientId
              ),

              contract_id: Number(
                transferData.newContractId
              ),

              project_name:
                transferData.newProject.trim(),

              start_date:
                transferData.effectiveDate,

              status: "Active",
            }),
          }
        );

      const createData =
        await createResponse
          .json()
          .catch(() => ({}));

      if (!createResponse.ok) {
        throw new Error(
          createData?.message ||
          "Failed to create new deployment"
        );
      }

      // IMPORTANT:
      // Existing employee account remains unchanged.

      await fetchAll();

      setShowTransferModal(false);
      setSelectedGroup(null);
      resetTransferForm();

      const employeeName =
        current.employee_name ||
        getCandidate(
          current.candidate_id
        )?.full_name ||
        "Employee";

      alert(
        `${employeeName} transferred successfully.`
      );
    } catch (err) {
      console.error(
        "Error updating transfer:",
        err
      );

      // ======================================================
      // ROLLBACK
      // ======================================================

      if (
        oldDeploymentClosed &&
        selectedGroup?.current?.id
      ) {
        try {
          await fetch(
            `${API_BASE}/deployments/${selectedGroup.current.id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                end_date: null,
                status: "Active",
              }),
            }
          );
        } catch (rollbackError) {
          console.error(
            "CRITICAL: Failed to rollback old deployment:",
            rollbackError
          );
        }
      }

      alert(
        `Failed to complete transfer: ${
          err?.message || "Unknown error"
        }`
      );
    } finally {
      setTransferring(false);
    }
  };

  // ==========================================================
  // OPEN TERMINATE
  // ==========================================================

  const openTerminateModal = (group) => {
    if (!group?.current) {
      alert(
        "No active deployment selected."
      );
      return;
    }

    setSelectedGroup(group);

    setTerminateData({
      effectiveDate: "",
    });

    setShowTerminateModal(true);
  };

  // ==========================================================
  // TERMINATE
  // ==========================================================

  const handleTerminateSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!selectedGroup?.current) {
        alert(
          "No employee selected."
        );
        return;
      }

      const current =
        selectedGroup.current;

      if (!terminateData.effectiveDate) {
        alert(
          "Please select the termination date."
        );
        return;
      }

      if (
        current.start_date &&
        new Date(
          terminateData.effectiveDate
        ) <
          new Date(
            current.start_date
          )
      ) {
        alert(
          "Termination date cannot be before the deployment start date."
        );
        return;
      }

      setTerminating(true);

      const response = await fetch(
        `${API_BASE}/deployments/${current.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            end_date:
              terminateData.effectiveDate,
            status: "Terminated",
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "Failed to terminate deployment"
        );
      }

      await fetchAll();

      const employeeName =
        current.employee_name ||
        getCandidate(
          current.candidate_id
        )?.full_name ||
        "Employee";

      setShowTerminateModal(false);
      setSelectedGroup(null);
      resetTerminateForm();

      alert(
        `${employeeName} terminated successfully.`
      );
    } catch (err) {
      console.error(
        "Error terminating employee:",
        err
      );

      alert(
        `Failed to terminate employee: ${
          err?.message || "Unknown error"
        }`
      );
    } finally {
      setTerminating(false);
    }
  };

  // ==========================================================
  // CONTRACT DETAILS
  // ==========================================================

  const openContractDetails = (
    deployment
  ) => {
    if (!deployment) {
      alert(
        "Contract details not found."
      );
      return;
    }

    const contract = {
      id: deployment.contract_id,

      contract_number:
        deployment.contract_number,

      contract_title:
        deployment.contract_title,

      billing_model:
        deployment.billing_model,

      markup_percentage:
        deployment.markup_percentage,

      per_head_fee:
        deployment.per_head_fee,

      credit_terms:
        deployment.credit_terms,

      gst_type:
        deployment.gst_type,

      contract_status:
        deployment.contract_status,

      contract_start_date:
        deployment.contract_start_date,

      contract_end_date:
        deployment.contract_end_date,

      company_name:
        deployment.company_name,

      project_name:
        deployment.project_name,

      employee_name:
        deployment.employee_name,

      pay_rate:
        deployment.pay_rate,

      bill_rate:
        deployment.bill_rate,
    };

    setSelectedContractDetails(
      contract
    );

    setShowContractModal(true);
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar activePage="/employee-deployments" />

        <main className="flex-1 flex justify-center items-center">
          <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm">
            <Loader2 className="h-5 w-5 animate-spin text-slate-900" />
            Loading deployments...
          </div>
        </main>
      </div>
    );
  }

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <div className="flex min-h-screen bg-slate-50">

      <Sidebar activePage="/employee-deployments" />

      <main className="flex-1 min-w-0">

        <div className="p-8 space-y-6">

          {/* HEADER */}

          <div className="flex justify-between items-center gap-4">

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Employee Deployments
              </h1>

              <p className="text-sm text-slate-500 mt-1">
                Assign employees to client projects,
                track deployments, and manage transfers.
              </p>
            </div>

            <button
              type="button"
              onClick={openAssignModal}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Assign Employee
            </button>

          </div>

          {/* ERROR */}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between gap-3">

              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>

              <button
                type="button"
                onClick={fetchAll}
                className="flex items-center gap-1 text-xs font-semibold hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>

            </div>
          )}

          {/* SUMMARY */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

              <p className="text-xs font-semibold text-slate-500 uppercase">
                Total Deployments
              </p>

              <p className="text-2xl font-bold text-slate-900 mt-2">
                {deployments.length}
              </p>

            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

              <p className="text-xs font-semibold text-slate-500 uppercase">
                Active Employees
              </p>

              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {activeCandidateIds.size}
              </p>

            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

              <p className="text-xs font-semibold text-slate-500 uppercase">
                Unassigned Employees
              </p>

              <p className="text-2xl font-bold text-amber-600 mt-2">
                {unassignedCandidates.length}
              </p>

            </div>

          </div>

          {/* ==================================================
              CURRENT DEPLOYMENTS
          ================================================== */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">

              <div>
                <h2 className="font-bold text-slate-900">
                  Current Deployments
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  Employees currently assigned to clients
                </p>
              </div>

              <button
                type="button"
                onClick={fetchAll}
                className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-left border-collapse">

                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">

                    <th className="p-4">
                      Employee
                    </th>

                    <th className="p-4">
                      Client Transition
                    </th>

                    <th className="p-4">
                      Project
                    </th>

                    <th className="p-4">
                      Designation
                    </th>

                    <th className="p-4">
                      Joining Date
                    </th>

                    <th className="p-4">
                      Contract
                    </th>

                    <th className="p-4">
                      Status
                    </th>

                    <th className="p-4 text-right">
                      Actions
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">

                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="p-10 text-center text-slate-400"
                      >
                        No active deployments found.
                      </td>
                    </tr>
                  ) : (
                    rows.map(
                      ({
                        current,
                        previous,
                        history,
                      }) => {

                        const candidate =
                          getCandidate(
                            current.candidate_id
                          );

                        const employeeName =
                          current.employee_name ||
                          candidate?.full_name ||
                          "Unknown Employee";

                        const designation =
                          current.designation ||
                          candidate?.designation ||
                          "N/A";

                        const joiningDate =
                          candidate?.date_of_joining ||
                          current.start_date ||
                          null;

                        const contractEndDate =
                          getContractEndDate(
                            current
                          );

                        const contractDaysLeft =
                          getDaysRemaining(
                            contractEndDate
                          );

                        const employeeAccount =
                          getEmployeeAccount(
                            current.candidate_id
                          );

                        const accountCreated =
                          Boolean(
                            employeeAccount
                          );

                        return (
                          <tr
                            key={current.id}
                            className="hover:bg-slate-50 transition"
                          >

                            {/* EMPLOYEE */}

                            <td className="p-4">

                              <div className="font-bold text-slate-900">
                                {employeeName}
                              </div>

                              {(
                                candidate?.email ||
                                current.email
                              ) && (
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {candidate?.email ||
                                    current.email}
                                </div>
                              )}

                              {accountCreated && (
                                <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Login Account Active
                                </div>
                              )}

                            </td>

                            {/* CLIENT */}

                            <td className="p-4">

                              <div className="flex items-center gap-2">

                                {previous ? (
                                  <>
                                    <span className="text-slate-400 line-through text-xs">
                                      {previous.company_name ||
                                        "Previous Client"}
                                    </span>

                                    <ArrowRight className="h-3.5 w-3.5 text-blue-600 shrink-0" />

                                    <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                                      {current.company_name ||
                                        "Current Client"}
                                    </span>
                                  </>
                                ) : (
                                  <span className="font-semibold text-slate-800">
                                    {current.company_name ||
                                      "N/A"}
                                  </span>
                                )}

                              </div>

                            </td>

                            {/* PROJECT */}

                            <td className="p-4 text-slate-700">
                              {current.project_name ||
                                "N/A"}
                            </td>

                            {/* DESIGNATION */}

                            <td className="p-4 text-slate-600">
                              {designation}
                            </td>

                            {/* JOINING DATE */}

                            <td className="p-4 text-slate-600">
                              {formatDate(
                                joiningDate
                              )}
                            </td>

                            {/* CONTRACT */}

                            <td className="p-4">

                              <div className="flex items-center gap-2">

                                <div>

                                  <div className="text-xs font-bold text-slate-800">
                                    {current.contract_number ||
                                      "N/A"}
                                  </div>

                                  {contractDaysLeft !==
                                    null && (
                                    <div
                                      className={`text-[10px] font-semibold mt-0.5 ${
                                        contractDaysLeft < 0
                                          ? "text-red-600"
                                          : contractDaysLeft <=
                                            30
                                          ? "text-amber-600"
                                          : "text-emerald-600"
                                      }`}
                                    >
                                      {contractDaysLeft < 0
                                        ? "Expired"
                                        : `${contractDaysLeft} days left`}
                                    </div>
                                  )}

                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openContractDetails(
                                      current
                                    )
                                  }
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                                  title="View Contract Details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>

                              </div>

                            </td>

                            {/* STATUS */}

                            <td className="p-4">

                              <span className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 rounded-full">
                                {current.status ||
                                  "Active"}
                              </span>

                            </td>

                            {/* ACTIONS */}

                            <td className="p-4 text-right whitespace-nowrap">

                              {/* CONTRACT */}

                              <button
                                type="button"
                                onClick={() =>
                                  openContractDetails(
                                    current
                                  )
                                }
                                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition mr-2"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Contract
                              </button>

                              {/* CREATE ACCOUNT */}

                              <button
                                type="button"
                                disabled={
                                  accountCreated ||
                                  !(
                                    candidate?.email ||
                                    current.email
                                  )
                                }
                                onClick={() => {

                                  const employeeId =
                                    current.candidate_id ||
                                    candidate?.id;

                                  const employeeEmail =
                                    candidate?.email ||
                                    current.email ||
                                    "";

                                  if (!employeeId) {
                                    alert(
                                      "Employee ID is missing."
                                    );
                                    return;
                                  }

                                  if (!employeeEmail) {
                                    alert(
                                      "Employee email is required before creating an account."
                                    );
                                    return;
                                  }

                                  if (accountCreated) {
                                    return;
                                  }

                                  setAccountEmployee({
                                    id: Number(
                                      employeeId
                                    ),

                                    name:
                                      current.employee_name ||
                                      candidate?.full_name ||
                                      "Employee",

                                    email:
                                      employeeEmail,
                                  });
                                }}
                                title={
                                  accountCreated
                                    ? "Employee account already created"
                                    : !(
                                        candidate?.email ||
                                        current.email
                                      )
                                    ? "Employee email is required"
                                    : "Create employee login account"
                                }
                                className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition mr-2 ${
                                  accountCreated
                                    ? "bg-emerald-50 text-emerald-600 cursor-not-allowed"
                                    : !(
                                        candidate?.email ||
                                        current.email
                                      )
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-violet-50 text-violet-600 hover:bg-violet-100"
                                }`}
                              >

                                {accountCreated ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <UserPlus className="h-3.5 w-3.5" />
                                )}

                                {accountCreated
                                  ? "Account Created"
                                  : "Create Account"}

                              </button>

                              {/* TRANSFER */}

                              <button
                                type="button"
                                onClick={() =>
                                  openTransferModal({
                                    current,
                                    history,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition mr-2"
                              >
                                Transfer
                              </button>

                              {/* TERMINATE */}

                              <button
                                type="button"
                                onClick={() =>
                                  openTerminateModal({
                                    current,
                                    history,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg transition mr-2"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Terminate
                              </button>

                              {/* HISTORY */}

                              <button
                                type="button"
                                onClick={() => {

                                  setSelectedGroup({
                                    current,
                                    history,
                                  });

                                  setShowHistoryModal(
                                    true
                                  );

                                }}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg transition"
                              >
                                <History className="h-3.5 w-3.5" />
                                History
                              </button>

                            </td>

                          </tr>
                        );
                      }
                    )
                  )}

                </tbody>

              </table>

            </div>

          </div>

          {/* ==================================================
              UNASSIGNED EMPLOYEES
          ================================================== */}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="px-5 py-4 border-b border-slate-200">

              <h2 className="font-bold text-slate-900">
                Unassigned Employees
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Employees who are currently available for deployment
              </p>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-left">

                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">

                    <th className="p-4">
                      Employee
                    </th>

                    <th className="p-4">
                      Employee Code
                    </th>

                    <th className="p-4">
                      Designation
                    </th>

                    <th className="p-4">
                      Pay Rate
                    </th>

                    <th className="p-4">
                      Status
                    </th>

                    <th className="p-4 text-right">
                      Action
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">

                  {unassignedCandidates.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="p-8 text-center text-slate-400"
                      >
                        No unassigned employees.
                      </td>
                    </tr>
                  ) : (
                    unassignedCandidates.map(
                      (candidate) => (
                        <tr
                          key={candidate.id}
                          className="hover:bg-slate-50"
                        >

                          <td className="p-4">

                            <div className="font-bold text-slate-900">
                              {candidate.full_name ||
                                "Unnamed Employee"}
                            </div>

                            {candidate.email && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                {candidate.email}
                              </div>
                            )}

                          </td>

                          <td className="p-4 text-slate-600">
                            {candidate.employee_code ||
                              "N/A"}
                          </td>

                          <td className="p-4 text-slate-600">
                            {candidate.designation ||
                              "N/A"}
                          </td>

                          <td className="p-4 font-semibold text-slate-700">

                            {formatCurrency(
                              candidate.pay_rate
                            )}

                            <span className="text-xs text-slate-400 font-normal">
                              {" "}
                              / month
                            </span>

                          </td>

                          <td className="p-4">

                            <span className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-600 rounded-full">
                              {candidate.employment_status ||
                                "Available"}
                            </span>

                          </td>

                          <td className="p-4 text-right">

                            <button
                              type="button"
                              onClick={() => {

                                setFormData({
                                  candidateId:
                                    String(
                                      candidate.id
                                    ),
                                  clientId: "",
                                  contractId: "",
                                  project: "",
                                  startDate: "",
                                });

                                setAssignContracts([]);

                                setShowAssignModal(
                                  true
                                );

                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                              Deploy
                            </button>

                          </td>

                        </tr>
                      )
                    )
                  )}

                </tbody>

              </table>

            </div>

          </div>

        </div>

      </main>

      {/* =====================================================
          CONTRACT DETAILS MODAL
      ====================================================== */}

      {showContractModal &&
        selectedContractDetails && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">

            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">

              <div className="flex justify-between items-center border-b pb-4">

                <div className="flex items-center gap-3">

                  <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div>

                    <h3 className="text-lg font-bold text-slate-900">
                      Contract Details
                    </h3>

                    <p className="text-xs text-slate-500 mt-0.5">
                      Complete contract and deployment information
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowContractModal(false);
                    setSelectedContractDetails(
                      null
                    );
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">

                <div className="flex justify-between items-start gap-4">

                  <div>

                    <p className="text-[10px] uppercase font-bold text-blue-600">
                      Contract Number
                    </p>

                    <p className="text-lg font-bold text-slate-900 mt-1">
                      {selectedContractDetails.contract_number ||
                        "N/A"}
                    </p>

                    <p className="text-xs text-slate-600 mt-1">
                      {selectedContractDetails.contract_title ||
                        "Contract title not available"}
                    </p>

                  </div>

                  {(() => {

                    const health =
                      getContractHealth(
                        selectedContractDetails
                      );

                    const HealthIcon =
                      health.icon;

                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs font-bold ${health.className}`}
                      >
                        <HealthIcon className="h-3.5 w-3.5" />
                        {health.label}
                      </span>
                    );

                  })()}

                </div>

              </div>

              {/* CONTRACT DATES */}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                <div className="border border-slate-200 rounded-xl p-4">

                  <div className="flex items-center gap-2 text-slate-500">
                    <CalendarDays className="h-4 w-4" />

                    <span className="text-[10px] uppercase font-bold">
                      Start Date
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-900 mt-2">
                    {formatDate(
                      getContractStartDate(
                        selectedContractDetails
                      )
                    )}
                  </p>

                </div>

                <div className="border border-slate-200 rounded-xl p-4">

                  <div className="flex items-center gap-2 text-slate-500">
                    <CalendarDays className="h-4 w-4" />

                    <span className="text-[10px] uppercase font-bold">
                      End Date
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-900 mt-2">
                    {formatDate(
                      getContractEndDate(
                        selectedContractDetails
                      )
                    )}
                  </p>

                </div>

                <div className="border border-slate-200 rounded-xl p-4">

                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock3 className="h-4 w-4" />

                    <span className="text-[10px] uppercase font-bold">
                      Time Remaining
                    </span>
                  </div>

                  {(() => {

                    const days =
                      getDaysRemaining(
                        getContractEndDate(
                          selectedContractDetails
                        )
                      );

                    if (days === null) {
                      return (
                        <p className="text-sm font-bold text-slate-500 mt-2">
                          Not configured
                        </p>
                      );
                    }

                    if (days < 0) {
                      return (
                        <p className="text-sm font-bold text-red-600 mt-2">
                          Expired
                        </p>
                      );
                    }

                    return (
                      <p
                        className={`text-sm font-bold mt-2 ${
                          days <= 30
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {days}{" "}
                        {days === 1
                          ? "day"
                          : "days"}{" "}
                        left
                      </p>
                    );

                  })()}

                </div>

              </div>

              {/* CONTRACT INFORMATION */}

              <div className="border border-slate-200 rounded-xl p-4">

                <div className="flex items-center gap-2 mb-4">

                  <FileText className="h-4 w-4 text-blue-600" />

                  <h4 className="text-sm font-bold text-slate-900">
                    Contract Information
                  </h4>

                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Billing Model
                    </p>

                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      {selectedContractDetails.billing_model ||
                        "N/A"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Markup
                    </p>

                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      {selectedContractDetails.markup_percentage ??
                        0}
                      %
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Per Head Fee
                    </p>

                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      {formatCurrency(
                        selectedContractDetails.per_head_fee
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Credit Terms
                    </p>

                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      {selectedContractDetails.credit_terms ||
                        "N/A"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      GST Type
                    </p>

                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      {selectedContractDetails.gst_type ||
                        "N/A"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Status
                    </p>

                    <p className="text-xs font-semibold text-emerald-600 mt-1">
                      {selectedContractDetails.contract_status ||
                        "N/A"}
                    </p>
                  </div>

                </div>

              </div>

              {/* DEPLOYMENT INFORMATION */}

              <div className="border border-slate-200 rounded-xl p-4">

                <h4 className="text-sm font-bold text-slate-900 mb-4">
                  Deployment Information
                </h4>

                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Client
                    </p>

                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      {selectedContractDetails.company_name ||
                        "N/A"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Employee
                    </p>

                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      {selectedContractDetails.employee_name ||
                        "N/A"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Project
                    </p>

                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      {selectedContractDetails.project_name ||
                        "N/A"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">
                      Deployment Status
                    </p>

                    <p className="text-xs font-semibold text-emerald-600 mt-1">
                      Active
                    </p>
                  </div>

                </div>

              </div>

              {/* RATES */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">

                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Employee Pay Rate
                  </p>

                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {formatCurrency(
                      selectedContractDetails.pay_rate
                    )}

                    <span className="text-xs font-normal text-slate-400">
                      {" "}
                      / month
                    </span>
                  </p>

                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">

                  <p className="text-[10px] uppercase font-bold text-emerald-700">
                    Client Bill Rate
                  </p>

                  <p className="text-lg font-bold text-emerald-700 mt-1">
                    {formatCurrency(
                      selectedContractDetails.bill_rate
                    )}

                    <span className="text-xs font-normal text-emerald-600">
                      {" "}
                      / month
                    </span>
                  </p>

                </div>

              </div>

              <div className="flex justify-end pt-2 border-t">

                <button
                  type="button"
                  onClick={() => {
                    setShowContractModal(false);
                    setSelectedContractDetails(
                      null
                    );
                  }}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
                >
                  Close
                </button>

              </div>

            </div>

          </div>
        )}

      {/* =====================================================
          ASSIGN MODAL
      ====================================================== */}

      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">

          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center border-b pb-3">

              <div>

                <h3 className="text-lg font-bold text-slate-900">
                  Deploy Employee
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Select client and contract to calculate billing automatically.
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  resetAssignForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <form
              onSubmit={handleAssignSubmit}
              className="space-y-4 text-sm"
            >

              {/* EMPLOYEE */}

              <div>

                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Employee *
                </label>

                <select
                  required
                  value={
                    formData.candidateId
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      candidateId:
                        e.target.value,
                    })
                  }
                  className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                >

                  <option value="">
                    Select Employee
                  </option>

                  {unassignedCandidates.map(
                    (candidate) => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                      >
                        {candidate.full_name ||
                          "Unnamed Employee"}
                      </option>
                    )
                  )}

                </select>

                {unassignedCandidates.length ===
                  0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    All employees are currently deployed.
                  </p>
                )}

              </div>

              {/* EMPLOYEE PAY */}

              {selectedAssignCandidate && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">

                  <div className="flex justify-between items-center">

                    <div>

                      <p className="text-[10px] uppercase font-bold text-slate-500">
                        Employee Pay Rate
                      </p>

                      <p className="text-lg font-bold text-slate-900 mt-0.5">

                        {formatCurrency(
                          selectedAssignCandidate.pay_rate
                        )}

                        <span className="text-xs font-normal text-slate-400">
                          {" "}
                          / month
                        </span>

                      </p>

                    </div>

                    <div className="text-right">

                      <p className="text-[10px] uppercase font-bold text-slate-500">
                        Employee Code
                      </p>

                      <p className="text-xs font-semibold text-slate-700 mt-0.5">
                        {selectedAssignCandidate.employee_code ||
                          "N/A"}
                      </p>

                    </div>

                  </div>

                </div>
              )}

              {/* CLIENT + CONTRACT */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Client *
                  </label>

                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => {

                      const clientId =
                        e.target.value;

                      setFormData({
                        ...formData,
                        clientId,
                        contractId: "",
                      });

                      setAssignContracts([]);

                      if (clientId) {
                        fetchContractsForAssignClient(
                          clientId
                        );
                      }

                    }}
                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                  >

                    <option value="">
                      Select Client
                    </option>

                    {clients.map(
                      (client) => (
                        <option
                          key={client.id}
                          value={client.id}
                        >
                          {client.company_name ||
                            "Unnamed Client"}
                        </option>
                      )
                    )}

                  </select>

                </div>

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Contract *
                  </label>

                  <select
                    required
                    disabled={
                      !formData.clientId ||
                      loadingAssignContracts
                    }
                    value={
                      formData.contractId
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contractId:
                          e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  >

                    <option value="">
                      {loadingAssignContracts
                        ? "Loading contracts..."
                        : !formData.clientId
                        ? "Select client first"
                        : "Select Contract"}
                    </option>

                    {assignContracts.map(
                      (contract) => (
                        <option
                          key={contract.id}
                          value={contract.id}
                        >
                          {contract.contract_number ||
                            `Contract #${contract.id}`}
                        </option>
                      )
                    )}

                  </select>

                  {formData.clientId &&
                    !loadingAssignContracts &&
                    assignContracts.length ===
                      0 && (
                      <p className="text-[10px] text-red-500 mt-1">
                        No active contracts found for this client.
                      </p>
                    )}

                </div>

              </div>

              {/* CONTRACT DETAILS */}

              {selectedAssignContract && (
                <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4">

                  <div className="flex items-center gap-2 mb-3">

                    <FileText className="h-4 w-4 text-blue-600" />

                    <span className="text-xs font-bold text-slate-700">
                      Contract Details
                    </span>

                  </div>

                  <div className="grid grid-cols-2 gap-3">

                    <div>

                      <p className="text-[10px] uppercase text-slate-400 font-bold">
                        Contract
                      </p>

                      <p className="text-xs font-semibold text-slate-800 mt-1">
                        {selectedAssignContract.contract_number ||
                          "N/A"}
                      </p>

                    </div>

                    <div>

                      <p className="text-[10px] uppercase text-slate-400 font-bold">
                        Billing Model
                      </p>

                      <p className="text-xs font-semibold text-slate-800 mt-1">
                        {selectedAssignContract.billing_model ||
                          "N/A"}
                      </p>

                    </div>

                    <div>

                      <p className="text-[10px] uppercase text-slate-400 font-bold">
                        Markup
                      </p>

                      <p className="text-xs font-semibold text-slate-800 mt-1">
                        {selectedAssignContract.markup_percentage ??
                          0}
                        %
                      </p>

                    </div>

                    <div>

                      <p className="text-[10px] uppercase text-slate-400 font-bold">
                        Per Head Fee
                      </p>

                      <p className="text-xs font-semibold text-slate-800 mt-1">
                        {formatCurrency(
                          selectedAssignContract.per_head_fee
                        )}
                      </p>

                    </div>

                  </div>

                </div>
              )}

              {/* PROJECT + START DATE */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Project Name
                  </label>

                  <input
                    type="text"
                    placeholder="e.g. Cloud Modernization"
                    value={
                      formData.project
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        project:
                          e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                  />

                </div>

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Deployment Start Date *
                  </label>

                  <input
                    type="date"
                    required
                    value={
                      formData.startDate
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startDate:
                          e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                  />

                </div>

              </div>

              {/* RATES */}

              {selectedAssignCandidate &&
                selectedAssignContract && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">

                      <p className="text-[10px] uppercase font-bold text-slate-500">
                        Pay Rate / Month
                      </p>

                      <p className="text-lg font-bold text-slate-900 mt-1">
                        {formatCurrency(
                          selectedAssignCandidate.pay_rate
                        )}
                      </p>

                      <p className="text-[10px] text-slate-400 mt-1">
                        From employee master record
                      </p>

                    </div>

                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">

                      <p className="text-[10px] uppercase font-bold text-emerald-700">
                        Bill Rate / Month
                      </p>

                      <p className="text-lg font-bold text-emerald-700 mt-1">
                        {formatCurrency(
                          assignBillRate
                        )}
                      </p>

                      <p className="text-[10px] text-emerald-600 mt-1">
                        Automatically calculated from contract
                      </p>

                    </div>

                  </div>
                )}

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">

                <p className="text-[11px] text-amber-700">
                  <strong>End Date:</strong>{" "}
                  This deployment starts as active with no end
                  date. The actual end date is entered later when
                  the employee is transferred or the deployment
                  is terminated.
                </p>

              </div>

              {/* BUTTONS */}

              <div className="flex justify-end gap-3 pt-4 border-t">

                <button
                  type="button"
                  disabled={assigning}
                  onClick={() => {
                    setShowAssignModal(false);
                    resetAssignForm();
                  }}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    assigning ||
                    !formData.candidateId ||
                    !formData.clientId ||
                    !formData.contractId ||
                    !formData.startDate ||
                    assignContracts.length ===
                      0
                  }
                  className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 disabled:opacity-60"
                >

                  {assigning && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {assigning
                    ? "Deploying..."
                    : "Deploy Employee"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* =====================================================
          TRANSFER MODAL
      ====================================================== */}

      {showTransferModal &&
        selectedGroup?.current && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">

            <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl">

              <div className="flex justify-between items-center border-b pb-3">

                <h3 className="text-lg font-bold text-slate-900">
                  Transfer Employee
                </h3>

                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedGroup(null);
                    resetTransferForm();
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              <form
                onSubmit={handleTransferSubmit}
                className="space-y-4 text-sm"
              >

                {/* NEW CLIENT */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    New Client *
                  </label>

                  <select
                    required
                    value={
                      transferData.newClientId
                    }
                    onChange={(e) => {

                      const clientId =
                        e.target.value;

                      setTransferData({
                        ...transferData,
                        newClientId:
                          clientId,
                        newContractId: "",
                      });

                      setTransferContracts([]);

                      if (clientId) {
                        fetchContractsForTransferClient(
                          clientId
                        );
                      }

                    }}
                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200"
                  >

                    <option value="">
                      Select Client
                    </option>

                    {clients
                      .filter(
                        (client) =>
                          Number(client.id) !==
                          Number(
                            selectedGroup.current
                              .client_id
                          )
                      )
                      .map(
                        (client) => (
                          <option
                            key={client.id}
                            value={client.id}
                          >
                            {client.company_name ||
                              "Unnamed Client"}
                          </option>
                        )
                      )}

                  </select>

                </div>

                {/* NEW CONTRACT */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    New Contract *
                  </label>

                  <select
                    required
                    disabled={
                      !transferData.newClientId ||
                      loadingTransferContracts
                    }
                    value={
                      transferData.newContractId
                    }
                    onChange={(e) =>
                      setTransferData({
                        ...transferData,
                        newContractId:
                          e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50"
                  >

                    <option value="">
                      {loadingTransferContracts
                        ? "Loading contracts..."
                        : !transferData.newClientId
                        ? "Select client first"
                        : "Select Contract"}
                    </option>

                    {transferContracts.map(
                      (contract) => (
                        <option
                          key={contract.id}
                          value={contract.id}
                        >
                          {contract.contract_number ||
                            `Contract #${contract.id}`}
                        </option>
                      )
                    )}

                  </select>

                  {transferData.newClientId &&
                    !loadingTransferContracts &&
                    transferContracts.length ===
                      0 && (
                      <p className="text-[10px] text-red-500 mt-1">
                        No active contracts found for this client.
                      </p>
                    )}

                </div>

                {/* PROJECT */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    New Project Name *
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      transferData.newProject
                    }
                    onChange={(e) =>
                      setTransferData({
                        ...transferData,
                        newProject:
                          e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="Enter project name"
                  />

                </div>

                {/* DATE */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Effective Transfer Date *
                  </label>

                  <input
                    type="date"
                    required
                    value={
                      transferData.effectiveDate
                    }
                    onChange={(e) =>
                      setTransferData({
                        ...transferData,
                        effectiveDate:
                          e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200"
                  />

                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">

                  <button
                    type="button"
                    disabled={
                      transferring
                    }
                    onClick={() => {
                      setShowTransferModal(false);
                      setSelectedGroup(null);
                      resetTransferForm();
                    }}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      transferring ||
                      !transferData.newClientId ||
                      !transferData.newContractId ||
                      !transferData.effectiveDate ||
                      !transferData.newProject.trim()
                    }
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60"
                  >

                    {transferring && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {transferring
                      ? "Transferring..."
                      : "Complete Transfer"}

                  </button>

                </div>

              </form>

            </div>

          </div>
        )}

      {/* =====================================================
          TERMINATE MODAL
      ====================================================== */}

      {showTerminateModal &&
        selectedGroup?.current && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">

            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-xl">

              <div className="flex justify-between items-center border-b pb-3">

                <div className="flex items-center gap-2">

                  <div className="h-9 w-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                    <Ban className="h-5 w-5" />
                  </div>

                  <div>

                    <h3 className="text-lg font-bold text-slate-900">
                      Terminate Deployment
                    </h3>

                    <p className="text-xs text-slate-500 mt-0.5">
                      Close the employee's current deployment.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowTerminateModal(false);
                    setSelectedGroup(null);
                    resetTerminateForm();
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">

                <p className="text-[10px] uppercase font-bold text-slate-500">
                  Employee
                </p>

                <p className="font-bold text-slate-900 mt-1">
                  {selectedGroup.current
                    .employee_name ||
                    getCandidate(
                      selectedGroup.current
                        .candidate_id
                    )?.full_name ||
                    "Unknown Employee"}
                </p>

                <p className="text-xs text-slate-500 mt-1">
                  {selectedGroup.current
                    .company_name ||
                    "Current Client"}
                </p>

              </div>

              <form
                onSubmit={
                  handleTerminateSubmit
                }
                className="space-y-4"
              >

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Termination Date *
                  </label>

                  <input
                    type="date"
                    required
                    value={
                      terminateData.effectiveDate
                    }
                    onChange={(e) =>
                      setTerminateData({
                        effectiveDate:
                          e.target.value,
                      })
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-red-200"
                  />

                </div>

                <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-3">

                  <p className="text-xs text-red-700">
                    This will close the current deployment
                    with the selected termination date and
                    make the employee available for a new
                    deployment.
                  </p>

                </div>

                <div className="flex justify-end gap-3 pt-3 border-t">

                  <button
                    type="button"
                    disabled={terminating}
                    onClick={() => {
                      setShowTerminateModal(false);
                      setSelectedGroup(null);
                      resetTerminateForm();
                    }}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      terminating ||
                      !terminateData.effectiveDate
                    }
                    className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 disabled:opacity-60"
                  >

                    {terminating && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {terminating
                      ? "Terminating..."
                      : "Terminate Employee"}

                  </button>

                </div>

              </form>

            </div>

          </div>
        )}

      {/* =====================================================
          HISTORY MODAL
      ====================================================== */}

      {showHistoryModal &&
        selectedGroup?.current && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">

            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">

              <div className="flex justify-between items-center border-b pb-3">

                <h3 className="text-lg font-bold text-slate-900">
                  Deployment History
                </h3>

                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedGroup(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              <p className="text-xs text-slate-500">
                Employee:{" "}
                <strong className="text-slate-800">
                  {selectedGroup.current
                    .employee_name ||
                    getCandidate(
                      selectedGroup.current
                        .candidate_id
                    )?.full_name ||
                    "Unknown Employee"}
                </strong>
              </p>

              <div className="space-y-3 py-2 max-h-80 overflow-y-auto">

                {selectedGroup.history?.length ===
                0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">
                    No deployment history found.
                  </div>
                ) : (
                  selectedGroup.history.map(
                    (
                      deployment,
                      index
                    ) => (
                      <div
                        key={
                          deployment.id
                        }
                        className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100"
                      >

                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs mt-0.5 shrink-0">
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">

                          <div className="flex justify-between items-center gap-3">

                            <h4 className="font-bold text-slate-900 truncate">
                              {deployment.company_name ||
                                "Unknown Client"}
                            </h4>

                            <span
                              className={`px-2 py-0.5 text-xs font-bold rounded-full whitespace-nowrap ${
                                isActiveStatus(
                                  deployment.status
                                )
                                  ? "bg-emerald-50 text-emerald-600"
                                  : String(
                                      deployment.status ||
                                        ""
                                    ).toLowerCase() ===
                                    "terminated"
                                  ? "bg-red-50 text-red-600"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {deployment.status ||
                                "Unknown"}
                            </span>

                          </div>

                          <p className="text-xs text-slate-600 mt-1">
                            Project:{" "}
                            <span className="font-medium">
                              {deployment.project_name ||
                                "N/A"}
                            </span>
                          </p>

                          {deployment.contract_number && (
                            <p className="text-xs text-slate-500 mt-1">
                              Contract:{" "}
                              <span className="font-medium">
                                {
                                  deployment.contract_number
                                }
                              </span>
                            </p>
                          )}

                          <p className="text-xs text-slate-400 mt-0.5">
                            Duration:{" "}
                            {formatDate(
                              deployment.start_date
                            )}{" "}
                            →{" "}
                            {deployment.end_date
                              ? formatDate(
                                  deployment.end_date
                                )
                              : "Present"}
                          </p>

                          {(deployment.pay_rate !=
                            null ||
                            deployment.bill_rate !=
                              null) && (
                            <p className="text-xs text-slate-400 mt-1">
                              Pay:{" "}
                              {formatCurrency(
                                deployment.pay_rate
                              )}{" "}
                              • Bill:{" "}
                              {formatCurrency(
                                deployment.bill_rate
                              )}
                            </p>
                          )}

                        </div>

                      </div>
                    )
                  )
                )}

              </div>

              <div className="flex justify-end pt-2">

                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedGroup(null);
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
                >
                  Close
                </button>

              </div>

            </div>

          </div>
        )}

      {/* =====================================================
          CREATE EMPLOYEE ACCOUNT MODAL
          
          IMPORTANT:
          THIS MUST BE OUTSIDE THE HISTORY MODAL.
      ====================================================== */}

      {accountEmployee && (
        <EmployeeCreateAccountModal
          employee={accountEmployee}
          API_BASE={API_BASE}
          onClose={() => {
            setAccountEmployee(null);
          }}
          onCreated={async () => {
            setAccountEmployee(null);
            await fetchAll();
          }}
        />
      )}

    </div>
  );
}

export default EmployeeDeployment;

