import React, { useEffect, useMemo, useState } from "react";

import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    Eye,
    FileText,
    Loader2,
    Search,
    X,
    IndianRupee,
    Upload,
    Send,
    RefreshCw,
    Info,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";
import api from "../../../services/api";


// =============================================================
// PAYMENT MODES
// =============================================================

const PAYMENT_MODES = [
    "NEFT/RTGS",
    "IMPS",
    "UPI",
    "Bank Transfer",
    "Cheque",
    "Other",
];

// =============================================================
// DISPUTE TYPES
// =============================================================

const DISPUTE_TYPES = [
    "Calculation Error",
    "Employee Count Incorrect",
    "Attendance / Billable Days Incorrect",
    "Pay / Billing Rate Incorrect",
    "Overtime Amount Incorrect",
    "Statutory / GST Calculation Incorrect",
    "Other",
];

// =============================================================
// LOCAL DATE
// =============================================================

const getTodayLocal = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const TODAY = getTodayLocal();

// =============================================================
// CLIENT INVOICE MANAGEMENT
// =============================================================

function ClientInvoiceManagement({
    activeTab,
    setActiveTab,
}) {
    const [invoices, setInvoices] = useState([]);

    const [searchQuery, setSearchQuery] = useState("");

    // =========================================================
    // INVOICE DETAILS
    // =========================================================

    const [selectedInvoice, setSelectedInvoice] =
        useState(null);

    const [showInvoiceDetails, setShowInvoiceDetails] =
        useState(false);

    // =========================================================
    // BILLING CALCULATION INFO
    // =========================================================

    const [showBillingInfo, setShowBillingInfo] =
        useState(false);

    // =========================================================
    // DISPUTE
    // =========================================================

    const [showDisputeModal, setShowDisputeModal] =
        useState(false);

    const [submittingDispute, setSubmittingDispute] =
        useState(false);

    const [disputeForm, setDisputeForm] = useState({
        dispute_type: "Calculation Error",
        reason: "",
    });

    // =========================================================
    // PAYMENT
    // =========================================================

    const [showPaymentModal, setShowPaymentModal] =
        useState(false);

    const [submittingPayment, setSubmittingPayment] =
        useState(false);

    const [paymentForm, setPaymentForm] = useState({
        amount_reported: "",
        payment_date: TODAY,
        payment_mode: "NEFT/RTGS",
        reference_number: "",
        notes: "",
        payment_proof_url: "",
    });

    // =========================================================
    // LOADING
    // =========================================================

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] =
        useState(false);

    // =========================================================
    // CLIENT ID
    // =========================================================

    const clientId =
        sessionStorage.getItem("client_id") ||
        sessionStorage.getItem("clientId");

    // =========================================================
    // FORMAT CURRENCY
    // =========================================================

    const formatCurrency = (amount) => {
        return Number(amount || 0).toLocaleString(
            "en-IN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }
        );
    };

    // =========================================================
    // FORMAT DATE
    // =========================================================

    const formatDate = (date) => {
        if (!date) return "-";

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return String(date);
        }

        return parsed.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };


// =========================================================
// FORMAT BILLING MONTH
// =========================================================

const formatBillingMonth = (date) => {
    if (!date) return "-";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
        return String(date);
    }

    return parsed.toLocaleDateString(
        "en-IN",
        {
            month: "short",
            year: "numeric",
        }
    );
};


// =========================================================
// FETCH CLIENT INVOICES
// =========================================================

const fetchInvoices = async (forceRefresh = false) => {
    try {
        if (forceRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        const response = await api.get("/client-management/invoices");
        const data = response.data || {};
        setInvoices(data.invoices || data.data || []);
        return data;
    } catch (error) {
        console.error("Fetch invoices error:", error);
        alert(
            error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Failed to load invoices."
        );
        return null;
    } finally {
        if (forceRefresh) {
            setRefreshing(false);
        } else {
            setLoading(false);
        }
    }
};

useEffect(() => {
    fetchInvoices();
}, []);

// =========================================================
// NORMALIZE INVOICE
// =========================================================

const normalizeInvoice = (invoice) => {
    const totalAmount = Number(
        invoice.total_amount ??
        invoice.total_invoice_amount ??
        invoice.total_bill_amount ??
        0
    );

    const amountPaid = Number(
        invoice.amount_paid ??
        invoice.paid_amount ??
        invoice.total_paid ??
        0
    );

    const tdsDeducted = Number(
        invoice.tds_deducted ?? 0
    );

    const amountSettled = Number(
        invoice.amount_settled ??
        amountPaid + tdsDeducted
    );

    const outstanding = Math.max(
        0,
        totalAmount - amountSettled
    );

    const paymentStatus = String(
        invoice.payment_status ??
        invoice.status ??
        "Pending"
    ).trim();

    const confirmationStatus =
        invoice.confirmation_status ||
            invoice.confirmationStatus
            ? String(
                invoice.confirmation_status ||
                invoice.confirmationStatus
            ).trim()
            : null;

    return {
        ...invoice,

        // =================================================
        // BASIC
        // =================================================

        invoiceNumber:
            invoice.invoice_number ||
            invoice.invoiceNumber ||
            `INV-${invoice.id}`,

        clientName:
            invoice.client_name ||
            invoice.company_name ||
            "Client",

        billingMonth:
            invoice.billing_month ||
            invoice.billingMonth ||
            "-",

        invoiceDate:
            invoice.invoice_date ||
            invoice.created_at ||
            null,

        dueDate:
            invoice.due_date ||
            null,

        lifecycleState:
            invoice.lifecycle_state ||
            "Draft",

        // =================================================
        // BILLING CALCULATION
        // =================================================

        employeeCount: Number(
            invoice.employee_count ?? 0
        ),

        totalPayRate: Number(
            invoice.total_pay_rate ??
            invoice.totalPayRate ??
            0
        ),

        employerStatutory: Number(
            invoice.employer_statutory ??
            invoice.employerStatutory ??
            0
        ),

        serviceCharge: Number(
            invoice.service_charge ??
            invoice.serviceCharge ??
            0
        ),

        grossMargin: Number(
            invoice.gross_margin ??
            invoice.grossMargin ??
            0
        ),

        subtotal: Number(
            invoice.subtotal ?? 0
        ),

        gstType:
            invoice.gst_type ||
            invoice.gstType ||
            null,

        cgst: Number(
            invoice.cgst ?? 0
        ),

        sgst: Number(
            invoice.sgst ?? 0
        ),

        igst: Number(
            invoice.igst ?? 0
        ),

        totalGst: Number(
            invoice.total_gst ??
            (
                Number(invoice.cgst ?? 0) +
                Number(invoice.sgst ?? 0) +
                Number(invoice.igst ?? 0)
            )
        ),

        // =================================================
        // FINANCIAL
        // =================================================

        totalAmount,

        amountPaid,

        tdsDeducted,

        amountSettled,

        outstanding,

        // =================================================
        // PAYMENT
        // =================================================

        paymentStatus,

        // =================================================
        // PAYMENT CONFIRMATION
        // =================================================

        confirmationStatus,

        confirmationId:
            invoice.confirmation_id ||
            invoice.confirmationId ||
            null,

        confirmationAmount:
            invoice.confirmation_amount != null
                ? Number(
                    invoice.confirmation_amount
                )
                : null,

        confirmationDate:
            invoice.confirmation_date ||
            null,

        confirmationPaymentMode:
            invoice.confirmation_payment_mode ||
            null,

        confirmationReference:
            invoice.confirmation_reference ||
            null,

        confirmationSubmittedAt:
            invoice.confirmation_submitted_at ||
            null,

        rejectionReason:
            invoice.rejection_reason ||
            invoice.rejectionReason ||
            null,

        // =================================================
        // DISPUTE
        // =================================================

        disputeId:
            invoice.dispute_id ||
            invoice.disputeId ||
            null,

        disputeStatus:
            invoice.dispute_status ||
            invoice.disputeStatus ||
            null,

        disputeType:
            invoice.dispute_type ||
            invoice.disputeType ||
            null,

        disputeReason:
            invoice.dispute_reason ||
            invoice.disputeReason ||
            null,

        disputeSubmittedAt:
            invoice.dispute_submitted_at ||
            invoice.disputeSubmittedAt ||
            null,

        disputeReviewedBy:
            invoice.dispute_reviewed_by ||
            invoice.disputeReviewedBy ||
            null,

        disputeReviewedAt:
            invoice.dispute_reviewed_at ||
            invoice.disputeReviewedAt ||
            null,

        adminResponse:
            invoice.admin_response ||
            invoice.adminResponse ||
            null,
    };
};


// =========================================================
// NORMALIZED INVOICES
// =========================================================

const normalizedInvoices = useMemo(() => {
    return invoices.map(
        normalizeInvoice
    );
}, [invoices]);


// =========================================================
// SEARCH
// =========================================================

const filteredInvoices = useMemo(() => {
    const query = searchQuery
        .toLowerCase()
        .trim();

    return normalizedInvoices.filter(
        (invoice) => {
            if (!query) return true;

            return (
                invoice.invoiceNumber
                    .toLowerCase()
                    .includes(query) ||

                String(
                    invoice.billingMonth
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    invoice.paymentStatus
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    invoice.confirmationStatus ||
                    ""
                )
                    .toLowerCase()
                    .includes(query) ||

                String(
                    invoice.disputeStatus ||
                    ""
                )
                    .toLowerCase()
                    .includes(query)
            );
        }
    );
}, [
    normalizedInvoices,
    searchQuery,
]);


// =========================================================
// PAYMENT STATUS
// =========================================================

const getPaymentStatus = (invoice) => {
    const status = String(
        invoice.paymentStatus ||
        "Pending"
    )
        .trim()
        .toLowerCase();

    if (status === "paid") {
        return {
            label: "Paid",
            className:
                "bg-emerald-50 text-emerald-700 border-emerald-200",
            icon: CheckCircle2,
        };
    }

    if (
        status === "partially paid"
    ) {
        return {
            label: "Partially Paid",
            className:
                "bg-blue-50 text-blue-700 border-blue-200",
            icon: CreditCard,
        };
    }

    if (status === "overdue") {
        return {
            label: "Overdue",
            className:
                "bg-red-50 text-red-700 border-red-200",
            icon: AlertCircle,
        };
    }

    return {
        label: "Pending",
        className:
            "bg-amber-50 text-amber-700 border-amber-200",
        icon: Clock,
    };
};


// =========================================================
// PAYMENT CONFIRMATION STATUS
// =========================================================

const getConfirmationStatus = (
    invoice
) => {
    const status = String(
        invoice.confirmationStatus || ""
    )
        .trim()
        .toLowerCase();

    if (
        status ===
        "pending verification"
    ) {
        return {
            label:
                "Payment Verification Pending",
            className:
                "bg-amber-50 text-amber-700 border-amber-200",
            icon: Clock,
        };
    }

    if (status === "rejected") {
        return {
            label: "Payment Rejected",
            className:
                "bg-red-50 text-red-700 border-red-200",
            icon: AlertCircle,
        };
    }

    if (status === "verified") {
        return {
            label: "Payment Verified",
            className:
                "bg-emerald-50 text-emerald-700 border-emerald-200",
            icon: CheckCircle2,
        };
    }

    return null;
};


// =========================================================
// DISPUTE STATUS
// =========================================================

const getDisputeStatus = (
    invoice
) => {
    const status = String(
        invoice.disputeStatus || ""
    )
        .trim()
        .toLowerCase();

    if (
        status === "pending review"
    ) {
        return {
            label: "Dispute Pending",
            className:
                "bg-amber-50 text-amber-700 border-amber-200",
            icon: Clock,
        };
    }

    if (status === "accepted") {
        return {
            label: "Dispute Accepted",
            className:
                "bg-red-50 text-red-700 border-red-200",
            icon: AlertCircle,
        };
    }

    if (status === "rejected") {
        return {
            label: "Dispute Rejected",
            className:
                "bg-slate-100 text-slate-700 border-slate-200",
            icon: X,
        };
    }

    if (status === "resolved") {
        return {
            label: "Dispute Resolved",
            className:
                "bg-emerald-50 text-emerald-700 border-emerald-200",
            icon: CheckCircle2,
        };
    }

    return null;
};


// =========================================================
// ACTIVE DISPUTE
// =========================================================

const hasActiveDispute = (
    invoice
) => {
    const status = String(
        invoice.disputeStatus || ""
    )
        .trim()
        .toLowerCase();

    return [
        "pending review",
        "accepted",
    ].includes(status);
};


// =========================================================
// DISPUTE PENDING ADMIN REVIEW
// =========================================================

const isDisputePendingReview = (
    invoice
) => {
    const status = String(
        invoice.disputeStatus || ""
    )
        .trim()
        .toLowerCase();

    return status === "pending review";
};


// =========================================================
// CAN RAISE DISPUTE
// =========================================================

const canRaiseDispute = (
    invoice
) => {
    // Already has an active dispute
    if (hasActiveDispute(invoice)) {
        return false;
    }

    // Payment already verified by admin
    if (
        String(
            invoice.confirmationStatus || ""
        )
            .trim()
            .toLowerCase() === "verified"
    ) {
        return false;
    }

    // Invoice fully paid
    if (
        String(
            invoice.paymentStatus || ""
        )
            .trim()
            .toLowerCase() === "paid"
    ) {
        return false;
    }

    return true;
};


// =========================================================
// PAYMENT HELPERS
// =========================================================

const isPaymentPendingVerification = (
    invoice
) => {
    return (
        String(
            invoice.confirmationStatus ||
            ""
        )
            .trim()
            .toLowerCase() ===
        "pending verification"
    );
};


const isPaymentRejected = (
    invoice
) => {
    return (
        String(
            invoice.confirmationStatus ||
            ""
        )
            .trim()
            .toLowerCase() ===
        "rejected"
    );
};


// =========================================================
// IS PAYMENT VERIFIED
// =========================================================

const isPaymentVerified = (
    invoice
) => {
    return (
        String(
            invoice.confirmationStatus ||
            ""
        )
            .trim()
            .toLowerCase() ===
        "verified"
    );
};


// =========================================================
// CAN REPORT PAYMENT
// =========================================================

const canReportPayment = (
    invoice
) => {
    const paymentStatus = String(
        invoice.paymentStatus || ""
    )
        .trim()
        .toLowerCase();

    if (paymentStatus === "paid") {
        return false;
    }

    if (
        isPaymentPendingVerification(
            invoice
        )
    ) {
        return false;
    }

    // Block payment while dispute is pending
    if (
        isDisputePendingReview(
            invoice
        )
    ) {
        return false;
    }

    return true;
};


// =========================================================
// OPEN BILLING INFO
// =========================================================

const openBillingInfo = (
    invoice
) => {
    setSelectedInvoice(
        invoice
    );

    setShowBillingInfo(
        true
    );
};


// =========================================================
// OPEN DISPUTE MODAL
// =========================================================

const openDisputeModal = (
    invoice
) => {
    if (
        !canRaiseDispute(
            invoice
        )
    ) {
        if (
            hasActiveDispute(
                invoice
            )
        ) {
            alert(
                "A dispute for this invoice is already under review."
            );
        } else {
            alert(
                "This invoice has already been paid and verified. Disputes can only be raised before payment is confirmed."
            );
        }

        return;
    }

    setSelectedInvoice(
        invoice
    );

    setDisputeForm({
        dispute_type:
            "Calculation Error",
        reason: "",
    });

    setShowDisputeModal(
        true
    );
};


// =========================================================
// OPEN PAYMENT MODAL
// =========================================================

const openPaymentModal = (
    invoice
) => {
    if (
        !canReportPayment(
            invoice
        )
    ) {
        if (
            isDisputePendingReview(
                invoice
            )
        ) {
            alert(
                "You have an active dispute on this invoice. Please wait for Talent Corner to review and respond before making a payment."
            );
        } else if (
            isPaymentPendingVerification(
                invoice
            )
        ) {
            alert(
                "A payment confirmation for this invoice is already awaiting verification."
            );
        } else {
            alert(
                "This invoice has already been fully paid."
            );
        }

        return;
    }

    setSelectedInvoice(
        invoice
    );

    setPaymentForm({
        amount_reported:
            invoice.outstanding > 0
                ? invoice.outstanding.toFixed(2)
                : "",

        payment_date:
            TODAY,

        payment_mode:
            "NEFT/RTGS",

        reference_number:
            "",

        notes:
            "",

        payment_proof_url:
            "",
    });

    setShowPaymentModal(
        true
    );
};


// =========================================================
// SUBMIT PAYMENT
// =========================================================

const handleSubmitPayment = async (
    e
) => {
    e.preventDefault();

    if (!selectedInvoice) {
        return;
    }

    const amount = Number(
        paymentForm.amount_reported
    );

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        alert(
            "Please enter a valid payment amount."
        );

        return;
    }

    if (
        amount >
        Number(
            selectedInvoice.outstanding
        )
    ) {
        alert(
            `Payment cannot exceed the outstanding amount of ₹${formatCurrency(
                selectedInvoice.outstanding
            )}.`
        );

        return;
    }

    if (
        !paymentForm.reference_number ||
        !paymentForm.reference_number.trim()
    ) {
        alert(
            "Please enter the UTR / transaction reference number."
        );

        return;
    }

    if (
        !paymentForm.payment_date
    ) {
        alert(
            "Please select the payment date."
        );

        return;
    }

    // Payment date cannot be future date
    if (
        paymentForm.payment_date >
        TODAY
    ) {
        alert(
            "Payment date cannot be in the future."
        );

        return;
    }

    try {
        setSubmittingPayment(
            true
        );

        // =====================================================
        // USE CENTRAL API INSTANCE
        // No API_BASE
        // No local fetch()
        // =====================================================

        const response =
            await api.post(
                `/client/invoices/${selectedInvoice.id}/payment-confirmation`,
                {
                    client_id:
                        Number(
                            clientId
                        ),

                    amount_reported:
                        amount,

                    payment_date:
                        paymentForm.payment_date,

                    payment_mode:
                        paymentForm.payment_mode,

                    reference_number:
                        paymentForm.reference_number.trim(),

                    notes:
                        paymentForm.notes &&
                        paymentForm.notes.trim()
                            ? paymentForm.notes.trim()
                            : null,

                    payment_proof_url:
                        paymentForm.payment_proof_url &&
                        paymentForm.payment_proof_url.trim()
                            ? paymentForm.payment_proof_url.trim()
                            : null,
                }
            );

        const data =
            response.data || {};

        alert(
            "Payment confirmation submitted successfully. It is now awaiting admin verification."
        );

        setShowPaymentModal(
            false
        );

        setSelectedInvoice(
            null
        );

        await fetchInvoices(
            true
        );
    } catch (error) {
        console.error(
            "Payment confirmation error:",
            error
        );

        alert(
            error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Failed to submit payment confirmation."
        );
    } finally {
        setSubmittingPayment(
            false
        );
    }
};


// =========================================================
// SUBMIT DISPUTE
// =========================================================

const handleSubmitDispute = async (
    e
) => {
    e.preventDefault();

    if (!selectedInvoice) {
        return;
    }

    const reason =
        disputeForm.reason.trim();

    if (!reason) {
        alert(
            "Please explain the issue with this invoice."
        );

        return;
    }

    if (
        reason.length < 10
    ) {
        alert(
            "Please provide a little more detail about the issue."
        );

        return;
    }

    if (
        reason.length > 1000
    ) {
        alert(
            "Dispute reason cannot exceed 1000 characters."
        );

        return;
    }

    try {
        setSubmittingDispute(
            true
        );

        // =====================================================
        // USE CENTRAL API INSTANCE
        // No API_BASE
        // No local fetch()
        // =====================================================

        const response =
            await api.post(
                `/client/invoices/${selectedInvoice.id}/dispute`,
                {
                    client_id:
                        Number(
                            clientId
                        ),

                    dispute_type:
                        disputeForm.dispute_type,

                    reason,
                }
            );

        const data =
            response.data || {};

        alert(
            "Invoice dispute submitted successfully. Talent Corner will review it."
        );

        setShowDisputeModal(
            false
        );

        setSelectedInvoice(
            null
        );

        await fetchInvoices(
            true
        );
    } catch (error) {
        console.error(
            "Invoice dispute error:",
            error
        );

        alert(
            error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Failed to submit invoice dispute."
        );
    } finally {
        setSubmittingDispute(
            false
        );
    }
};


// =========================================================
// SUMMARY
// =========================================================

const summary = useMemo(() => {
    return {
        totalInvoices:
            normalizedInvoices.length,

        totalBilled:
            normalizedInvoices.reduce(
                (
                    sum,
                    invoice
                ) =>
                    sum +
                    invoice.totalAmount,
                0
            ),

        totalPaid:
            normalizedInvoices.reduce(
                (
                    sum,
                    invoice
                ) =>
                    sum +
                    invoice.amountSettled,
                0
            ),

        outstanding:
            normalizedInvoices.reduce(
                (
                    sum,
                    invoice
                ) =>
                    sum +
                    invoice.outstanding,
                0
            ),
    };
}, [
    normalizedInvoices,
]);


    // =========================================================
    // LOADING
    // =========================================================

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mr-2" />

                <span className="text-sm font-semibold text-slate-500">
                    Loading invoices...
                </span>
            </div>
        );
    }

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-900">

            {/* =================================================
                SIDEBAR
            ================================================= */}

            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />

            {/* =================================================
                MAIN
            ================================================= */}

            <main className="flex-1 min-w-0 p-8 space-y-6 overflow-y-auto text-slate-900">

                <div className="max-w-[1500px] mx-auto space-y-6">

                    {/* =================================================
                        HEADER
                    ================================================= */}

                    <div className="flex flex-col lg:flex-row justify-between gap-4">

                        <div>

                            <div className="flex items-center gap-2">

                                <FileText className="w-6 h-6 text-emerald-600" />

                                <h1 className="text-2xl font-bold text-slate-900">
                                    My Invoices
                                </h1>

                            </div>

                            <p className="mt-1 text-sm text-slate-500">
                                View your billing invoices,
                                payment status and outstanding
                                amounts.
                            </p>

                        </div>

                        <button
                            onClick={() =>
                                fetchInvoices(true)
                            }
                            disabled={refreshing}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                        >

                            <RefreshCw
                                className={`w-4 h-4 ${refreshing
                                    ? "animate-spin"
                                    : ""
                                    }`}
                            />

                            {refreshing
                                ? "Refreshing..."
                                : "Refresh"}

                        </button>

                    </div>

                    {/* =================================================
                        SUMMARY
                    ================================================= */}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                        <SummaryCard
                            title="Total Invoices"
                            value={
                                summary.totalInvoices
                            }
                            icon={FileText}
                        />

                        <SummaryCard
                            title="Total Billed"
                            value={`₹${formatCurrency(
                                summary.totalBilled
                            )}`}
                            icon={IndianRupee}
                        />

                        <SummaryCard
                            title="Amount Paid"
                            value={`₹${formatCurrency(
                                summary.totalPaid
                            )}`}
                            icon={CheckCircle2}
                        />

                        <SummaryCard
                            title="Outstanding"
                            value={`₹${formatCurrency(
                                summary.outstanding
                            )}`}
                            icon={Clock}
                        />

                    </div>

                    {/* =================================================
                        SEARCH
                    ================================================= */}

                    <div className="flex flex-col sm:flex-row justify-between gap-3">

                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                            <input
                                type="text"
                                placeholder="Search invoice..."
                                value={
                                    searchQuery
                                }
                                onChange={(e) =>
                                    setSearchQuery(
                                        e.target.value
                                    )
                                }
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                            />

                        </div>

                    </div>

                    {/* =================================================
                        TABLE
                    ================================================= */}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-slate-900">

                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">

                            <div>

                                <h2 className="font-bold text-slate-900">
                                    Billing Invoices
                                </h2>

                                <p className="text-xs text-slate-400 mt-1">
                                    {
                                        filteredInvoices.length
                                    }{" "}
                                    invoice
                                    {filteredInvoices.length !==
                                        1
                                        ? "s"
                                        : ""}
                                </p>

                            </div>

                        </div>

                        {filteredInvoices.length ===
                            0 ? (
                            <div className="text-center py-20">

                                <FileText className="w-12 h-12 mx-auto text-slate-200" />

                                <h3 className="mt-4 font-semibold text-slate-700">
                                    No invoices found
                                </h3>

                                <p className="text-sm text-slate-400 mt-1">
                                    Your invoices will
                                    appear here once
                                    they are generated
                                    by Talent Corner.
                                </p>

                            </div>
                        ) : (
                            <div className="overflow-x-auto">

                                <table className="w-full text-left">

                                    <thead>

                                        <tr className="bg-slate-50 border-b border-slate-100">

                                            {[
                                                "Invoice",
                                                "Billing Month",
                                                "Invoice Date",
                                                "Due Date",
                                                "Total",
                                                "Outstanding",
                                                "Status",
                                                "Action",
                                            ].map(
                                                (
                                                    heading
                                                ) => (
                                                    <th
                                                        key={
                                                            heading
                                                        }
                                                        className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"
                                                    >
                                                        {
                                                            heading
                                                        }
                                                    </th>
                                                )
                                            )}

                                        </tr>

                                    </thead>

                                    <tbody className="divide-y divide-slate-100">

                                        {filteredInvoices.map(
                                            (
                                                invoice
                                            ) => {

                                                const status =
                                                    getPaymentStatus(
                                                        invoice
                                                    );

                                                const StatusIcon =
                                                    status.icon;

                                                const confirmation =
                                                    getConfirmationStatus(
                                                        invoice
                                                    );

                                                const ConfirmationIcon =
                                                    confirmation?.icon;

                                                const dispute =
                                                    getDisputeStatus(
                                                        invoice
                                                    );

                                                const DisputeIcon =
                                                    dispute?.icon;

                                                const pendingVerification =
                                                    isPaymentPendingVerification(
                                                        invoice
                                                    );

                                                const rejected =
                                                    isPaymentRejected(
                                                        invoice
                                                    );

                                                return (
                                                    <tr
                                                        key={
                                                            invoice.id
                                                        }
                                                        className="hover:bg-slate-50 transition"
                                                    >

                                                        {/* INVOICE */}

                                                        <td className="px-5 py-4">

                                                            <div className="flex items-center gap-3">

                                                                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">

                                                                    <FileText className="w-4 h-4 text-emerald-600" />

                                                                </div>

                                                                <div>

                                                                    <p className="font-bold text-sm text-slate-900">
                                                                        {
                                                                            invoice.invoiceNumber
                                                                        }
                                                                    </p>

                                                                    <p className="text-xs text-slate-400">
                                                                        {
                                                                            invoice.lifecycleState
                                                                        }
                                                                    </p>

                                                                </div>

                                                            </div>

                                                        </td>

                                                        {/* BILLING MONTH */}

                                                        <td className="px-5 py-4 text-sm text-slate-700">
                                                            {formatBillingMonth(
                                                                invoice.billingMonth
                                                            )}
                                                        </td>

                                                        {/* INVOICE DATE */}

                                                        <td className="px-5 py-4 text-sm text-slate-700">
                                                            {formatDate(
                                                                invoice.invoiceDate
                                                            )}
                                                        </td>

                                                        {/* DUE DATE */}

                                                        <td className="px-5 py-4">

                                                            <div className="flex items-center gap-1.5 text-sm text-slate-700">

                                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />

                                                                {formatDate(
                                                                    invoice.dueDate
                                                                )}

                                                            </div>

                                                        </td>

                                                        {/* TOTAL */}

                                                        <td className="px-5 py-4 font-semibold text-slate-900 whitespace-nowrap">

                                                            ₹
                                                            {formatCurrency(
                                                                invoice.totalAmount
                                                            )}

                                                        </td>

                                                        {/* OUTSTANDING */}

                                                        <td className="px-5 py-4">

                                                            <span
                                                                className={`font-bold ${invoice.outstanding >
                                                                    0
                                                                    ? "text-red-600"
                                                                    : "text-emerald-600"
                                                                    }`}
                                                            >
                                                                ₹
                                                                {formatCurrency(
                                                                    invoice.outstanding
                                                                )}
                                                            </span>

                                                        </td>

                                                        {/* STATUS */}

                                                        <td className="px-5 py-4">

                                                            <div className="space-y-2">

                                                                {/* PAYMENT STATUS */}

                                                                <span
                                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${status.className}`}
                                                                >

                                                                    <StatusIcon className="w-3.5 h-3.5" />

                                                                    {
                                                                        status.label
                                                                    }

                                                                </span>

                                                                {/* PAYMENT CONFIRMATION */}

                                                                {confirmation && (
                                                                    <div>

                                                                        <span
                                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${confirmation.className}`}
                                                                        >

                                                                            {ConfirmationIcon && (
                                                                                <ConfirmationIcon className="w-3 h-3" />
                                                                            )}

                                                                            {
                                                                                confirmation.label
                                                                            }

                                                                        </span>

                                                                    </div>
                                                                )}

                                                                {/* PAYMENT REJECTION */}

                                                                {rejected &&
                                                                    invoice.rejectionReason && (
                                                                        <div className="max-w-[220px] rounded-lg bg-red-50 border border-red-100 p-2.5">

                                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">
                                                                                Payment Rejection Reason
                                                                            </p>

                                                                            <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
                                                                                {
                                                                                    invoice.rejectionReason
                                                                                }
                                                                            </p>

                                                                        </div>
                                                                    )}

                                                                {/* DISPUTE */}

                                                                {dispute && (
                                                                    <div>

                                                                        <span
                                                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${dispute.className}`}
                                                                        >

                                                                            {DisputeIcon && (
                                                                                <DisputeIcon className="w-3 h-3" />
                                                                            )}

                                                                            {
                                                                                dispute.label
                                                                            }

                                                                        </span>

                                                                    </div>
                                                                )}

                                                                {/* DISPUTE REASON */}

                                                                {invoice.disputeStatus &&
                                                                    invoice.disputeReason && (
                                                                        <div className="max-w-[240px] rounded-lg bg-orange-50 border border-orange-100 p-2.5">

                                                                            <p className="text-[10px] uppercase tracking-wider font-bold text-orange-600">
                                                                                Dispute Reason
                                                                            </p>

                                                                            <p className="text-[11px] text-orange-700 mt-1 leading-relaxed">
                                                                                {
                                                                                    invoice.disputeReason
                                                                                }
                                                                            </p>

                                                                        </div>
                                                                    )}

                                                            </div>

                                                        </td>

                                                        {/* ACTION */}

                                                        <td className="px-5 py-4">

                                                            <div className="flex items-center gap-2 flex-wrap">

                                                                {/* VIEW */}

                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedInvoice(
                                                                            invoice
                                                                        );

                                                                        setShowInvoiceDetails(
                                                                            true
                                                                        );
                                                                    }}
                                                                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition"
                                                                    title="View Invoice"
                                                                >

                                                                    <Eye className="w-4 h-4" />

                                                                </button>

                                                                {/* VIEW BILLING INFO */}

                                                                <button
                                                                    onClick={() =>
                                                                        openBillingInfo(
                                                                            invoice
                                                                        )
                                                                    }
                                                                    className="px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                                                                    title="View Invoice Calculation"
                                                                >

                                                                    <Info className="w-3.5 h-3.5" />

                                                                    View Info

                                                                </button>

                                                                {/* RAISE DISPUTE */}
                                                                {canRaiseDispute(invoice) && (
                                                                    <button
                                                                        onClick={() => openDisputeModal(invoice)}
                                                                        className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                                                                        title="Raise Invoice Dispute"
                                                                    >
                                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                                        Raise Dispute
                                                                    </button>
                                                                )}

                                                                {/* PAYMENT BUTTONS */}
                                                                {!pendingVerification && !isDisputePendingReview(invoice) && (
                                                                    <>
                                                                        {isPaymentRejected(invoice) && (
                                                                            <button
                                                                                onClick={() => openPaymentModal(invoice)}
                                                                                className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                                                                            >
                                                                                <CreditCard className="w-3.5 h-3.5" />
                                                                                Report Again
                                                                            </button>
                                                                        )}

                                                                        {isPaymentVerified(invoice) && invoice.paymentStatus.toLowerCase() !== "paid" && (
                                                                            <button
                                                                                onClick={() => openPaymentModal(invoice)}
                                                                                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                                                                            >
                                                                                <CreditCard className="w-3.5 h-3.5" />
                                                                                Pay Now
                                                                            </button>
                                                                        )}

                                                                        {isPaymentVerified(invoice) && invoice.paymentStatus.toLowerCase() === "paid" && (
                                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                                Paid
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}

                                                                {/* NORMAL PAYMENT (not verified, not rejected) */}
                                                                {!pendingVerification &&
                                                                    !rejected &&
                                                                    !isDisputePendingReview(invoice) &&
                                                                    !isPaymentVerified(invoice) &&
                                                                    canReportPayment(invoice) && (
                                                                        <button
                                                                            onClick={() => openPaymentModal(invoice)}
                                                                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                                                                        >
                                                                            <CreditCard className="w-3.5 h-3.5" />
                                                                            Report Payment
                                                                        </button>
                                                                    )}

                                                            </div>

                                                        </td>

                                                    </tr>
                                                );
                                            }
                                        )}

                                    </tbody>

                                </table>

                            </div>
                        )}

                    </div>

                </div>

            </main>

            {/* =====================================================
                BILLING INFORMATION MODAL
            ===================================================== */}

            {showBillingInfo &&
                selectedInvoice && (
                    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">

                        <div className="bg-white text-slate-900 w-full max-w-xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">

                            {/* HEADER */}

                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">

                                <div>

                                    <p className="text-xs uppercase tracking-wider text-blue-600 font-bold">
                                        Invoice Calculation
                                    </p>

                                    <h2 className="text-xl font-bold text-slate-900 mt-1">
                                        {
                                            selectedInvoice.invoiceNumber
                                        }
                                    </h2>

                                    <p className="text-xs text-slate-500 mt-1">
                                        {
                                            selectedInvoice.clientName
                                        }
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowBillingInfo(
                                            false
                                        )
                                    }
                                    className="p-2 rounded-lg hover:bg-slate-100 bg-white"
                                >

                                    <X className="w-5 h-5 text-slate-500" />

                                </button>

                            </div>

                            {/* BODY */}

                            <div className="p-6 space-y-5">

                                {/* INFO */}

                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">

                                    <div className="flex gap-3">

                                        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />

                                        <div>

                                            <p className="text-sm font-bold text-blue-800">
                                                How your invoice is calculated
                                            </p>

                                            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                                                The invoice amount is calculated
                                                from employee pay rates,
                                                employer statutory contributions,
                                                Talent Corner service charges
                                                and applicable GST.
                                            </p>

                                        </div>

                                    </div>

                                </div>

                                {/* EMPLOYEE COUNT */}

                                <div className="bg-slate-50 rounded-xl p-4">

                                    <div className="flex justify-between items-center">

                                        <div>

                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                Deployed Employees
                                            </p>

                                            <p className="text-lg font-bold text-slate-900 mt-1">
                                                {
                                                    selectedInvoice.employeeCount
                                                }
                                            </p>

                                        </div>

                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">

                                            <FileText className="w-5 h-5 text-emerald-600" />

                                        </div>

                                    </div>

                                </div>

                                {/* CALCULATION */}

                                <div className="border border-slate-200 rounded-xl overflow-hidden">

                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">

                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            Billing Breakdown
                                        </p>

                                    </div>

                                    <div className="p-4 space-y-4">

                                        <BillingMoneyRow
                                            label="Total Employee Pay Rate"
                                            value={
                                                selectedInvoice.totalPayRate
                                            }
                                        />

                                        <BillingMoneyRow
                                            label="Employer Statutory Contribution"
                                            value={
                                                selectedInvoice.employerStatutory
                                            }
                                        />

                                        <BillingMoneyRow
                                            label="Agency Service Charge / Markup"
                                            value={
                                                selectedInvoice.serviceCharge
                                            }
                                        />

                                        <BillingMoneyRow
                                            label="Talent Corner Gross Margin"
                                            value={
                                                selectedInvoice.grossMargin
                                            }
                                        />

                                        <div className="border-t border-slate-200 pt-4">

                                            <BillingMoneyRow
                                                label="Subtotal"
                                                value={
                                                    selectedInvoice.subtotal
                                                }
                                                bold
                                            />

                                        </div>

                                        <div className="pt-2">

                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                                                GST
                                                {selectedInvoice.gstType
                                                    ? ` (${selectedInvoice.gstType})`
                                                    : ""}
                                            </p>

                                            {selectedInvoice.cgst >
                                                0 && (
                                                    <BillingMoneyRow
                                                        label="CGST (9%)"
                                                        value={
                                                            selectedInvoice.cgst
                                                        }
                                                    />
                                                )}

                                            {selectedInvoice.sgst >
                                                0 && (
                                                    <BillingMoneyRow
                                                        label="SGST (9%)"
                                                        value={
                                                            selectedInvoice.sgst
                                                        }
                                                    />
                                                )}

                                            {selectedInvoice.igst >
                                                0 && (
                                                    <BillingMoneyRow
                                                        label="IGST"
                                                        value={
                                                            selectedInvoice.igst
                                                        }
                                                    />
                                                )}

                                            <div className="border-t border-slate-200 mt-4 pt-4">

                                                <BillingMoneyRow
                                                    label="Total GST"
                                                    value={
                                                        selectedInvoice.totalGst
                                                    }
                                                    bold
                                                />

                                            </div>

                                        </div>

                                    </div>

                                </div>

                                {/* TOTAL */}

                                <div className="bg-emerald-600 rounded-xl p-5 text-white">

                                    <div className="flex justify-between items-center gap-4">

                                        <div>

                                            <p className="text-xs uppercase tracking-wider text-emerald-100 font-semibold">
                                                Total Client Invoice Amount
                                            </p>

                                            <p className="text-2xl font-bold mt-1">
                                                ₹
                                                {formatCurrency(
                                                    selectedInvoice.totalAmount
                                                )}
                                            </p>

                                        </div>

                                        <IndianRupee className="w-8 h-8 text-emerald-100" />

                                    </div>

                                </div>

                                {/* CLOSE */}

                                <div className="flex justify-end">

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowBillingInfo(
                                                false
                                            )
                                        }
                                        className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                                    >
                                        Close
                                    </button>

                                </div>

                            </div>

                        </div>

                    </div>
                )}

            {/* =====================================================
                INVOICE DETAILS MODAL
            ===================================================== */}

            {showInvoiceDetails &&
                selectedInvoice && (
                    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">

                        <div className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">

                            {/* HEADER */}

                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">

                                <div>

                                    <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                                        Invoice Details
                                    </p>

                                    <h2 className="text-xl font-bold text-slate-900 mt-1">
                                        {
                                            selectedInvoice.invoiceNumber
                                        }
                                    </h2>

                                </div>

                                <button
                                    onClick={() =>
                                        setShowInvoiceDetails(
                                            false
                                        )
                                    }
                                    className="p-2 rounded-lg hover:bg-slate-100 bg-white"
                                >

                                    <X className="w-5 h-5 text-slate-500" />

                                </button>

                            </div>

                            {/* BODY */}

                            <div className="p-6 space-y-6 text-slate-900">

                                {/* DETAILS */}

                                <div className="grid grid-cols-2 gap-4">

                                    <Detail
                                        label="Billing Month"
                                        value={formatBillingMonth(
                                            selectedInvoice.billingMonth
                                        )}
                                    />

                                    <Detail
                                        label="Invoice Date"
                                        value={formatDate(
                                            selectedInvoice.invoiceDate
                                        )}
                                    />

                                    <Detail
                                        label="Due Date"
                                        value={formatDate(
                                            selectedInvoice.dueDate
                                        )}
                                    />

                                    <Detail
                                        label="Lifecycle"
                                        value={
                                            selectedInvoice.lifecycleState
                                        }
                                    />

                                </div>

                                {/* VIEW BILLING INFO */}

                                <button
                                    type="button"
                                    onClick={() =>
                                        openBillingInfo(
                                            selectedInvoice
                                        )
                                    }
                                    className="w-full px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-semibold flex items-center justify-center gap-2"
                                >

                                    <Info className="w-4 h-4" />

                                    View Invoice Calculation

                                </button>

                                {/* FINANCIAL */}

                                <div className="bg-slate-50 rounded-xl p-5 space-y-4">

                                    <MoneyRow
                                        label="Invoice Amount"
                                        value={
                                            selectedInvoice.totalAmount
                                        }
                                    />

                                    <MoneyRow
                                        label="Amount Paid"
                                        value={
                                            selectedInvoice.amountPaid
                                        }
                                    />

                                    <MoneyRow
                                        label="TDS Deducted"
                                        value={
                                            selectedInvoice.tdsDeducted
                                        }
                                    />

                                    <MoneyRow
                                        label="Amount Settled"
                                        value={
                                            selectedInvoice.amountSettled
                                        }
                                    />

                                    <div className="border-t border-slate-200 pt-4">

                                        <MoneyRow
                                            label="Outstanding"
                                            value={
                                                selectedInvoice.outstanding
                                            }
                                            bold
                                        />

                                    </div>

                                </div>

                                {/* PAYMENT CONFIRMATION */}

                                {selectedInvoice.confirmationStatus && (
                                    <div
                                        className={`rounded-xl border p-4 ${String(
                                            selectedInvoice.confirmationStatus
                                        ).toLowerCase() ===
                                            "rejected"
                                            ? "bg-red-50 border-red-200"
                                            : String(
                                                selectedInvoice.confirmationStatus
                                            ).toLowerCase() ===
                                                "pending verification"
                                                ? "bg-amber-50 border-amber-200"
                                                : "bg-emerald-50 border-emerald-200"
                                            }`}
                                    >

                                        <div className="flex items-start gap-3">

                                            {String(
                                                selectedInvoice.confirmationStatus
                                            ).toLowerCase() ===
                                                "rejected" ? (
                                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                                            ) : String(
                                                selectedInvoice.confirmationStatus
                                            ).toLowerCase() ===
                                                "pending verification" ? (
                                                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                                            ) : (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                            )}

                                            <div className="flex-1">

                                                <p
                                                    className={`text-sm font-bold ${String(
                                                        selectedInvoice.confirmationStatus
                                                    ).toLowerCase() ===
                                                        "rejected"
                                                        ? "text-red-700"
                                                        : String(
                                                            selectedInvoice.confirmationStatus
                                                        ).toLowerCase() ===
                                                            "pending verification"
                                                            ? "text-amber-700"
                                                            : "text-emerald-700"
                                                        }`}
                                                >

                                                    {String(
                                                        selectedInvoice.confirmationStatus
                                                    ).toLowerCase() ===
                                                        "rejected"
                                                        ? "Payment Verification Rejected"
                                                        : selectedInvoice.confirmationStatus}

                                                </p>

                                                {/* REJECTION REASON */}

                                                {String(
                                                    selectedInvoice.confirmationStatus
                                                ).toLowerCase() ===
                                                    "rejected" && (
                                                        <div className="mt-3">

                                                            <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                                                                Rejection Reason
                                                            </p>

                                                            <p className="text-sm text-red-700 mt-1 leading-relaxed">
                                                                {selectedInvoice.rejectionReason ||
                                                                    "No rejection reason was provided."}
                                                            </p>

                                                        </div>
                                                    )}

                                                {/* PAYMENT DETAILS */}

                                                {selectedInvoice.confirmationReference && (
                                                    <div className="mt-3 grid grid-cols-2 gap-3">

                                                        <Detail
                                                            label="Reported Amount"
                                                            value={`₹${formatCurrency(
                                                                selectedInvoice.confirmationAmount
                                                            )}`}
                                                        />

                                                        <Detail
                                                            label="Payment Date"
                                                            value={formatDate(
                                                                selectedInvoice.confirmationDate
                                                            )}
                                                        />

                                                        <Detail
                                                            label="Payment Mode"
                                                            value={
                                                                selectedInvoice.confirmationPaymentMode ||
                                                                "-"
                                                            }
                                                        />

                                                        <Detail
                                                            label="Reference"
                                                            value={
                                                                selectedInvoice.confirmationReference
                                                            }
                                                        />

                                                    </div>
                                                )}

                                            </div>

                                        </div>

                                    </div>
                                )}

                                {/* DISPUTE */}

                                {selectedInvoice.disputeStatus && (
                                    <div
                                        className={`rounded-xl border p-4 ${String(
                                            selectedInvoice.disputeStatus
                                        ).toLowerCase() ===
                                            "pending review"
                                            ? "bg-amber-50 border-amber-200"
                                            : String(
                                                selectedInvoice.disputeStatus
                                            ).toLowerCase() ===
                                                "accepted"
                                                ? "bg-red-50 border-red-200"
                                                : String(
                                                    selectedInvoice.disputeStatus
                                                ).toLowerCase() ===
                                                    "resolved"
                                                    ? "bg-emerald-50 border-emerald-200"
                                                    : "bg-slate-50 border-slate-200"
                                            }`}
                                    >

                                        <div className="flex items-start gap-3">

                                            <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />

                                            <div className="flex-1">

                                                <p className="text-sm font-bold text-slate-900">
                                                    Invoice Dispute
                                                </p>

                                                <div className="mt-2">

                                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Status
                                                    </p>

                                                    <p className="text-sm font-semibold text-slate-800 mt-1">
                                                        {
                                                            selectedInvoice.disputeStatus
                                                        }
                                                    </p>

                                                </div>

                                                {selectedInvoice.disputeType && (
                                                    <div className="mt-3">

                                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                            Issue Type
                                                        </p>

                                                        <p className="text-sm text-slate-700 mt-1">
                                                            {
                                                                selectedInvoice.disputeType
                                                            }
                                                        </p>

                                                    </div>
                                                )}

                                                {selectedInvoice.disputeReason && (
                                                    <div className="mt-3">

                                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                            Your Reason
                                                        </p>

                                                        <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                                                            {
                                                                selectedInvoice.disputeReason
                                                            }
                                                        </p>

                                                    </div>
                                                )}

                                                {selectedInvoice.adminResponse && (
                                                    <div className="mt-4 pt-4 border-t border-slate-200">

                                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                            Talent Corner Response
                                                        </p>

                                                        <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                                                            {
                                                                selectedInvoice.adminResponse
                                                            }
                                                        </p>

                                                    </div>
                                                )}

                                            </div>

                                        </div>

                                    </div>
                                )}

                                {/* ACTION */}

                                <div className="flex justify-end items-center gap-3 flex-wrap">

                                    {/* VIEW INFO */}

                                    <button
                                        onClick={() =>
                                            openBillingInfo(
                                                selectedInvoice
                                            )
                                        }
                                        className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-semibold flex items-center gap-2"
                                    >

                                        <Info className="w-4 h-4" />

                                        View Info

                                    </button>

                                    {/* DISPUTE */}

                                    {canRaiseDispute(
                                        selectedInvoice
                                    ) && (
                                            <button
                                                onClick={() => {
                                                    setShowInvoiceDetails(
                                                        false
                                                    );
                                                    openDisputeModal(
                                                        selectedInvoice
                                                    );
                                                }}
                                                className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-semibold flex items-center gap-2"
                                            >

                                                <AlertCircle className="w-4 h-4" />

                                                Raise Dispute

                                            </button>
                                        )}

                                    {/* CONFIRMATION VERIFIED — Pay Now or Paid */}
                                    {!isPaymentPendingVerification(selectedInvoice) &&
                                        !isPaymentRejected(selectedInvoice) &&
                                        !isDisputePendingReview(selectedInvoice) &&
                                        isPaymentVerified(selectedInvoice) && (
                                            <>
                                                {selectedInvoice.paymentStatus.toLowerCase() === "paid" ? (
                                                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        Paid
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setShowInvoiceDetails(false);
                                                            openPaymentModal(selectedInvoice);
                                                        }}
                                                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2"
                                                    >
                                                        <CreditCard className="w-4 h-4" />
                                                        Pay Now
                                                    </button>
                                                )}
                                            </>
                                        )}

                                    {/* NORMAL PAYMENT (not verified, not rejected) */}
                                    {!isPaymentPendingVerification(selectedInvoice) &&
                                        !isPaymentRejected(selectedInvoice) &&
                                        !isDisputePendingReview(selectedInvoice) &&
                                        !isPaymentVerified(selectedInvoice) &&
                                        canReportPayment(selectedInvoice) && (
                                            <button
                                                onClick={() => {
                                                    setShowInvoiceDetails(false);
                                                    openPaymentModal(selectedInvoice);
                                                }}
                                                className={`px-4 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 ${isPaymentRejected(selectedInvoice)
                                                    ? "bg-red-600 hover:bg-red-700"
                                                    : "bg-emerald-600 hover:bg-emerald-700"
                                                    }`}
                                            >
                                                <CreditCard className="w-4 h-4" />
                                                {isPaymentRejected(selectedInvoice)
                                                    ? "Report Payment Again"
                                                    : "Report Payment"}
                                            </button>
                                        )}

                                    {/* PAYMENT REJECTED */}
                                    {isPaymentRejected(selectedInvoice) && (
                                        <button
                                            onClick={() => {
                                                setShowInvoiceDetails(false);
                                                openPaymentModal(selectedInvoice);
                                            }}
                                            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center gap-2"
                                        >
                                            <CreditCard className="w-4 h-4" />
                                            Report Again
                                        </button>
                                    )}

                                    {/* PAYMENT PENDING VERIFICATION */}
                                    {isPaymentPendingVerification(selectedInvoice) && (
                                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                                            <Clock className="w-4 h-4" />
                                            Payment awaiting admin verification
                                        </div>
                                    )}

                                    {/* DISPUTE-LOCKED NOTICE */}
                                    {isDisputePendingReview(selectedInvoice) &&
                                        !isPaymentPendingVerification(selectedInvoice) && (
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                                                <Clock className="w-4 h-4" />
                                                Payment locked until Talent Corner responds to your dispute
                                            </div>
                                        )}

                                </div>

                            </div>

                        </div>

                    </div>
                )}

            {/* =====================================================
                DISPUTE MODAL
            ===================================================== */}

            {showDisputeModal &&
                selectedInvoice && (
                    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">

                        <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">

                            {/* HEADER */}

                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">

                                <div>

                                    <p className="text-xs uppercase tracking-wider text-red-600 font-bold">
                                        Invoice Dispute
                                    </p>

                                    <h2 className="text-xl font-bold text-slate-900 mt-1">
                                        Raise Dispute
                                    </h2>

                                    <p className="text-xs text-slate-500 mt-1">
                                        {
                                            selectedInvoice.invoiceNumber
                                        }
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowDisputeModal(
                                            false
                                        )
                                    }
                                    className="p-2 rounded-lg hover:bg-slate-100"
                                >

                                    <X className="w-5 h-5 text-slate-500" />

                                </button>

                            </div>

                            {/* NOTICE */}

                            <div className="mx-6 mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4">

                                <div className="flex gap-3">

                                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />

                                    <div>

                                        <p className="text-sm font-bold text-amber-800">
                                            Found an issue with this invoice?
                                        </p>

                                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                            If you believe the employee
                                            count, attendance, billing rate,
                                            statutory contribution, GST or
                                            another calculation is incorrect,
                                            explain the issue below.
                                        </p>

                                    </div>

                                </div>

                            </div>

                            {/* FORM */}

                            <form
                                onSubmit={
                                    handleSubmitDispute
                                }
                                className="p-6 space-y-5"
                            >

                                {/* INVOICE AMOUNT */}

                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">

                                    <div className="flex justify-between items-center">

                                        <span className="text-sm text-slate-600">
                                            Invoice Amount
                                        </span>

                                        <span className="font-bold text-slate-900">
                                            ₹
                                            {formatCurrency(
                                                selectedInvoice.totalAmount
                                            )}
                                        </span>

                                    </div>

                                </div>

                                {/* DISPUTE TYPE */}

                                <div>

                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Issue Type *
                                    </label>

                                    <select
                                        required
                                        value={
                                            disputeForm.dispute_type
                                        }
                                        onChange={(e) =>
                                            setDisputeForm(
                                                (
                                                    prev
                                                ) => ({
                                                    ...prev,
                                                    dispute_type:
                                                        e
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                                    >

                                        {DISPUTE_TYPES.map(
                                            (
                                                type
                                            ) => (
                                                <option
                                                    key={
                                                        type
                                                    }
                                                    value={
                                                        type
                                                    }
                                                >
                                                    {
                                                        type
                                                    }
                                                </option>
                                            )
                                        )}

                                    </select>

                                </div>

                                {/* REASON */}

                                <div>

                                    <div className="flex justify-between items-center mb-1.5">

                                        <label className="block text-xs font-semibold text-slate-700">
                                            Explain the issue *
                                        </label>

                                        <span className="text-[11px] text-slate-400">
                                            {
                                                disputeForm.reason
                                                    .length
                                            }
                                            /1000
                                        </span>

                                    </div>

                                    <textarea
                                        rows="6"
                                        maxLength={
                                            1000
                                        }
                                        required
                                        placeholder="Example: The invoice shows 12 employees, but only 10 employees were deployed during August. Please review the employee count and recalculate the invoice."
                                        value={
                                            disputeForm.reason
                                        }
                                        onChange={(e) =>
                                            setDisputeForm(
                                                (
                                                    prev
                                                ) => ({
                                                    ...prev,
                                                    reason:
                                                        e
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 resize-none"
                                    />

                                </div>

                                {/* WARNING */}

                                <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl p-3">

                                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />

                                    <p className="text-xs text-red-700 leading-relaxed">
                                        Submitting a dispute does not
                                        automatically cancel or reject the
                                        invoice. Talent Corner will review
                                        the issue and respond to the dispute.
                                    </p>

                                </div>

                                {/* ACTIONS */}

                                <div className="flex justify-end gap-3 pt-2">

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowDisputeModal(
                                                false
                                            )
                                        }
                                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={
                                            submittingDispute
                                        }
                                        className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >

                                        {submittingDispute ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />

                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />

                                                Submit Dispute
                                            </>
                                        )}

                                    </button>

                                </div>

                            </form>

                        </div>

                    </div>
                )}

            {/* =====================================================
                REPORT PAYMENT MODAL
            ===================================================== */}

            {showPaymentModal &&
                selectedInvoice && (
                    <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">

                        <div className="bg-white text-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">

                            {/* HEADER */}

                            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">

                                <div>

                                    <p className="text-xs uppercase tracking-wider text-emerald-600 font-bold">
                                        Payment Confirmation
                                    </p>

                                    <h2 className="text-xl font-bold text-slate-900 mt-1">
                                        {isPaymentRejected(
                                            selectedInvoice
                                        )
                                            ? "Report Payment Again"
                                            : "Report Payment"}
                                    </h2>

                                    <p className="text-xs text-slate-500 mt-1">
                                        {
                                            selectedInvoice.invoiceNumber
                                        }
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPaymentModal(
                                            false
                                        )
                                    }
                                    className="p-2 rounded-lg hover:bg-slate-100 bg-white"
                                >

                                    <X className="w-5 h-5 text-slate-500" />

                                </button>

                            </div>

                            {/* PAYMENT REJECTION NOTICE */}

                            {isPaymentRejected(
                                selectedInvoice
                            ) && (
                                    <div className="mx-6 mt-5 bg-red-50 border border-red-200 rounded-xl p-4">

                                        <div className="flex gap-3">

                                            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />

                                            <div>

                                                <p className="text-sm font-bold text-red-700">
                                                    Previous Payment Rejected
                                                </p>

                                                <p className="text-xs text-red-600 mt-1">
                                                    Please correct the
                                                    payment information
                                                    and submit the
                                                    payment confirmation
                                                    again.
                                                </p>

                                                <div className="mt-3 pt-3 border-t border-red-200">

                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-red-500">
                                                        Rejection Reason
                                                    </p>

                                                    <p className="text-xs text-red-700 mt-1 leading-relaxed">
                                                        {selectedInvoice.rejectionReason ||
                                                            "No rejection reason was provided."}
                                                    </p>

                                                </div>

                                            </div>

                                        </div>

                                    </div>
                                )}

                            {/* FORM */}

                            <form
                                onSubmit={
                                    handleSubmitPayment
                                }
                                className="p-6 space-y-4 text-slate-900"
                            >

                                {/* OUTSTANDING */}

                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">

                                    <div className="flex justify-between text-sm">

                                        <span className="text-slate-700">
                                            Outstanding Amount
                                        </span>

                                        <span className="font-bold text-emerald-700">
                                            ₹
                                            {formatCurrency(
                                                selectedInvoice.outstanding
                                            )}
                                        </span>

                                    </div>

                                </div>

                                {/* AMOUNT */}

                                <div>

                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Amount Paid *
                                    </label>

                                    <div className="relative">

                                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            max={
                                                selectedInvoice.outstanding
                                            }
                                            required
                                            value={
                                                paymentForm.amount_reported
                                            }
                                            onChange={(e) =>
                                                setPaymentForm(
                                                    (
                                                        prev
                                                    ) => ({
                                                        ...prev,
                                                        amount_reported:
                                                            e
                                                                .target
                                                                .value,
                                                    })
                                                )
                                            }
                                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                        />

                                    </div>

                                </div>

                                {/* PAYMENT DATE */}

                                <div>

                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Payment Date *
                                    </label>

                                    <input
                                        type="date"
                                        required
                                        max={TODAY}
                                        value={
                                            paymentForm.payment_date
                                        }
                                        onChange={(e) =>
                                            setPaymentForm(
                                                (
                                                    prev
                                                ) => ({
                                                    ...prev,
                                                    payment_date:
                                                        e
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                    />

                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Select the actual date on which
                                        the payment was made.
                                    </p>

                                </div>

                                {/* PAYMENT MODE */}

                                <div>

                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Payment Mode *
                                    </label>

                                    <select
                                        value={
                                            paymentForm.payment_mode
                                        }
                                        onChange={(e) =>
                                            setPaymentForm(
                                                (
                                                    prev
                                                ) => ({
                                                    ...prev,
                                                    payment_mode:
                                                        e
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                    >

                                        {PAYMENT_MODES.map(
                                            (
                                                mode
                                            ) => (
                                                <option
                                                    key={
                                                        mode
                                                    }
                                                    value={
                                                        mode
                                                    }
                                                >
                                                    {
                                                        mode
                                                    }
                                                </option>
                                            )
                                        )}

                                    </select>

                                </div>

                                {/* REFERENCE */}

                                <div>

                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        UTR / Transaction Reference *
                                    </label>

                                    <input
                                        type="text"
                                        required
                                        placeholder="Enter UTR or transaction ID"
                                        value={
                                            paymentForm.reference_number
                                        }
                                        onChange={(e) =>
                                            setPaymentForm(
                                                (
                                                    prev
                                                ) => ({
                                                    ...prev,
                                                    reference_number:
                                                        e
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                    />

                                </div>

                                {/* PROOF URL */}

                                <div>

                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Payment Proof URL
                                        <span className="text-slate-400 font-normal">
                                            {" "}
                                            (optional)
                                        </span>
                                    </label>

                                    <div className="relative">

                                        <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                                        <input
                                            type="url"
                                            placeholder="https://..."
                                            value={
                                                paymentForm.payment_proof_url
                                            }
                                            onChange={(e) =>
                                                setPaymentForm(
                                                    (
                                                        prev
                                                    ) => ({
                                                        ...prev,
                                                        payment_proof_url:
                                                            e
                                                                .target
                                                                .value,
                                                    })
                                                )
                                            }
                                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                        />

                                    </div>

                                </div>

                                {/* NOTES */}

                                <div>

                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                        Notes
                                    </label>

                                    <textarea
                                        rows="3"
                                        placeholder="Optional payment notes..."
                                        value={
                                            paymentForm.notes
                                        }
                                        onChange={(e) =>
                                            setPaymentForm(
                                                (
                                                    prev
                                                ) => ({
                                                    ...prev,
                                                    notes:
                                                        e
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 resize-none"
                                    />

                                </div>

                                {/* WARNING */}

                                <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">

                                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />

                                    <p className="text-xs text-amber-700">
                                        Submitting this form does
                                        not mark the invoice as
                                        paid. Talent Corner will
                                        verify the transaction
                                        before recording the
                                        payment.
                                    </p>

                                </div>

                                {/* ACTIONS */}

                                <div className="flex justify-end gap-3 pt-2">

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPaymentModal(
                                                false
                                            )
                                        }
                                        className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={
                                            submittingPayment
                                        }
                                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >

                                        {submittingPayment ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />

                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />

                                                {isPaymentRejected(
                                                    selectedInvoice
                                                )
                                                    ? "Submit Again"
                                                    : "Submit Payment"}
                                            </>
                                        )}

                                    </button>

                                </div>

                            </form>

                        </div>

                    </div>
                )}

        </div>
    );
}

// =============================================================
// SUMMARY CARD
// =============================================================

function SummaryCard({
    title,
    value,
    icon: Icon,
}) {
    return (
        <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-5 shadow-sm">

            <div className="flex items-center justify-between">

                <div>

                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {title}
                    </p>

                    <p className="text-xl font-bold text-slate-900 mt-2">
                        {value}
                    </p>

                </div>

                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">

                    <Icon className="w-5 h-5 text-emerald-600" />

                </div>

            </div>

        </div>
    );
}

// =============================================================
// DETAIL
// =============================================================

function Detail({
    label,
    value,
}) {
    return (
        <div>

            <p className="text-xs text-slate-500 font-semibold">
                {label}
            </p>

            <p className="text-sm font-semibold text-slate-900 mt-1 break-words">
                {value}
            </p>

        </div>
    );
}

// =============================================================
// MONEY ROW
// =============================================================

function MoneyRow({
    label,
    value,
    bold = false,
}) {
    return (
        <div className="flex justify-between items-center gap-4">

            <span
                className={`text-sm ${bold
                    ? "font-bold text-slate-900"
                    : "text-slate-600"
                    }`}
            >
                {label}
            </span>

            <span
                className={`text-sm whitespace-nowrap ${bold
                    ? "font-bold text-emerald-600"
                    : "font-semibold text-slate-900"
                    }`}
            >
                ₹
                {Number(
                    value || 0
                ).toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }
                )}
            </span>

        </div>
    );
}

// =============================================================
// BILLING MONEY ROW
// =============================================================

function BillingMoneyRow({
    label,
    value,
    bold = false,
}) {
    return (
        <div className="flex justify-between items-center gap-4">

            <span
                className={`text-sm ${bold
                    ? "font-bold text-slate-900"
                    : "text-slate-600"
                    }`}
            >
                {label}
            </span>

            <span
                className={`text-sm whitespace-nowrap ${bold
                    ? "font-bold text-slate-900"
                    : "font-semibold text-slate-900"
                    }`}
            >
                ₹
                {Number(
                    value || 0
                ).toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }
                )}
            </span>

        </div>
    );
}

export default ClientInvoiceManagement;