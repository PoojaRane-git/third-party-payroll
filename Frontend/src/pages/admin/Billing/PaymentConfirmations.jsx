import React, {
    useEffect,
    useMemo,
    useState,
} from "react";

import axios from "axios";

import {
    AlertCircle,
    CheckCircle2,
    CreditCard,
    Eye,
    FileText,
    Loader2,
    RefreshCw,
    Search,
    X,
    XCircle,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";

// =====================================================
// API
// =====================================================

const API_BASE =
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000/api";

// =====================================================
// HELPERS
// =====================================================

const formatCurrency = (value) => {
    const number = Number(value || 0);

    return `₹${number.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const normalizeStatus = (status) => {
    return String(status || "")
        .trim()
        .toLowerCase();
};

// =====================================================
// PAYMENT STATUS
// =====================================================

const getPaymentConfirmationStatus = (payment) => {
    return (
        payment?.confirmation_status ||
        payment?.status ||
        payment?.payment_status ||
        "Pending Verification"
    );
};

const isPendingPayment = (payment) => {
    const status = normalizeStatus(
        getPaymentConfirmationStatus(payment)
    );

    return (
        status === "pending verification" ||
        status === "pending" ||
        status === "pending review"
    );
};

// =====================================================
// DISPUTE STATUS
// =====================================================

// Database may contain:
// Pending
// Pending Review
// Verified
// Rejected

const isPendingDispute = (status) => {
    const normalized = normalizeStatus(status);

    return (
        normalized === "pending" ||
        normalized === "pending review"
    );
};

const isResolvedDispute = (status) => {
    const normalized = normalizeStatus(status);

    return (
        normalized === "verified" ||
        normalized === "resolved" ||
        normalized === "closed"
    );
};

const isRejectedDispute = (status) => {
    return (
        normalizeStatus(status) === "rejected"
    );
};

const formatDateTime = (value) => {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    });
};

// =====================================================
// COMPONENT
// =====================================================

export default function PaymentConfirmations() {

    // =================================================
    // PAYMENT STATE
    // =================================================

    const [payments, setPayments] = useState([]);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [errorMessage, setErrorMessage] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [statusFilter, setStatusFilter] =
        useState("All");

    const [selectedPayment, setSelectedPayment] =
        useState(null);

    const [action, setAction] =
        useState(null);

    const [tdsDeducted, setTdsDeducted] =
        useState("0");

    const [rejectionReason, setRejectionReason] =
        useState("");

    // =================================================
    // DISPUTE STATE
    // =================================================

    const [invoiceDisputes, setInvoiceDisputes] =
        useState([]);

    const [disputesLoading, setDisputesLoading] =
        useState(false);

    const [disputesError, setDisputesError] =
        useState("");

    const [selectedDispute, setSelectedDispute] =
        useState(null);

    const [showDisputeModal, setShowDisputeModal] =
        useState(false);

    const [showPreviousDisputes, setShowPreviousDisputes] =
        useState(false);

    const [disputeResponse, setDisputeResponse] =
        useState("");

    const [resolvingDispute, setResolvingDispute] =
        useState(false);

    // =================================================
    // GET ACTIVE DISPUTE
    // =================================================

    const getActiveDispute = (invoiceId) => {

        return (
            invoiceDisputes.find(
                (dispute) =>
                    Number(dispute.invoice_id) ===
                        Number(invoiceId) &&
                    isPendingDispute(
                        dispute.status
                    )
            ) || null
        );
    };

    const hasActiveInvoiceDispute = (
        invoiceId
    ) => {
        return Boolean(
            getActiveDispute(invoiceId)
        );
    };

    // =================================================
    // FETCH PAYMENTS
    // =================================================

    const fetchPayments = async () => {

        try {

            setLoading(true);
            setErrorMessage("");

            const response =
                await axios.get(
                    `${API_BASE}/payments`
                );

            if (
                response.data?.success === false
            ) {
                throw new Error(
                    response.data?.message ||
                    response.data?.error ||
                    "Failed to load payments."
                );
            }

            const paymentData =
                Array.isArray(
                    response.data?.payments
                )
                    ? response.data.payments
                    : [];

            setPayments(paymentData);

        } catch (error) {

            console.error(
                "Failed to fetch payment confirmations:",
                error
            );

            const message =
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                "Failed to load payment confirmations.";

            setErrorMessage(message);
            setPayments([]);

        } finally {

            setLoading(false);

        }
    };

   // =================================================
// FETCH INVOICE DISPUTES
// =================================================

const fetchInvoiceDisputes = async () => {
    try {
        setDisputesLoading(true);
        setDisputesError("");

        const response = await axios.get(
            `${API_BASE}/invoice-disputes`
        );

        console.log(
            "Invoice disputes API response:",
            response.data
        );

        if (response.data?.success === false) {
            throw new Error(
                response.data?.message ||
                response.data?.error ||
                "Failed to load invoice disputes."
            );
        }

        // -------------------------------------------------
        // Backend currently returns the array directly:
        //
        // [
        //   {
        //      id: 2,
        //      invoice_id: 1,
        //      ...
        //   }
        // ]
        //
        // Also support { disputes: [...] } so this
        // frontend works with either response format.
        // -------------------------------------------------

        let disputeData = [];

        if (Array.isArray(response.data)) {
            disputeData = response.data;
        } else if (
            Array.isArray(response.data?.disputes)
        ) {
            disputeData = response.data.disputes;
        }

        console.log(
            "Invoice disputes loaded:",
            disputeData
        );

        setInvoiceDisputes(disputeData);

    } catch (error) {
        console.error(
            "Failed to fetch invoice disputes:",
            error
        );

        const message =
            error.response?.data?.message ||
            error.response?.data?.error ||
            error.message ||
            "Failed to load invoice disputes.";

        setDisputesError(message);
        setInvoiceDisputes([]);

    } finally {
        setDisputesLoading(false);
    }
};
    // =================================================
    // REFRESH ALL
    // =================================================

    const refreshAll = async () => {

        await Promise.all([
            fetchPayments(),
            fetchInvoiceDisputes(),
        ]);
    };

    // =================================================
    // INITIAL LOAD
    // =================================================

    useEffect(() => {
        refreshAll();
    }, []);

    // =================================================
    // OPEN VERIFY MODAL
    // =================================================

    const openVerifyModal = (payment) => {

        const activeDispute =
            getActiveDispute(
                payment.invoice_id
            );

        if (activeDispute) {

            alert(
                "Payment verification is disabled because this invoice has an unresolved dispute."
            );

            return;
        }

        setSelectedPayment(payment);

        setAction("verify");

        setTdsDeducted(
            String(
                payment.tds_deducted || 0
            )
        );

        setRejectionReason("");
    };

    // =================================================
    // OPEN REJECT MODAL
    // =================================================

    const openRejectModal = (payment) => {

        const activeDispute =
            getActiveDispute(
                payment.invoice_id
            );

        if (activeDispute) {

            alert(
                "Payment rejection is disabled because this invoice has an unresolved dispute."
            );

            return;
        }

        setSelectedPayment(payment);

        setAction("reject");

        setTdsDeducted("0");

        setRejectionReason("");
    };

    // =================================================
    // OPEN VIEW PAYMENT
    // =================================================

    const openViewModal = (payment) => {

        setSelectedPayment(payment);

        setAction("view");

        setTdsDeducted("0");

        setRejectionReason("");
    };

    // =================================================
    // CLOSE PAYMENT MODAL
    // =================================================

    const closeModal = () => {

        if (saving) {
            return;
        }

        setSelectedPayment(null);
        setAction(null);
        setTdsDeducted("0");
        setRejectionReason("");
    };

    // =================================================
    // OPEN DISPUTE RESOLVE MODAL
    // =================================================

    const openDisputeResolveModal = (
        dispute
    ) => {

        if (
            !isPendingDispute(
                dispute.status
            )
        ) {
            return;
        }

        setSelectedDispute(dispute);

        setDisputeResponse("");

        setShowDisputeModal(true);
    };

    // =================================================
    // CLOSE DISPUTE MODAL
    // =================================================

    const closeDisputeModal = () => {

        if (resolvingDispute) {
            return;
        }

        setSelectedDispute(null);

        setDisputeResponse("");

        setShowDisputeModal(false);
    };

    // =================================================
    // RESOLVE DISPUTE
    // =================================================

    const handleResolveDispute = async () => {

        if (!selectedDispute) {
            return;
        }

        const responseText =
            disputeResponse.trim();

        if (responseText.length < 5) {

            alert(
                "Please enter an admin response."
            );

            return;
        }

        try {

            setResolvingDispute(true);

            const response =
                await axios.patch(
                    `${API_BASE}/invoice-disputes/${selectedDispute.id}/resolve`,
                    {
                        admin_response:
                            responseText,

                        reviewed_by:
                            "Admin",
                    }
                );

            if (
                response.data?.success === false
            ) {
                throw new Error(
                    response.data?.message ||
                    response.data?.error ||
                    "Failed to resolve dispute."
                );
            }

            alert(
                response.data?.message ||
                "Invoice dispute resolved successfully. Client can now make payment."
            );

            setSelectedDispute(null);
            setDisputeResponse("");
            setShowDisputeModal(false);

            await refreshAll();

        } catch (error) {

            console.error(
                "Resolve dispute error:",
                error
            );

            alert(
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                "Failed to resolve invoice dispute."
            );

        } finally {

            setResolvingDispute(false);

        }
    };

    // =================================================
    // VERIFY PAYMENT
    // =================================================

    const handleVerify = async () => {

        if (!selectedPayment) {
            return;
        }

        const activeDispute =
            getActiveDispute(
                selectedPayment.invoice_id
            );

        if (activeDispute) {

            alert(
                "Payment verification is disabled because this invoice has an unresolved dispute."
            );

            return;
        }

        const tds =
            Number(
                tdsDeducted || 0
            );

        if (
            !Number.isFinite(tds) ||
            tds < 0
        ) {

            alert(
                "Enter a valid TDS amount."
            );

            return;
        }

        try {

            setSaving(true);

            const response =
                await axios.patch(
                    `${API_BASE}/payments/${selectedPayment.id}/verify`,
                    {
                        verified_by:
                            "Admin",

                        tds_deducted:
                            tds,
                    }
                );

            if (
                response.data?.success === false
            ) {
                throw new Error(
                    response.data?.message ||
                    response.data?.error ||
                    "Failed to verify payment."
                );
            }

            alert(
                response.data?.message ||
                "Payment verified successfully."
            );

            closeModal();

            await refreshAll();

        } catch (error) {

            console.error(
                "Verify payment error:",
                error
            );

            alert(
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                "Failed to verify payment."
            );

        } finally {

            setSaving(false);

        }
    };

    // =================================================
    // REJECT PAYMENT
    // =================================================

    const handleReject = async () => {

        if (!selectedPayment) {
            return;
        }

        const activeDispute =
            getActiveDispute(
                selectedPayment.invoice_id
            );

        if (activeDispute) {

            alert(
                "Payment rejection is disabled because this invoice has an unresolved dispute."
            );

            return;
        }

        const reason =
            rejectionReason.trim();

        if (reason.length < 5) {

            alert(
                "Please provide a rejection reason."
            );

            return;
        }

        try {

            setSaving(true);

            const response =
                await axios.patch(
                    `${API_BASE}/payments/${selectedPayment.id}/reject`,
                    {
                        verified_by:
                            "Admin",

                        rejection_reason:
                            reason,
                    }
                );

            if (
                response.data?.success === false
            ) {
                throw new Error(
                    response.data?.message ||
                    response.data?.error ||
                    "Failed to reject payment."
                );
            }

            alert(
                response.data?.message ||
                "Payment confirmation rejected."
            );

            closeModal();

            await refreshAll();

        } catch (error) {

            console.error(
                "Reject payment error:",
                error
            );

            alert(
                error.response?.data?.message ||
                error.response?.data?.error ||
                error.message ||
                "Failed to reject payment."
            );

        } finally {

            setSaving(false);

        }
    };

    // =================================================
    // FILTER PAYMENTS
    // =================================================

    const filteredPayments =
        useMemo(() => {

            const query =
                search
                    .trim()
                    .toLowerCase();

            return payments.filter(
                (payment) => {

                    const confirmationStatus =
                        getPaymentConfirmationStatus(
                            payment
                        );

                    const searchableText = `
                        ${payment.invoice_number || ""}
                        ${payment.client_name || ""}
                        ${payment.reference_number || ""}
                        ${payment.payment_mode || ""}
                        ${confirmationStatus || ""}
                        ${payment.invoice_payment_status || ""}
                        ${payment.payment_completion_status || ""}
                    `.toLowerCase();

                    const matchesSearch =
                        !query ||
                        searchableText.includes(
                            query
                        );

                    const matchesStatus =
                        statusFilter === "All" ||
                        normalizeStatus(
                            confirmationStatus
                        ) ===
                        normalizeStatus(
                            statusFilter
                        );

                    return (
                        matchesSearch &&
                        matchesStatus
                    );
                }
            );

        }, [
            payments,
            search,
            statusFilter,
        ]);

    // =================================================
    // PAYMENT COUNTS
    // =================================================

    const pendingCount =
        payments.filter(
            (payment) =>
                isPendingPayment(payment)
        ).length;

    const verifiedCount =
        payments.filter(
            (payment) =>
                normalizeStatus(
                    getPaymentConfirmationStatus(
                        payment
                    )
                ) === "verified"
        ).length;

    const rejectedCount =
        payments.filter(
            (payment) =>
                normalizeStatus(
                    getPaymentConfirmationStatus(
                        payment
                    )
                ) === "rejected"
        ).length;

    // =================================================
    // DISPUTE LISTS
    // =================================================

    const pendingDisputes =
        useMemo(() => {

            return invoiceDisputes.filter(
                (dispute) =>
                    isPendingDispute(
                        dispute.status
                    )
            );

        }, [invoiceDisputes]);

    const previousDisputes =
        useMemo(() => {

            return invoiceDisputes.filter(
                (dispute) =>
                    !isPendingDispute(
                        dispute.status
                    )
            );

        }, [invoiceDisputes]);

    const pendingDisputeCount =
        pendingDisputes.length;

    const previousDisputeCount =
        previousDisputes.length;

    // =================================================
    // PAYMENT STATUS BADGE
    // =================================================

    const StatusBadge = ({
        status,
    }) => {

        const normalized =
            normalizeStatus(status);

        if (
            normalized ===
                "pending verification" ||
            normalized === "pending" ||
            normalized ===
                "pending review"
        ) {

            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 whitespace-nowrap">
                    <AlertCircle
                        size={13}
                    />

                    Pending Verification
                </span>
            );
        }

       if (
    normalized === "verified" ||
    normalized === "resolved" ||
    normalized === "closed"
)  {

            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 whitespace-nowrap">
                    <CheckCircle2
                        size={13}
                    />

                    Verified
                </span>
            );
        }

        if (
            normalized ===
            "rejected"
        ) {

            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                    <XCircle
                        size={13}
                    />

                    Rejected
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 whitespace-nowrap">
                <AlertCircle
                    size={13}
                />

                Pending Verification
            </span>
        );
    };

    // =================================================
    // INVOICE PAYMENT STATUS BADGE
    // =================================================

    const InvoicePaymentStatusBadge = ({
        status,
    }) => {

        const normalized =
            normalizeStatus(status);

        if (
            normalized ===
            "paid"
        ) {

            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 whitespace-nowrap">
                    <CheckCircle2
                        size={13}
                    />

                    Paid
                </span>
            );
        }

        if (
            normalized ===
            "partially paid"
        ) {

            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 whitespace-nowrap">
                    <CreditCard
                        size={13}
                    />

                    Partially Paid
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 whitespace-nowrap">
                <AlertCircle
                    size={13}
                />

                Pending
            </span>
        );
    };

    // =================================================
    // DISPUTE STATUS BADGE
    // =================================================

    const DisputeStatusBadge = ({
        status,
    }) => {

        const normalized =
            normalizeStatus(status);

        if (
            isPendingDispute(status)
        ) {

            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 whitespace-nowrap">
                    <AlertCircle
                        size={13}
                    />

                    Pending
                </span>
            );
        }

        if (
            normalized ===
            "verified"
        ) {

            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 whitespace-nowrap">
                    <CheckCircle2
                        size={13}
                    />

                    Resolved
                </span>
            );
        }

        if (
            normalized ===
            "rejected"
        ) {

            return (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                    <XCircle
                        size={13}
                    />

                    Rejected
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 whitespace-nowrap">
                {status || "Unknown"}
            </span>
        );
    };

    // =================================================
    // UI
    // =================================================

    return (

        <div className="flex min-h-screen bg-gray-50">

            <Sidebar />

            <main className="flex-1 p-6 overflow-x-auto">

                {/* =================================================
                    HEADER
                   ================================================= */}

                <div className="flex justify-between items-start mb-6">

                    <div>

                        <h1 className="text-2xl font-bold text-gray-900">
                            Payment Confirmations
                        </h1>

                        <p className="text-gray-500 mt-1">
                            Review client-reported payments and
                            resolve invoice disputes before payment
                            processing.
                        </p>

                    </div>

                    <button
                        onClick={
                            refreshAll
                        }
                        disabled={
                            loading ||
                            disputesLoading ||
                            resolvingDispute
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >

                        <RefreshCw
                            size={17}
                            className={
                                loading ||
                                disputesLoading
                                    ? "animate-spin"
                                    : ""
                            }
                        />

                        Refresh

                    </button>

                </div>

                {/* =================================================
                    PAYMENT ERROR
                   ================================================= */}

                {errorMessage && (

                    <div className="mb-5 border border-red-200 bg-red-50 text-red-700 rounded-xl p-4 flex items-start gap-3">

                        <AlertCircle
                            size={20}
                        />

                        <div>

                            <p className="font-semibold">
                                Failed to load payment confirmations
                            </p>

                            <p className="text-sm mt-1">
                                {errorMessage}
                            </p>

                            <button
                                onClick={
                                    fetchPayments
                                }
                                className="mt-3 px-3 py-2 bg-red-600 text-white rounded-lg text-sm"
                            >
                                Try Again
                            </button>

                        </div>

                    </div>

                )}

                {/* =================================================
                    PAYMENT SUMMARY
                   ================================================= */}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

                    <div className="bg-white border rounded-xl p-5">

                        <p className="text-sm text-gray-500">
                            Pending Verification
                        </p>

                        <p className="text-2xl font-bold mt-1">
                            {pendingCount}
                        </p>

                    </div>

                    <div className="bg-white border rounded-xl p-5">

                        <p className="text-sm text-gray-500">
                            Verified
                        </p>

                        <p className="text-2xl font-bold mt-1">
                            {verifiedCount}
                        </p>

                    </div>

                    <div className="bg-white border rounded-xl p-5">

                        <p className="text-sm text-gray-500">
                            Rejected
                        </p>

                        <p className="text-2xl font-bold mt-1">
                            {rejectedCount}
                        </p>

                    </div>

                </div>

                {/* =================================================
                    SEARCH
                   ================================================= */}

                <div className="bg-white border rounded-xl p-4 mb-5">

                    <div className="flex flex-col md:flex-row gap-3">

                        <div className="relative flex-1">

                            <Search
                                size={18}
                                className="absolute left-3 top-3 text-gray-400"
                            />

                            <input
                                value={
                                    search
                                }
                                onChange={(e) =>
                                    setSearch(
                                        e.target.value
                                    )
                                }
                                placeholder="Search invoice, client, reference..."
                                className="w-full border rounded-lg pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-gray-200"
                            />

                        </div>

                        <select
                            value={
                                statusFilter
                            }
                            onChange={(e) =>
                                setStatusFilter(
                                    e.target.value
                                )
                            }
                            className="border rounded-lg px-4 py-3"
                        >

                            <option value="All">
                                All Statuses
                            </option>

                            <option value="Pending Verification">
                                Pending Verification
                            </option>

                            <option value="Verified">
                                Verified
                            </option>

                            <option value="Rejected">
                                Rejected
                            </option>

                        </select>

                    </div>

                </div>

                {/* =================================================
                    PAYMENT TABLE
                   ================================================= */}

                <div className="bg-white border rounded-xl overflow-hidden">

                    {loading ? (

                        <div className="flex justify-center py-20">

                            <Loader2
                                size={32}
                                className="animate-spin text-gray-500"
                            />

                        </div>

                    ) : filteredPayments.length === 0 ? (

                        <div className="text-center py-20">

                            <CreditCard
                                size={42}
                                className="mx-auto text-gray-300 mb-3"
                            />

                            <p className="font-semibold text-gray-600">
                                No payment confirmations found
                            </p>

                            <p className="text-sm text-gray-400 mt-1">
                                Client payment submissions will appear here.
                            </p>

                        </div>

                    ) : (

                        <div className="overflow-x-auto">

                            <table className="w-full min-w-[1250px]">

                                <thead className="bg-gray-50 border-b">

                                    <tr>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Invoice
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Client
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Invoice Amount
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Amount Paid
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Outstanding
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Payment Status
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Reported Amount
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Payment Date
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Mode
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Reference
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Confirmation
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Action
                                        </th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {filteredPayments.map(
                                        (payment) => {

                                            const confirmationStatus =
                                                getPaymentConfirmationStatus(
                                                    payment
                                                );

                                            const isPending =
                                                isPendingPayment(
                                                    payment
                                                );

                                            const activeDispute =
                                                getActiveDispute(
                                                    payment.invoice_id
                                                );

                                            const invoiceAmount =
                                                Number(
                                                    payment.invoice_amount ||
                                                    payment.total_amount ||
                                                    0
                                                );

                                            const amountPaid =
                                                Number(
                                                    payment.amount_paid ||
                                                    0
                                                );

                                            const tds =
                                                Number(
                                                    payment.tds_deducted ||
                                                    0
                                                );

                                            const outstanding =
                                                Number(
                                                    payment.outstanding_amount ??
                                                    payment.outstanding ??
                                                    Math.max(
                                                        0,
                                                        invoiceAmount -
                                                        amountPaid -
                                                        tds
                                                    )
                                                );

                                            const invoicePaymentStatus =
                                                payment.invoice_payment_status ||
                                                payment.payment_completion_status ||
                                                (
                                                    outstanding <=
                                                    0
                                                        ? "Paid"
                                                        : amountPaid +
                                                              tds >
                                                          0
                                                            ? "Partially Paid"
                                                            : "Pending"
                                                );

                                            return (

                                                <tr
                                                    key={
                                                        payment.id
                                                    }
                                                    className="border-t hover:bg-gray-50"
                                                >

                                                    {/* INVOICE */}

                                                    <td className="p-4">

                                                        <p className="font-semibold text-gray-900">
                                                            {payment.invoice_number ||
                                                                `INV-${payment.invoice_id}`}
                                                        </p>

                                                        {activeDispute && (

                                                            <div className="mt-2">

                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">

                                                                    <AlertCircle
                                                                        size={12}
                                                                    />

                                                                    Dispute Active

                                                                </span>

                                                            </div>

                                                        )}

                                                    </td>

                                                    {/* CLIENT */}

                                                    <td className="p-4">

                                                        <p className="font-medium text-gray-900">
                                                            {payment.client_name ||
                                                                "-"}
                                                        </p>

                                                    </td>

                                                    {/* INVOICE AMOUNT */}

                                                    <td className="p-4">

                                                        <p className="font-semibold text-gray-900">
                                                            {formatCurrency(
                                                                invoiceAmount
                                                            )}
                                                        </p>

                                                    </td>

                                                    {/* AMOUNT PAID */}

                                                    <td className="p-4">

                                                        <p className="font-semibold text-green-700">
                                                            {formatCurrency(
                                                                amountPaid
                                                            )}
                                                        </p>

                                                        {tds > 0 && (

                                                            <p className="text-xs text-gray-500 mt-1">
                                                                TDS:{" "}
                                                                {formatCurrency(
                                                                    tds
                                                                )}
                                                            </p>

                                                        )}

                                                    </td>

                                                    {/* OUTSTANDING */}

                                                    <td className="p-4">

                                                        <p
                                                            className={`font-semibold ${
                                                                outstanding <=
                                                                0
                                                                    ? "text-green-700"
                                                                    : "text-red-600"
                                                            }`}
                                                        >

                                                            {formatCurrency(
                                                                outstanding
                                                            )}

                                                        </p>

                                                    </td>

                                                    {/* PAYMENT STATUS */}

                                                    <td className="p-4">

                                                        <InvoicePaymentStatusBadge
                                                            status={
                                                                invoicePaymentStatus
                                                            }
                                                        />

                                                    </td>

                                                    {/* REPORTED AMOUNT */}

                                                    <td className="p-4">

                                                        <p className="font-semibold text-gray-900">
                                                            {formatCurrency(
                                                                payment.amount_reported
                                                            )}
                                                        </p>

                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Client reported
                                                        </p>

                                                    </td>

                                                    {/* PAYMENT DATE */}

                                                    <td className="p-4">

                                                        <span className="text-sm text-gray-700">
                                                            {payment.payment_date ||
                                                                "-"}
                                                        </span>

                                                    </td>

                                                    {/* MODE */}

                                                    <td className="p-4">

                                                        <span className="text-sm text-gray-700">
                                                            {payment.payment_mode ||
                                                                "-"}
                                                        </span>

                                                    </td>

                                                    {/* REFERENCE */}

                                                    <td className="p-4">

                                                        <span className="text-sm font-medium text-gray-700 break-all">
                                                            {payment.reference_number ||
                                                                "-"}
                                                        </span>

                                                    </td>

                                                    {/* CONFIRMATION STATUS */}

                                                    <td className="p-4">

                                                        <StatusBadge
                                                            status={
                                                                confirmationStatus
                                                            }
                                                        />

                                                    </td>

                                                    {/* ACTION */}

                                                    <td className="p-4">

                                                        {isPending ? (

                                                            activeDispute ? (

                                                                <button
                                                                    disabled
                                                                    title="Resolve the invoice dispute before processing payment."
                                                                    className="flex items-center gap-1 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm cursor-not-allowed whitespace-nowrap"
                                                                >

                                                                    <AlertCircle
                                                                        size={15}
                                                                    />

                                                                    Dispute Under Review

                                                                </button>

                                                            ) : (

                                                                <div className="flex gap-2">

                                                                    <button
                                                                        onClick={() =>
                                                                            openVerifyModal(
                                                                                payment
                                                                            )
                                                                        }
                                                                        className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                                                                    >

                                                                        <CheckCircle2
                                                                            size={15}
                                                                        />

                                                                        Verify

                                                                    </button>

                                                                    <button
                                                                        onClick={() =>
                                                                            openRejectModal(
                                                                                payment
                                                                            )
                                                                        }
                                                                        className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                                                                    >

                                                                        <XCircle
                                                                            size={15}
                                                                        />

                                                                        Reject

                                                                    </button>

                                                                </div>

                                                            )

                                                        ) : (

                                                            <button
                                                                onClick={() =>
                                                                    openViewModal(
                                                                        payment
                                                                    )
                                                                }
                                                                className="flex items-center gap-1 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 whitespace-nowrap"
                                                            >

                                                                <Eye
                                                                    size={15}
                                                                />

                                                                View

                                                            </button>

                                                        )}

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

                {/* =================================================
                    PENDING INVOICE DISPUTES
                   ================================================= */}

                <div className="bg-white border rounded-xl overflow-hidden mt-6">

                    {/* HEADER */}

                    <div className="p-5 border-b">

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                            <div>

                                <h2 className="text-lg font-bold text-gray-900">
                                    Invoice Disputes
                                </h2>

                                <p className="text-sm text-gray-500 mt-1">
                                    Review unresolved disputes raised by clients before payment processing.
                                </p>

                            </div>

                            <div className="flex items-center gap-2 flex-wrap">

                                {/* PENDING */}

                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">

                                    <AlertCircle
                                        size={13}
                                    />

                                    {pendingDisputeCount} Pending

                                </span>

                                {/* PREVIOUS DISPUTES BUTTON */}

                                {previousDisputeCount > 0 && (

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPreviousDisputes(
                                                true
                                            )
                                        }
                                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                                    >

                                        <Eye
                                            size={15}
                                        />

                                        Previous Disputes (
                                        {previousDisputeCount}
                                        )

                                    </button>

                                )}

                            </div>

                        </div>

                    </div>

                    {/* DISPUTE ERROR */}

                    {disputesError && (

                        <div className="p-5">

                            <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl p-4 flex items-start gap-3">

                                <AlertCircle
                                    size={20}
                                />

                                <div>

                                    <p className="font-semibold">
                                        Failed to load invoice disputes
                                    </p>

                                    <p className="text-sm mt-1">
                                        {disputesError}
                                    </p>

                                    <button
                                        onClick={
                                            fetchInvoiceDisputes
                                        }
                                        className="mt-3 px-3 py-2 bg-red-600 text-white rounded-lg text-sm"
                                    >
                                        Try Again
                                    </button>

                                </div>

                            </div>

                        </div>

                    )}

                    {/* LOADING */}

                    {disputesLoading ? (

                        <div className="flex justify-center py-14">

                            <Loader2
                                size={30}
                                className="animate-spin text-gray-500"
                            />

                        </div>

                    ) : !disputesError &&
                      pendingDisputes.length === 0 ? (

                        /* NO PENDING DISPUTES */

                        <div className="text-center py-16">

                            <CheckCircle2
                                size={42}
                                className="mx-auto text-green-400 mb-3"
                            />

                            <p className="font-semibold text-gray-600">
                                No pending invoice disputes
                            </p>

                            <p className="text-sm text-gray-400 mt-1">
                                All current invoice disputes have been resolved.
                            </p>

                        </div>

                    ) : !disputesError ? (

                        /* PENDING TABLE */

                        <div className="overflow-x-auto">

                            <table className="w-full min-w-[1000px]">

                                <thead className="bg-gray-50 border-b">

                                    <tr>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Invoice
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Client
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Dispute Type
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Client's Reason
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Submitted
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Status
                                        </th>

                                        <th className="text-left p-4 text-sm font-semibold">
                                            Action
                                        </th>

                                    </tr>

                                </thead>

                                <tbody>

                                    {pendingDisputes.map(
                                        (dispute) => (

                                            <tr
                                                key={
                                                    dispute.id
                                                }
                                                className="border-t hover:bg-gray-50"
                                            >

                                                {/* INVOICE */}

                                                <td className="p-4">

                                                    <p className="font-semibold">
                                                        {dispute.invoice_number ||
                                                            `INV-${dispute.invoice_id}`}
                                                    </p>

                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {formatCurrency(
                                                            dispute.invoice_amount
                                                        )}
                                                    </p>

                                                </td>

                                                {/* CLIENT */}

                                                <td className="p-4">

                                                    <p className="font-medium">
                                                        {dispute.client_name ||
                                                            `Client #${dispute.client_id}`}
                                                    </p>

                                                </td>

                                                {/* TYPE */}

                                                <td className="p-4">

                                                    <span className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
                                                        {dispute.dispute_type ||
                                                            "-"}
                                                    </span>

                                                </td>

                                                {/* REASON */}

                                                <td className="p-4">

                                                    <div className="max-w-md">

                                                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                                            {dispute.reason ||
                                                                "No reason provided."}
                                                        </p>

                                                        <p className="text-xs text-yellow-700 mt-2 font-medium">
                                                            Payment is blocked until this dispute is resolved.
                                                        </p>

                                                    </div>

                                                </td>

                                                {/* SUBMITTED */}

                                                <td className="p-4">

                                                    <span className="text-sm text-gray-600 whitespace-nowrap">
                                                        {formatDateTime(
                                                            dispute.submitted_at
                                                        )}
                                                    </span>

                                                </td>

                                                {/* STATUS */}

                                                <td className="p-4">

                                                    <DisputeStatusBadge
                                                        status={
                                                            dispute.status
                                                        }
                                                    />

                                                </td>

                                                {/* ACTION */}

                                                <td className="p-4">

                                                    <button
                                                        onClick={() =>
                                                            openDisputeResolveModal(
                                                                dispute
                                                            )
                                                        }
                                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition whitespace-nowrap"
                                                    >

                                                        <CheckCircle2
                                                            size={15}
                                                        />

                                                        Resolve Dispute

                                                    </button>

                                                </td>

                                            </tr>

                                        )
                                    )}

                                </tbody>

                            </table>

                        </div>

                    ) : null}

                </div>

                {/* =================================================
                    PREVIOUS DISPUTES MODAL
                   ================================================= */}

                {showPreviousDisputes && (

                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[55] p-4">

                        <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden">

                            {/* HEADER */}

                            <div className="flex items-center justify-between p-5 border-b">

                                <div>

                                    <h2 className="text-xl font-bold text-gray-900">
                                        Previous Invoice Disputes
                                    </h2>

                                    <p className="text-sm text-gray-500 mt-1">
                                        Historical resolved and rejected disputes.
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPreviousDisputes(
                                            false
                                        )
                                    }
                                    className="p-2 rounded-lg hover:bg-gray-100"
                                >

                                    <X
                                        size={20}
                                    />

                                </button>

                            </div>

                            {/* BODY */}

                            <div className="overflow-auto max-h-[75vh]">

                                {previousDisputes.length ===
                                0 ? (

                                    <div className="text-center py-16">

                                        <FileText
                                            size={42}
                                            className="mx-auto text-gray-300 mb-3"
                                        />

                                        <p className="font-semibold text-gray-600">
                                            No previous disputes
                                        </p>

                                    </div>

                                ) : (

                                    <table className="w-full min-w-[1000px]">

                                        <thead className="bg-gray-50 border-b sticky top-0">

                                            <tr>

                                                <th className="text-left p-4 text-sm font-semibold">
                                                    Invoice
                                                </th>

                                                <th className="text-left p-4 text-sm font-semibold">
                                                    Client
                                                </th>

                                                <th className="text-left p-4 text-sm font-semibold">
                                                    Dispute Type
                                                </th>

                                                <th className="text-left p-4 text-sm font-semibold">
                                                    Client Reason
                                                </th>

                                                <th className="text-left p-4 text-sm font-semibold">
                                                    Submitted
                                                </th>

                                                <th className="text-left p-4 text-sm font-semibold">
                                                    Status
                                                </th>

                                                <th className="text-left p-4 text-sm font-semibold">
                                                    Admin Response
                                                </th>

                                                <th className="text-left p-4 text-sm font-semibold">
                                                    Reviewed
                                                </th>

                                            </tr>

                                        </thead>

                                        <tbody>

                                            {previousDisputes.map(
                                                (
                                                    dispute
                                                ) => (

                                                    <tr
                                                        key={
                                                            dispute.id
                                                        }
                                                        className="border-t"
                                                    >

                                                        {/* INVOICE */}

                                                        <td className="p-4">

                                                            <p className="font-semibold">
                                                                {dispute.invoice_number ||
                                                                    `INV-${dispute.invoice_id}`}
                                                            </p>

                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {formatCurrency(
                                                                    dispute.invoice_amount
                                                                )}
                                                            </p>

                                                        </td>

                                                        {/* CLIENT */}

                                                        <td className="p-4">

                                                            <p className="font-medium">
                                                                {dispute.client_name ||
                                                                    `Client #${dispute.client_id}`}
                                                            </p>

                                                        </td>

                                                        {/* TYPE */}

                                                        <td className="p-4">

                                                            <span className="inline-flex px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm">
                                                                {dispute.dispute_type ||
                                                                    "-"}
                                                            </span>

                                                        </td>

                                                        {/* REASON */}

                                                        <td className="p-4">

                                                            <p className="text-sm text-gray-700 max-w-sm whitespace-pre-wrap">
                                                                {dispute.reason ||
                                                                    "-"}
                                                            </p>

                                                        </td>

                                                        {/* SUBMITTED */}

                                                        <td className="p-4">

                                                            <span className="text-sm text-gray-600 whitespace-nowrap">
                                                                {formatDateTime(
                                                                    dispute.submitted_at
                                                                )}
                                                            </span>

                                                        </td>

                                                        {/* STATUS */}

                                                        <td className="p-4">

                                                            <DisputeStatusBadge
                                                                status={
                                                                    dispute.status
                                                                }
                                                            />

                                                        </td>

                                                        {/* ADMIN RESPONSE */}

                                                        <td className="p-4">

                                                            <p className="text-sm text-gray-700 max-w-sm whitespace-pre-wrap">
                                                                {dispute.admin_response ||
                                                                    "No admin response"}
                                                            </p>

                                                        </td>

                                                        {/* REVIEWED */}

                                                        <td className="p-4">

                                                            <div>

                                                                <p className="text-sm font-medium text-gray-700">
                                                                    {dispute.reviewed_by ||
                                                                        "-"}
                                                                </p>

                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    {formatDateTime(
                                                                        dispute.reviewed_at
                                                                    )}
                                                                </p>

                                                            </div>

                                                        </td>

                                                    </tr>

                                                )
                                            )}

                                        </tbody>

                                    </table>

                                )}

                            </div>

                        </div>

                    </div>

                )}

                {/* =================================================
                    PAYMENT MODAL
                   ================================================= */}

                {selectedPayment &&
                    !showDisputeModal && (

                        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">

                            <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">

                                {/* HEADER */}

                                <div className="flex justify-between items-center p-5 border-b">

                                    <div>

                                        <h2 className="text-xl font-bold">

                                            {action ===
                                            "verify"

                                                ? "Verify Payment"

                                                : action ===
                                                  "reject"

                                                    ? "Reject Payment"

                                                    : "Payment Confirmation"}

                                        </h2>

                                        <p className="text-sm text-gray-500 mt-1">
                                            {selectedPayment.invoice_number ||
                                                `INV-${selectedPayment.invoice_id}`}
                                        </p>

                                    </div>

                                    <button
                                        onClick={
                                            closeModal
                                        }
                                        disabled={
                                            saving
                                        }
                                        className="p-1 rounded hover:bg-gray-100"
                                    >

                                        <X />

                                    </button>

                                </div>

                                {/* BODY */}

                                <div className="p-5 space-y-4">

                                    {/* PAYMENT SUMMARY */}

                                    <div className="bg-gray-50 rounded-xl p-4">

                                        <div className="grid grid-cols-2 gap-4">

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Client
                                                </p>

                                                <p className="font-semibold">
                                                    {selectedPayment.client_name ||
                                                        "-"}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Invoice Amount
                                                </p>

                                                <p className="font-semibold">
                                                    {formatCurrency(
                                                        selectedPayment.invoice_amount
                                                    )}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Amount Reported
                                                </p>

                                                <p className="font-semibold">
                                                    {formatCurrency(
                                                        selectedPayment.amount_reported
                                                    )}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Amount Paid
                                                </p>

                                                <p className="font-semibold text-green-700">
                                                    {formatCurrency(
                                                        selectedPayment.amount_paid
                                                    )}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Outstanding
                                                </p>

                                                <p className="font-semibold text-red-600">
                                                    {formatCurrency(
                                                        selectedPayment.outstanding_amount ??
                                                        selectedPayment.outstanding
                                                    )}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Payment Status
                                                </p>

                                                <InvoicePaymentStatusBadge
                                                    status={
                                                        selectedPayment.invoice_payment_status ||
                                                        selectedPayment.payment_completion_status
                                                    }
                                                />

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Payment Date
                                                </p>

                                                <p className="font-semibold">
                                                    {selectedPayment.payment_date ||
                                                        "-"}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Payment Mode
                                                </p>

                                                <p className="font-semibold">
                                                    {selectedPayment.payment_mode ||
                                                        "-"}
                                                </p>

                                            </div>

                                            <div className="col-span-2">

                                                <p className="text-xs text-gray-500">
                                                    Reference
                                                </p>

                                                <p className="font-semibold break-all">
                                                    {selectedPayment.reference_number ||
                                                        "-"}
                                                </p>

                                            </div>

                                        </div>

                                    </div>

                                    {/* ACTIVE DISPUTE */}

                                    {(() => {

                                        const activeDispute =
                                            getActiveDispute(
                                                selectedPayment.invoice_id
                                            );

                                        if (
                                            !activeDispute
                                        ) {
                                            return null;
                                        }

                                        return (

                                            <div className="border border-yellow-300 bg-yellow-50 rounded-xl p-4">

                                                <div className="flex items-start gap-3">

                                                    <AlertCircle
                                                        size={22}
                                                        className="text-yellow-600 shrink-0"
                                                    />

                                                    <div>

                                                        <p className="font-bold text-yellow-800">
                                                            Invoice Dispute Under Review
                                                        </p>

                                                        <p className="text-sm text-yellow-900 mt-2">
                                                            <strong>
                                                                Type:
                                                            </strong>{" "}
                                                            {activeDispute.dispute_type ||
                                                                "-"}
                                                        </p>

                                                        <p className="text-sm text-yellow-900 mt-2 whitespace-pre-wrap">
                                                            <strong>
                                                                Client Reason:
                                                            </strong>{" "}
                                                            {activeDispute.reason ||
                                                                "-"}
                                                        </p>

                                                        <p className="text-sm font-semibold text-yellow-800 mt-3">
                                                            Payment verification and rejection are disabled until this dispute is resolved.
                                                        </p>

                                                    </div>

                                                </div>

                                            </div>

                                        );

                                    })()}

                                    {/* CONFIRMATION STATUS */}

                                    <div className="border rounded-xl p-4">

                                        <div className="flex justify-between items-center">

                                            <span className="text-sm font-semibold">
                                                Confirmation Status
                                            </span>

                                            <StatusBadge
                                                status={
                                                    getPaymentConfirmationStatus(
                                                        selectedPayment
                                                    )
                                                }
                                            />

                                        </div>

                                    </div>

                                    {/* NOTES */}

                                    {selectedPayment.notes && (

                                        <div className="border rounded-xl p-4">

                                            <div className="flex items-center gap-2 mb-2">

                                                <FileText
                                                    size={17}
                                                />

                                                <p className="font-semibold">
                                                    Client Notes
                                                </p>

                                            </div>

                                            <p className="text-sm text-gray-600 whitespace-pre-wrap">
                                                {selectedPayment.notes}
                                            </p>

                                        </div>

                                    )}

                                    {/* PAYMENT PROOF */}

                                    {selectedPayment.payment_proof_url && (

                                        <a
                                            href={
                                                selectedPayment.payment_proof_url
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2 border rounded-xl p-4 hover:bg-gray-50"
                                        >

                                            <CreditCard
                                                size={18}
                                            />

                                            <span className="font-medium">
                                                View Payment Proof
                                            </span>

                                        </a>

                                    )}

                                    {/* REJECTION REASON */}

                                    {selectedPayment.rejection_reason && (

                                        <div className="border border-red-200 bg-red-50 rounded-xl p-4">

                                            <p className="text-sm font-semibold text-red-700">
                                                Rejection Reason
                                            </p>

                                            <p className="text-sm text-gray-700 mt-1">
                                                {selectedPayment.rejection_reason}
                                            </p>

                                        </div>

                                    )}

                                    {/* TDS */}

                                    {action ===
                                        "verify" && (

                                        <div className="border border-green-200 bg-green-50 rounded-xl p-4">

                                            <label className="block text-sm font-semibold mb-2">
                                                TDS Deducted
                                            </label>

                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={
                                                    tdsDeducted
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    setTdsDeducted(
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                                className="w-full border rounded-lg p-3 bg-white"
                                            />

                                            <p className="text-xs text-gray-500 mt-2">
                                                TDS will be recorded in payments_ledger.
                                            </p>

                                        </div>

                                    )}

                                    {/* REJECTION */}

                                    {action ===
                                        "reject" && (

                                        <div className="border border-red-200 bg-red-50 rounded-xl p-4">

                                            <label className="block text-sm font-semibold mb-2">
                                                Rejection Reason
                                            </label>

                                            <textarea
                                                rows={4}
                                                value={
                                                    rejectionReason
                                                }
                                                onChange={(
                                                    e
                                                ) =>
                                                    setRejectionReason(
                                                        e
                                                            .target
                                                            .value
                                                    )
                                                }
                                                placeholder="Explain why this payment cannot be verified..."
                                                className="w-full border rounded-lg p-3 bg-white resize-none"
                                            />

                                        </div>

                                    )}

                                    {/* VERIFY BUTTON */}

                                    {action ===
                                        "verify" && (

                                        <div className="flex justify-end gap-3 pt-2">

                                            <button
                                                type="button"
                                                onClick={
                                                    closeModal
                                                }
                                                disabled={
                                                    saving
                                                }
                                                className="px-4 py-2 border rounded-lg"
                                            >
                                                Cancel
                                            </button>

                                            <button
                                                type="button"
                                                onClick={
                                                    handleVerify
                                                }
                                                disabled={
                                                    saving ||
                                                    hasActiveInvoiceDispute(
                                                        selectedPayment.invoice_id
                                                    )
                                                }
                                                className="px-5 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >

                                                {saving ? (

                                                    <>
                                                        <Loader2
                                                            size={
                                                                17
                                                            }
                                                            className="animate-spin"
                                                        />

                                                        Verifying...
                                                    </>

                                                ) : (

                                                    <>
                                                        <CheckCircle2
                                                            size={
                                                                17
                                                            }
                                                        />

                                                        Verify Payment
                                                    </>

                                                )}

                                            </button>

                                        </div>

                                    )}

                                    {/* REJECT BUTTON */}

                                    {action ===
                                        "reject" && (

                                        <div className="flex justify-end gap-3 pt-2">

                                            <button
                                                type="button"
                                                onClick={
                                                    closeModal
                                                }
                                                disabled={
                                                    saving
                                                }
                                                className="px-4 py-2 border rounded-lg"
                                            >
                                                Cancel
                                            </button>

                                            <button
                                                type="button"
                                                onClick={
                                                    handleReject
                                                }
                                                disabled={
                                                    saving ||
                                                    hasActiveInvoiceDispute(
                                                        selectedPayment.invoice_id
                                                    )
                                                }
                                                className="px-5 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >

                                                {saving ? (

                                                    <>
                                                        <Loader2
                                                            size={
                                                                17
                                                            }
                                                            className="animate-spin"
                                                        />

                                                        Rejecting...
                                                    </>

                                                ) : (

                                                    <>
                                                        <XCircle
                                                            size={
                                                                17
                                                            }
                                                        />

                                                        Reject Payment
                                                    </>

                                                )}

                                            </button>

                                        </div>

                                    )}

                                </div>

                            </div>

                        </div>

                    )}

                {/* =================================================
                    RESOLVE DISPUTE MODAL
                   ================================================= */}

                {showDisputeModal &&
                    selectedDispute && (

                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">

                            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

                                {/* HEADER */}

                                <div className="flex items-center justify-between p-5 border-b">

                                    <div>

                                        <h2 className="text-xl font-bold text-gray-900">
                                            Resolve Invoice Dispute
                                        </h2>

                                        <p className="text-sm text-gray-500 mt-1">
                                            {selectedDispute.invoice_number ||
                                                `INV-${selectedDispute.invoice_id}`}
                                        </p>

                                    </div>

                                    <button
                                        onClick={
                                            closeDisputeModal
                                        }
                                        disabled={
                                            resolvingDispute
                                        }
                                        className="p-2 rounded-lg hover:bg-gray-100"
                                    >

                                        <X
                                            size={20}
                                        />

                                    </button>

                                </div>

                                {/* BODY */}

                                <div className="p-5 space-y-5">

                                    {/* INVOICE DETAILS */}

                                    <div className="bg-gray-50 rounded-xl p-4">

                                        <div className="grid grid-cols-2 gap-4">

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Invoice
                                                </p>

                                                <p className="font-semibold">
                                                    {selectedDispute.invoice_number ||
                                                        `INV-${selectedDispute.invoice_id}`}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Amount
                                                </p>

                                                <p className="font-semibold">
                                                    {formatCurrency(
                                                        selectedDispute.invoice_amount
                                                    )}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Client
                                                </p>

                                                <p className="font-semibold">
                                                    {selectedDispute.client_name ||
                                                        `Client #${selectedDispute.client_id}`}
                                                </p>

                                            </div>

                                            <div>

                                                <p className="text-xs text-gray-500">
                                                    Type
                                                </p>

                                                <p className="font-semibold">
                                                    {selectedDispute.dispute_type ||
                                                        "-"}
                                                </p>

                                            </div>

                                        </div>

                                    </div>

                                    {/* CLIENT REASON */}

                                    <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4">

                                        <div className="flex items-start gap-3">

                                            <AlertCircle
                                                size={20}
                                                className="text-yellow-600 mt-0.5"
                                            />

                                            <div>

                                                <p className="text-sm font-semibold text-yellow-800">
                                                    Client's Reason
                                                </p>

                                                <p className="text-sm text-yellow-900 mt-2 whitespace-pre-wrap">
                                                    {selectedDispute.reason ||
                                                        "No reason provided."}
                                                </p>

                                            </div>

                                        </div>

                                    </div>

                                    {/* ADMIN RESPONSE */}

                                    <div>

                                        <label className="block text-sm font-semibold text-gray-800 mb-2">

                                            Admin Response

                                            <span className="text-red-500 ml-1">
                                                *
                                            </span>

                                        </label>

                                        <textarea
                                            rows={5}
                                            value={
                                                disputeResponse
                                            }
                                            onChange={(
                                                e
                                            ) =>
                                                setDisputeResponse(
                                                    e
                                                        .target
                                                        .value
                                                )
                                            }
                                            placeholder="Explain how the dispute was reviewed and resolved..."
                                            className="w-full border rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500"
                                        />

                                        <p className="text-xs text-gray-500 mt-2">
                                            This response will be saved with the dispute.
                                        </p>

                                    </div>

                                    {/* RESULT */}

                                    <div className="border border-green-200 bg-green-50 rounded-xl p-4">

                                        <div className="flex items-start gap-3">

                                            <CheckCircle2
                                                size={20}
                                                className="text-green-600 mt-0.5"
                                            />

                                            <div>

                                                <p className="font-semibold text-green-800">
                                                    What happens after resolution?
                                                </p>

                                                <p className="text-sm text-green-700 mt-1">
                                                    The dispute will be marked as Resolved. Payment processing for this invoice will then be allowed.
                                                </p>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                                {/* FOOTER */}

                                <div className="flex justify-end gap-3 p-5 border-t">

                                    <button
                                        type="button"
                                        onClick={
                                            closeDisputeModal
                                        }
                                        disabled={
                                            resolvingDispute
                                        }
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={
                                            handleResolveDispute
                                        }
                                        disabled={
                                            resolvingDispute ||
                                            disputeResponse.trim()
                                                .length <
                                                5
                                        }
                                        className="px-5 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >

                                        {resolvingDispute ? (

                                            <>
                                                <Loader2
                                                    size={
                                                        17
                                                    }
                                                    className="animate-spin"
                                                />

                                                Resolving...
                                            </>

                                        ) : (

                                            <>
                                                <CheckCircle2
                                                    size={
                                                        17
                                                    }
                                                />

                                                Resolve Dispute
                                            </>

                                        )}

                                    </button>

                                </div>

                            </div>

                        </div>

                    )}

            </main>

        </div>
    );
}