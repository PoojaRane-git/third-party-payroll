import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
    Search,
    Plus,
    X,
    FileText,
    Download,
    RefreshCw,
    Building,
    Eye,
    Edit,
    ExternalLink
} from "lucide-react";
import Sidebar from "../Layout/Sidebar";
import api from "../../services/api";

const emptyForm = {
    clientId: "",
    contractNumber: "",
    contractTitle: "",
    startDate: "",
    endDate: "",
    billingModel: "Percentage Markup",
    markupPercentage: "",
    perHeadFee: "",
    creditTerms: "Net 30",
    contractStatus: "Active"
};

export default function ContractManagement({
    activeTab,
    setActiveTab
}) {
    const [contracts, setContracts] = useState([]);
    const [clients, setClients] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState("add");
    const [editingContractId, setEditingContractId] = useState(null);

    const [form, setForm] = useState(emptyForm);

    const [selectedContract, setSelectedContract] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);

    const [saving, setSaving] = useState(false);

    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const urlClientId = searchParams.get("client_id");

    // =====================================================
    // FETCH CLIENTS
    // =====================================================

    const fetchClients = async () => {
        try {
            const response = await api.get("/clients");

            const data = response?.data || {};

            const clientList = Array.isArray(data)
                ? data
                : data.data || [];

            setClients(clientList);
        } catch (error) {
            console.error(
                "Error fetching clients:",
                error
            );
        }
    };

    // =====================================================
    // FETCH CONTRACTS
    // =====================================================

    const fetchContracts = async (clientId = null) => {
        try {
            const endpoint = clientId
                ? `/contracts?client_id=${encodeURIComponent(clientId)}`
                : "/contracts";

            console.log(
                "Fetching contracts:",
                endpoint
            );

            const response = await api.get(endpoint);

            const data = response?.data || {};

            console.log(
                "Contracts:",
                data
            );

            const contractList = Array.isArray(data)
                ? data
                : data.data || [];

            setContracts(contractList);
        } catch (error) {
            console.error(
                "Error fetching contracts:",
                error
            );
        }
    };

    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        fetchContracts(urlClientId);
    }, [urlClientId]);

    // =====================================================
    // CLIENT NAME
    // =====================================================

    const getClientName = (contract) => {
        if (contract.client) {
            return contract.client;
        }

        if (contract.clients?.company_name) {
            return contract.clients.company_name;
        }

        const client = clients.find(
            (c) =>
                String(c.id) ===
                String(contract.client_id)
        );

        return (
            client?.company_name ||
            `Client #${contract.client_id}`
        );
    };

    // =====================================================
    // STATUS
    // =====================================================

    const getDisplayStatus = (contract) => {
        const dbStatus =
            contract.contract_status || "Active";

        if (dbStatus !== "Active") {
            return dbStatus;
        }

        if (!contract.end_date) {
            return dbStatus;
        }

        const end = new Date(
            contract.end_date
        );

        const now = new Date();

        const daysLeft = Math.ceil(
            (end - now) /
                (1000 * 60 * 60 * 24)
        );

        if (daysLeft < 0) {
            return "Expired";
        }

        if (daysLeft <= 30) {
            return "Expiring Soon";
        }

        return "Active";
    };

    // =====================================================
    // STATUS STYLE
    // =====================================================

    const statusStyles = (status) => {
        switch (status) {
            case "Active":
                return "bg-emerald-50 text-emerald-600";

            case "Expiring Soon":
                return "bg-amber-50 text-amber-600";

            case "Expired":
                return "bg-red-50 text-red-600";

            case "Renewed":
                return "bg-blue-50 text-blue-600";

            case "Terminated":
                return "bg-slate-100 text-slate-500";

            default:
                return "bg-slate-100 text-slate-500";
        }
    };

    // =====================================================
    // BILLING MODEL DISPLAY
    // =====================================================

    const getBillingDisplay = (contract) => {
        const model =
            contract.billing_model;

        if (model === "Percentage Markup") {
            return `${contract.markup_percentage ?? 0}%`;
        }

        if (model === "Per Head") {
            return `₹${contract.per_head_fee ?? 0}/head`;
        }

        if (model === "Flat Fee") {
            return `₹${contract.per_head_fee ?? 0}`;
        }

        return model || "-";
    };

    // =====================================================
    // OPEN ADD
    // =====================================================

    const openAddModal = () => {
        setFormMode("add");
        setEditingContractId(null);

        setForm({
            ...emptyForm,
            clientId: urlClientId || ""
        });

        setShowFormModal(true);
    };

    // =====================================================
    // OPEN EDIT
    // =====================================================

    const openEditModal = (contract) => {
        setFormMode("edit");
        setEditingContractId(contract.id);

        setForm({
            clientId:
                String(
                    contract.client_id || ""
                ),

            contractNumber:
                contract.contract_number || "",

            contractTitle:
                contract.contract_title || "",

            startDate:
                contract.start_date || "",

            endDate:
                contract.end_date || "",

            billingModel:
                contract.billing_model ||
                "Percentage Markup",

            markupPercentage:
                contract.markup_percentage ??
                "",

            perHeadFee:
                contract.per_head_fee ??
                "",

            creditTerms:
                contract.credit_terms ||
                "Net 30",

            contractStatus:
                contract.contract_status ||
                "Active"
        });

        setShowFormModal(true);
    };

    // =====================================================
    // OPEN RENEW
    // =====================================================

    const openRenewModal = (contract) => {
        setFormMode("renew");
        setEditingContractId(contract.id);

        setForm({
            clientId:
                String(
                    contract.client_id || ""
                ),

            contractNumber:
                `${
                    contract.contract_number ||
                    "CONTRACT"
                }-RENEWED`,

            contractTitle:
                contract.contract_title || "",

            startDate: "",

            endDate: "",

            billingModel:
                contract.billing_model ||
                "Percentage Markup",

            markupPercentage:
                contract.markup_percentage ??
                "",

            perHeadFee:
                contract.per_head_fee ??
                "",

            creditTerms:
                contract.credit_terms ||
                "Net 30",

            contractStatus: "Active"
        });

        setShowFormModal(true);
    };

    // =====================================================
    // CLOSE FORM
    // =====================================================

    const closeFormModal = () => {
        setShowFormModal(false);
        setForm(emptyForm);
        setEditingContractId(null);
        setSaving(false);
    };

    // =====================================================
    // BUILD PAYLOAD
    // =====================================================

    const buildPayload = () => {
        return {
            client_id:
                Number(form.clientId),

            contract_number:
                form.contractNumber.trim(),

            contract_title:
                form.contractTitle.trim(),

            start_date:
                form.startDate,

            end_date:
                form.endDate,

            billing_model:
                form.billingModel,

            markup_percentage:
                form.markupPercentage === ""
                    ? 0
                    : Number(
                        form.markupPercentage
                    ),

            per_head_fee:
                form.perHeadFee === ""
                    ? 0
                    : Number(
                        form.perHeadFee
                    ),

            credit_terms:
                form.creditTerms,

            contract_status:
                form.contractStatus
        };
    };

    // =====================================================
    // SUBMIT
    // =====================================================

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (
            !form.clientId ||
            !form.contractNumber ||
            !form.contractTitle ||
            !form.startDate ||
            !form.endDate
        ) {
            alert(
                "Please fill all required fields."
            );
            return;
        }

        if (
            form.billingModel ===
                "Percentage Markup" &&
            form.markupPercentage === ""
        ) {
            alert(
                "Please enter markup percentage."
            );
            return;
        }

        setSaving(true);

        try {
            // =================================================
            // ADD
            // =================================================

            if (formMode === "add") {
                const payload =
                    buildPayload();

                console.log(
                    "Creating contract:",
                    payload
                );

                const response =
                    await api.post(
                        "/contracts",
                        payload
                    );

                const data =
                    response?.data || {};

                console.log(
                    "Create response:",
                    data
                );

                alert(
                    "Contract created successfully."
                );
            }

            // =================================================
            // EDIT
            // =================================================

            if (formMode === "edit") {
                const payload =
                    buildPayload();

                console.log(
                    "Updating contract:",
                    editingContractId,
                    payload
                );

                const response =
                    await api.put(
                        `/contracts/${editingContractId}`,
                        payload
                    );

                const data =
                    response?.data || {};

                console.log(
                    "Update response:",
                    data
                );

                alert(
                    "Contract updated successfully."
                );
            }

            // =================================================
            // RENEW
            // =================================================

            if (formMode === "renew") {

                // ---------------------------------------------
                // MARK OLD CONTRACT AS RENEWED
                // ---------------------------------------------

                console.log(
                    "Marking old contract as renewed:",
                    editingContractId
                );

                const oldResponse =
                    await api.put(
                        `/contracts/${editingContractId}`,
                        {
                            contract_status:
                                "Renewed"
                        }
                    );

                const oldData =
                    oldResponse?.data || {};

                console.log(
                    "Old contract update response:",
                    oldData
                );

                // ---------------------------------------------
                // CREATE NEW CONTRACT
                // ---------------------------------------------

                const payload =
                    buildPayload();

                console.log(
                    "Creating renewed contract:",
                    payload
                );

                const newResponse =
                    await api.post(
                        "/contracts",
                        payload
                    );

                const newData =
                    newResponse?.data || {};

                console.log(
                    "Renewed contract response:",
                    newData
                );

                alert(
                    "Contract renewed successfully."
                );
            }

            await fetchContracts(
                urlClientId
            );

            closeFormModal();

        } catch (error) {

            console.error(
                `Error in ${formMode} contract:`,
                error
            );

            const message =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                "Something went wrong.";

            alert(message);

            setSaving(false);
        }
    };

    // =====================================================
    // VIEW
    // =====================================================

    const handleViewContract = (
        contract
    ) => {
        setSelectedContract(contract);
        setShowViewModal(true);
    };

    // =====================================================
    // DOWNLOAD
    // =====================================================

    const handleDownloadAgreement = (
        contract
    ) => {
        if (contract.document_url) {
            window.open(
                contract.document_url,
                "_blank"
            );
        } else {
            alert(
                "No agreement document has been uploaded for this contract."
            );
        }
    };

    // =====================================================
    // SEARCH
    // =====================================================

    const filteredContracts =
        contracts.filter(
            (contract) => {
                const clientName =
                    getClientName(
                        contract
                    );

                const contractNumber =
                    contract.contract_number ||
                    "";

                const contractTitle =
                    contract.contract_title ||
                    "";

                const search =
                    searchQuery.toLowerCase();

                return (
                    clientName
                        .toLowerCase()
                        .includes(search) ||

                    contractNumber
                        .toLowerCase()
                        .includes(search) ||

                    contractTitle
                        .toLowerCase()
                        .includes(search)
                );
            }
        );

    // =====================================================
    // MODAL TITLE
    // =====================================================

    const modalTitle =
        formMode === "add"
            ? "Add New Contract Agreement"
            : formMode === "edit"
                ? "Edit Contract Agreement"
                : "Renew Contract Agreement";

    // =====================================================
    // UI
    // =====================================================

    return (
        <div className="flex min-h-screen bg-slate-50/50">

            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />

            <main className="flex-1 p-8 space-y-6 overflow-y-auto">

                {/* ================================================= */}
                {/* HEADER */}
                {/* ================================================= */}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                    <div className="flex items-start gap-3">

                        <button
                            type="button"
                            onClick={() =>
                                navigate("/clients")
                            }
                            className="mt-1 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold shadow-sm"
                        >
                            ← Back
                        </button>

                        <div>

                            <h2 className="text-2xl font-bold text-slate-900">
                                Contract Management
                            </h2>

                            <p className="text-sm text-slate-500">
                                Manage agreements and service level
                                terms between Talent Corner and clients.
                            </p>

                        </div>

                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">

                        {/* SEARCH */}

                        <div className="relative w-full sm:w-64">

                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                            <input
                                type="text"
                                placeholder="Search contracts..."
                                value={searchQuery}
                                onChange={(e) =>
                                    setSearchQuery(
                                        e.target.value
                                    )
                                }
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-transparent rounded-xl text-sm focus:bg-white focus:border-slate-300 focus:outline-none"
                            />

                        </div>

                        {/* ADD */}

                        <button
                            onClick={
                                openAddModal
                            }
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold"
                        >

                            <Plus className="h-4 w-4" />

                            Add Contract

                        </button>

                    </div>

                </div>

                {/* ================================================= */}
                {/* TABLE */}
                {/* ================================================= */}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">

                    <div className="p-4 border-b border-slate-100 flex justify-between">

                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">

                            Agreements (
                            {filteredContracts.length}
                            )

                        </span>

                        <span className="text-xs text-slate-500">
                            Talent Corner Legal & Operations
                        </span>

                    </div>

                    <div className="overflow-x-auto">

                        <table className="w-full text-left">

                            <thead>

                                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase">

                                    <th className="p-4">
                                        Client
                                    </th>

                                    <th className="p-4">
                                        Contract
                                    </th>

                                    <th className="p-4">
                                        Start Date
                                    </th>

                                    <th className="p-4">
                                        End Date
                                    </th>

                                    <th className="p-4">
                                        Billing Model
                                    </th>

                                    <th className="p-4">
                                        Credit Terms
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

                                {filteredContracts.length > 0 ? (

                                    filteredContracts.map(
                                        (contract) => {

                                            const status =
                                                getDisplayStatus(
                                                    contract
                                                );

                                            return (
                                                <tr
                                                    key={
                                                        contract.id
                                                    }
                                                    className="hover:bg-slate-50"
                                                >

                                                    <td className="p-4">

                                                        <div className="flex items-center gap-2">

                                                            <Building className="h-4 w-4 text-blue-500" />

                                                            <div>

                                                                <div className="font-medium text-slate-900">
                                                                    {getClientName(
                                                                        contract
                                                                    )}
                                                                </div>

                                                                <div className="text-[11px] text-slate-400">
                                                                    Client #
                                                                    {
                                                                        contract.client_id
                                                                    }
                                                                </div>

                                                            </div>

                                                        </div>

                                                    </td>

                                                    <td className="p-4">

                                                        <div className="font-semibold text-slate-800">
                                                            {
                                                                contract.contract_title ||
                                                                "-"
                                                            }
                                                        </div>

                                                        <div className="text-[11px] font-mono text-slate-400">
                                                            {
                                                                contract.contract_number ||
                                                                "-"
                                                            }
                                                        </div>

                                                    </td>

                                                    <td className="p-4 font-mono text-xs text-slate-600">
                                                        {
                                                            contract.start_date ||
                                                            "-"
                                                        }
                                                    </td>

                                                    <td className="p-4 font-mono text-xs text-slate-600">
                                                        {
                                                            contract.end_date ||
                                                            "-"
                                                        }
                                                    </td>

                                                    <td className="p-4">

                                                        <span className="inline-flex px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-semibold">

                                                            {getBillingDisplay(
                                                                contract
                                                            )}

                                                        </span>

                                                        <div className="text-[10px] text-slate-400 mt-1">

                                                            {
                                                                contract.billing_model ||
                                                                "-"
                                                            }

                                                        </div>

                                                    </td>

                                                    <td className="p-4 text-xs font-semibold text-slate-700">

                                                        {
                                                            contract.credit_terms ||
                                                            "-"
                                                        }

                                                    </td>

                                                    <td className="p-4">

                                                        <span
                                                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles(
                                                                status
                                                            )}`}
                                                        >

                                                            {status}

                                                        </span>

                                                    </td>

                                                    <td className="p-4 text-right">

                                                        <div className="inline-flex items-center gap-2">

                                                            <button
                                                                onClick={() =>
                                                                    handleViewContract(
                                                                        contract
                                                                    )
                                                                }
                                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                                                            >

                                                                <Eye className="h-3.5 w-3.5" />

                                                                View

                                                            </button>

                                                            <button
                                                                onClick={() =>
                                                                    openEditModal(
                                                                        contract
                                                                    )
                                                                }
                                                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"
                                                            >

                                                                <Edit className="h-4 w-4" />

                                                            </button>

                                                            <button
                                                                onClick={() =>
                                                                    handleDownloadAgreement(
                                                                        contract
                                                                    )
                                                                }
                                                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg"
                                                            >

                                                                <Download className="h-4 w-4" />

                                                            </button>

                                                            <button
                                                                onClick={() =>
                                                                    openRenewModal(
                                                                        contract
                                                                    )
                                                                }
                                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                                                            >

                                                                <RefreshCw className="h-3.5 w-3.5" />

                                                                Renew

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
                                            className="p-8 text-center text-slate-400"
                                        >

                                            No agreements or contracts found.

                                        </td>

                                    </tr>

                                )}

                            </tbody>

                        </table>

                    </div>

                </div>

                {/* ================================================= */}
                {/* VIEW MODAL */}
                {/* ================================================= */}

                {showViewModal &&
                    selectedContract && (

                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

                            <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden">

                                <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50">

                                    <div className="flex items-center gap-2">

                                        <Building className="h-5 w-5 text-blue-500" />

                                        <div>

                                            <h3 className="font-bold text-slate-900">

                                                {getClientName(
                                                    selectedContract
                                                )}

                                            </h3>

                                            <p className="text-xs text-slate-400">

                                                {
                                                    selectedContract.contract_number
                                                }

                                            </p>

                                        </div>

                                    </div>

                                    <button
                                        onClick={() =>
                                            setShowViewModal(
                                                false
                                            )
                                        }
                                    >

                                        <X className="h-5 w-5 text-slate-400" />

                                    </button>

                                </div>

                                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

                                    <div className="grid grid-cols-2 gap-4">

                                        <div className="p-3 bg-slate-50 rounded-xl">

                                            <span className="text-[11px] uppercase text-slate-400">
                                                Contract Number
                                            </span>

                                            <p className="font-mono font-semibold text-slate-800">

                                                {
                                                    selectedContract.contract_number ||
                                                    "-"
                                                }

                                            </p>

                                        </div>

                                        <div className="p-3 bg-slate-50 rounded-xl">

                                            <span className="text-[11px] uppercase text-slate-400">
                                                Status
                                            </span>

                                            <div className="mt-1">

                                                <span
                                                    className={`inline-flex px-2.5 py-1 rounded-full text-xs ${statusStyles(
                                                        getDisplayStatus(
                                                            selectedContract
                                                        )
                                                    )}`}
                                                >

                                                    {getDisplayStatus(
                                                        selectedContract
                                                    )}

                                                </span>

                                            </div>

                                        </div>

                                    </div>

                                    <div>

                                        <span className="text-[11px] uppercase text-slate-400">
                                            Contract Title
                                        </span>

                                        <p className="font-semibold text-slate-800">

                                            {
                                                selectedContract.contract_title ||
                                                "-"
                                            }

                                        </p>

                                    </div>

                                    <div className="grid grid-cols-2 gap-4">

                                        <div>

                                            <span className="text-[11px] uppercase text-slate-400">
                                                Start Date
                                            </span>

                                            <p className="font-mono font-semibold">

                                                {
                                                    selectedContract.start_date ||
                                                    "-"
                                                }

                                            </p>

                                        </div>

                                        <div>

                                            <span className="text-[11px] uppercase text-slate-400">
                                                End Date
                                            </span>

                                            <p className="font-mono font-semibold">

                                                {
                                                    selectedContract.end_date ||
                                                    "-"
                                                }

                                            </p>

                                        </div>

                                    </div>

                                    <div>

                                        <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">
                                            Billing Information
                                        </h4>

                                        <div className="grid grid-cols-2 gap-4">

                                            <div className="p-3 bg-slate-50 rounded-xl">

                                                <span className="text-[11px] text-slate-400">
                                                    Billing Model
                                                </span>

                                                <p className="font-semibold">

                                                    {
                                                        selectedContract.billing_model ||
                                                        "-"
                                                    }

                                                </p>

                                            </div>

                                            <div className="p-3 bg-slate-50 rounded-xl">

                                                <span className="text-[11px] text-slate-400">
                                                    Markup Percentage
                                                </span>

                                                <p className="font-semibold text-purple-600">

                                                    {
                                                        selectedContract.markup_percentage ??
                                                        0
                                                    }%

                                                </p>

                                            </div>

                                            <div className="p-3 bg-slate-50 rounded-xl">

                                                <span className="text-[11px] text-slate-400">
                                                    Per Head Fee
                                                </span>

                                                <p className="font-semibold">

                                                    ₹
                                                    {
                                                        selectedContract.per_head_fee ??
                                                        0
                                                    }

                                                </p>

                                            </div>

                                            <div className="p-3 bg-slate-50 rounded-xl">

                                                <span className="text-[11px] text-slate-400">
                                                    Credit Terms
                                                </span>

                                                <p className="font-semibold">

                                                    {
                                                        selectedContract.credit_terms ||
                                                        "-"
                                                    }

                                                </p>

                                            </div>

                                        </div>

                                    </div>

                                    <div>

                                        <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">
                                            Signed Agreement
                                        </h4>

                                        {selectedContract.document_url ? (

                                            <a
                                                href={
                                                    selectedContract.document_url
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-3 border rounded-xl hover:border-blue-300"
                                            >

                                                <span className="flex items-center gap-2 text-xs font-semibold">

                                                    <FileText className="h-4 w-4 text-blue-500" />

                                                    View uploaded document

                                                </span>

                                                <ExternalLink className="h-4 w-4 text-slate-400" />

                                            </a>

                                        ) : (

                                            <div className="p-3 bg-slate-50 border border-dashed rounded-xl text-xs text-slate-400 text-center">

                                                No document uploaded.

                                            </div>

                                        )}

                                    </div>

                                </div>

                                <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">

                                    <button
                                        onClick={() =>
                                            setShowViewModal(
                                                false
                                            )
                                        }
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
                                    >
                                        Close
                                    </button>

                                </div>

                            </div>

                        </div>

                    )}

                {/* ================================================= */}
                {/* ADD / EDIT / RENEW MODAL */}
                {/* ================================================= */}

                {showFormModal && (

                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

                        <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden">

                            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50">

                                <h3 className="font-bold text-slate-900">
                                    {modalTitle}
                                </h3>

                                <button
                                    onClick={
                                        closeFormModal
                                    }
                                >

                                    <X className="h-5 w-5 text-slate-400" />

                                </button>

                            </div>

                            {formMode === "renew" && (

                                <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">

                                    The existing contract will be marked
                                    <strong> Renewed</strong> and a new
                                    contract will be created.

                                </div>

                            )}

                            <form
                                onSubmit={
                                    handleSubmit
                                }
                                className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
                            >

                                <div>

                                    <label className="block text-xs font-semibold mb-1">
                                        Client *
                                    </label>

                                    <select
                                        required
                                        disabled={
                                            formMode ===
                                            "edit"
                                        }
                                        value={
                                            form.clientId
                                        }
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                clientId:
                                                    e.target.value
                                            })
                                        }
                                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                                    >

                                        <option value="">
                                            Select a client...
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

                                <div>

                                    <label className="block text-xs font-semibold mb-1">
                                        Contract Number *
                                    </label>

                                    <input
                                        type="text"
                                        required
                                        value={
                                            form.contractNumber
                                        }
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                contractNumber:
                                                    e.target.value
                                            })
                                        }
                                        placeholder="TCS-MSA-2026-01"
                                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                                    />

                                </div>

                                <div>

                                    <label className="block text-xs font-semibold mb-1">
                                        Contract Title *
                                    </label>

                                    <input
                                        type="text"
                                        required
                                        value={
                                            form.contractTitle
                                        }
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                contractTitle:
                                                    e.target.value
                                            })
                                        }
                                        placeholder="IT Staff Augmentation MSA"
                                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                                    />

                                </div>

                                <div className="grid grid-cols-2 gap-4">

                                    <div>

                                        <label className="block text-xs font-semibold mb-1">
                                            Start Date *
                                        </label>

                                        <input
                                            type="date"
                                            required
                                            value={
                                                form.startDate
                                            }
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    startDate:
                                                        e.target.value
                                                })
                                            }
                                            className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                                        />

                                    </div>

                                    <div>

                                        <label className="block text-xs font-semibold mb-1">
                                            End Date *
                                        </label>

                                        <input
                                            type="date"
                                            required
                                            value={
                                                form.endDate
                                            }
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    endDate:
                                                        e.target.value
                                                })
                                            }
                                            className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                                        />

                                    </div>

                                </div>

                                <div>

                                    <label className="block text-xs font-semibold mb-1">
                                        Billing Model
                                    </label>

                                    <select
                                        value={
                                            form.billingModel
                                        }
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                billingModel:
                                                    e.target.value
                                            })
                                        }
                                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                                    >

                                        <option value="Percentage Markup">
                                            Percentage Markup
                                        </option>

                                        <option value="Per Head">
                                            Per Head
                                        </option>

                                        <option value="Flat Fee">
                                            Flat Fee
                                        </option>

                                    </select>

                                </div>

                                {form.billingModel ===
                                    "Percentage Markup" && (

                                    <div>

                                        <label className="block text-xs font-semibold mb-1">
                                            Markup Percentage (%)
                                        </label>

                                        <input
                                            type="number"
                                            step="0.01"
                                            value={
                                                form.markupPercentage
                                            }
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    markupPercentage:
                                                        e.target.value
                                                })
                                            }
                                            placeholder="10"
                                            className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                                        />

                                    </div>

                                )}

                                {(
                                    form.billingModel ===
                                        "Per Head" ||
                                    form.billingModel ===
                                        "Flat Fee"
                                ) && (

                                    <div>

                                        <label className="block text-xs font-semibold mb-1">

                                            {form.billingModel ===
                                            "Per Head"
                                                ? "Per Head Fee (₹)"
                                                : "Fee (₹)"}

                                        </label>

                                        <input
                                            type="number"
                                            step="0.01"
                                            value={
                                                form.perHeadFee
                                            }
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    perHeadFee:
                                                        e.target.value
                                                })
                                            }
                                            placeholder="5000"
                                            className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                                        />

                                    </div>

                                )}

                                <div>

                                    <label className="block text-xs font-semibold mb-1">
                                        Credit Terms
                                    </label>

                                    <select
                                        value={
                                            form.creditTerms
                                        }
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                creditTerms:
                                                    e.target.value
                                            })
                                        }
                                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
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

                                    <label className="block text-xs font-semibold mb-1">
                                        Contract Status
                                    </label>

                                    <select
                                        value={
                                            form.contractStatus
                                        }
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                contractStatus:
                                                    e.target.value
                                            })
                                        }
                                        className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                                    >

                                        <option value="Active">
                                            Active
                                        </option>

                                        <option value="Expired">
                                            Expired
                                        </option>

                                        <option value="Terminated">
                                            Terminated
                                        </option>

                                    </select>

                                </div>

                                <div className="pt-4 border-t flex justify-end gap-3">

                                    <button
                                        type="button"
                                        onClick={
                                            closeFormModal
                                        }
                                        disabled={
                                            saving
                                        }
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={
                                            saving
                                        }
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                                    >

                                        {saving
                                            ? "Saving..."
                                            : formMode ===
                                                "add"
                                                ? "Save Contract"
                                                : formMode ===
                                                    "edit"
                                                    ? "Save Changes"
                                                    : "Renew Contract"}

                                    </button>

                                </div>

                            </form>

                        </div>

                    </div>

                )}

            </main>

        </div>
    );
}