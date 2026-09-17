import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import {
  CheckCircle2,
  Lock,
  FileText,
  Download,
  Mail,
  Loader2,
  ShieldAlert,
  RefreshCw,
  Calendar,
  Pencil,
  UserPlus,
} from "lucide-react";

import Sidebar from "./Layout/Sidebar";
import api from "../services/api";

// =====================================================
// CONSTANTS
// =====================================================

// =====================================================
// HELPERS
// =====================================================

const normalizeStatus = (status) => {
  if (!status) return "";

  return String(status)
    .trim()
    .toLowerCase()
    .replace(/^\w/, (char) => char.toUpperCase());
};

const normalizeSalaryMonth = (monthValue) => {
  if (!monthValue) return "";

  const value = String(monthValue).trim();

  if (/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.slice(0, 7);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 7);
  }

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    return `${year}-${month}`;
  }

  const parsed = new Date(`1 ${value}`);

  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();

    const month = String(
      parsed.getMonth() + 1
    ).padStart(2, "0");

    return `${year}-${month}`;
  }

  return value;
};

const formatSalaryMonth = (monthValue) => {
  const normalized =
    normalizeSalaryMonth(monthValue);

  const match =
    normalized.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return monthValue || "-";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    return monthValue || "-";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(
      year,
      month - 1,
      1
    )
  );
};

const getCalendarDaysInMonth = (
  yyyyMm
) => {
  const normalized =
    normalizeSalaryMonth(yyyyMm);

  const match =
    normalized.match(/^(\d{4})-(\d{2})$/);

  if (!match) return 0;

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    return 0;
  }

  return new Date(
    year,
    month,
    0
  ).getDate();
};

const formatMoney = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  );
};

const getNumericValue = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const EMPTY_PAYROLL_FORM = {
  // Employee / Payroll references
  employee_ref_id: null,
  deployment_id: null,
  attendance_id: null,
  client_id: null,
  employee_name: "",
  salary_month: "",

  // Earnings
  basic_salary: 0,
  allowances: 0,
  hra: 0,
  conveyance: 0,
  medical_allowance: 0,
  other_allowance: 0,
  overtime: 0,
  bonus: 0,

  // Employee deductions
  pf: 0,
  esic: 0,
  tax: 0,
  professional_tax: 0,
  lop: 0,

  // Employer contributions
  employer_pf: 0,
  employer_esic: 0,
  gratuity: 0,

  // PF
  pf_wages: 0,

  // Employer totals
  total_employer_contribution: 0,
  total_employer_cost: 0,

  // Bank
  bank_name: "",
  account_number: "",
  ifsc_code: "",
};  

const ELIGIBLE_PAYSLIP_STATUSES = ["Approved", "Locked"];
// =====================================================
// COMPONENT
// =====================================================

export default function PayrollModule({
  activeTab,
  setActiveTab,
}) {
  // =====================================================
  // STATE
  // =====================================================

  const [activeSubTab, setActiveSubTab] =
    useState("payroll");

  const [payrollRecords, setPayrollRecords] =
    useState([]);

  const [clients, setClients] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState("");

  const [selectedClient, setSelectedClient] =
    useState("1");

  const [salaryMonth, setSalaryMonth] =
    useState("2026-08");

  const [selectedSlip, setSelectedSlip] =
    useState(null);

  const payslipRef = useRef(null);

  const [pdfLoading, setPdfLoading] =
    useState(false);

  const [emailLoading, setEmailLoading] =
    useState(false);

  // =====================================================
  // EDIT PAYROLL STATE
  // =====================================================

  const [editModalOpen, setEditModalOpen] =
    useState(false);

  const [editRecord, setEditRecord] =
    useState(null);

  const [editForm, setEditForm] =
    useState(EMPTY_PAYROLL_FORM);

  const [editSaving, setEditSaving] =
    useState(false);
     const [payslipRecords, setPayslipRecords] = useState([]);

  // =====================================================
  // CREATE PAYROLL STATE
  // =====================================================

  const [createModalOpen, setCreateModalOpen] =
    useState(false);

  const [employeeOptions, setEmployeeOptions] =
    useState([]);

  const [employeeOptionsLoading, setEmployeeOptionsLoading] =
    useState(false);

  const [selectedDeploymentId, setSelectedDeploymentId] =
    useState("");

  const [prefillLoading, setPrefillLoading] =
    useState(false);

  const [prefillInfo, setPrefillInfo] =
    useState(null);

  const [createForm, setCreateForm] =
    useState(EMPTY_PAYROLL_FORM);

  const [createSaving, setCreateSaving] =
    useState(false);

  const [createError, setCreateError] =
    useState("");
   

    const openEditModal = (record) => {
  const status = normalizeStatus(record?.status);

  if (status === "Locked") {
    alert("Locked payroll cannot be edited.");
    return;
  }

  setEditRecord(record);

  setEditForm({
    basic_salary: record.basic_salary ?? 0,
    hra: record.hra ?? 0,
    conveyance: record.conveyance ?? 0,
    medical_allowance: record.medical_allowance ?? 0,
    other_allowance: record.other_allowance ?? 0,
    allowances: record.allowances ?? 0,
    overtime: record.overtime ?? record.overtime_amount ?? 0,
    bonus: record.bonus ?? 0,

    pf: record.pf ?? record.employee_pf ?? 0,
    esic: record.esic ?? record.employee_esic ?? 0,
    tax: record.tax ?? record.tds ?? 0,
    professional_tax: record.professional_tax ?? 0,
    lop: record.lop ?? record.lop_deduction ?? 0,

    employer_pf: record.employer_pf ?? record.employerPF ?? 0,
    employer_esic: record.employer_esic ?? record.employerESIC ?? 0,
    gratuity: record.gratuity ?? 0,
    pf_wages: record.pf_wages ?? 0,

    bank_name: record.bank_name ?? "",
    account_number: record.account_number ?? record.bank_account_number ?? "",
    ifsc_code: record.ifsc_code ?? record.bank_ifsc ?? "",
  });

  setEditModalOpen(true);
};


  // =====================================================
  // FETCH CLIENTS
  // =====================================================

  useEffect(() => {
    let mounted = true;

    const fetchClients = async () => {
      try {
        const response =
          await api.get("/clients");

        const responseData =
          response?.data;

        const clientList =
          Array.isArray(
            responseData?.data
          )
            ? responseData.data
            : Array.isArray(
              responseData
            )
              ? responseData
              : [];

        if (!mounted) return;

        setClients(clientList);

        if (clientList.length > 0) {
          const currentExists =
            clientList.some(
              (client) =>
                String(client.id) ===
                String(selectedClient)
            );

          if (!currentExists) {
            setSelectedClient(
              String(
                clientList[0].id
              )
            );
          }
        }
      } catch (err) {
        console.error(
          "GET /clients error:",
          err
        );

        if (mounted) {
          setClients([]);
        }
      }
    };

    fetchClients();

    return () => {
      mounted = false;
    };
  }, [selectedClient]);

  // =====================================================
  // CLIENT NAME
  // =====================================================

  const getStatusClass = (status) => {
  switch (status) {
    case "Approved":
      return "bg-emerald-200 text-emerald-800";
    case "Locked":
      return "bg-indigo-200 text-indigo-800";
    case "Pending":
      return "bg-amber-200 text-amber-800";
    default:
      return "bg-slate-200 text-slate-700";
  }
};

  const getClientName =
    useCallback(
      (record) => {
        if (
          record?.client_name &&
          String(
            record.client_name
          ).trim()
        ) {
          return record.client_name;
        }

        const client =
          clients.find(
            (item) =>
              String(item.id) ===
              String(
                record?.client_id
              )
          );

        return (
          client?.company_name ||
          "N/A"
        );
      },
      [clients]
    );

  // =====================================================
  // TOTAL EMPLOYEE DEDUCTIONS
  // =====================================================

  const getTotalDeductions =
    useCallback(
      (record) => {
        const databaseTotal =
          record?.total_deductions ??
          record?.totalDeductions;

        if (
          databaseTotal !==
          undefined &&
          databaseTotal !== null
        ) {
          return getNumericValue(
            databaseTotal
          );
        }

        return (
          getNumericValue(
            record?.pf
          ) +
          getNumericValue(
            record?.esic
          ) +
          getNumericValue(
            record?.tax
          ) +
          getNumericValue(
            record?.professional_tax
          ) +
          getNumericValue(
            record?.lop
          )
        );
      },
      []
    );

  // =====================================================
  // EMPLOYER PF
  // =====================================================

  const getEmployerPF =
    useCallback(
      (record) => {
        return getNumericValue(
          record?.employer_pf ??
          record?.employerPF
        );
      },
      []
    );

  // =====================================================
  // EMPLOYER ESIC
  // =====================================================

  const getEmployerESIC =
    useCallback(
      (record) => {
        return getNumericValue(
          record?.employer_esic ??
          record?.employerESIC
        );
      },
      []
    );

  // =====================================================
  // TOTAL EMPLOYER CONTRIBUTION
  // =====================================================

  const getTotalEmployerContribution =
    useCallback(
      (record) => {
        const databaseTotal =
          record?.total_employer_contribution ??
          record?.totalEmployerContribution;

        if (
          databaseTotal !==
          undefined &&
          databaseTotal !== null
        ) {
          return getNumericValue(
            databaseTotal
          );
        }

        return (
          getEmployerPF(record) +
          getEmployerESIC(record)
        );
      },
      [
        getEmployerPF,
        getEmployerESIC,
      ]
    );

  // =====================================================
  // TOTAL EMPLOYER COST
  // =====================================================

  const getTotalEmployerCost =
    useCallback(
      (record) => {
        const databaseTotal =
          record?.total_employer_cost ??
          record?.totalEmployerCost;

        if (
          databaseTotal !==
          undefined &&
          databaseTotal !== null
        ) {
          return getNumericValue(
            databaseTotal
          );
        }

        return (
          getNumericValue(
            record?.gross_salary
          ) +
          getTotalEmployerContribution(
            record
          )
        );
      },
      [
        getTotalEmployerContribution,
      ]
    );

  // =====================================================
  // FETCH PAYROLL
  // =====================================================

  const fetchPayroll =
    useCallback(
      async () => {
        try {
          setLoading(true);
          setError("");

          const clientId =
            Number(
              selectedClient
            );

          const month =
            normalizeSalaryMonth(
              salaryMonth
            );

          if (
            !Number.isInteger(
              clientId
            ) ||
            clientId <= 0
          ) {
            throw new Error(
              "Invalid client selected."
            );
          }

          if (
            !/^\d{4}-\d{2}$/.test(
              month
            )
          ) {
            throw new Error(
              "Invalid salary month."
            );
          }

          const response =
            await api.get(
              "/payroll",
              {
                params: {
                  client_id:
                    clientId,
                  salary_month:
                    month,
                },
              }
            );

          const json =
            response?.data;

          if (
            json?.success ===
            false
          ) {
            throw new Error(
              json?.message ||
              json?.error ||
              "Payroll request failed."
            );
          }

          const records =
            Array.isArray(
              json?.data
            )
              ? json.data
              : Array.isArray(
                json
              )
                ? json
                : [];

          console.log(
            "PAYROLL RECORDS:",
            records
          );

          setPayrollRecords(
            records
          );

          setSelectedSlip(
            (current) => {
              if (!current) {
                return null;
              }

              const updated =
                records.find(
                  (record) =>
                    String(
                      record.id
                    ) ===
                    String(
                      current.id
                    )
                );

              return (
                updated ||
                null
              );
            }
          );
        } catch (err) {
          console.error(
            "GET /payroll error:",
            err
          );

          const message =
            err?.response
              ?.data?.error ||
            err?.response
              ?.data?.message ||
            err?.message ||
            "Failed to load payroll records.";

          setError(message);
          setPayrollRecords([]);
          setSelectedSlip(null);
        } finally {
          setLoading(false);
        }
      },
      [
        selectedClient,
        salaryMonth,
      ]
    );

  // =====================================================
  // LOAD PAYROLL
  // =====================================================

  useEffect(() => {
    if (!selectedClient) {
      setLoading(false);
      return;
    }

    fetchPayroll();
  }, [
    fetchPayroll,
    selectedClient,
  ]);

  // =====================================================
  // FILTER PAYROLL
  // =====================================================

  const filteredPayrollRecords =
    useMemo(() => {
      return payrollRecords.filter(
        (record) => {
          const recordMonth =
            normalizeSalaryMonth(
              record.salary_month
            );

          const monthMatches =
            recordMonth ===
            normalizeSalaryMonth(
              salaryMonth
            );

          const clientMatches =
            String(
              record.client_id ??
              ""
            ) ===
            String(
              selectedClient
            );

          return (
            monthMatches &&
            clientMatches
          );
        }
      );
    }, [
      payrollRecords,
      salaryMonth,
      selectedClient,
    ]);

  // =====================================================
  // PAYSLIP RECORDS
  // ====================================================

  // =====================================================
  // KEEP SELECTED SLIP VALID
  // =====================================================

  useEffect(() => {
    setSelectedSlip(
      (current) => {
        if (
          current &&
          payslipRecords.some(
            (record) =>
              String(
                record.id
              ) ===
              String(
                current.id
              )
          )
        ) {
          return payslipRecords.find(
            (record) =>
              String(
                record.id
              ) ===
              String(
                current.id
              )
          );
        }

        return (
          payslipRecords[0] ||
          null
        );
      }
    );
  }, [payslipRecords]);

  // =====================================================
  // RUN BULK PAYROLL
  // =====================================================

  const handleRunBulkPayroll =
    async (e) => {
      e.preventDefault();

      try {
        setGenerating(true);
        setError("");

        if (!salaryMonth) {
          throw new Error(
            "Please select a salary month."
          );
        }

        if (!selectedClient) {
          throw new Error(
            "Please select a client."
          );
        }

        const payrollMonth =
          normalizeSalaryMonth(
            salaryMonth
          );

        if (
          !/^\d{4}-\d{2}$/.test(
            payrollMonth
          )
        ) {
          throw new Error(
            "Invalid salary month."
          );
        }

        const response =
          await api.post(
            "/payroll/generate",
            {
              client_id:
                Number(
                  selectedClient
                ),
              salary_month:
                payrollMonth,
            }
          );

        const json =
          response?.data;

        if (
          json?.success ===
          false
        ) {
          throw new Error(
            json?.message ||
            json?.error ||
            "Payroll generation failed."
          );
        }

        alert(
          json?.message ||
          `Payroll generated successfully for ${formatSalaryMonth(
            payrollMonth
          )}.`
        );

        await fetchPayroll();
      } catch (err) {
        console.error(
          "Payroll generation error:",
          err
        );

        const message =
          err?.response
            ?.data?.error ||
          err?.response
            ?.data?.message ||
          err?.message ||
          "Payroll generation failed.";

        setError(message);

        alert(
          `Payroll generation failed: ${message}`
        );
      } finally {
        setGenerating(false);
      }
    };

  // =====================================================
  // EDIT PAYROLL
  // =====================================================
  const handleEditFieldChange =
    (
      field,
      value
    ) => {
      setEditForm(
        (prev) => ({
          ...prev,
          [field]: value,
        })
      );
    };

const handleSaveEdit = async () => {
  if (!editRecord) return;

  const status = normalizeStatus(editRecord.status);

  if (status === "Locked") {
    alert("Locked payroll cannot be edited.");
    return;
  }

  try {
    setEditSaving(true);

    const numericFields = [
      "basic_salary", "hra", "conveyance", "medical_allowance", "other_allowance",
      "allowances", "overtime", "bonus",
      "pf", "esic", "tax", "professional_tax", "lop",
      "employer_pf", "employer_esic", "gratuity", "pf_wages",
    ];
        const payload = {
          ...editForm,
        };

        numericFields.forEach(
          (field) => {
            payload[field] =
              getNumericValue(
                editForm[field]
              );
          }
        );

        const response =
          await api.patch(
            `/payroll/${editRecord.id}/details`,
            payload
          );

        const json =
          response?.data;

        if (
          json?.success ===
          false
        ) {
          throw new Error(
            json?.message ||
            json?.error ||
            "Failed to update payroll details."
          );
        }

        await fetchPayroll();

        setEditModalOpen(false);
        setEditRecord(null);

        alert(
          json?.message ||
          "Payroll details updated successfully."
        );
      } catch (err) {
        console.error(
          "Payroll edit error:",
          err
        );

        const message =
          err?.response
            ?.data?.error ||
          err?.response
            ?.data?.message ||
          err?.message ||
          "Failed to update payroll details.";

        alert(
          `Failed to update payroll: ${message}`
        );
      } finally {
        setEditSaving(false);
      }
    };

  // =====================================================
  // EMPTY CREATE FORM
  // =====================================================

  const emptyCreateForm =
    () => ({
      ...EMPTY_PAYROLL_FORM,
    });


// =====================================================
// OPEN CREATE MODAL
// =====================================================

const openCreateModal =
  async () => {
    setCreateModalOpen(true);
    setCreateError("");
    setSelectedDeploymentId("");
    setPrefillInfo(null);
    setCreateForm(
      emptyCreateForm()
    );

    if (!selectedClient) {
      setCreateError(
        "Please select a client first."
      );
      return;
    }

    try {
      setEmployeeOptionsLoading(
        true
      );

      const response =
        await api.get(
          "/payroll/lookup/employees",
          {
            params: {
              client_id:
                Number(
                  selectedClient
                ),
            },
          }
        );

      const json =
        response?.data;

      const list =
        Array.isArray(
          json?.data
        )
          ? json.data
          : [];

      setEmployeeOptions(
        list
      );

      if (
        list.length ===
        0
      ) {
        setCreateError(
          "No employees/deployments are available for this client."
        );
      }
    } catch (err) {
      console.error(
        "GET /payroll/lookup/employees error:",
        err
      );

      const message =
        err?.response
          ?.data?.error ||
        err?.response
          ?.data?.message ||
        err?.message ||
        "Failed to load employees.";

      setEmployeeOptions(
        []
      );

      setCreateError(
        message
      );
    } finally {
      setEmployeeOptionsLoading(
        false
      );
    }
  };

// =====================================================
// SELECT EMPLOYEE
// =====================================================
// =====================================================
// SELECT EMPLOYEE
// =====================================================

const handleSelectEmployee = async (deploymentId) => {
  setSelectedDeploymentId(deploymentId);
  setPrefillInfo(null);
  setCreateError("");
  setCreateForm(emptyCreateForm());

  if (!deploymentId) return;

  try {
    setPrefillLoading(true);

    const response = await api.get(
      "/payroll/lookup/prefill",
      {
        params: {
          deployment_id: deploymentId,
          salary_month: normalizeSalaryMonth(salaryMonth),
        },
      }
    );

    const json = response?.data;

    if (json?.success === false) {
      throw new Error(
        json?.message || "Failed to load employee data."
      );
    }

    const info = json?.data;

   if (!info) {
  throw new Error("Employee information was not returned.");
}

   if (!info.attendance) {
  alert(
    `No attendance record found for ${info.employee_name || "this employee"} for ${salaryMonth}.\n\nPayroll cannot be created without attendance.`
  );
  return;
}

    setPrefillInfo(info);
const payRate = Number(info.pay_rate || 0);
const daysInMonth =
  Number(info.total_days || 0) || getCalendarDaysInMonth(salaryMonth);

if (!daysInMonth) {
  setCreateError("Could not determine the number of days in this salary month.");
  return;
}

let payableDays = Number(info.payable_days);

if (!Number.isFinite(payableDays) || payableDays <= 0) {
  payableDays =
    Number(info.present_days || 0) +
    Number(info.leave_days || 0) +
    Number(info.half_days || 0) * 0.5;
}

const basicSalary = Math.round(payRate);

const hra = Math.round(basicSalary * 0.5);
const conveyance = 1200;
const medicalAllowance = 1000;
const otherAllowance = 0;

const earnBasicSalary = Math.round(
  (basicSalary / daysInMonth) * payableDays
);

const earnHRA = Math.round(
  (hra / daysInMonth) * payableDays
);

const earnConveyance = Math.round(
  (conveyance / daysInMonth) * payableDays
);

const earnMedicalAllowance = Math.round(
  (medicalAllowance / daysInMonth) * payableDays
);

const earnOtherAllowance = Math.round(
  (otherAllowance / daysInMonth) * payableDays
);

const earnedFixedGross =
  earnBasicSalary +
  earnHRA +
  earnConveyance +
  earnMedicalAllowance +
  earnOtherAllowance;

const overtimeHours = Number(info.overtime_hours || 0);

const overtime = Math.round(
  (basicSalary / 26 / 8) * 1.5 * overtimeHours
);

const department = String(info.department || "")
  .trim()
  .toLowerCase();

const bonus = ["admin", "accounts"].includes(department)
  ? Math.round(earnedFixedGross * 0.0833)
  : 0;

const grossSalary = Math.round(
  earnedFixedGross + overtime + bonus
);

const pfWages = Math.max(
  0,
  Math.round(grossSalary - earnHRA)
);

const pf = Math.round(
  Math.min(pfWages, 15000) * 0.12
);

const esic = (esicApplicable && grossSalary <= 21000)
  ? Math.round(grossSalary * 0.0075)
  : 0;

const professionalTax =
  grossSalary > 25000 ? 200 : 0;

const tax = 0;

// Payable days already account for unpaid/LOP days
const lop = 0;

const totalDeductions =
  pf +
  esic +
  tax +
  professionalTax +
  lop;

const netSalary = Math.max(
  0,
  Math.round(grossSalary - totalDeductions)
);

const gratuity = Math.round(
  earnBasicSalary * 0.0481
);

const employerPf = pf;

const employerEsic =
  (esicApplicable && grossSalary <= 21000)
    ? Math.round(grossSalary * 0.0325)
    : 0;

const totalEmployerContribution =
  employerPf + employerEsic;

const totalEmployerCost = Math.round(
  grossSalary +
  totalEmployerContribution +
  gratuity
);

    // =================================================
    // POPULATE FORM
    // =================================================
console.log("========== PAYROLL CALCULATION ==========");
console.log("payRate:", payRate);
console.log("daysInMonth:", daysInMonth);
console.log("payableDays:", payableDays);
console.log("basicSalary:", earnBasicSalary);
console.log("HRA:", earnHRA);
console.log("Conveyance:", earnConveyance);
console.log("Medical:", earnMedicalAllowance);
console.log("Other:", earnOtherAllowance);
console.log("Overtime:", overtime);
console.log("Bonus:", bonus);
console.log("PF Wages:", pfWages);
console.log("PF:", pf);
console.log("ESIC:", esic);
console.log("PT:", professionalTax);
console.log("Gratuity:", gratuity);
console.log("========================================");

setCreateForm(prev => ({
  ...prev,

  // IMPORTANT
  employee_ref_id: Number(info.employee_id),
  deployment_id: Number(info.deployment_id),
  attendance_id: info.attendance_id ?? info.attendance?.id ?? null,
  client_id: Number(info.client_id),
  employee_name: info.employee_name ?? "",
  salary_month: salaryMonth,

  // Earnings
  basic_salary: earnBasicSalary,
  hra: earnHRA,
  conveyance: earnConveyance,
  medical_allowance: earnMedicalAllowance,
  other_allowance: earnOtherAllowance,

  allowances:
    earnHRA +
    earnConveyance +
    earnMedicalAllowance +
    earnOtherAllowance,

  overtime,
  bonus,

  // Deductions
  pf,
  esic,
  tax,
  professional_tax: professionalTax,
  lop,

  // Employer
  employer_pf: employerPf,
  employer_esic: employerEsic,
  gratuity,

  pf_wages: pfWages,

  total_employer_contribution:
    totalEmployerContribution,

  total_employer_cost:
    totalEmployerCost,

  bank_name: info?.bank_name ?? "",
  account_number:
    info?.account_number ??
    info?.bank_account_number ??
    "",
  ifsc_code:
    info?.ifsc_code ??
    info?.bank_ifsc ??
    "",
}));

    // =================================================
    // EXISTING PAYROLL
    // =================================================

    if (info.already_exists) {
      setCreateError(
        `A payroll record already exists for this employee this month (status: ${
          info.existing_payroll_status || "Unknown"
        }).`
      );
    }

  } catch (err) {
    console.error(
      "GET /payroll/lookup/prefill error:",
      err
    );

    const message =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Failed to load employee data.";

    setCreateError(message);

  } finally {
    setPrefillLoading(false);
  }
};

// =====================================================
// CREATE FIELD CHANGE
// =====================================================

const handleCreateFieldChange =
  (
    field,
    value
  ) => {
    setCreateForm(
      (prev) => ({
        ...prev,
        [field]: value,
      })
    );
  };

// =====================================================
// CREATE PAYROLL
// =====================================================

const handleCreatePayroll =
  async () => {


    if (!createForm.employee_ref_id || !createForm.deployment_id) {
    alert("Please select an employee and deployment.");
    return;
}

    if (
      !selectedDeploymentId ||
      !prefillInfo
    ) {
      setCreateError(
        "Please select an employee first."
      );
      return;
    }

    if (
      prefillInfo.already_exists
    ) {
      setCreateError(
        "A payroll record already exists for this employee this month."
      );
      return;
    }

    try {
      setCreateSaving(
        true
      );

      setCreateError("");

      // =================================================
      // ALL NUMERIC PAYROLL FIELDS
      // =================================================

      const numericFields = [
        // Earnings
        "basic_salary",
        "allowances",
        "hra",
        "conveyance",
        "medical_allowance",
        "other_allowance",
        "overtime",
        "bonus",

        // Deductions
        "pf",
        "esic",
        "tax",
        "professional_tax",
        "lop",

        // Employer contributions
        "employer_pf",
        "employer_esic",
        "gratuity",
        "total_employer_contribution",
        "total_employer_cost",

        // PF
        "pf_wages",
      ];

      // =================================================
      // CREATE PAYLOAD
      // =================================================

      const payload = {
        client_id:
          Number(
            selectedClient
          ),

        deployment_id:
          prefillInfo.deployment_id,

        employee_ref_id:
          prefillInfo.employee_id,

        attendance_id:
          prefillInfo.attendance_id ??
          null,

        salary_month:
          normalizeSalaryMonth(
            salaryMonth
          ),

        email:
          prefillInfo.email ??
          "",

        ...createForm,
      };

      // =================================================
      // CONVERT NUMERIC FIELDS TO NUMBERS
      // =================================================

      numericFields.forEach(
        (field) => {
          payload[field] =
            getNumericValue(
              createForm[field]
            );
        }
      );

      // =================================================
      // POST PAYROLL
      // =================================================

      const response =
        await api.post(
          "/payroll",
          payload
        );

      const json =
        response?.data;

      if (
        json?.success ===
        false
      ) {
        throw new Error(
          json?.message ||
          json?.error ||
          "Failed to create payroll record."
        );
      }

      // =================================================
      // REFRESH PAYROLL LIST
      // =================================================

      await fetchPayroll();

      // =================================================
      // RESET MODAL
      // =================================================

      setCreateModalOpen(
        false
      );

      setSelectedDeploymentId(
        ""
      );

      setPrefillInfo(
        null
      );

      setCreateForm(
        emptyCreateForm()
      );

      alert(
        json?.message ||
        "Payroll created successfully."
      );
    } catch (err) {
      console.error(
        "POST /payroll error:",
        err
      );

      const message =
        err?.response
          ?.data?.error ||
        err?.response
          ?.data?.message ||
        err?.message ||
        "Failed to create payroll record.";

      setCreateError(
        message
      );
    } finally {
      setCreateSaving(
        false
      );
    }
  };
  // =====================================================
  // CREATE PAYSLIP PDF
  // =====================================================

  const createPayslipPDF =
    async () => {
      if (!selectedSlip) {
        throw new Error(
          "No payslip selected."
        );
      }

      const status =
        normalizeStatus(
          selectedSlip.status
        );

      if (
        !ELIGIBLE_PAYSLIP_STATUSES.includes(
          status
        )
      ) {
        throw new Error(
          "Payslip can be generated only after payroll is Approved or Locked."
        );
      }

      if (!payslipRef.current) {
        throw new Error(
          "Payslip content is not available."
        );
      }

      const originalElement =
        payslipRef.current;

      const clonedElement =
        originalElement.cloneNode(
          true
        );

      const pdfContainer =
        document.createElement(
          "div"
        );

      pdfContainer.className =
        "pdf-render-container";

      pdfContainer.style.position =
        "fixed";

      pdfContainer.style.left =
        "-100000px";

      pdfContainer.style.top =
        "0";

      pdfContainer.style.width =
        `${Math.max(
          originalElement.offsetWidth,
          900
        )}px`;

      pdfContainer.style.background =
        "#ffffff";

      pdfContainer.style.zIndex =
        "-9999";

      pdfContainer.style.padding =
        "0";

      pdfContainer.style.margin =
        "0";

      document.body.appendChild(
        pdfContainer
      );

      pdfContainer.appendChild(
        clonedElement
      );

      try {
        clonedElement.classList.add(
          "pdf-safe"
        );

        const actionArea =
          clonedElement.querySelector(
            ".pdf-action-buttons"
          );

        if (actionArea) {
          actionArea.remove();
        }

        const emailInfo =
          clonedElement.querySelector(
            ".pdf-email-information"
          );

        if (emailInfo) {
          emailInfo.remove();
        }

        const allElements = [
          clonedElement,
          ...clonedElement.querySelectorAll(
            "*"
          ),
        ];

        allElements.forEach(
          (element) => {
            const computed =
              window.getComputedStyle(
                element
              );

            if (
              computed.color?.includes(
                "oklch"
              )
            ) {
              element.style.color =
                "#0f172a";
            }

            if (
              computed.backgroundColor?.includes(
                "oklch"
              )
            ) {
              element.style.backgroundColor =
                "#ffffff";
            }

            if (
              computed.borderColor?.includes(
                "oklch"
              )
            ) {
              element.style.borderColor =
                "#e2e8f0";
            }

            if (
              computed.outlineColor?.includes(
                "oklch"
              )
            ) {
              element.style.outlineColor =
                "#e2e8f0";
            }

            if (
              computed.boxShadow?.includes(
                "oklch"
              )
            ) {
              element.style.boxShadow =
                "none";
            }

            if (
              computed.textShadow?.includes(
                "oklch"
              )
            ) {
              element.style.textShadow =
                "none";
            }
          }
        );

        clonedElement.style.backgroundColor =
          "#ffffff";

        clonedElement.style.color =
          "#0f172a";

        clonedElement.style.boxShadow =
          "none";

        await new Promise(
          (resolve) =>
            requestAnimationFrame(
              () =>
                requestAnimationFrame(
                  resolve
                )
            )
        );

        const canvas =
          await html2canvas(
            clonedElement,
            {
              scale: 2,
              useCORS: true,
              allowTaint: false,
              backgroundColor:
                "#ffffff",
              logging: false,
              imageTimeout: 15000,
              foreignObjectRendering:
                false,
              removeContainer:
                true,

              onclone: (
                clonedDocument
              ) => {
                const safeStyle =
                  clonedDocument.createElement(
                    "style"
                  );

                safeStyle.innerHTML = `
                  .pdf-safe,
                  .pdf-safe * {
                    color: #0f172a !important;
                    border-color: #e2e8f0 !important;
                    outline-color: #e2e8f0 !important;
                    box-shadow: none !important;
                    text-shadow: none !important;
                  }

                  .pdf-safe {
                    background: #ffffff !important;
                  }

                  .pdf-safe .bg-slate-50 {
                    background: #f8fafc !important;
                  }

                  .pdf-safe .bg-slate-100 {
                    background: #f1f5f9 !important;
                  }

                  .pdf-safe .bg-indigo-50,
                  .pdf-safe .bg-indigo-50\\/50 {
                    background: #eef2ff !important;
                  }

                  .pdf-safe .bg-indigo-100\\/70 {
                    background: #e0e7ff !important;
                  }

                  .pdf-safe .bg-emerald-50 {
                    background: #ecfdf5 !important;
                  }

                  .pdf-safe .bg-emerald-100 {
                    background: #d1fae5 !important;
                  }

                  .pdf-safe .bg-slate-900 {
                    background: #0f172a !important;
                  }

                  .pdf-safe .text-white {
                    color: #ffffff !important;
                  }

                  .pdf-safe .text-slate-900 {
                    color: #0f172a !important;
                  }

                  .pdf-safe .text-slate-800 {
                    color: #1e293b !important;
                  }

                  .pdf-safe .text-slate-700 {
                    color: #334155 !important;
                  }

                  .pdf-safe .text-slate-600 {
                    color: #475569 !important;
                  }

                  .pdf-safe .text-slate-500 {
                    color: #64748b !important;
                  }

                  .pdf-safe .text-slate-400 {
                    color: #94a3b8 !important;
                  }

                  .pdf-safe .text-indigo-700 {
                    color: #4338ca !important;
                  }

                  .pdf-safe .text-indigo-900 {
                    color: #312e81 !important;
                  }

                  .pdf-safe .text-emerald-600 {
                    color: #059669 !important;
                  }

                  .pdf-safe .text-emerald-700 {
                    color: #047857 !important;
                  }

                  .pdf-safe .text-emerald-800 {
                    color: #065f46 !important;
                  }

                  .pdf-safe .text-emerald-900 {
                    color: #064e3b !important;
                  }

                  .pdf-safe .text-rose-600 {
                    color: #e11d48 !important;
                  }

                  .pdf-safe .border-slate-100 {
                    border-color: #f1f5f9 !important;
                  }

                  .pdf-safe .border-slate-200 {
                    border-color: #e2e8f0 !important;
                  }

                  .pdf-safe .border-emerald-200 {
                    border-color: #a7f3d0 !important;
                  }

                  .pdf-safe .border-indigo-100 {
                    border-color: #e0e7ff !important;
                  }

                  .pdf-action-buttons,
                  .pdf-email-information {
                    display: none !important;
                  }
                `;

                clonedDocument.head.appendChild(
                  safeStyle
                );
              },
            }
          );

        if (
          !canvas ||
          canvas.width <= 0 ||
          canvas.height <= 0
        ) {
          throw new Error(
            "Failed to render payslip into canvas."
          );
        }

        const imgData =
          canvas.toDataURL(
            "image/png",
            1.0
          );

        const pdf =
          new jsPDF({
            orientation:
              "portrait",
            unit: "mm",
            format: "a4",
            compress: true,
          });

        const pageWidth =
          pdf.internal.pageSize.getWidth();

        const pageHeight =
          pdf.internal.pageSize.getHeight();

        const margin = 8;

        const availableWidth =
          pageWidth -
          margin * 2;

        const imageHeight =
          (canvas.height *
            availableWidth) /
          canvas.width;

        const printableHeight =
          pageHeight -
          margin * 2;

        let heightLeft =
          imageHeight;

        let position =
          margin;

        pdf.addImage(
          imgData,
          "PNG",
          margin,
          position,
          availableWidth,
          imageHeight,
          undefined,
          "FAST"
        );

        heightLeft -=
          printableHeight;

        while (
          heightLeft > 0
        ) {
          position =
            margin -
            (imageHeight -
              heightLeft);

          pdf.addPage();

          pdf.addImage(
            imgData,
            "PNG",
            margin,
            position,
            availableWidth,
            imageHeight,
            undefined,
            "FAST"
          );

          heightLeft -=
            printableHeight;
        }

        return pdf;
      } finally {
        if (
          pdfContainer.parentNode
        ) {
          pdfContainer.parentNode.removeChild(
            pdfContainer
          );
        }
      }
    };

  // =====================================================
  // DOWNLOAD PDF
  // =====================================================

  const handleDownload =
    async () => {
      if (!selectedSlip) {
        alert(
          "Please select a payslip."
        );
        return;
      }

      try {
        setPdfLoading(true);

        const pdf =
          await createPayslipPDF();

        const employeeName =
          String(
            selectedSlip.employee_name ||
            "Employee"
          )
            .trim()
            .replace(
              /[^a-zA-Z0-9]+/g,
              "_"
            );

        const month =
          normalizeSalaryMonth(
            selectedSlip.salary_month
          );

        pdf.save(
          `Payslip_${employeeName}_${month}.pdf`
        );
      } catch (err) {
        console.error(
          "PDF generation error:",
          err
        );

        alert(
          `Failed to download payslip: ${err.message}`
        );
      } finally {
        setPdfLoading(false);
      }
    };

  // =====================================================
  // GENERATE PDF
  // =====================================================

  const handleGeneratePDF =
    async () => {
      await handleDownload();
    };

  // =====================================================
  // EMAIL PAYSLIP
  // =====================================================
  const handleEmail = async () => {
    if (!selectedSlip?.id) {
      alert("Invalid payroll ID.");
      return;
    }
    console.log("selected ID :",selectedSlip.email)

    const status = normalizeStatus(selectedSlip.status);

    if (!ELIGIBLE_PAYSLIP_STATUSES.includes(status)) {
      alert(
        "Payslip can be emailed only after payroll is Approved or Locked."
      );
      return;
    }

    try {
      setEmailLoading(true);

      const response = await api.post(
        `/payroll/${selectedSlip.id}/email`
      );

      const data = response?.data;

      if (data?.success === false) {
        throw new Error(
          data?.message ||
          data?.error ||
          "Failed to email payslip."
        );
      }

      alert(
        data?.message ||
        "Payslip emailed successfully."
      );
    } catch (error) {
      console.error(
        "EMAIL PAYSLIP ERROR:",
        error
      );

      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to send payslip.";

      alert(message);
    } finally {
      setEmailLoading(false);
    }
  };
  // =====================================================
  // CSV ESCAPE
  // =====================================================

  const escapeCSV = (
    value
  ) => {
    return `"${String(
      value ?? ""
    ).replace(
      /"/g,
      '""'
    )}"`;
  };

  // =====================================================
  // EXPORT BANK FILE
  // =====================================================

  const handleExportBankFile =
    () => {
      const approvedRecords =
        filteredPayrollRecords.filter(
          (record) =>
            ELIGIBLE_PAYSLIP_STATUSES.includes(
              normalizeStatus(
                record.status
              )
            )
        );

      if (
        approvedRecords.length ===
        0
      ) {
        alert(
          `No Approved or Locked payroll records available for ${formatSalaryMonth(
            salaryMonth
          )}.`
        );

        return;
      }

      const csvHeader =
        [
          "Beneficiary Name",
          "Account Number",
          "IFSC Code",
          "Amount",
          "Salary Month",
          "Bank Name",
          "Client",
        ]
          .map(
            escapeCSV
          )
          .join(",") +
        "\n";

      const csvRows =
        approvedRecords
          .map(
            (record) =>
              [
                record.employee_name ||
                "",

                record.account_number ||
                "",

                record.ifsc_code ||
                "",

                getNumericValue(
                  record.net_salary
                ),

                normalizeSalaryMonth(
                  record.salary_month
                ),

                record.bank_name ||
                "",

                getClientName(
                  record
                ),
              ]
                .map(
                  escapeCSV
                )
                .join(",")
          )
          .join("\n");

      const blob =
        new Blob(
          [
            csvHeader +
            csvRows,
          ],
          {
            type:
              "text/csv;charset=utf-8;",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;

      link.download =
        `Corporate_Bank_Disbursal_${selectedClient}_${salaryMonth}.csv`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      URL.revokeObjectURL(
        url
      );
    };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm">
            <Loader2 className="h-5 w-5 animate-spin text-slate-900" />
            Loading payroll records...
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // MAIN
  // =====================================================

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 p-8 space-y-6 overflow-y-auto">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Payroll & Payslip Management
            </h1>

            <p className="text-sm text-slate-500">
              Payroll generated from client-approved attendance, with controlled manual corrections.
            </p>
          </div>

          <div className="flex bg-slate-200/70 p-1 rounded-xl">

            <button
              onClick={() =>
                setActiveSubTab(
                  "payroll"
                )
              }
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeSubTab ===
                  "payroll"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Payroll Processing
            </button>

            <button
              onClick={() =>
                setActiveSubTab(
                  "payslip"
                )
              }
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeSubTab ===
                  "payslip"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Payslip Generator & Viewer
            </button>

          </div>

        </div>

        {/* ERROR */}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">

            <ShieldAlert className="h-4 w-4 flex-shrink-0" />

            <span className="flex-1">
              {error}
            </span>

            <button
              onClick={
                fetchPayroll
              }
              className="text-xs font-bold underline"
            >
              Retry
            </button>

          </div>
        )}

        {/* =====================================================
            PAYROLL TAB
        ===================================================== */}

        {activeSubTab ===
          "payroll" && (
            <div className="space-y-6">

              {/* INFO */}

              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-indigo-900">

                <div>
                  <span className="font-bold block mb-1">
                    Attendance Traceability
                  </span>

                  <p className="text-indigo-700">
                    Bulk payroll uses approved attendance records.
                  </p>
                </div>

                <div>
                  <span className="font-bold block mb-1">
                    Deployment Based Payroll
                  </span>

                  <p className="text-indigo-700">
                    Payroll remains linked to employee, deployment and client.
                  </p>
                </div>

                <div>
                  <span className="font-bold block mb-1">
                    Manual Control
                  </span>

                  <p className="text-indigo-700">
                    Admin can correct Pending or Approved payroll before locking.
                  </p>
                </div>

              </div>

              {/* RUN PAYROLL */}

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">

                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Run Bulk Payroll by Client
                  </h3>

                  <div className="flex flex-wrap gap-2">

                    <button
                    
                    onClick={
                        openCreateModal
                      }
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create Payroll Manually
                    </button>

                    <button
                      onClick={
                        handleExportBankFile
                      }
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
                    >
                      <Download className="h-4 w-4" />
                      Export Bank File (.csv)
                    </button>

                  </div>

                </div>

                <form
                  onSubmit={
                    handleRunBulkPayroll
                  }
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2"
                >

                  {/* CLIENT */}

                  <div>

                    <label className="block font-bold text-slate-600 mb-1">
                      Select Client Company
                    </label>

                    <select
                      value={
                        selectedClient
                      }
                      onChange={(e) =>
                        setSelectedClient(
                          e.target.value
                        )
                      }
                      className="w-full border border-slate-200 p-2.5 rounded-xl bg-white font-medium text-slate-800"
                    >

                      {clients.length ===
                        0 ? (
                        <option value="">
                          No clients available
                        </option>
                      ) : (
                        clients.map(
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
                                client.company_name
                              }{" "}
                              (ID:{" "}
                              {
                                client.id
                              }
                              )
                            </option>
                          )
                        )
                      )}

                    </select>

                  </div>

                  {/* MONTH */}

                  <div>

                    <label className="block font-bold text-slate-600 mb-1">
                      Salary Month
                    </label>

                    <div className="relative">

                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />

                      <input
                        type="month"
                        required
                        value={
                          salaryMonth
                        }
                        onChange={(e) =>
                          setSalaryMonth(
                            e.target.value
                          )
                        }
                        className="w-full border border-slate-200 p-2.5 pl-10 rounded-xl font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                      />

                    </div>

                    <p className="text-[10px] text-slate-400 mt-1">

                      Selected:{" "}

                      <span className="font-semibold text-slate-600">
                        {
                          formatSalaryMonth(
                            salaryMonth
                          )
                        }
                      </span>

                      <span className="ml-2 text-slate-400">
                        (
                        {
                          getCalendarDaysInMonth(
                            salaryMonth
                          )
                        }{" "}
                        calendar days)
                      </span>

                    </p>

                  </div>

                  {/* RUN */}

                  <div className="flex items-end">

                    <button
                      type="submit"
                      disabled={
                        generating ||
                        !selectedClient
                      }
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-sm inline-flex items-center justify-center gap-1.5"
                    >

                      {generating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating Payroll...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Run Payroll from Attendance
                        </>
                      )}

                    </button>

                  </div>

                </form>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">

                  <strong>
                    Important:
                  </strong>{" "}
                  Only Approved attendance can generate payroll.

                </div>

              </div>

              {/* PAYROLL TABLE */}

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">

                <table className="w-full text-left border-collapse">

                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">

                      <th className="p-4">
                        Client / Employee
                      </th>

                      <th className="p-4">
                        Month
                      </th>

                      <th className="p-4">
                        Attendance
                      </th>

                      <th className="p-4">
                        Gross Salary
                      </th>

                      <th className="p-4">
                        Employee Deductions
                      </th>

                      <th className="p-4">
                        Net Salary
                      </th>

                      <th className="p-4">
                        Employer Contributions
                      </th>

                      <th className="p-4">
                        Employer Cost
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

                    {filteredPayrollRecords.length ===
                      0 ? (

                      <tr>
                        <td
                          colSpan="10"
                          className="p-10 text-center"
                        >

                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50 text-slate-400" />

                          <p className="text-sm font-semibold text-slate-600">
                            No payroll records found
                          </p>

                          <p className="text-xs mt-1 text-slate-400">

                            No payroll exists for{" "}

                            <strong>
                              {
                                formatSalaryMonth(
                                  salaryMonth
                                )
                              }
                            </strong>{" "}

                            for the selected client.

                          </p>

                        </td>
                      </tr>

                    ) : (

                      filteredPayrollRecords.map(
                        (rec) => {

                          const status =
                            normalizeStatus(
                              rec.status
                            );

                          const totalDeductions =
                            getTotalDeductions(
                              rec
                            );

                          const employerPF =
                            getEmployerPF(
                              rec
                            );

                          const employerESIC =
                            getEmployerESIC(
                              rec
                            );

                          const totalEmployerContribution =
                            getTotalEmployerContribution(
                              rec
                            );

                          const totalEmployerCost =
                            getTotalEmployerCost(
                              rec
                            );

                          return (
                            <tr
                              key={
                                rec.id
                              }
                              className="hover:bg-slate-50 transition"
                            >

                              <td className="p-4">

                                <p className="font-bold text-slate-900">
                                  {
                                    rec.employee_name ||
                                    "N/A"
                                  }
                                </p>

                                <p className="text-[11px] text-indigo-600 font-semibold">
                                  {
                                    getClientName(
                                      rec
                                    )
                                  }
                                </p>

                                <p className="text-[10px] text-slate-400 mt-1">
                                  Client ID:{" "}
                                  {
                                    rec.client_id ??
                                    "-"
                                  }

                                  {" • "}

                                  Deployment ID:{" "}
                                  {
                                    rec.deployment_id ??
                                    "-"
                                  }
                                </p>

                              </td>

                              <td className="p-4 text-slate-600 text-xs">
                                {
                                  formatSalaryMonth(
                                    rec.salary_month
                                  )
                                }
                              </td>

                              <td className="p-4 text-xs">

                                <div className="flex items-center gap-1 font-semibold text-slate-800">

                                  <Calendar className="h-3.5 w-3.5 text-slate-400" />

                                  Present:{" "}
                                  {
                                    rec.present_days ??
                                    "-"
                                  }

                                  {" / "}

                                  {
                                    rec.total_days ??
                                    getCalendarDaysInMonth(
                                      rec.salary_month
                                    )
                                  }

                                </div>

                                <span className="text-rose-600 font-medium">
                                  LOP Days:{" "}
                                  {
                                    rec.lop_days ??
                                    "-"
                                  }
                                </span>

                                <p className="text-[10px] text-slate-400 mt-1">
                                  Attendance ID:{" "}
                                  {
                                    rec.attendance_id ??
                                    "-"
                                  }
                                </p>

                              </td>

                              <td className="p-4 font-semibold text-slate-800">
                                ₹
                                {
                                  formatMoney(
                                    rec.gross_salary
                                  )
                                }
                              </td>

                              <td className="p-4 text-rose-600 font-medium text-xs">

                                <div>
                                  PF: ₹
                                  {
                                    formatMoney(
                                      rec.pf
                                    )
                                  }
                                </div>

                                <div>
                                  ESIC: ₹
                                  {
                                    formatMoney(
                                      rec.esic
                                    )
                                  }
                                </div>

                                <div>
                                  TDS: ₹
                                  {
                                    formatMoney(
                                      rec.tax
                                    )
                                  }
                                </div>

                                <div>
                                  PT: ₹
                                  {
                                    formatMoney(
                                      rec.professional_tax
                                    )
                                  }
                                </div>

                                <div>
                                  LOP: ₹
                                  {
                                    formatMoney(
                                      rec.lop
                                    )
                                  }
                                </div>

                                <div className="font-bold border-t border-rose-100 mt-1 pt-1">
                                  Total: ₹
                                  {
                                    formatMoney(
                                      totalDeductions
                                    )
                                  }
                                </div>

                              </td>

                              <td className="p-4 font-bold text-emerald-600">
                                ₹
                                {
                                  formatMoney(
                                    rec.net_salary
                                  )
                                }
                              </td>

                              <td className="p-4 text-xs">

                                <div className="text-slate-600">
                                  Employer PF:{" "}
                                  <span className="font-semibold text-slate-800">
                                    ₹
                                    {
                                      formatMoney(
                                        employerPF
                                      )
                                    }
                                  </span>
                                </div>

                                <div className="text-slate-600 mt-1">
                                  Employer ESIC:{" "}
                                  <span className="font-semibold text-slate-800">
                                    ₹
                                    {
                                      formatMoney(
                                        employerESIC
                                      )
                                    }
                                  </span>
                                </div>

                                <div className="border-t border-indigo-100 mt-2 pt-2">
                                  <span className="font-bold text-indigo-700">
                                    Total: ₹
                                    {
                                      formatMoney(
                                        totalEmployerContribution
                                      )
                                    }
                                  </span>
                                </div>

                              </td>

                              <td className="p-4">

                                <div className="font-bold text-slate-900">
                                  ₹
                                  {
                                    formatMoney(
                                      totalEmployerCost
                                    )
                                  }
                                </div>

                                <p className="text-[10px] text-slate-400 mt-1">
                                  Gross + Contributions
                                </p>

                              </td>

                              <td className="p-4">

                                <span
                                  className={`px-2.5 py-1 text-xs font-bold rounded-full ${getStatusClass(
                                    status
                                  )}`}
                                >
                                  {status ||
                                    "Unknown"}
                                </span>

                              </td>

                              <td className="p-4 text-right">

                                <div className="flex justify-end gap-2 flex-wrap">

                                  {/* EDIT */}

                                  {(
                                      <button
                                        onClick={() =>
                                          openEditModal(
                                            rec
                                          )
                                        }
                                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition inline-flex items-center gap-1"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                      </button>
                                    )}

                                  {/* VIEW SLIP */}

                                  {ELIGIBLE_PAYSLIP_STATUSES.includes(
                                    status
                                  ) && (
                                      <button
                                        onClick={() => {
                                          setSelectedSlip(
                                            rec
                                          );

                                          setActiveSubTab(
                                            "payslip"
                                          );
                                        }}
                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition inline-flex items-center gap-1"
                                      >

                                        <FileText className="h-3.5 w-3.5" />

                                        View Slip

                                      </button>
                                    )}

                                </div>

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
          )}

        {/* =====================================================
    PAYSLIP TAB
===================================================== */}

{activeSubTab === "payslip" && (

  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

    {/* =====================================================
        EMPLOYEE LIST
    ===================================================== */}

    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 h-fit">

      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
        Select Employee Slip
      </h3>

      <p className="text-[10px] text-slate-400 pb-2 border-b border-slate-100">

        {getClientName({
          client_id: selectedClient,
        })}

        {" • "}

        {formatSalaryMonth(salaryMonth)}

      </p>

      {payslipRecords.length === 0 ? (

        <div className="p-4 text-center">

          <p className="text-xs font-semibold text-slate-600">
            No payslips available.
          </p>

          <p className="text-[11px] text-slate-400 mt-1">
            Payslips are available only after payroll is Approved or Locked.
          </p>

        </div>

      ) : (

        payslipRecords.map((rec) => {

          const status = normalizeStatus(rec.status);

          return (

            <div
              key={rec.id}
              onClick={() => setSelectedSlip(rec)}
              className={`p-3 rounded-xl cursor-pointer border transition ${
                String(selectedSlip?.id) === String(rec.id)
                  ? "border-indigo-600 bg-indigo-50/50 shadow-sm"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >

              <div className="flex justify-between items-start gap-2">

                <div>

                  <p className="text-xs font-bold text-slate-900">
                    {rec.employee_name || "Employee"}
                  </p>

                  <p className="text-[10px] text-indigo-600 font-semibold">
                    {getClientName(rec)}
                  </p>

                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getStatusClass(
                    status
                  )}`}
                >
                  {status}
                </span>

              </div>

              <div className="flex justify-between items-center mt-2 text-[11px] text-slate-500">

                <span>
                  {formatSalaryMonth(rec.salary_month)}
                </span>

                <span className="font-semibold text-emerald-600">
                  ₹{formatMoney(rec.net_salary)}
                </span>

              </div>

            </div>

          );
        })

      )}

    </div>

    {/* =====================================================
        PAYSLIP
    ===================================================== */}

    <div
      ref={payslipRef}
      className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6"
    >

      {!selectedSlip ? (

        <div className="text-center py-12">

          <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />

          <p className="text-sm font-semibold text-slate-600">
            No payslip available
          </p>

          <p className="text-xs text-slate-400 mt-1">
            Payroll must be Approved or Locked before a payslip can be viewed.
          </p>

        </div>

      ) : (

        <>

          {/* =====================================================
              HEADER
          ===================================================== */}

          <div className="flex justify-between items-start border-b border-slate-100 pb-6">

            <div>

              <h2 className="text-xl font-extrabold text-slate-900">
                Talent Corner HR Services
              </h2>

              <p className="text-xs text-slate-500 mt-0.5">
                Client:{" "}
                <span className="font-semibold text-slate-700">
                  {getClientName(selectedSlip)}
                </span>
              </p>

              <p className="text-[10px] text-slate-400 mt-1">
                Client ID:{" "}
                {selectedSlip.client_id ?? "-"}

                {" • "}

                Deployment ID:{" "}
                {selectedSlip.deployment_id ?? "-"}
              </p>

            </div>

            <div className="text-right">

              <span className="bg-slate-100 text-slate-800 text-xs font-bold px-3 py-1 rounded-full">

                Payslip:{" "}
                {formatSalaryMonth(selectedSlip.salary_month)}

              </span>

              <p className="text-[11px] text-slate-400 mt-1">

                Status:{" "}

                <span className="font-semibold text-slate-700">
                  {normalizeStatus(selectedSlip.status)}
                </span>

              </p>

            </div>

          </div>

          {/* =====================================================
              EMPLOYEE SUMMARY
          ===================================================== */}

          <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">

            <div>

              <p className="text-slate-400 font-medium">
                Employee Name
              </p>

              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {selectedSlip.employee_name || "Employee"}
              </p>

            </div>

            <div>

              <p className="text-slate-400 font-medium">
                Present
              </p>

              <p className="font-bold text-slate-900 text-sm mt-0.5">

                {selectedSlip.present_days ?? "-"}

                {" / "}

                {selectedSlip.total_days ??
                  getCalendarDaysInMonth(selectedSlip.salary_month)}

                {" Days"}

              </p>

            </div>

            <div>

              <p className="text-slate-400 font-medium">
                LOP Days
              </p>

              <p className="font-bold text-rose-600 text-sm mt-0.5">
                {selectedSlip.lop_days ?? 0}
              </p>

            </div>

            <div>

              <p className="text-slate-400 font-medium">
                Leave
              </p>

              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {selectedSlip.leave_days ?? 0}
              </p>

            </div>

            <div>

              <p className="text-slate-400 font-medium">
                Overtime
              </p>

              <p className="font-bold text-slate-900 text-sm mt-0.5">

                {selectedSlip.overtime_hours ?? 0} hrs

              </p>

            </div>

          </div>

          {/* =====================================================
              EARNINGS + DEDUCTIONS
          ===================================================== */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">

            {/* =====================================================
                EARNINGS
            ===================================================== */}

            <div className="border border-slate-200 rounded-xl overflow-hidden">

              <div className="bg-slate-100 p-3 font-bold text-slate-700 uppercase tracking-wider">
                Earnings
              </div>

              <div className="p-4 space-y-3">

                <div className="flex justify-between">

                  <span>
                    Basic Salary
                  </span>

                  <span className="font-semibold">
                    ₹{formatMoney(selectedSlip.basic_salary)}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span>
                    Allowances
                  </span>

                  <span className="font-semibold">
                    ₹{formatMoney(selectedSlip.allowances)}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span>
                    Overtime
                  </span>

                  <span className="font-semibold">
                    ₹
                    {formatMoney(
                      selectedSlip.overtime ??
                      selectedSlip.overtime_amount
                    )}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span>
                    Bonus
                  </span>

                  <span className="font-semibold">
                    ₹{formatMoney(selectedSlip.bonus)}
                  </span>

                </div>

                <div className="flex justify-between pt-3 border-t border-slate-200 font-bold text-slate-900">

                  <span>
                    Gross Earnings
                  </span>

                  <span>
                    ₹{formatMoney(selectedSlip.gross_salary)}
                  </span>

                </div>

              </div>

            </div>

            {/* =====================================================
                DEDUCTIONS
            ===================================================== */}

            <div className="border border-slate-200 rounded-xl overflow-hidden">

              <div className="bg-slate-100 p-3 font-bold text-slate-700 uppercase tracking-wider">
                Employee Deductions
              </div>

              <div className="p-4 space-y-3">

                <div className="flex justify-between">

                  <span>
                    Provident Fund (PF)
                  </span>

                  <span className="font-semibold text-rose-600">
                    ₹
                    {formatMoney(
                      selectedSlip.pf ??
                      selectedSlip.employee_pf
                    )}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span>
                    ESIC
                  </span>

                  <span className="font-semibold text-rose-600">
                    ₹
                    {formatMoney(
                      selectedSlip.esic ??
                      selectedSlip.employee_esic
                    )}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span>
                    Tax (TDS)
                  </span>

                  <span className="font-semibold text-rose-600">
                    ₹
                    {formatMoney(
                      selectedSlip.tax ??
                      selectedSlip.tds
                    )}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span>
                    Professional Tax
                  </span>

                  <span className="font-semibold text-rose-600">
                    ₹
                    {formatMoney(selectedSlip.professional_tax)}
                  </span>

                </div>

                <div className="flex justify-between">

                  <span>
                    Loss of Pay (LOP)
                  </span>

                  <span className="font-semibold text-rose-600">
                    ₹
                    {formatMoney(
                      selectedSlip.lop ??
                      selectedSlip.lop_deduction
                    )}
                  </span>

                </div>

                <div className="flex justify-between pt-3 border-t border-slate-200 font-bold text-slate-900">

                  <span>
                    Total Deductions
                  </span>

                  <span>
                    ₹
                    {formatMoney(
                      getTotalDeductions(selectedSlip)
                    )}
                  </span>

                </div>

              </div>

            </div>

          </div>

          {/* =====================================================
              EMPLOYER CONTRIBUTIONS
          ===================================================== */}

          <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl overflow-hidden">

            <div className="bg-indigo-100/70 p-3 font-bold text-indigo-900 uppercase tracking-wider text-xs">
              Employer Contributions
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">

              <div>

                <p className="text-slate-500">
                  Employer PF
                </p>

                <p className="font-bold text-slate-900 mt-1">
                  ₹
                  {formatMoney(
                    getEmployerPF(selectedSlip)
                  )}
                </p>

              </div>

              <div>

                <p className="text-slate-500">
                  Employer ESIC
                </p>

                <p className="font-bold text-slate-900 mt-1">
                  ₹
                  {formatMoney(
                    getEmployerESIC(selectedSlip)
                  )}
                </p>

              </div>

              <div>

                <p className="text-slate-500">
                  Total Employer Contribution
                </p>

                <p className="font-bold text-indigo-700 mt-1">
                  ₹
                  {formatMoney(
                    getTotalEmployerContribution(selectedSlip)
                  )}
                </p>

              </div>

            </div>

          </div>

          {/* =====================================================
              NET SALARY
          ===================================================== */}

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex justify-between items-center text-emerald-900">

            <div>

              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Net Salary Payable
              </p>

              <p className="text-2xl font-extrabold mt-0.5">
                ₹{formatMoney(selectedSlip.net_salary)}
              </p>

            </div>

            <span className="text-xs font-medium bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg">

              Account:{" "}
              {selectedSlip.account_number || "-"}

            </span>

          </div>

          {/* =====================================================
              EMPLOYER COST
          ===================================================== */}

          <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center">

            <div>

              <p className="text-xs text-slate-300 uppercase tracking-wider">
                Total Employer Cost
              </p>

              <p className="text-xl font-extrabold mt-1">
                ₹
                {formatMoney(
                  getTotalEmployerCost(selectedSlip)
                )}
              </p>

            </div>

            <div className="text-right text-xs text-slate-300">
              Gross Salary + Employer Contributions
            </div>

          </div>

          {/* =====================================================
              TRACEABILITY
          ===================================================== */}

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">

            <p className="text-xs font-bold text-slate-700 mb-2">
              Payroll Traceability
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">

              <div>

                <span className="text-slate-400">
                  Client ID
                </span>

                <p className="font-semibold">
                  {selectedSlip.client_id ?? "-"}
                </p>

              </div>

              <div>

                <span className="text-slate-400">
                  Deployment ID
                </span>

                <p className="font-semibold">
                  {selectedSlip.deployment_id ?? "-"}
                </p>

              </div>

              <div>

                <span className="text-slate-400">
                  Attendance ID
                </span>

                <p className="font-semibold">
                  {selectedSlip.attendance_id ?? "-"}
                </p>

              </div>

              <div>

                <span className="text-slate-400">
                  Employee ID
                </span>

                <p className="font-semibold">
                  {selectedSlip.employee_ref_id ??
                    selectedSlip.employee_id ??
                    "-"}
                </p>

              </div>

            </div>

          </div>

          {/* =====================================================
              ACTIONS
          ===================================================== */}

          <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100">

            <button
              onClick={handleGeneratePDF}
              disabled={pdfLoading || !selectedSlip}
              className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >

              {pdfLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}

              {pdfLoading
                ? "Generating..."
                : "Generate PDF"}

            </button>

            <button
              onClick={handleDownload}
              disabled={pdfLoading || !selectedSlip}
              className="bg-white hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2"
            >

              {pdfLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}

              Download PDF

            </button>

            <button
              onClick={handleEmail}
              disabled={
                emailLoading ||
                !selectedSlip ||
                !ELIGIBLE_PAYSLIP_STATUSES.includes(
                  normalizeStatus(selectedSlip.status)
                )
              }
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >

              {emailLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}

              {emailLoading
                ? "Sending..."
                : "Email to Employee"}

            </button>

          </div>

          {/* =====================================================
              EMAIL INFORMATION
          ===================================================== */}

          <div className="mt-2">

            {selectedSlip.email ? (

              <div className="text-[11px] text-slate-400">

                Payslip email will be sent to:

                <span className="font-semibold text-slate-600 ml-1">
                  {selectedSlip.email}
                </span>

              </div>

            ) : (

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">

                Employee email address is not available.
                Add an employee email before using{" "}

                <strong className="ml-1">
                  Email to Employee
                </strong>.

              </div>

            )}

          </div>

        </>

      )}

    </div>

  </div>

)}

        {/* =====================================================
            EDIT PAYROLL MODAL
        ===================================================== */}

        {editModalOpen &&
          editRecord && (

            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">

              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">

                {/* MODAL HEADER */}

                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">

                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Edit Payroll
                    </h3>

                    <p className="text-xs text-slate-500 mt-0.5">
                      {
                        editRecord.employee_name ||
                        "Employee"
                      }

                      {" • "}

                      {
                        formatSalaryMonth(
                          editRecord.salary_month
                        )
                      }

                      {" • "}

                      <span className="font-semibold">
                        {
                          normalizeStatus(
                            editRecord.status
                          )
                        }
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setEditModalOpen(
                        false
                      )
                    }
                    className="text-slate-400 hover:text-slate-700 text-xl font-bold"
                  >
                    ×
                  </button>

                </div>

                <div className="p-6 space-y-6">

                  {/* WARNING */}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    <strong>
                      Manual Payroll Correction:
                    </strong>{" "}
                    These values will overwrite the current payroll values.
                    Locked payroll cannot be edited.
                  </div>

                  {/* SALARY */}

                  <div>

                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Salary & Earnings
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">

                      {[
                        [
                          "basic_salary",
                          "Basic Salary",
                        ],
                        [
                          "allowances",
                          "Allowances",
                        ],
                        [
                          "overtime",
                          "Overtime Amount",
                        ],
                        [
                          "bonus",
                          "Bonus",
                        ],
                      ].map(
                        ([
                          field,
                          label,
                        ]) => (
                          <div
                            key={
                              field
                            }
                          >
                            <label className="block font-bold text-slate-600 mb-1">
                              {label}
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                editForm[
                                field
                                ] ??
                                0
                              }
                              onChange={(
                                e
                              ) =>
                                handleEditFieldChange(
                                  field,
                                  e.target
                                    .value
                                )
                              }
                              className="w-full border border-slate-200 p-2.5 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                          </div>
                        )
                      )}

                    </div>

                  </div>

                  {/* DEDUCTIONS */}

                  <div>

                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Employee Deductions
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">

                      {[
                        [
                          "pf",
                          "Employee PF",
                        ],
                        [
                          "esic",
                          "Employee ESIC",
                        ],
                        [
                          "tax",
                          "Tax / TDS",
                        ],
                        [
                          "professional_tax",
                          "Professional Tax",
                        ],
                        [
                          "lop",
                          "LOP Deduction",
                        ],
                      ].map(
                        ([
                          field,
                          label,
                        ]) => (
                          <div
                            key={
                              field
                            }
                          >
                            <label className="block font-bold text-slate-600 mb-1">
                              {label}
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                editForm[
                                field
                                ] ??
                                0
                              }
                              onChange={(
                                e
                              ) =>
                                handleEditFieldChange(
                                  field,
                                  e.target
                                    .value
                                )
                              }
                              className="w-full border border-slate-200 p-2.5 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                          </div>
                        )
                      )}

                    </div>

                  </div>

                  {/* EMPLOYER */}

                  <div>

                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Employer Contributions
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">

                      <div>

                        <label className="block font-bold text-slate-600 mb-1">
                          Employer PF
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            editForm.employer_pf ??
                            0
                          }
                          onChange={(
                            e
                          ) =>
                            handleEditFieldChange(
                              "employer_pf",
                              e.target.value
                            )
                          }
                          className="w-full border border-slate-200 p-2.5 rounded-lg"
                        />

                      </div>

                      <div>

                        <label className="block font-bold text-slate-600 mb-1">
                          Employer ESIC
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            editForm.employer_esic ??
                            0
                          }
                          onChange={(
                            e
                          ) =>
                            handleEditFieldChange(
                              "employer_esic",
                              e.target.value
                            )
                          }
                          className="w-full border border-slate-200 p-2.5 rounded-lg"
                        />

                      </div>

                    </div>

                  </div>

                  {/* BANK */}

                  <div>

                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Bank Details
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">

                      <div>

                        <label className="block font-bold text-slate-600 mb-1">
                          Bank Name
                        </label>

                        <input
                          type="text"
                          value={
                            editForm.bank_name ??
                            ""
                          }
                          onChange={(
                            e
                          ) =>
                            handleEditFieldChange(
                              "bank_name",
                              e.target.value
                            )
                          }
                          className="w-full border border-slate-200 p-2.5 rounded-lg"
                        />

                      </div>

                      <div>

                        <label className="block font-bold text-slate-600 mb-1">
                          Account Number
                        </label>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            editForm.account_number ??
                            ""
                          }
                          onChange={(
                            e
                          ) =>
                            handleEditFieldChange(
                              "account_number",
                              e.target.value
                            )
                          }
                          className="w-full border border-slate-200 p-2.5 rounded-lg"
                        />

                      </div>

                      <div>

                        <label className="block font-bold text-slate-600 mb-1">
                          IFSC Code
                        </label>

                        <input
                          type="text"
                          value={
                            editForm.ifsc_code ??
                            ""
                          }
                          onChange={(
                            e
                          ) =>
                            handleEditFieldChange(
                              "ifsc_code",
                              e.target.value.toUpperCase()
                            )
                          }
                          className="w-full border border-slate-200 p-2.5 rounded-lg uppercase"
                        />

                      </div>

                    </div>

                  </div>

                </div>

                {/* FOOTER */}

                <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">

                  <button
                    onClick={() =>
                      setEditModalOpen(
                        false
                      )
                    }
                    disabled={
                      editSaving
                    }
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={
                      handleSaveEdit
                    }
                    disabled={
                      editSaving
                    }
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white inline-flex items-center gap-2"
                  >

                    {editSaving && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}

                    {editSaving
                      ? "Saving..."
                      : "Save Changes"}

                  </button>

                </div>

              </div>

            </div>
          )}

        {/* =====================================================
            CREATE PAYROLL MODAL
        ===================================================== */}

       {createModalOpen && (

  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">

    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">

      {/* HEADER */}

      <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">

        <div>

          <h3 className="text-base font-bold text-slate-900">
            Create Payroll Manually
          </h3>

          <p className="text-xs text-slate-500 mt-0.5">
            {formatSalaryMonth(salaryMonth)}
            {" • "}
            {getClientName({
              client_id: selectedClient,
            })}
          </p>

        </div>

        <button
          onClick={() =>
            setCreateModalOpen(false)
          }
          className="text-slate-400 hover:text-slate-700 text-xl font-bold"
        >
          ×
        </button>

      </div>

      <div className="p-6 space-y-6">

        {/* ERROR */}

        {createError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-xs">
            {createError}
          </div>
        )}

        {/* =====================================================
            EMPLOYEE SELECTION
        ===================================================== */}

        <div>

          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Employee Selection
          </h4>

          <label className="block font-bold text-slate-600 mb-1 text-xs">
            Select Employee / Deployment
          </label>

          <select
            value={selectedDeploymentId}
            onChange={(e) =>
              handleSelectEmployee(
                e.target.value
              )
            }
            disabled={
              employeeOptionsLoading
            }
            className="w-full border border-slate-200 p-3 rounded-xl bg-white font-medium text-slate-800"
          >

            <option value="">
              {employeeOptionsLoading
                ? "Loading employees..."
                : "Select an employee"}
            </option>

            {employeeOptions.map(
              (emp) => (
                <option
                  key={emp.deployment_id}
                  value={emp.deployment_id}
                >
                  {emp.employee_name}
                  {" — "}
                  {emp.project_name ||
                    "No project"}
                  {" (Deployment #"}
                  {emp.deployment_id}
                  {")"}
                </option>
              )
            )}

          </select>

        </div>

        {/* =====================================================
            PREFILL LOADING
        ===================================================== */}

        {prefillLoading && (

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3">

            <Loader2 className="h-4 w-4 animate-spin" />

            Loading employee salary and attendance...

          </div>

        )}

        {/* =====================================================
            PREFILL INFO
        ===================================================== */}

        {prefillInfo &&
          !prefillLoading && (

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">

              <h4 className="text-xs font-bold text-slate-700 mb-3">
                Auto-Filled Employee Information
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">

                <div>
                  <span className="text-slate-400 block">
                    Employee
                  </span>

                  <span className="font-bold text-slate-800">
                    {prefillInfo.employee_name ||
                      "Employee"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">
                    Pay Rate
                  </span>

                  <span className="font-bold text-slate-800">
                    ₹
                    {formatMoney(
                      prefillInfo.pay_rate
                    )}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">
                    Present Days
                  </span>

                  <span className="font-bold text-slate-800">
                    {prefillInfo.present_days ??
                      0}
                    {" / "}
                    {prefillInfo.total_days ??
                      getCalendarDaysInMonth(
                        salaryMonth
                      )}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">
                    LOP Days
                  </span>

                  <span className="font-bold text-rose-600">
                    {prefillInfo.lop_days ??
                      0}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block">
                    OT Hours
                  </span>

                  <span className="font-bold text-slate-800">
                    {prefillInfo.overtime_hours ??
                      0}
                  </span>
                </div>

              </div>

              <div className="mt-4 pt-3 border-t border-slate-200">

                <span className="text-slate-400 block text-[11px]">
                  Employee Email
                </span>

                <span className="font-bold text-slate-800 text-xs">
                  {prefillInfo.email || "-"}
                </span>

              </div>

              {prefillInfo.already_exists && (

                <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5 text-xs">

                  A payroll record already exists
                  for this employee for{" "}

                  <strong>
                    {formatSalaryMonth(
                      salaryMonth
                    )}
                  </strong>

                  {" Status: "}

                  <strong>
                    {prefillInfo.existing_payroll_status ||
                      "Unknown"}
                  </strong>

                </div>

              )}

            </div>
          )}

        {/* =====================================================
            MANUAL PAYROLL FIELDS
        ===================================================== */}

        {prefillInfo && (

          <>

            {/* =================================================
                EARNINGS
            ================================================= */}

            <div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Salary & Earnings
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">

                {[
                  [
                    "basic_salary",
                    "Basic Salary",
                  ],
                  [
                    "hra",
                    "HRA",
                  ],
                  [
                    "conveyance",
                    "Conveyance",
                  ],
                  [
                    "medical_allowance",
                    "Medical Allowance",
                  ],
                  [
                    "other_allowance",
                    "Other Allowance",
                  ],
                  [
                    "allowances",
                    "Other Allowances",
                  ],
                  [
                    "overtime",
                    "Overtime Amount",
                  ],
                  [
                    "bonus",
                    "Bonus",
                  ],
                ].map(
                  ([
                    field,
                    label,
                  ]) => (

                    <div
                      key={field}
                    >

                      <label className="block font-bold text-slate-600 mb-1">
                        {label}
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          createForm[field] ??
                          0
                        }
                        onChange={(e) =>
                          handleCreateFieldChange(
                            field,
                            e.target.value
                          )
                        }
                        className="w-full border border-slate-200 p-2.5 rounded-lg"
                      />

                    </div>

                  )
                )}

              </div>

            </div>

            {/* =================================================
                DEDUCTIONS
            ================================================= */}

            <div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Employee Deductions
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">

                {[
                  [
                    "pf",
                    "Employee PF",
                  ],
                  [
                    "esic",
                    "Employee ESIC",
                  ],
                  [
                    "tax",
                    "Tax / TDS",
                  ],
                  [
                    "professional_tax",
                    "Professional Tax",
                  ],
                  [
                    "lop",
                    "LOP Deduction",
                  ],
                ].map(
                  ([
                    field,
                    label,
                  ]) => (

                    <div
                      key={field}
                    >

                      <label className="block font-bold text-slate-600 mb-1">
                        {label}
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          createForm[field] ??
                          0
                        }
                        onChange={(e) =>
                          handleCreateFieldChange(
                            field,
                            e.target.value
                          )
                        }
                        className="w-full border border-slate-200 p-2.5 rounded-lg"
                      />

                    </div>

                  )
                )}

              </div>

            </div>

            {/* =================================================
                EMPLOYER CONTRIBUTIONS
            ================================================= */}

            <div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Employer Contributions
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">

                {[
                  [
                    "employer_pf",
                    "Employer PF",
                  ],
                  [
                    "employer_esic",
                    "Employer ESIC",
                  ],
                  [
                    "gratuity",
                    "Gratuity",
                  ],
                ].map(
                  ([
                    field,
                    label,
                  ]) => (

                    <div
                      key={field}
                    >

                      <label className="block font-bold text-slate-600 mb-1">
                        {label}
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          createForm[field] ??
                          0
                        }
                        onChange={(e) =>
                          handleCreateFieldChange(
                            field,
                            e.target.value
                          )
                        }
                        className="w-full border border-slate-200 p-2.5 rounded-lg"
                      />

                    </div>

                  )
                )}

              </div>

            </div>

            {/* =================================================
                PF INFORMATION
            ================================================= */}

            <div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                PF Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">

                <div>

                  <label className="block font-bold text-slate-600 mb-1">
                    PF Wages
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      createForm.pf_wages ??
                      0
                    }
                    onChange={(e) =>
                      handleCreateFieldChange(
                        "pf_wages",
                        e.target.value
                      )
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-lg"
                  />

                </div>

              </div>

            </div>

            {/* =================================================
                BANK DETAILS
            ================================================= */}

            <div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Bank Details
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">

                <div>

                  <label className="block font-bold text-slate-600 mb-1">
                    Bank Name
                  </label>

                  <input
                    type="text"
                    value={
                      createForm.bank_name ??
                      ""
                    }
                    onChange={(e) =>
                      handleCreateFieldChange(
                        "bank_name",
                        e.target.value
                      )
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-lg"
                  />

                </div>

                <div>

                  <label className="block font-bold text-slate-600 mb-1">
                    Account Number
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      createForm.account_number ??
                      ""
                    }
                    onChange={(e) =>
                      handleCreateFieldChange(
                        "account_number",
                        e.target.value
                      )
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-lg"
                  />

                </div>

                <div>

                  <label className="block font-bold text-slate-600 mb-1">
                    IFSC Code
                  </label>

                  <input
                    type="text"
                    value={
                      createForm.ifsc_code ??
                      ""
                    }
                    onChange={(e) =>
                      handleCreateFieldChange(
                        "ifsc_code",
                        e.target.value.toUpperCase()
                      )
                    }
                    className="w-full border border-slate-200 p-2.5 rounded-lg uppercase"
                  />

                </div>

              </div>

            </div>

          </>
        )}


              </div>

              {/* FOOTER */}

              <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">

                <button
                  onClick={() =>
                    setCreateModalOpen(
                      false
                    )
                  }
                  disabled={
                    createSaving
                  }
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  onClick={
                    handleCreatePayroll
                  }
                  disabled={
                    createSaving ||
                    !prefillInfo ||
                    prefillInfo?.already_exists
                  }
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white inline-flex items-center gap-2"
                >

                  {createSaving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {createSaving
                    ? "Creating..."
                    : "Create Payroll"}

                </button>

              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}