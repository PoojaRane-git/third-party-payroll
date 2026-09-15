import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Download,
  Mail,
  ShieldAlert,
  Loader2,
  Plus,
  RefreshCw,
  CheckCircle,
  Calculator,
  Users,
  IndianRupee,
  Eye,
  FilePlus2,
  Clock,
  Receipt,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api";

const DEFAULT_GST_TYPE =
  "Intra-State (CGST+SGST)";

const DEFAULT_PAYMENT_MODE =
  "NEFT/RTGS";

// ============================================================
// HELPERS
// ============================================================

const getCurrentBillingMonth = () => {
  const now = new Date();

  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
};

const getDateOnly = (value) => {
  if (!value) return null;

  return String(value)
    .split("T")[0]
    .split(" ")[0];
};

const getTodayDateOnly = () => {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatDate = (value) => {
  const dateOnly = getDateOnly(value);

  if (!dateOnly) {
    return "N/A";
  }

  const date = new Date(
    `${dateOnly}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return dateOnly;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (value) => {
  return Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
};

const getNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

// ============================================================
// NORMALIZE BILLING EMPLOYEE
// ============================================================

const normalizeBillingEmployee = (
  employee
) => {
  const billRate = getNumber(
    employee.bill_rate ??
    employee.billRate ??
    employee.billing_rate ??
    employee.rate
  );

  const employerStatutory =
    getNumber(
      employee.employer_statutory ??
      employee.employer_contribution ??
      employee.employer_statutory_amount ??
      employee.total_employer_contribution
    );

  const otHours = getNumber(
    employee.ot_hours ??
    employee.overtime_hours
  );

  const otAmount = getNumber(
    employee.ot_amount ??
    employee.overtime_amount ??
    employee.overtime_pay ??
    employee.overtime
  );

  const lopDays = getNumber(
    employee.lop_days ??
    employee.loss_of_pay_days
  );

  const lopDeduction = getNumber(
    employee.lop_deduction ??
    employee.lop_amount ??
    employee.loss_of_pay_amount ??
    employee.lop
  );

  const serviceCharge = getNumber(
    employee.service_charge ??
    employee.service_charge_amount ??
    employee.markup_amount ??
    employee.markup
  );

  return {
    ...employee,

    id:
      employee.id ??
      employee.payroll_id ??
      employee.employee_id,

    employee_id:
      employee.employee_id ??
      employee.emp_id ??
      employee.employee_ref_id,

    employee_name:
      employee.employee_name ??
      employee.name ??
      employee.full_name ??
      "Unknown Employee",

    // ========================================================
    // CLIENT BILLING
    // ========================================================

    bill_rate: billRate,

    employer_statutory:
      employerStatutory,

    ot_hours:
      otHours,

    ot_amount:
      otAmount,

    lop_days:
      lopDays,

    lop_deduction:
      lopDeduction,

    service_charge:
      serviceCharge,

    // ========================================================
    // OTHER DATA
    // ========================================================

    payroll_id:
      employee.payroll_id ??
      employee.payroll_record_id ??
      employee.id ??
      null,

    deployment_id:
      employee.deployment_id ??
      null,

    contract_id:
      employee.contract_id ??
      null,

    billing_model:
      employee.billing_model ??
      employee.billingModel ??
      null,

    markup_percentage:
      getNumber(
        employee.markup_percentage
      ),

    per_head_fee:
      getNumber(
        employee.per_head_fee
      ),

    // ========================================================
    // ATTENDANCE DATA
    // Kept only for informational display.
    // Never used as money values.
    // ========================================================

    present_days:
      getNumber(
        employee.present_days
      ),

    absent_days:
      getNumber(
        employee.absent_days
      ),

    leave_days:
      getNumber(
        employee.leave_days
      ),

    half_days:
      getNumber(
        employee.half_days
      ),

    payable_days:
      getNumber(
        employee.payable_days
      ),
  };
};

// ============================================================
// NORMALIZE INVOICE
// ============================================================

const normalizeInvoice = (
  invoice
) => {
  const clientName =
    invoice.clients?.company_name ||
    invoice.client_name ||
    "Unknown Client";

  const clientId =
    invoice.client_id ??
    invoice.clients?.id ??
    null;

  const totalReceived =
    getNumber(
      invoice.total_received ??
      invoice.amount_received
    );

  const tds =
    getNumber(
      invoice.tds_deducted
    );

  const amountSettled =
    getNumber(
      invoice.amount_settled ??
      totalReceived + tds
    );

  const totalAmount =
    getNumber(
      invoice.total_amount
    );

  const balance = Math.max(
    0,
    getNumber(
      invoice.balance_remaining ??
      totalAmount - amountSettled
    )
  );

  const dueDate =
    getDateOnly(
      invoice.due_date
    );

  const today =
    getTodayDateOnly();

  let paymentStatus =
    invoice.payment_status;

  const validStatuses = [
    "Pending",
    "Partially Paid",
    "Paid",
    "Overdue",
  ];

  if (
    !validStatuses.includes(
      paymentStatus
    )
  ) {
    if (
      balance <= 0 &&
      totalAmount > 0
    ) {
      paymentStatus = "Paid";
    } else if (
      dueDate &&
      today > dueDate
    ) {
      paymentStatus = "Overdue";
    } else if (
      amountSettled > 0
    ) {
      paymentStatus =
        "Partially Paid";
    } else {
      paymentStatus =
        "Pending";
    }
  }

  return {
    ...invoice,

    id: invoice.id,

    invoice_number:
      invoice.invoice_number ||
      `INV-${invoice.id}`,

    client_id:
      clientId !== null
        ? Number(clientId)
        : null,

    client_name:
      clientName,

    employee_count:
      getNumber(
        invoice.employee_count ??
        invoice.deployed_headcount
      ),

    // ========================================================
    // CLIENT BILLING RATE
    // ========================================================

    total_bill_rate:
      getNumber(
        invoice.total_bill_rate ??
        invoice.total_billRate ??
        invoice.bill_rate ??
        0
      ),

    // ========================================================
    // INTERNAL PAY RATE
    //
    // Kept only for backward compatibility with API data.
    // It is NOT displayed in the client UI.
    // ========================================================

    total_pay_rate:
      getNumber(
        invoice.total_pay_rate ??
        invoice.salary_cost
      ),

    employer_statutory:
      getNumber(
        invoice.employer_statutory
      ),

    service_charge:
      getNumber(
        invoice.service_charge ??
        invoice.service_charge_amount
      ),

    gross_margin:
      getNumber(
        invoice.gross_margin ??
        invoice.service_charge
      ),

    subtotal:
      getNumber(
        invoice.subtotal
      ),

    cgst:
      getNumber(
        invoice.cgst
      ),

    sgst:
      getNumber(
        invoice.sgst
      ),

    igst:
      getNumber(
        invoice.igst
      ),

    total_amount:
      totalAmount,

    payment_status:
      paymentStatus,

    total_received:
      totalReceived,

    tds_deducted:
      tds,

    amount_settled:
      amountSettled,

    balance_remaining:
      balance,

    lifecycle_state:
      invoice.lifecycle_state ||
      "Draft",

    gst_type:
      invoice.gst_type ||
      DEFAULT_GST_TYPE,

    contract_id:
      invoice.contract_id ??
      null,

    contract_number:
      invoice.contract_number ??
      null,

    contract_title:
      invoice.contract_title ??
      null,

    billing_model:
      invoice.billing_model ||
      "Contract Based",

    markup_percentage:
      getNumber(
        invoice.markup_percentage
      ),

    per_head_fee:
      getNumber(
        invoice.per_head_fee
      ),

    credit_terms:
      invoice.credit_terms ??
      null,
  };
};

// ============================================================
// COMPONENT
// ============================================================

export default function ClientBilling({
  activeTab,
  setActiveTab,
}) {
  // ==========================================================
  // INTERNAL BILLING TAB
  // ==========================================================

  const [
    billingTab,
    setBillingTab,
  ] = useState("new");

  // ==========================================================
  // STATE
  // ==========================================================

  const [clients, setClients] =
    useState([]);

  const [invoices, setInvoices] =
    useState([]);

  const [employees, setEmployees] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    employeesLoading,
    setEmployeesLoading,
  ] = useState(false);

  const [
    generating,
    setGenerating,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    sendingAlert,
    setSendingAlert,
  ] = useState(false);

  const [
    recordingPayment,
    setRecordingPayment,
  ] = useState(false);

  const [
    paymentsLoading,
    setPaymentsLoading,
  ] = useState(false);

  const [error, setError] =
    useState(null);

  const [
    selectedInvoice,
    setSelectedInvoice,
  ] = useState(null);

  const [payments, setPayments] =
    useState([]);

  // ==========================================================
  // BILLING FORM
  // ==========================================================

  const [form, setForm] = useState({
    client_id: "",
    client_name: "",
    billing_month:
      getCurrentBillingMonth(),
    gst_type:
      DEFAULT_GST_TYPE,
  });

  // ==========================================================
  // PAYMENT FORM
  // ==========================================================

  const [
    paymentForm,
    setPaymentForm,
  ] = useState({
    amount_received: "",
    tds_deducted: "",
    payment_date: "",
    payment_mode:
      DEFAULT_PAYMENT_MODE,
    reference_number: "",
  });

  // ==========================================================
  // AUTH HEADERS
  // ==========================================================

  const getAuthHeaders = () => {
    const token =
      sessionStorage.getItem("token");

    return {
      "Content-Type":
        "application/json",

      ...(token
        ? {
          Authorization:
            `Bearer ${token}`,
        }
        : {}),
    };
  };

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData =
    async () => {
      try {
        setLoading(true);
        setError(null);

        await Promise.all([
          fetchClients(),
          fetchInvoices(),
        ]);
      } catch (err) {
        console.error(
          "INITIAL BILLING LOAD ERROR:",
          err
        );

        setError(
          err.message ||
          "Failed to load client billing data."
        );
      } finally {
        setLoading(false);
      }
    };

  // ==========================================================
  // FETCH CLIENTS
  // ==========================================================

  const fetchClients =
    async () => {
      const response =
        await fetch(
          `${API_BASE}/clients`,
          {
            headers:
              getAuthHeaders(),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.message ||
          json.error ||
          `HTTP ${response.status}`
        );
      }

      const records =
        Array.isArray(json)
          ? json
          : Array.isArray(
            json.data
          )
            ? json.data
            : Array.isArray(
              json.clients
            )
              ? json.clients
              : [];

      setClients(records);

      return records;
    };

  // ==========================================================
  // FETCH BILLING EMPLOYEES
  // ==========================================================

  const fetchBillingEmployees =
    async (
      clientId = form.client_id,
      billingMonth =
        form.billing_month
    ) => {
      if (
        !clientId ||
        !billingMonth
      ) {
        setEmployees([]);
        return [];
      }

      try {
        setEmployeesLoading(
          true
        );

        setError(null);

        const url =
          `${API_BASE}/clients/${clientId}/billing-employees` +
          `?month=${encodeURIComponent(
            billingMonth
          )}`;

        console.log(
          "FETCH BILLING EMPLOYEES:",
          url
        );

        const response =
          await fetch(url, {
            headers:
              getAuthHeaders(),
          });

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.message ||
            json.error ||
            `HTTP ${response.status}`
          );
        }

        const records =
          Array.isArray(json)
            ? json
            : Array.isArray(
              json.data
            )
              ? json.data
              : Array.isArray(
                json.employees
              )
                ? json.employees
                : [];

        console.log(
          "RAW BILLING EMPLOYEES:",
          records
        );

        const normalized =
          records.map(
            normalizeBillingEmployee
          );

        console.log(
          "NORMALIZED BILLING EMPLOYEES:",
          normalized
        );

        setEmployees(
          normalized
        );

        return normalized;
      } catch (err) {
        console.error(
          "FETCH BILLING EMPLOYEES ERROR:",
          err
        );

        setEmployees([]);

        setError(
          err.message ||
          "Failed to fetch employee payroll data."
        );

        return [];
      } finally {
        setEmployeesLoading(
          false
        );
      }
    };

  // ==========================================================
  // AUTO FETCH CLIENT / MONTH
  // ==========================================================

  useEffect(() => {
    if (
      form.client_id &&
      form.billing_month
    ) {
      fetchBillingEmployees(
        form.client_id,
        form.billing_month
      );
    } else {
      setEmployees([]);
    }
  }, [
    form.client_id,
    form.billing_month,
  ]);

  // ==========================================================
  // CLIENT CHANGE
  // ==========================================================

  const handleClientChange =
    (event) => {
      const value =
        event.target.value;

      if (!value) {
        setForm(
          (previous) => ({
            ...previous,
            client_id: "",
            client_name: "",
          })
        );

        setEmployees([]);

        return;
      }

      const clientId =
        Number(value);

      const selectedClient =
        clients.find(
          (client) =>
            Number(client.id) ===
            clientId
        );

      setForm(
        (previous) => ({
          ...previous,

          client_id:
            clientId,

          client_name:
            selectedClient?.company_name ||
            "",
        })
      );
    };

  // ==========================================================
  // CALCULATE EMPLOYEE
  //
  // Employee Cost =
  // Bill Rate
  // + Employer Statutory
  // + OT
  // - LOP
  //
  // Client Bill =
  // Employee Cost
  // + Service Charge
  // ==========================================================
  const calculateEmployee = (employee) => {
    const billRate = getNumber(employee.bill_rate);
    const employerStatutory = getNumber(
      employee.employer_statutory
    );
    const otAmount = getNumber(
      employee.ot_amount
    );
    const lopDeduction = getNumber(
      employee.lop_deduction
    );
    const serviceCharge = getNumber(
      employee.service_charge
    );

    const employeeCost =
      billRate +
      employerStatutory +
      otAmount -
      lopDeduction;

    const billAmount =
      employeeCost +
      serviceCharge;

    return {
      employeeCost: Math.max(0, employeeCost),
      billAmount: Math.max(0, billAmount),
    };
  };

  // ==========================================================
  // BILLING TOTALS
  // ==========================================================

  const employeeTotals =
    useMemo(() => {
      let billRate = 0;
      let statutory = 0;
      let otAmount = 0;
      let lopDeduction = 0;
      let serviceCharge = 0;
      let employeeCost = 0;
      let subtotal = 0;

      employees.forEach(
        (employee) => {
          const calculated =
            calculateEmployee(
              employee
            );

          billRate +=
            getNumber(
              employee.bill_rate
            );

          statutory +=
            getNumber(
              employee.employer_statutory
            );

          otAmount +=
            getNumber(
              employee.ot_amount
            );

          lopDeduction +=
            getNumber(
              employee.lop_deduction
            );

          serviceCharge +=
            getNumber(
              employee.service_charge
            );

          employeeCost +=
            calculated.employeeCost;

          subtotal +=
            calculated.billAmount;
        }
      );

      const gstRate = 18;

      const gst =
        subtotal *
        (gstRate / 100);

      const intraState =
        form.gst_type.includes(
          "Intra-State"
        );

      const cgst =
        intraState
          ? gst / 2
          : 0;

      const sgst =
        intraState
          ? gst / 2
          : 0;

      const igst =
        intraState
          ? 0
          : gst;

      const total =
        subtotal +
        cgst +
        sgst +
        igst;

      return {
        employeeCount:
          employees.length,

        billRate,

        statutory,

        otAmount,

        lopDeduction,

        serviceCharge,

        employeeCost,

        subtotal,

        gst,

        cgst,

        sgst,

        igst,

        total,
      };
    }, [
      employees,
      form.gst_type,
    ]);

  // ==========================================================
  // FETCH INVOICES
  // ==========================================================

  const fetchInvoices =
    async () => {
      try {
        const response =
          await fetch(
            `${API_BASE}/client-billing/invoices`,
            {
              headers:
                getAuthHeaders(),
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.message ||
            json.error ||
            `HTTP ${response.status}`
          );
        }

        const records =
          Array.isArray(
            json.data
          )
            ? json.data
            : Array.isArray(json)
              ? json
              : [];

        const normalized =
          records.map(
            normalizeInvoice
          );

        setInvoices(
          normalized
        );

        setSelectedInvoice(
          (current) => {
            if (
              !normalized.length
            ) {
              return null;
            }

            if (current?.id) {
              const updated =
                normalized.find(
                  (invoice) =>
                    Number(
                      invoice.id
                    ) ===
                    Number(
                      current.id
                    )
                );

              if (updated) {
                return updated;
              }
            }

            return normalized[0];
          }
        );

        return normalized;
      } catch (err) {
        console.error(
          "FETCH INVOICES ERROR:",
          err
        );

        setInvoices([]);
        setSelectedInvoice(
          null
        );

        throw err;
      }
    };

  // ==========================================================
  // GENERATE CLIENT INVOICE
  // ==========================================================

  const handleGenerateInvoice =
    async () => {
      if (!form.client_id) {
        alert(
          "Please select a client."
        );
        return;
      }

      if (!form.billing_month) {
        alert(
          "Please select a billing month."
        );
        return;
      }

      if (
        !employees.length
      ) {
        alert(
          "No attendance billing records were found for this client and month."
        );
        return;
      }

      try {
        setGenerating(true);
        setError(null);

        const requestData = {
          client_id:
            Number(
              form.client_id
            ),

          billing_month:
            form.billing_month,

          gst_type:
            form.gst_type,
        };

        console.log(
          "GENERATING CLIENT INVOICE:",
          requestData
        );

        const response =
          await fetch(
            `${API_BASE}/client-billing`,
            {
              method: "POST",

              headers:
                getAuthHeaders(),

              body:
                JSON.stringify(
                  requestData
                ),
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.message ||
            json.error ||
            "Failed to generate client invoice."
          );
        }

        await fetchInvoices();

        alert(
          `Client invoice generated successfully for ${form.client_name}.`
        );

        setBillingTab(
          "generated"
        );

        setEmployees([]);
      } catch (err) {
        console.error(
          "GENERATE CLIENT BILLING ERROR:",
          err
        );

        setError(
          err.message ||
          "Error generating client invoice."
        );

        alert(
          err.message ||
          "Error generating client invoice."
        );
      } finally {
        setGenerating(
          false
        );
      }
    };

  // ==========================================================
  // GENERATE NEW BILLING TAB
  // ==========================================================

  const handleGenerateNewBilling =
    () => {
      setSelectedInvoice(
        null
      );

      setPayments([]);

      setError(null);

      setForm({
        client_id: "",
        client_name: "",
        billing_month:
          getCurrentBillingMonth(),
        gst_type:
          DEFAULT_GST_TYPE,
      });

      setEmployees([]);

      setBillingTab("new");
    };

  // ==========================================================
  // VIEW GENERATED BILLING TAB
  // ==========================================================

  const handleViewBilling =
    () => {
      setBillingTab(
        "generated"
      );

      if (
        !selectedInvoice &&
        invoices.length
      ) {
        setSelectedInvoice(
          invoices[0]
        );
      }
    };

  // ==========================================================
  // VIEW PENDING BILLING TAB
  // ==========================================================

  const handleShowPendingBilling =
    () => {
      setBillingTab(
        "pending"
      );

      const pendingInvoices =
        invoices.filter(
          (invoice) =>
            getNumber(
              invoice.balance_remaining
            ) > 0 &&
            invoice.payment_status !==
            "Paid"
        );

      if (
        pendingInvoices.length
      ) {
        const selectedStillPending =
          pendingInvoices.find(
            (invoice) =>
              Number(
                invoice.id
              ) ===
              Number(
                selectedInvoice?.id
              )
          );

        setSelectedInvoice(
          selectedStillPending ||
          pendingInvoices[0]
        );
      } else {
        setSelectedInvoice(
          null
        );
      }
    };

  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh =
    async () => {
      try {
        setRefreshing(
          true
        );

        setError(null);

        await Promise.all([
          fetchClients(),
          fetchInvoices(),
        ]);

        if (
          form.client_id &&
          form.billing_month
        ) {
          await fetchBillingEmployees(
            form.client_id,
            form.billing_month
          );
        }
      } catch (err) {
        setError(
          err.message ||
          "Failed to refresh billing data."
        );
      } finally {
        setRefreshing(
          false
        );
      }
    };

  // ==========================================================
  // PAYMENT STATUS STYLE
  // ==========================================================

  const getPaymentStatusClasses =
    (status) => {
      switch (status) {
        case "Paid":
          return {
            badge:
              "bg-emerald-50 text-emerald-700 border border-emerald-200",
          };

        case "Overdue":
          return {
            badge:
              "bg-red-50 text-red-700 border border-red-200",
          };

        case "Partially Paid":
          return {
            badge:
              "bg-orange-50 text-orange-700 border border-orange-200",
          };

        default:
          return {
            badge:
              "bg-amber-50 text-amber-700 border border-amber-200",
          };
      }
    };

  // ==========================================================
  // UPDATE LIFECYCLE
  // ==========================================================

  const handleUpdateLifecycleState =
    async (
      id,
      newState
    ) => {
      const allowedStates = [
        "Draft",
        "Pro-Forma Sent",
        "Tax Invoice Dispatched",
      ];

      if (
        !allowedStates.includes(
          newState
        )
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_BASE}/client-billing/${id}/status`,
            {
              method: "PATCH",

              headers:
                getAuthHeaders(),

              body:
                JSON.stringify({
                  lifecycle_state:
                    newState,
                }),
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.message ||
            json.error ||
            "Failed to update lifecycle."
          );
        }

        await fetchInvoices();
      } catch (err) {
        alert(
          err.message ||
          "Failed to update lifecycle."
        );
      }
    };

  // ==========================================================
  // FETCH PAYMENTS
  // ==========================================================

  const fetchPaymentsForInvoice =
    async (
      invoiceId
    ) => {
      if (!invoiceId) {
        setPayments([]);
        return;
      }

      try {
        setPaymentsLoading(
          true
        );

        const response =
          await fetch(
            `${API_BASE}/invoices/${invoiceId}/payments`,
            {
              headers:
                getAuthHeaders(),
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.message ||
            json.error ||
            "Failed to load payments."
          );
        }

        const records =
          Array.isArray(
            json.payments
          )
            ? json.payments
            : Array.isArray(
              json.data
            )
              ? json.data
              : [];

        setPayments(
          records
        );
      } catch (err) {
        console.error(
          "PAYMENT HISTORY ERROR:",
          err
        );

        setPayments([]);
      } finally {
        setPaymentsLoading(
          false
        );
      }
    };

  useEffect(() => {
    if (
      selectedInvoice?.id
    ) {
      fetchPaymentsForInvoice(
        selectedInvoice.id
      );
    } else {
      setPayments([]);
    }
  }, [
    selectedInvoice?.id,
  ]);

  // ==========================================================
  // RECORD PAYMENT
  // ==========================================================

  const handleRecordPayment =
    async (event) => {
      event.preventDefault();

      if (!selectedInvoice) {
        alert(
          "No invoice selected."
        );
        return;
      }

      const amount =
        getNumber(
          paymentForm.amount_received
        );

      const tds =
        getNumber(
          paymentForm.tds_deducted
        );

      if (amount <= 0) {
        alert(
          "Enter a valid payment amount."
        );
        return;
      }

      if (
        !paymentForm.payment_date
      ) {
        alert(
          "Please select a payment date."
        );
        return;
      }

      if (
        amount >
        Number(
          selectedInvoice.balance_remaining ||
          0
        )
      ) {
        alert(
          "Payment amount cannot be greater than the pending invoice balance."
        );
        return;
      }

      if (tds < 0) {
        alert(
          "TDS cannot be negative."
        );
        return;
      }

      try {
        setRecordingPayment(
          true
        );

        const response =
          await fetch(
            `${API_BASE}/invoices/${selectedInvoice.id}/payments`,
            {
              method: "POST",

              headers:
                getAuthHeaders(),

              body:
                JSON.stringify({
                  amount_received:
                    amount,

                  tds_deducted:
                    tds,

                  payment_date:
                    paymentForm.payment_date,

                  payment_mode:
                    paymentForm.payment_mode,

                  reference_number:
                    paymentForm.reference_number ||
                    null,
                }),
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.message ||
            json.error ||
            "Failed to record payment."
          );
        }

        const refreshedInvoices =
          await fetchInvoices();

        const updatedInvoice =
          refreshedInvoices.find(
            (invoice) =>
              Number(
                invoice.id
              ) ===
              Number(
                selectedInvoice.id
              )
          );

        if (updatedInvoice) {
          setSelectedInvoice(
            updatedInvoice
          );
        }

        await fetchPaymentsForInvoice(
          selectedInvoice.id
        );

        setPaymentForm({
          amount_received:
            "",

          tds_deducted:
            "",

          payment_date:
            "",

          payment_mode:
            DEFAULT_PAYMENT_MODE,

          reference_number:
            "",
        });

        alert(
          "Payment recorded successfully."
        );
      } catch (err) {
        alert(
          err.message ||
          "Failed to record payment."
        );
      } finally {
        setRecordingPayment(
          false
        );
      }
    };

  // ==========================================================
  // PAYMENT REMINDER
  // ==========================================================

  const handleSendPaymentAlert =
    async () => {
      if (!selectedInvoice?.id) {
        alert(
          "Please select an invoice first."
        );
        return;
      }

      if (
        selectedInvoice.payment_status ===
        "Paid"
      ) {
        alert(
          "This invoice is already paid."
        );
        return;
      }

      try {
        setSendingAlert(
          true
        );

        const response =
          await fetch(
            `${API_BASE}/client-billing/${selectedInvoice.id}/payment-alert`,
            {
              method: "POST",

              headers:
                getAuthHeaders(),
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.message ||
            json.error ||
            "Failed to send reminder."
          );
        }

        alert(
          "Payment reminder sent successfully."
        );
      } catch (err) {
        alert(
          err.message ||
          "Failed to send payment reminder."
        );
      } finally {
        setSendingAlert(
          false
        );
      }
    };

  // ==========================================================
  // EXPORT CSV
  // ==========================================================

  const handleExportCSV =
    () => {
      if (!invoices.length) {
        alert(
          "No billing records available."
        );
        return;
      }

      const header =
        "Invoice Number,Client Name,Billing Month,Employees,Bill Rate,Employer Statutory,Service Charge,Gross Margin,GST,Total Amount,Received,TDS,Pending,Lifecycle,Payment Status,Due Date\n";

      const rows =
        invoices
          .map((invoice) => {
            const gst =
              getNumber(
                invoice.cgst
              ) +
              getNumber(
                invoice.sgst
              ) +
              getNumber(
                invoice.igst
              );

            return [
              invoice.invoice_number,

              invoice.client_name,

              invoice.billing_month,

              invoice.employee_count,

              invoice.total_bill_rate,

              invoice.employer_statutory,

              invoice.service_charge,

              invoice.gross_margin,

              gst,

              invoice.total_amount,

              invoice.total_received,

              invoice.tds_deducted,

              invoice.balance_remaining,

              invoice.lifecycle_state,

              invoice.payment_status,

              invoice.due_date ||
              "",
            ]
              .map(
                (value) =>
                  `"${String(
                    value ?? ""
                  ).replace(
                    /"/g,
                    '""'
                  )}"`
              )
              .join(",");
          })
          .join("\n");

      const blob =
        new Blob(
          [header + rows],
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
        "B2B_Client_Billing_Report.csv";

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

  // ==========================================================
  // PENDING INVOICES
  // ==========================================================

  const pendingInvoices =
    useMemo(() => {
      return invoices.filter(
        (invoice) =>
          getNumber(
            invoice.balance_remaining
          ) > 0 &&
          invoice.payment_status !==
          "Paid"
      );
    }, [invoices]);

  // ==========================================================
  // DISPLAY INVOICES
  // ==========================================================

  const displayedInvoices =
    billingTab === "pending"
      ? pendingInvoices
      : invoices;

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">

        <Sidebar
          activeTab={activeTab}
          setActiveTab={
            setActiveTab
          }
        />

        <div className="flex-1 flex items-center justify-center">

          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">

            <Loader2 className="h-5 w-5 animate-spin" />

            Loading client billing...

          </div>

        </div>

      </div>
    );
  }

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <div className="flex min-h-screen bg-slate-50">

      <Sidebar
        activeTab={activeTab}
        setActiveTab={
          setActiveTab
        }
      />

      <main className="flex-1 p-8 space-y-6 overflow-y-auto">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="flex flex-col xl:flex-row justify-between gap-4">

          <div>

            <h1 className="text-2xl font-bold text-slate-900">
              Client Billing & Contract Operations
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Review processed employee payroll,
              apply contract billing rules and
              manage client invoices.
            </p>

          </div>

          <div className="flex flex-wrap gap-2">

            {/* PENDING BILLING */}

            <button
              type="button"
              onClick={
                handleShowPendingBilling
              }
              className={`px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 border ${billingTab === "pending"
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
                }`}
            >

              <Clock className="h-4 w-4" />

              Pending Billing

              <span className="bg-white/80 text-orange-700 px-2 py-0.5 rounded-full text-[10px]">
                {pendingInvoices.length}
              </span>

            </button>

            {/* GENERATED BILLING */}

            <button
              type="button"
              onClick={
                handleViewBilling
              }
              className={`px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 border ${billingTab === "generated"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white border-slate-200 hover:bg-slate-50"
                }`}
            >

              <Eye className="h-4 w-4" />

              View Billing

              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
                {invoices.length}
              </span>

            </button>

            {/* NEW BILLING */}

            <button
              type="button"
              onClick={
                handleGenerateNewBilling
              }
              className={`px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 ${billingTab === "new"
                ? "bg-indigo-600 text-white"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
            >

              <FilePlus2 className="h-4 w-4" />

              Generate New Client Billing

            </button>

            {/* REFRESH */}

            <button
              type="button"
              onClick={
                handleRefresh
              }
              disabled={
                refreshing
              }
              className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 hover:bg-slate-50"
            >

              <RefreshCw
                className={
                  refreshing
                    ? "h-4 w-4 animate-spin"
                    : "h-4 w-4"
                }
              />

              Refresh

            </button>

            {/* EXPORT */}

            <button
              type="button"
              onClick={
                handleExportCSV
              }
              className="bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2"
            >

              <Download className="h-4 w-4" />

              Export Billing CSV

            </button>

          </div>

        </div>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex gap-2">

            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />

            <span>
              {error}
            </span>

          </div>
        )}

        {/* ====================================================
            INTERNAL BILLING TABS
        ==================================================== */}

        <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm flex gap-2">

          <button
            type="button"
            onClick={() =>
              setBillingTab("new")
            }
            className={`flex-1 py-3 rounded-xl text-xs font-bold ${billingTab === "new"
              ? "bg-indigo-600 text-white"
              : "text-slate-500 hover:bg-slate-50"
              }`}
          >

            <span className="inline-flex items-center gap-2">

              <FilePlus2 className="h-4 w-4" />

              Generate New Billing

            </span>

          </button>

          <button
            type="button"
            onClick={() =>
              setBillingTab(
                "generated"
              )
            }
            className={`flex-1 py-3 rounded-xl text-xs font-bold ${billingTab === "generated"
              ? "bg-indigo-600 text-white"
              : "text-slate-500 hover:bg-slate-50"
              }`}
          >

            <span className="inline-flex items-center gap-2">

              <Receipt className="h-4 w-4" />

              Generated Billing

              <span>
                ({invoices.length})
              </span>

            </span>

          </button>

          <button
            type="button"
            onClick={
              handleShowPendingBilling
            }
            className={`flex-1 py-3 rounded-xl text-xs font-bold ${billingTab === "pending"
              ? "bg-orange-600 text-white"
              : "text-slate-500 hover:bg-slate-50"
              }`}
          >

            <span className="inline-flex items-center gap-2">

              <Clock className="h-4 w-4" />

              Pending Billing

              <span>
                ({pendingInvoices.length})
              </span>

            </span>

          </button>

        </div>

        {/* ====================================================
            NEW BILLING TAB
        ==================================================== */}

        {billingTab === "new" && (
          <>

            {/* BILLING SETUP */}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

              <div className="flex items-center gap-2 mb-5">

                <Users className="h-5 w-5 text-slate-700" />

                <div>

                  <h2 className="text-sm font-bold text-slate-900">
                    Client Billing Setup
                  </h2>

                  <p className="text-xs text-slate-400">
                    Select client, billing month and GST
                    type. Employee payroll is fetched
                    automatically.
                  </p>

                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* CLIENT */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Client
                  </label>

                  <select
                    value={
                      form.client_id
                    }
                    onChange={
                      handleClientChange
                    }
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium"
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
                            client.company_name
                          }
                        </option>
                      )
                    )}

                  </select>

                </div>

                {/* MONTH */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Billing Month
                  </label>

                  <input
                    type="month"
                    value={
                      form.billing_month
                    }
                    onChange={(event) =>
                      setForm(
                        (previous) => ({
                          ...previous,

                          billing_month:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs"
                  />

                </div>

                {/* GST */}

                <div>

                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    GST Type
                  </label>

                  <select
                    value={
                      form.gst_type
                    }
                    onChange={(event) =>
                      setForm(
                        (previous) => ({
                          ...previous,

                          gst_type:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs"
                  >

                    <option>
                      Intra-State (CGST+SGST)
                    </option>

                    <option>
                      Inter-State (IGST)
                    </option>

                  </select>

                </div>

              </div>

            </div>

            {/* EMPLOYEE PAYROLL */}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

              <div className="p-6 border-b border-slate-200">

                <div className="flex items-center gap-2">

                  <Calculator className="h-5 w-5 text-slate-700" />

                  <h2 className="text-sm font-bold text-slate-900">
                    Employee Payroll & Billing
                  </h2>

                </div>

                <p className="text-xs text-slate-400 mt-1">
                  Values come from employee attendance
                  and signed client contract billing rules.
                  Nothing is manually entered here.
                </p>

              </div>

              {employeesLoading ? (

                <div className="p-10 text-center">

                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />

                  <p className="text-xs font-semibold text-slate-500 mt-3">
                    Loading employee payroll...
                  </p>

                </div>

              ) : !form.client_id ? (

                <div className="p-10 text-center">

                  <Users className="h-8 w-8 mx-auto text-slate-300" />

                  <p className="text-sm font-bold text-slate-500 mt-3">
                    Select a client
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    Processed payroll employees
                    will appear automatically.
                  </p>

                </div>

              ) : employees.length ===
                0 ? (

                <div className="p-10 text-center">

                  <Users className="h-8 w-8 mx-auto text-slate-300" />

                  <p className="text-sm font-bold text-slate-500 mt-3">
                    No processed payroll records found
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    No attendance billing data was found
                    for{" "}
                    <b>
                      {form.billing_month}
                    </b>
                    .
                  </p>

                </div>

              ) : (

                <div className="overflow-x-auto">

                  <table className="w-full text-xs">

                    <thead>

                      <tr className="bg-slate-100 border-b border-slate-200">

                        <th className="p-4 text-left font-bold">
                          Employee
                        </th>

                        <th className="p-4 text-right font-bold">
                          Bill Rate
                        </th>

                        <th className="p-4 text-right font-bold">
                          Employer Statutory
                        </th>

                        <th className="p-4 text-right font-bold">
                          OT
                        </th>

                        <th className="p-4 text-right font-bold">
                          LOP
                        </th>

                        <th className="p-4 text-right font-bold">
                          Service Charge
                        </th>

                        <th className="p-4 text-right font-bold">
                          Employee Cost
                        </th>

                        <th className="p-4 text-right font-bold">
                          Client Bill
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {employees.map((employee) => {
                        const calculated = calculateEmployee(employee);

                        console.log("RENDERING EMPLOYEE:", {
                          name: employee.employee_name,
                          bill_rate: employee.bill_rate,
                          employer_statutory: employee.employer_statutory,
                          ot_amount: employee.ot_amount,
                          ot_hours: employee.ot_hours,
                          lop_deduction: employee.lop_deduction,
                          lop_days: employee.lop_days,
                          service_charge: employee.service_charge,
                        });

                        return (
                          <tr
                            key={
                              employee.attendance_id ??
                              employee.id ??
                              employee.employee_id
                            }
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            {/* EMPLOYEE */}
                            <td className="px-4 py-4">
                              <div className="font-semibold text-slate-800">
                                {employee.employee_name}
                              </div>

                              <div className="text-[10px] text-slate-500 mt-1">
                                ID: {employee.employee_id ?? "N/A"}
                              </div>
                            </td>

                            {/* BILL RATE */}
                            <td className="px-4 py-4 text-right font-bold text-indigo-600">
                              ₹ {formatCurrency(employee.bill_rate)}
                            </td>

                            {/* EMPLOYER STATUTORY */}
                            <td className="px-4 py-4 text-right">
                              ₹ {formatCurrency(employee.employer_statutory)}
                            </td>

                            {/* OT */}
                            <td className="px-4 py-4 text-right">
                              <div className="font-semibold">
                                ₹ {formatCurrency(employee.ot_amount)}
                              </div>

                              {Number(employee.ot_hours) > 0 && (
                                <div className="text-[10px] text-slate-500 mt-1">
                                  {employee.ot_hours} hrs
                                </div>
                              )}
                            </td>

                            {/* LOP */}
                            <td className="px-4 py-4 text-right">
                              <div className="font-semibold text-red-600">
                                ₹ {formatCurrency(employee.lop_deduction)}
                              </div>

                              {Number(employee.lop_days) > 0 && (
                                <div className="text-[10px] text-red-500 mt-1">
                                  {employee.lop_days} days
                                </div>
                              )}
                            </td>

                            {/* SERVICE CHARGE */}
                            <td className="px-4 py-4 text-right">
                              ₹ {formatCurrency(employee.service_charge)}
                            </td>

                            {/* EMPLOYEE COST */}
                            <td className="px-4 py-4 text-right font-semibold">
                              ₹ {formatCurrency(calculated.employeeCost)}
                            </td>

                            {/* CLIENT BILL */}
                            <td className="px-4 py-4 text-right font-bold text-emerald-600">
                              ₹ {formatCurrency(calculated.billAmount)}
                            </td>
                          </tr>
                        );
                      })}

                    </tbody>

                  </table>

                </div>
              )}

            </div>

            {/* BILLING SUMMARY */}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

              <div className="flex items-center gap-2 mb-5">

                <IndianRupee className="h-5 w-5 text-slate-700" />

                <div>

                  <h2 className="text-sm font-bold text-slate-900">
                    Client Billing Summary
                  </h2>

                  <p className="text-xs text-slate-400">
                    Automatically calculated from
                    processed employee payroll and
                    contract billing.
                  </p>

                </div>

              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                <SummaryCard
                  title="Employees"
                  value={
                    employeeTotals.employeeCount
                  }
                />

                <SummaryCard
                  title="Bill Rate"
                  value={`₹ ${formatCurrency(
                    employeeTotals.billRate
                  )}`}
                />

                <SummaryCard
                  title="Employer Statutory"
                  value={`₹ ${formatCurrency(
                    employeeTotals.statutory
                  )}`}
                />

                <SummaryCard
                  title="OT Amount"
                  value={`₹ ${formatCurrency(
                    employeeTotals.otAmount
                  )}`}
                />

                <SummaryCard
                  title="LOP Deduction"
                  value={`₹ ${formatCurrency(
                    employeeTotals.lopDeduction
                  )}`}
                />

                <SummaryCard
                  title="Service Charge"
                  value={`₹ ${formatCurrency(
                    employeeTotals.serviceCharge
                  )}`}
                />

                <SummaryCard
                  title="Employee Cost"
                  value={`₹ ${formatCurrency(
                    employeeTotals.employeeCost
                  )}`}
                />

                <SummaryCard
                  title="Subtotal"
                  value={`₹ ${formatCurrency(
                    employeeTotals.subtotal
                  )}`}
                />

              </div>

              <div className="mt-5 border-t border-slate-200 pt-4 space-y-2 text-xs">

                {form.gst_type.includes(
                  "Intra-State"
                ) ? (

                  <>

                    <div className="flex justify-between">

                      <span>
                        CGST 9%
                      </span>

                      <b>
                        ₹{" "}
                        {formatCurrency(
                          employeeTotals.cgst
                        )}
                      </b>

                    </div>

                    <div className="flex justify-between">

                      <span>
                        SGST 9%
                      </span>

                      <b>
                        ₹{" "}
                        {formatCurrency(
                          employeeTotals.sgst
                        )}
                      </b>

                    </div>

                  </>

                ) : (

                  <div className="flex justify-between">

                    <span>
                      IGST 18%
                    </span>

                    <b>
                      ₹{" "}
                      {formatCurrency(
                        employeeTotals.igst
                      )}
                    </b>

                  </div>

                )}

                <div className="flex justify-between border-t-2 border-slate-200 pt-4 text-base font-extrabold">

                  <span>
                    FINAL CLIENT INVOICE
                  </span>

                  <span className="text-emerald-600">

                    ₹{" "}
                    {formatCurrency(
                      employeeTotals.total
                    )}

                  </span>

                </div>

              </div>

              <div className="flex justify-end mt-5">

                <button
                  type="button"
                  onClick={
                    handleGenerateInvoice
                  }
                  disabled={
                    generating ||
                    employeesLoading ||
                    !form.client_id ||
                    employees.length ===
                    0
                  }
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-6 py-3 rounded-xl text-xs font-bold inline-flex items-center gap-2"
                >

                  {generating ? (

                    <>

                      <Loader2 className="h-4 w-4 animate-spin" />

                      Generating Invoice...

                    </>

                  ) : (

                    <>

                      <Plus className="h-4 w-4" />

                      Generate Client Invoice

                    </>

                  )}

                </button>

              </div>

            </div>

          </>
        )}

        {/* ====================================================
            GENERATED / PENDING BILLING TAB
        ==================================================== */}

        {(billingTab ===
          "generated" ||
          billingTab ===
          "pending") && (

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ==================================================
                INVOICE LIST
            ================================================== */}

              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-fit">

                <div className="flex justify-between items-center mb-3">

                  <div>

                    <h3 className="text-xs font-bold text-slate-400 uppercase">

                      {billingTab ===
                        "pending"
                        ? "Pending Client Billing"
                        : "Generated Client Invoices"}

                    </h3>

                    <p className="text-[10px] text-slate-400 mt-1">

                      {billingTab ===
                        "pending"
                        ? "Invoices with outstanding balance"
                        : "All generated client invoices"}

                    </p>

                  </div>

                  <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full font-bold">

                    {
                      displayedInvoices.length
                    }

                  </span>

                </div>

                {displayedInvoices.length ===
                  0 ? (

                  <div className="text-center py-10">

                    {billingTab ===
                      "pending" ? (

                      <>

                        <CheckCircle className="h-8 w-8 mx-auto text-emerald-400" />

                        <p className="text-xs font-bold text-slate-500 mt-3">
                          No pending billing
                        </p>

                        <p className="text-[10px] text-slate-400 mt-1">
                          All client invoices are
                          fully settled.
                        </p>

                      </>

                    ) : (

                      <>

                        <Receipt className="h-8 w-8 mx-auto text-slate-300" />

                        <p className="text-xs font-bold text-slate-500 mt-3">
                          No invoices found.
                        </p>

                      </>

                    )}

                  </div>

                ) : (

                  <div className="space-y-3">

                    {displayedInvoices.map(
                      (invoice) => {

                        const status =
                          invoice.payment_status ||
                          "Pending";

                        const classes =
                          getPaymentStatusClasses(
                            status
                          );

                        return (
                          <button
                            type="button"
                            key={
                              invoice.id
                            }
                            onClick={() =>
                              setSelectedInvoice(
                                invoice
                              )
                            }
                            className={`w-full text-left p-3.5 rounded-xl border transition ${Number(
                              selectedInvoice?.id
                            ) ===
                              Number(
                                invoice.id
                              )
                              ? "border-indigo-600 bg-indigo-50/50"
                              : "border-slate-200 hover:bg-slate-50"
                              }`}
                          >

                            <div className="flex justify-between gap-2">

                              <div>

                                <p className="text-xs font-bold text-slate-900">
                                  {
                                    invoice.client_name
                                  }
                                </p>

                                <p className="text-[10px] text-slate-400 font-mono mt-1">
                                  {
                                    invoice.invoice_number
                                  }
                                </p>

                              </div>

                              <span
                                className={`px-2 py-1 rounded-full text-[9px] font-bold h-fit ${classes.badge}`}
                              >
                                {
                                  status
                                }
                              </span>

                            </div>

                            <div className="flex justify-between mt-3">

                              <span className="text-[10px] text-slate-400">
                                {
                                  invoice.billing_month
                                }
                              </span>

                              <span className="text-xs font-extrabold">
                                ₹{" "}
                                {formatCurrency(
                                  invoice.total_amount
                                )}
                              </span>

                            </div>

                            <div className="flex justify-between mt-1 text-[10px]">

                              <span className="text-slate-400">
                                Received ₹{" "}
                                {formatCurrency(
                                  invoice.total_received
                                )}
                              </span>

                              <span className="text-orange-600 font-bold">
                                Pending ₹{" "}
                                {formatCurrency(
                                  invoice.balance_remaining
                                )}
                              </span>

                            </div>

                          </button>
                        );
                      }
                    )}

                  </div>
                )}

              </div>

              {/* ==================================================
                INVOICE DETAILS
            ================================================== */}

              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">

                {!selectedInvoice ||
                  !displayedInvoices.some(
                    (invoice) =>
                      Number(
                        invoice.id
                      ) ===
                      Number(
                        selectedInvoice.id
                      )
                  ) ? (

                  <div className="text-center py-16">

                    {billingTab ===
                      "pending" ? (

                      <>

                        <Clock className="h-10 w-10 mx-auto text-orange-300" />

                        <p className="text-sm font-bold text-slate-500 mt-3">
                          Select a pending invoice
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          Select an invoice from the
                          pending billing list.
                        </p>

                      </>

                    ) : (

                      <>

                        <Receipt className="h-10 w-10 mx-auto text-slate-300" />

                        <p className="text-sm font-bold text-slate-500 mt-3">
                          Select an invoice
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          Select an invoice from the list
                          to view details.
                        </p>

                      </>

                    )}

                  </div>

                ) : (

                  <>

                    {/* ==================================================
                      INVOICE HEADER
                  ================================================== */}

                    <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-slate-100 pb-5">

                      <div>

                        <div className="flex items-center gap-2">

                          <Receipt className="h-5 w-5 text-indigo-600" />

                          <h2 className="text-xl font-extrabold text-slate-900">
                            Client Tax Invoice
                          </h2>

                        </div>

                        <p className="text-xs text-slate-500 mt-1">
                          {
                            selectedInvoice.invoice_number
                          }
                        </p>

                      </div>

                      <span
                        className={`inline-flex h-fit px-3 py-1.5 rounded-full text-xs font-bold ${getPaymentStatusClasses(
                          selectedInvoice.payment_status
                        ).badge
                          }`}
                      >
                        {
                          selectedInvoice.payment_status
                        }
                      </span>

                    </div>

                    {/* ==================================================
                      CLIENT
                  ================================================== */}

                    <div className="bg-slate-50 rounded-xl p-4 mt-5 flex justify-between">

                      <div>

                        <p className="text-[10px] text-slate-400 uppercase font-bold">
                          Billed To
                        </p>

                        <p className="text-sm font-bold mt-1">
                          {
                            selectedInvoice.client_name
                          }
                        </p>

                      </div>

                      <div className="text-right">

                        <p className="text-[10px] text-slate-400 uppercase font-bold">
                          Employees
                        </p>

                        <p className="text-sm font-bold mt-1">
                          {
                            selectedInvoice.employee_count
                          }
                        </p>

                      </div>

                    </div>

                    {/* ==================================================
                      BILLING BREAKDOWN
                      IMPORTANT:
                      Employee Pay removed.
                      Bill Rate used instead.
                  ================================================== */}

                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-5">

                      <div className="bg-slate-100 px-4 py-3 flex justify-between text-xs font-bold">

                        <span>
                          Billing Breakdown
                        </span>

                        <span>
                          Amount
                        </span>

                      </div>

                      <div className="p-4 space-y-3 text-xs">

                        {/* BILL RATE */}

                        <BillingRow
                          label="Bill Rate"
                          value={
                            selectedInvoice.total_bill_rate
                          }
                        />

                        {/* EMPLOYER STATUTORY */}

                        <BillingRow
                          label="Employer Statutory"
                          value={
                            selectedInvoice.employer_statutory
                          }
                        />

                        {/* SERVICE CHARGE */}

                        <BillingRow
                          label="Service Charge / Markup"
                          value={
                            selectedInvoice.service_charge
                          }
                          blue
                        />

                        {/* SUBTOTAL */}

                        <BillingRow
                          label="Subtotal"
                          value={
                            selectedInvoice.subtotal
                          }
                        />

                        {/* CGST */}

                        <BillingRow
                          label="CGST"
                          value={
                            selectedInvoice.cgst
                          }
                        />

                        {/* SGST */}

                        <BillingRow
                          label="SGST"
                          value={
                            selectedInvoice.sgst
                          }
                        />

                        {/* IGST */}

                        <BillingRow
                          label="IGST"
                          value={
                            selectedInvoice.igst
                          }
                        />

                        {/* TOTAL */}

                        <div className="border-t-2 border-slate-200 pt-4 flex justify-between text-sm font-extrabold">

                          <span>
                            Total Client Invoice
                          </span>

                          <span className="text-emerald-600">

                            ₹{" "}
                            {formatCurrency(
                              selectedInvoice.total_amount
                            )}

                          </span>

                        </div>

                      </div>

                    </div>

                    {/* ==================================================
                      PAYMENT SUMMARY
                  ================================================== */}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">

                      <SummaryCard
                        title="Received"
                        value={`₹ ${formatCurrency(
                          selectedInvoice.total_received
                        )}`}
                      />

                      <SummaryCard
                        title="TDS"
                        value={`₹ ${formatCurrency(
                          selectedInvoice.tds_deducted
                        )}`}
                      />

                      <SummaryCard
                        title="Pending"
                        value={`₹ ${formatCurrency(
                          selectedInvoice.balance_remaining
                        )}`}
                      />

                    </div>

                    {/* ==================================================
                      PAYMENT HISTORY
                  ================================================== */}

                    <div className="border border-slate-200 rounded-xl mt-5 overflow-hidden">

                      <div className="bg-slate-100 p-4">

                        <h3 className="text-xs font-bold uppercase">
                          Payment History
                        </h3>

                      </div>

                      {paymentsLoading ? (

                        <div className="p-6 text-center">

                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />

                        </div>

                      ) : payments.length ===
                        0 ? (

                        <div className="p-6 text-center text-xs text-slate-400">
                          No payments recorded.
                        </div>

                      ) : (

                        <div className="overflow-x-auto">

                          <table className="w-full text-xs">

                            <thead>

                              <tr className="border-b">

                                <th className="p-3 text-left">
                                  Date
                                </th>

                                <th className="p-3 text-left">
                                  Mode
                                </th>

                                <th className="p-3 text-right">
                                  Received
                                </th>

                                <th className="p-3 text-right">
                                  TDS
                                </th>

                              </tr>

                            </thead>

                            <tbody>

                              {payments.map(
                                (payment) => (

                                  <tr
                                    key={
                                      payment.id
                                    }
                                    className="border-b"
                                  >

                                    <td className="p-3">
                                      {formatDate(
                                        payment.payment_date
                                      )}
                                    </td>

                                    <td className="p-3">
                                      {
                                        payment.payment_mode
                                      }
                                    </td>

                                    <td className="p-3 text-right font-bold text-emerald-600">
                                      ₹{" "}
                                      {formatCurrency(
                                        payment.amount_received
                                      )}
                                    </td>

                                    <td className="p-3 text-right">
                                      ₹{" "}
                                      {formatCurrency(
                                        payment.tds_deducted
                                      )}
                                    </td>

                                  </tr>

                                )
                              )}

                            </tbody>

                          </table>

                        </div>

                      )}

                    </div>

                    {/* ==================================================
                      RECORD PAYMENT
                  ================================================== */}

                    {selectedInvoice.payment_status !==
                      "Paid" && (

                        <div className="border border-slate-200 rounded-xl p-5 mt-5">

                          <h3 className="text-sm font-bold">
                            Record Client Payment
                          </h3>

                          <form
                            onSubmit={
                              handleRecordPayment
                            }
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
                          >

                            {/* AMOUNT */}

                            <div>

                              <label className="block text-[10px] font-bold mb-1">
                                Amount Received
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  paymentForm.amount_received
                                }
                                onChange={(event) =>
                                  setPaymentForm(
                                    (previous) => ({
                                      ...previous,

                                      amount_received:
                                        event.target
                                          .value,
                                    })
                                  )
                                }
                                className="w-full border rounded-xl p-2.5 text-xs"
                                required
                              />

                            </div>

                            {/* TDS */}

                            <div>

                              <label className="block text-[10px] font-bold mb-1">
                                TDS Deducted
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  paymentForm.tds_deducted
                                }
                                onChange={(event) =>
                                  setPaymentForm(
                                    (previous) => ({
                                      ...previous,

                                      tds_deducted:
                                        event.target
                                          .value,
                                    })
                                  )
                                }
                                className="w-full border rounded-xl p-2.5 text-xs"
                              />

                            </div>

                            {/* PAYMENT DATE */}

                            <div>

                              <label className="block text-[10px] font-bold mb-1">
                                Payment Date
                              </label>

                              <input
                                type="date"
                                value={
                                  paymentForm.payment_date
                                }
                                onChange={(event) =>
                                  setPaymentForm(
                                    (previous) => ({
                                      ...previous,

                                      payment_date:
                                        event.target
                                          .value,
                                    })
                                  )
                                }
                                className="w-full border rounded-xl p-2.5 text-xs"
                                required
                              />

                            </div>

                            {/* PAYMENT MODE */}

                            <div>

                              <label className="block text-[10px] font-bold mb-1">
                                Payment Mode
                              </label>

                              <select
                                value={
                                  paymentForm.payment_mode
                                }
                                onChange={(event) =>
                                  setPaymentForm(
                                    (previous) => ({
                                      ...previous,

                                      payment_mode:
                                        event.target
                                          .value,
                                    })
                                  )
                                }
                                className="w-full border rounded-xl p-2.5 text-xs"
                              >

                                <option>
                                  NEFT/RTGS
                                </option>

                                <option>
                                  IMPS
                                </option>

                                <option>
                                  Bank Transfer
                                </option>

                                <option>
                                  Cheque
                                </option>

                                <option>
                                  Other
                                </option>

                              </select>

                            </div>

                            {/* REFERENCE */}

                            <div className="md:col-span-2">

                              <label className="block text-[10px] font-bold mb-1">
                                Reference Number
                              </label>

                              <input
                                type="text"
                                value={
                                  paymentForm.reference_number
                                }
                                onChange={(event) =>
                                  setPaymentForm(
                                    (previous) => ({
                                      ...previous,

                                      reference_number:
                                        event.target
                                          .value,
                                    })
                                  )
                                }
                                placeholder="UTR / transaction reference"
                                className="w-full border rounded-xl p-2.5 text-xs"
                              />

                            </div>

                            {/* SUBMIT */}

                            <div className="md:col-span-2 flex justify-end">

                              <button
                                type="submit"
                                disabled={
                                  recordingPayment
                                }
                                className="bg-emerald-600 disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2"
                              >

                                {recordingPayment ? (

                                  <>

                                    <Loader2 className="h-4 w-4 animate-spin" />

                                    Recording...

                                  </>

                                ) : (

                                  <>

                                    <CheckCircle className="h-4 w-4" />

                                    Record Payment

                                  </>

                                )}

                              </button>

                            </div>

                          </form>

                        </div>
                      )}

                    {/* ==================================================
                      ACTIONS
                  ================================================== */}

                    <div className="flex flex-col md:flex-row justify-between gap-4 mt-5 pt-5 border-t">

                      <div className="flex items-center gap-2">

                        <span className="text-xs font-bold text-slate-500">
                          Lifecycle:
                        </span>

                        <select
                          value={
                            selectedInvoice.lifecycle_state ||
                            "Draft"
                          }
                          onChange={(event) =>
                            handleUpdateLifecycleState(
                              selectedInvoice.id,
                              event.target
                                .value
                            )
                          }
                          className="border rounded-xl p-2 text-xs font-bold"
                        >

                          <option>
                            Draft
                          </option>

                          <option>
                            Pro-Forma Sent
                          </option>

                          <option>
                            Tax Invoice Dispatched
                          </option>

                        </select>

                      </div>

                      <button
                        type="button"
                        onClick={
                          handleSendPaymentAlert
                        }
                        disabled={
                          sendingAlert ||
                          selectedInvoice.payment_status ===
                          "Paid"
                        }
                        className="bg-blue-600 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2"
                      >

                        {sendingAlert ? (

                          <>

                            <Loader2 className="h-4 w-4 animate-spin" />

                            Sending...

                          </>

                        ) : (

                          <>

                            <Mail className="h-4 w-4" />

                            {selectedInvoice.payment_status ===
                              "Overdue"
                              ? "Send Overdue Reminder"
                              : "Send Payment Reminder"}

                          </>

                        )}

                      </button>

                    </div>

                  </>

                )}

              </div>

            </div>
          )}

      </main>

    </div>
  );
}

// ============================================================
// BILLING ROW
// ============================================================

function BillingRow({
  label,
  value,
  blue = false,
}) {
  return (
    <div className="flex justify-between">

      <span>
        {label}
      </span>

      <b
        className={
          blue
            ? "text-blue-600"
            : ""
        }
      >
        ₹{" "}
        {formatCurrency(
          value
        )}
      </b>

    </div>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  title,
  value,
}) {
  return (
    <div className="border border-slate-200 bg-slate-50 rounded-xl p-4">

      <p className="text-[9px] uppercase font-bold text-slate-400">
        {title}
      </p>

      <p className="text-sm font-extrabold text-slate-900 mt-1">
        {value}
      </p>

    </div>
  );
}