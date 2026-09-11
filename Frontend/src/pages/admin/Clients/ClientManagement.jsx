
import { useState, useEffect } from "react";
import {
    Search,
    Plus,
    X,
    Eye,
    MoreVertical,
    Users,
    FileText,
    Edit,
    UserX,
    Save,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../Layout/Sidebar";
 import api from '../../services/api'

export default function ClientManagement({
    activeTab,
    setActiveTab,
}) {
    const navigate = useNavigate();

    // =====================================================
    // CLIENT LIST
    // =====================================================

    const [clients, setClients] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    // =====================================================
    // MODALS
    // =====================================================

    const [showAddModal, setShowAddModal] =
        useState(false);

    const [showEditModal, setShowEditModal] =
        useState(false);

    const [showViewModal, setShowViewModal] =
        useState(false);

    const [showEmployeeModal, setShowEmployeeModal] =
        useState(false);

    // =====================================================
    // CLIENT SELECTION
    // =====================================================

    const [selectedClient, setSelectedClient] =
        useState(null);

    const [currentClientName, setCurrentClientName] =
        useState("");

    const [
        selectedClientEmployees,
        setSelectedClientEmployees,
    ] = useState([]);

    const [activeMenuId, setActiveMenuId] =
        useState(null);

    // =====================================================
    // FORM STATES
    // =====================================================

    const [companyName, setCompanyName] =
        useState("");

    const [logo, setLogo] =
        useState("🏢");

    const [industry, setIndustry] =
        useState("");

    const [gstin, setGstin] =
        useState("");

    const [contactPerson, setContactPerson] =
        useState("");

    const [email, setEmail] =
        useState("");

    const [phone, setPhone] =
        useState("");

    const [billingAddress, setBillingAddress] =
        useState("");

    const [stateCode, setStateCode] =
        useState("");

    const [creditTerms, setCreditTerms] =
        useState("Net 30");

    const [status, setStatus] =
        useState("Active");

    const [serviceFee, setServiceFee] =
        useState("");

    const [savingClient, setSavingClient] =
        useState(false);

    // =====================================================
    // FETCH CLIENTS
    // =====================================================

    const fetchClients = async () => {
        try {
            const res = await api.ge("/clients");
          

            const data = res.data;

            console.log(
                "CLIENT API RESPONSE:",
                data
            );

            if (!res.ok) {
                throw new Error(
                    data.message ||
                    "Failed to fetch clients"
                );
            }

            const clientList =
                Array.isArray(data)
                    ? data
                    : Array.isArray(data.data)
                        ? data.data
                        : [];

            setClients(clientList);

        } catch (err) {
            console.error(
                "Error fetching clients:",
                err
            );
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    // =====================================================
    // RESET FORM
    // =====================================================

    const resetForm = () => {
        setCompanyName("");
        setLogo("🏢");
        setIndustry("");
        setGstin("");
        setContactPerson("");
        setEmail("");
        setPhone("");
        setBillingAddress("");
        setStateCode("");
        setCreditTerms("Net 30");
        setStatus("Active");
        setServiceFee("");
    };

    // =====================================================
    // ADD CLIENT
    // =====================================================

   const addClient = async (e) => {
    e.preventDefault();

    if (
        !companyName.trim() ||
        !contactPerson.trim() ||
        !email.trim() ||
        !phone.trim()
    ) {
        alert("Please fill all required fields");
        return;
    }

    try {
        setSavingClient(true);

        const res = await api.post("/clients", {
            company_name: companyName.trim(),

            logo: logo || "🏢",

            industry:
                industry.trim() || null,

            gstin:
                gstin.trim()
                    ? gstin.trim().toUpperCase()
                    : null,

            contact_person:
                contactPerson.trim(),

            email:
                email.trim().toLowerCase(),

            phone:
                phone.trim(),

            billing_address:
                billingAddress.trim() || null,

            state_code:
                stateCode.trim() || null,

            credit_terms:
                creditTerms || "Net 30",

            status:
                status || "Active",

            service_fee:
                serviceFee !== ""
                    ? Number(serviceFee)
                    : null,
        });

        console.log(
            "ADD CLIENT RESPONSE:",
            res.data
        );

        resetForm();

        setShowAddModal(false);

        await fetchClients();

        alert("Client created successfully");

    } catch (err) {
        console.error(
            "Error adding client:",
            err
        );

        console.error(
            "ADD CLIENT ERROR:",
            err?.response?.data
        );

        alert(
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err.message ||
            "Failed to add client"
        );

    } finally {
        setSavingClient(false);
    }
};

    // =====================================================
    // EDIT CLIENT
    // =====================================================

    const handleEditClient = (client) => {
        console.log(
            "Opening edit client:",
            client
        );

        setSelectedClient(client);

        // Load existing data into form

        setCompanyName(
            client.company_name || ""
        );

        setLogo(
            client.logo || "🏢"
        );

        setIndustry(
            client.industry || ""
        );

        setGstin(
            client.gstin || ""
        );

        setContactPerson(
            client.contact_person || ""
        );

        setEmail(
            client.email || ""
        );

        setPhone(
            client.phone || ""
        );

        setBillingAddress(
            client.billing_address || ""
        );

        setStateCode(
            client.state_code || ""
        );

        setCreditTerms(
            client.credit_terms ||
            "Net 30"
        );

        setStatus(
            client.status ||
            "Active"
        );

        setServiceFee(
            client.service_fee !==
                null &&
            client.service_fee !==
                undefined
                ? String(
                    client.service_fee
                )
                : ""
        );

        setActiveMenuId(null);

        setShowEditModal(true);
    };

    // =====================================================
    // UPDATE CLIENT
    // =====================================================

   const updateClient = async (e) => {
    e.preventDefault();

    if (!selectedClient?.id) {
        alert("Invalid client selected");
        return;
    }

    if (
        !companyName.trim() ||
        !contactPerson.trim() ||
        !email.trim() ||
        !phone.trim()
    ) {
        alert("Please fill all required fields");
        return;
    }

    try {
        setSavingClient(true);

        const clientId = selectedClient.id;

        console.log(
            "Updating client:",
            clientId
        );

        const res = await api.put(
            `/clients/${clientId}`,
            {
                company_name:
                    companyName.trim(),

                logo:
                    logo || "🏢",

                industry:
                    industry.trim() || null,

                gstin:
                    gstin.trim()
                        ? gstin.trim().toUpperCase()
                        : null,

                contact_person:
                    contactPerson.trim(),

                email:
                    email.trim().toLowerCase(),

                phone:
                    phone.trim(),

                billing_address:
                    billingAddress.trim() || null,

                state_code:
                    stateCode.trim() || null,

                credit_terms:
                    creditTerms || "Net 30",

                status:
                    status || "Active",

                service_fee:
                    serviceFee !== ""
                        ? Number(serviceFee)
                        : null,
            }
        );

        console.log(
            "UPDATE CLIENT RESPONSE:",
            res.data
        );

        const data = res.data;

        if (data?.data) {
            setSelectedClient(data.data);
        }

        setShowEditModal(false);

        resetForm();

        await fetchClients();

        alert("Client updated successfully");

    } catch (err) {
        console.error(
            "Error updating client:",
            err
        );

        console.error(
            "UPDATE CLIENT ERROR:",
            err?.response?.data
        );

        alert(
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err.message ||
            "Failed to update client"
        );

    } finally {
        setSavingClient(false);
    }
};
    // =====================================================
    // DEACTIVATE CLIENT
    // =====================================================
const handleDeactivateClient = async (client) => {
    const confirmDeactivate =
        window.confirm(
            `Are you sure you want to deactivate ${client.company_name}? Historical payroll data will be preserved.`
        );

    if (!confirmDeactivate) {
        return;
    }

    try {
        const res = await api.patch(
            `/clients/${client.id}/deactivate`
        );

        console.log(
            "DEACTIVATE CLIENT RESPONSE:",
            res.data
        );

        setActiveMenuId(null);

        await fetchClients();

        alert(
            "Client deactivated successfully"
        );

    } catch (err) {
        console.error(
            "Error deactivating client:",
            err
        );

        console.error(
            "DEACTIVATE CLIENT ERROR:",
            err?.response?.data
        );

        alert(
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err.message ||
            "Failed to deactivate client"
        );
    }
};
    // =====================================================
    // VIEW CLIENT
    // =====================================================

    const handleViewEmployees = async (client) => {
    setCurrentClientName(
        client.company_name || "Client"
    );

    try {
        console.log(
            "Fetching deployments for client:",
            client.id
        );

        const res = await api.get(
            `/deployments/client/${client.id}`
        );

        console.log(
            "Deployment API response:",
            res.data
        );

        const data = res.data;

        const deploymentList =
            Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : [];

        setSelectedClientEmployees(
            deploymentList
        );

        setShowEmployeeModal(true);

    } catch (err) {
        console.error(
            "DEPLOYMENT FETCH ERROR:",
            err
        );

        console.error(
            "DEPLOYMENT API RESPONSE:",
            err?.response?.data
        );

        setSelectedClientEmployees([]);

        alert(
            `Could not fetch employee deployment details.\n\n${
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err.message ||
                "Request failed"
            }`
        );

    } finally {
        setActiveMenuId(null);
    }
};
    // =====================================================
    // VIEW CONTRACT
    // =====================================================

    const handleViewContract =
        (client) => {
            navigate(
                `/contracts?client_id=${client.id}&company_name=${encodeURIComponent(
                    client.company_name
                )}`
            );

            setActiveMenuId(null);
        };

    // =====================================================
    // SEARCH
    // =====================================================

    const filteredClients =
        clients.filter(
            (client) => {
                const search =
                    searchQuery
                        .toLowerCase()
                        .trim();

                if (!search) {
                    return true;
                }

                return (
                    client.company_name
                        ?.toLowerCase()
                        .includes(search) ||

                    client.contact_person
                        ?.toLowerCase()
                        .includes(search) ||

                    client.email
                        ?.toLowerCase()
                        .includes(search) ||

                    client.phone
                        ?.toLowerCase()
                        .includes(search)
                );
            }
        );

    // =====================================================
    // SERVICE FEE
    // =====================================================

    const formatServiceFee =
        (fee) => {
            if (
                fee === null ||
                fee === undefined ||
                fee === ""
            ) {
                return "N/A";
            }

            return `₹${Number(
                fee
            ).toLocaleString(
                "en-IN"
            )}`;
        };

    // =====================================================
    // FORM INPUT CLASS
    // =====================================================

    const inputClass =
        "w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    const labelClass =
        "block text-xs font-semibold text-slate-600 mb-1.5";

    // =====================================================
    // RETURN
    // =====================================================

    return (
        <div className="flex min-h-screen bg-slate-50/50">

            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />

            <main className="flex-1 p-8 space-y-6 overflow-y-auto">

                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            Client Master Directory
                        </h2>

                        <p className="text-sm text-slate-500">
                            Manage third-party payroll clients and enterprise accounts.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">

                        {/* SEARCH */}

                        <div className="relative w-full sm:w-64">

                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                            <input
                                type="text"
                                placeholder="Search clients..."
                                value={searchQuery}
                                onChange={(e) =>
                                    setSearchQuery(
                                        e.target.value
                                    )
                                }
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-transparent rounded-xl text-sm focus:bg-white focus:border-slate-300 focus:outline-none"
                            />

                        </div>

                        {/* ADD CLIENT */}

                        <button
                            onClick={() =>
                                setShowAddModal(
                                    true
                                )
                            }
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold"
                        >
                            <Plus className="h-4 w-4" />
                            Add Client
                        </button>

                    </div>
                </div>

                {/* =================================================
                    CLIENT TABLE
                ================================================= */}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    <div className="p-4 border-b border-slate-100 flex justify-between bg-slate-50/50">

                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Active Enterprise Accounts (
                            {
                                filteredClients.length
                            }
                            )
                        </span>

                        <span className="text-xs text-slate-500">
                            Real-time Database Synchronization
                        </span>

                    </div>

                    <div className="overflow-x-auto">

                        <table className="w-full text-left">

                            <thead>

                                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase bg-slate-50/30">

                                    <th className="p-4">
                                        ID
                                    </th>

                                    <th className="p-4">
                                        Company
                                    </th>

                                    <th className="p-4">
                                        Contact Person
                                    </th>

                                    <th className="p-4">
                                        Email
                                    </th>

                                    <th className="p-4">
                                        Phone
                                    </th>

                                    <th className="p-4">
                                        Service Fee
                                    </th>

                                    <th className="p-4">
                                        Status
                                    </th>

                                    <th className="p-4 text-right">
                                        Action
                                    </th>

                                </tr>

                            </thead>

                            <tbody className="divide-y divide-slate-100">

                                {filteredClients.length >
                                0 ? (

                                    filteredClients.map(
                                        (
                                            client
                                        ) => (

                                            <tr
                                                key={
                                                    client.id
                                                }
                                                className="hover:bg-slate-50 transition"
                                            >

                                                {/* ID */}

                                                <td className="p-4 font-mono text-xs text-slate-500">
                                                    #
                                                    {
                                                        client.id
                                                    }
                                                </td>

                                                {/* COMPANY */}

                                                <td className="p-4">

                                                    <div className="flex items-center gap-2">

                                                        <span className="text-lg">
                                                            {
                                                                client.logo ||
                                                                "🏢"
                                                            }
                                                        </span>

                                                        <span className="font-semibold text-slate-900">
                                                            {
                                                                client.company_name ||
                                                                "N/A"
                                                            }
                                                        </span>

                                                    </div>

                                                </td>

                                                {/* CONTACT */}

                                                <td className="p-4 text-slate-700">
                                                    {
                                                        client.contact_person ||
                                                        "N/A"
                                                    }
                                                </td>

                                                {/* EMAIL */}

                                                <td className="p-4 text-slate-600">
                                                    {
                                                        client.email ||
                                                        "N/A"
                                                    }
                                                </td>

                                                {/* PHONE */}

                                                <td className="p-4 font-mono text-xs text-slate-600">
                                                    {
                                                        client.phone ||
                                                        "N/A"
                                                    }
                                                </td>

                                                {/* SERVICE FEE */}

                                                <td className="p-4">

                                                    <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-semibold">
                                                        {formatServiceFee(
                                                            client.service_fee
                                                        )}
                                                    </span>

                                                </td>

                                                {/* STATUS */}

                                                <td className="p-4">

                                                    <span
                                                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                                            client.status ===
                                                            "Active"
                                                                ? "bg-emerald-50 text-emerald-600"
                                                                : "bg-amber-50 text-amber-600"
                                                        }`}
                                                    >
                                                        {
                                                            client.status ||
                                                            "Active"
                                                        }
                                                    </span>

                                                </td>

                                                {/* ACTION */}

                                                <td className="p-4 text-right">

                                                    <div className="inline-flex items-center gap-2">

                                                        {/* CONTRACT */}

                                                        <button
                                                            onClick={() =>
                                                                handleViewContract(
                                                                    client
                                                                )
                                                            }
                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                                                        >
                                                            <FileText className="h-3.5 w-3.5" />
                                                            Contracts
                                                        </button>

                                                        {/* VIEW */}

                                                        <button
                                                            onClick={() =>
                                                                handleViewClient(
                                                                    client
                                                                )
                                                            }
                                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                            View
                                                        </button>

                                                        {/* EMPLOYEES */}

                                                        <button
                                                            onClick={() =>
                                                                handleViewEmployees(
                                                                    client
                                                                )
                                                            }
                                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                                                        >
                                                            <Users className="h-3.5 w-3.5" />
                                                            Employees
                                                        </button>

                                                        {/* MORE */}

                                                        <div className="relative">

                                                            <button
                                                                onClick={() =>
                                                                    setActiveMenuId(
                                                                        activeMenuId ===
                                                                            client.id
                                                                            ? null
                                                                            : client.id
                                                                    )
                                                                }
                                                                className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </button>

                                                            {activeMenuId ===
                                                                client.id && (

                                                                <div className="absolute right-0 top-9 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50">

                                                                    {/* EDIT */}

                                                                    <button
                                                                        onClick={() =>
                                                                            handleEditClient(
                                                                                client
                                                                            )
                                                                        }
                                                                        className="w-full px-4 py-2.5 text-left text-xs hover:bg-blue-50 flex items-center gap-2 text-slate-700"
                                                                    >
                                                                        <Edit className="h-3.5 w-3.5 text-blue-600" />
                                                                        Edit Client
                                                                    </button>

                                                                    {/* DEACTIVATE */}

                                                                    <button
                                                                        onClick={() =>
                                                                            handleDeactivateClient(
                                                                                client
                                                                            )
                                                                        }
                                                                        className="w-full px-4 py-2.5 text-left text-xs text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                                                                    >
                                                                        <UserX className="h-3.5 w-3.5" />
                                                                        Deactivate Client
                                                                    </button>

                                                                </div>
                                                            )}

                                                        </div>

                                                    </div>

                                                </td>

                                            </tr>
                                        )
                                    )

                                ) : (

                                    <tr>

                                        <td
                                            colSpan="8"
                                            className="p-8 text-center text-slate-400"
                                        >
                                            No client organizations found.
                                        </td>

                                    </tr>

                                )}

                            </tbody>

                        </table>

                    </div>

                </div>

                {/* =================================================
                    ADD CLIENT MODAL
                ================================================= */}

                {showAddModal && (

                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

                        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden">

                            <div className="flex justify-between items-center px-6 py-4 border-b">

                                <h3 className="font-bold text-slate-900">
                                    Add New Enterprise Client
                                </h3>

                                <button
                                    onClick={() => {
                                        setShowAddModal(
                                            false
                                        );
                                        resetForm();
                                    }}
                                >
                                    <X className="h-5 w-5 text-slate-400" />
                                </button>

                            </div>

                            <form
                                onSubmit={addClient}
                                className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
                            >

                                <ClientFormFields
                                    companyName={
                                        companyName
                                    }
                                    setCompanyName={
                                        setCompanyName
                                    }
                                    logo={logo}
                                    setLogo={
                                        setLogo
                                    }
                                    industry={
                                        industry
                                    }
                                    setIndustry={
                                        setIndustry
                                    }
                                    gstin={gstin}
                                    setGstin={
                                        setGstin
                                    }
                                    contactPerson={
                                        contactPerson
                                    }
                                    setContactPerson={
                                        setContactPerson
                                    }
                                    email={email}
                                    setEmail={
                                        setEmail
                                    }
                                    phone={phone}
                                    setPhone={
                                        setPhone
                                    }
                                    serviceFee={
                                        serviceFee
                                    }
                                    setServiceFee={
                                        setServiceFee
                                    }
                                    creditTerms={
                                        creditTerms
                                    }
                                    setCreditTerms={
                                        setCreditTerms
                                    }
                                    status={status}
                                    setStatus={
                                        setStatus
                                    }
                                    stateCode={
                                        stateCode
                                    }
                                    setStateCode={
                                        setStateCode
                                    }
                                    billingAddress={
                                        billingAddress
                                    }
                                    setBillingAddress={
                                        setBillingAddress
                                    }
                                    inputClass={
                                        inputClass
                                    }
                                    labelClass={
                                        labelClass
                                    }
                                />

                                <div className="pt-4 border-t flex justify-end gap-3">

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddModal(
                                                false
                                            );
                                            resetForm();
                                        }}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={
                                            savingClient
                                        }
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" />

                                        {savingClient
                                            ? "Saving..."
                                            : "Save Client"}
                                    </button>

                                </div>

                            </form>

                        </div>

                    </div>
                )}

                {/* =================================================
                    EDIT CLIENT MODAL
                ================================================= */}

                {showEditModal &&
                    selectedClient && (

                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">

                            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden">

                                {/* HEADER */}

                                <div className="flex justify-between items-center px-6 py-4 border-b bg-blue-50">

                                    <div>

                                        <h3 className="font-bold text-slate-900">
                                            Edit Client
                                        </h3>

                                        <p className="text-xs text-slate-500 mt-1">
                                            Update details for{" "}
                                            <span className="font-semibold">
                                                {
                                                    selectedClient.company_name
                                                }
                                            </span>
                                        </p>

                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowEditModal(
                                                false
                                            );
                                            resetForm();
                                        }}
                                        className="p-2 hover:bg-blue-100 rounded-lg"
                                    >
                                        <X className="h-5 w-5 text-slate-500" />
                                    </button>

                                </div>

                                {/* FORM */}

                                <form
                                    onSubmit={
                                        updateClient
                                    }
                                    className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
                                >

                                    <ClientFormFields
                                        companyName={
                                            companyName
                                        }
                                        setCompanyName={
                                            setCompanyName
                                        }
                                        logo={logo}
                                        setLogo={
                                            setLogo
                                        }
                                        industry={
                                            industry
                                        }
                                        setIndustry={
                                            setIndustry
                                        }
                                        gstin={
                                            gstin
                                        }
                                        setGstin={
                                            setGstin
                                        }
                                        contactPerson={
                                            contactPerson
                                        }
                                        setContactPerson={
                                            setContactPerson
                                        }
                                        email={
                                            email
                                        }
                                        setEmail={
                                            setEmail
                                        }
                                        phone={
                                            phone
                                        }
                                        setPhone={
                                            setPhone
                                        }
                                        serviceFee={
                                            serviceFee
                                        }
                                        setServiceFee={
                                            setServiceFee
                                        }
                                        creditTerms={
                                            creditTerms
                                        }
                                        setCreditTerms={
                                            setCreditTerms
                                        }
                                        status={
                                            status
                                        }
                                        setStatus={
                                            setStatus
                                        }
                                        stateCode={
                                            stateCode
                                        }
                                        setStateCode={
                                            setStateCode
                                        }
                                        billingAddress={
                                            billingAddress
                                        }
                                        setBillingAddress={
                                            setBillingAddress
                                        }
                                        inputClass={
                                            inputClass
                                        }
                                        labelClass={
                                            labelClass
                                        }
                                        isEdit
                                    />

                                    <div className="pt-4 border-t flex justify-between items-center">

                                        <span className="text-xs text-slate-400">
                                            Client ID: #
                                            {
                                                selectedClient.id
                                            }
                                        </span>

                                        <div className="flex gap-3">

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowEditModal(
                                                        false
                                                    );
                                                    resetForm();
                                                }}
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold"
                                            >
                                                Cancel
                                            </button>

                                            <button
                                                type="submit"
                                                disabled={
                                                    savingClient
                                                }
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                                            >
                                                <Save className="h-4 w-4" />

                                                {savingClient
                                                    ? "Updating..."
                                                    : "Update Client"}
                                            </button>

                                        </div>

                                    </div>

                                </form>

                            </div>

                        </div>
                    )}

                {/* =================================================
                    EMPLOYEES MODAL
                ================================================= */}

                {showEmployeeModal && (

                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

                        <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full overflow-hidden">

                            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50">

                                <div>
                                    <h3 className="font-bold text-slate-900">
                                        Employees Deployed at{" "}
                                        {
                                            currentClientName
                                        }
                                    </h3>

                                    <p className="text-xs text-slate-500 mt-1">
                                        Current employee deployment and billing details
                                    </p>
                                </div>

                                <button
                                    onClick={() =>
                                        setShowEmployeeModal(
                                            false
                                        )
                                    }
                                    className="p-2 hover:bg-slate-200 rounded-lg"
                                >
                                    <X className="h-5 w-5 text-slate-500" />
                                </button>

                            </div>

                            <div className="p-6">

                                <div className="overflow-x-auto border rounded-xl">

                                    <table className="w-full text-left">

                                        <thead>

                                            <tr className="bg-slate-50 text-xs uppercase text-slate-400">

                                                <th className="p-3">
                                                    ID
                                                </th>

                                                <th className="p-3">
                                                    Employee
                                                </th>

                                                <th className="p-3">
                                                    Designation
                                                </th>

                                                <th className="p-3">
                                                    Project
                                                </th>

                                                <th className="p-3">
                                                    Pay Rate
                                                </th>

                                                <th className="p-3">
                                                    Bill Rate
                                                </th>

                                                <th className="p-3">
                                                    Billing Model
                                                </th>

                                                <th className="p-3">
                                                    Start Date
                                                </th>

                                                <th className="p-3">
                                                    End Date
                                                </th>

                                                <th className="p-3">
                                                    Status
                                                </th>

                                            </tr>

                                        </thead>

                                        <tbody className="divide-y">

                                            {selectedClientEmployees.length >
                                            0 ? (

                                                selectedClientEmployees.map(
                                                    (
                                                        deployment,
                                                        index
                                                    ) => (

                                                        <tr
                                                            key={
                                                                deployment.deployment_id ||
                                                                deployment.id ||
                                                                index
                                                            }
                                                            className="hover:bg-slate-50"
                                                        >

                                                            <td className="p-3 text-xs text-slate-500">
                                                                #
                                                                {
                                                                    deployment.deployment_id ||
                                                                    deployment.id ||
                                                                    index +
                                                                    1
                                                                }
                                                            </td>

                                                            <td className="p-3">

                                                                <div className="font-semibold text-slate-900">
                                                                    {
                                                                        deployment.candidate_name ||
                                                                        deployment.employee_name ||
                                                                        deployment.name ||
                                                                        `Candidate #${deployment.candidate_id}`
                                                                    }
                                                                </div>

                                                                {deployment.email && (
                                                                    <div className="text-xs text-slate-400">
                                                                        {
                                                                            deployment.email
                                                                        }
                                                                    </div>
                                                                )}

                                                                {deployment.phone && (
                                                                    <div className="text-xs text-slate-400">
                                                                        {
                                                                            deployment.phone
                                                                        }
                                                                    </div>
                                                                )}

                                                            </td>

                                                            <td className="p-3 text-sm text-slate-700">
                                                                {
                                                                    deployment.designation ||
                                                                    "N/A"
                                                                }
                                                            </td>

                                                            <td className="p-3 text-sm font-medium text-slate-800">
                                                                {
                                                                    deployment.project_name ||
                                                                    "N/A"
                                                                }
                                                            </td>

                                                            <td className="p-3 font-semibold text-purple-600">
                                                                ₹
                                                                {Number(
                                                                    deployment.pay_rate ||
                                                                    0
                                                                ).toLocaleString(
                                                                    "en-IN"
                                                                )}
                                                            </td>

                                                            <td className="p-3 font-semibold text-emerald-600">
                                                                ₹
                                                                {Number(
                                                                    deployment.bill_rate ||
                                                                    0
                                                                ).toLocaleString(
                                                                    "en-IN"
                                                                )}
                                                            </td>

                                                            <td className="p-3 text-xs text-slate-600">
                                                                {
                                                                    deployment.billing_model ||
                                                                    "N/A"
                                                                }
                                                            </td>

                                                            <td className="p-3 text-xs text-slate-600">
                                                                {
                                                                    deployment.start_date ||
                                                                    "N/A"
                                                                }
                                                            </td>

                                                            <td className="p-3 text-xs text-slate-600">
                                                                {
                                                                    deployment.end_date ||
                                                                    "Ongoing"
                                                                }
                                                            </td>

                                                            <td className="p-3">

                                                                <span
                                                                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                                                        deployment.status ===
                                                                        "Active"
                                                                            ? "bg-emerald-50 text-emerald-600"
                                                                            : "bg-amber-50 text-amber-600"
                                                                    }`}
                                                                >
                                                                    {
                                                                        deployment.status ||
                                                                        "N/A"
                                                                    }
                                                                </span>

                                                            </td>

                                                        </tr>

                                                    )
                                                )

                                            ) : (

                                                <tr>

                                                    <td
                                                        colSpan="10"
                                                        className="p-10 text-center text-slate-400"
                                                    >
                                                        No employees currently deployed for this client.
                                                    </td>

                                                </tr>

                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            </div>

                            <div className="px-6 py-4 border-t flex justify-between items-center">

                                <span className="text-xs text-slate-500">
                                    {
                                        selectedClientEmployees.length
                                    }{" "}
                                    active deployment(s)
                                </span>

                                <button
                                    onClick={() =>
                                        setShowEmployeeModal(
                                            false
                                        )
                                    }
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-semibold"
                                >
                                    Close
                                </button>

                            </div>

                        </div>

                    </div>
                )}

                {/* =================================================
                    VIEW CLIENT MODAL
                ================================================= */}

                {showViewModal &&
                    selectedClient && (

                        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">

                            <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden">

                                <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50">

                                    <h3 className="font-bold text-slate-900 flex items-center gap-2">

                                        <span>
                                            {
                                                selectedClient.logo ||
                                                "🏢"
                                            }
                                        </span>

                                        <span>
                                            {
                                                selectedClient.company_name
                                            }
                                        </span>

                                    </h3>

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

                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl">

                                        <InfoItem
                                            label="Client ID"
                                            value={`#${selectedClient.id}`}
                                        />

                                        <InfoItem
                                            label="Status"
                                            value={
                                                selectedClient.status ||
                                                "Active"
                                            }
                                        />

                                        <InfoItem
                                            label="Company"
                                            value={
                                                selectedClient.company_name
                                            }
                                        />

                                        <InfoItem
                                            label="Industry"
                                            value={
                                                selectedClient.industry
                                            }
                                        />

                                        <InfoItem
                                            label="Service Fee"
                                            value={formatServiceFee(
                                                selectedClient.service_fee
                                            )}
                                        />

                                        <InfoItem
                                            label="Credit Terms"
                                            value={
                                                selectedClient.credit_terms
                                            }
                                        />

                                    </div>

                                    <div>

                                        <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">
                                            Contact & Account Information
                                        </h4>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                                            <InfoCard
                                                label="Contact Person"
                                                value={
                                                    selectedClient.contact_person
                                                }
                                            />

                                            <InfoCard
                                                label="Email Address"
                                                value={
                                                    selectedClient.email
                                                }
                                            />

                                            <InfoCard
                                                label="Phone Number"
                                                value={
                                                    selectedClient.phone
                                                }
                                            />

                                            <InfoCard
                                                label="GSTIN"
                                                value={
                                                    selectedClient.gstin
                                                }
                                            />

                                            <InfoCard
                                                label="State Code"
                                                value={
                                                    selectedClient.state_code
                                                }
                                            />

                                            <InfoCard
                                                label="Billing Address"
                                                value={
                                                    selectedClient.billing_address
                                                }
                                            />

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>
                    )}

            </main>
        </div>
    );
}

// =====================================================
// CLIENT FORM COMPONENT
// =====================================================

function ClientFormFields({
    companyName,
    setCompanyName,

    logo,
    setLogo,

    industry,
    setIndustry,

    gstin,
    setGstin,

    contactPerson,
    setContactPerson,

    email,
    setEmail,

    phone,
    setPhone,

    serviceFee,
    setServiceFee,

    creditTerms,
    setCreditTerms,

    status,
    setStatus,

    stateCode,
    setStateCode,

    billingAddress,
    setBillingAddress,

    inputClass,
    labelClass,

    isEdit = false,
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* COMPANY */}

            <div>
                <label className={labelClass}>
                    Company Name *
                </label>

                <input
                    required
                    value={companyName}
                    onChange={(e) =>
                        setCompanyName(
                            e.target.value
                        )
                    }
                    placeholder="ABC Technologies"
                    className={inputClass}
                />
            </div>

            {/* INDUSTRY */}

            <div>
                <label className={labelClass}>
                    Industry
                </label>

                <input
                    value={industry}
                    onChange={(e) =>
                        setIndustry(
                            e.target.value
                        )
                    }
                    placeholder="IT & Software"
                    className={inputClass}
                />
            </div>

            {/* LOGO */}

            <div>
                <label className={labelClass}>
                    Logo / Icon
                </label>

                <input
                    value={logo}
                    onChange={(e) =>
                        setLogo(
                            e.target.value
                        )
                    }
                    placeholder="🏢"
                    className={inputClass}
                />
            </div>

            {/* GSTIN */}

            <div>
                <label className={labelClass}>
                    GSTIN
                </label>

                <input
                    value={gstin}
                    onChange={(e) =>
                        setGstin(
                            e.target.value.toUpperCase()
                        )
                    }
                    placeholder="27AAACT2719K1ZO"
                    className={`${inputClass} font-mono`}
                />
            </div>

            {/* STATE CODE */}

            <div>
                <label className={labelClass}>
                    State Code
                </label>

                <input
                    value={stateCode}
                    onChange={(e) =>
                        setStateCode(
                            e.target.value
                        )
                    }
                    placeholder="27"
                    className={inputClass}
                />
            </div>

            {/* CONTACT */}

            <div>
                <label className={labelClass}>
                    Contact Person *
                </label>

                <input
                    required
                    value={contactPerson}
                    onChange={(e) =>
                        setContactPerson(
                            e.target.value
                        )
                    }
                    placeholder="Rajesh Kumar"
                    className={inputClass}
                />
            </div>

            {/* EMAIL */}

            <div>
                <label className={labelClass}>
                    Email *
                </label>

                <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) =>
                        setEmail(
                            e.target.value
                        )
                    }
                    placeholder="contact@company.com"
                    className={inputClass}
                />
            </div>

            {/* PHONE */}

            <div>
                <label className={labelClass}>
                    Phone *
                </label>

                <input
                    required
                    value={phone}
                    onChange={(e) =>
                        setPhone(
                            e.target.value
                        )
                    }
                    placeholder="+91 9876543210"
                    className={inputClass}
                />
            </div>

            {/* SERVICE FEE */}

            <div>
                <label className={labelClass}>
                    Service Fee (₹) *
                </label>

                <input
                    required
                    type="number"
                    min="0"
                    value={serviceFee}
                    onChange={(e) =>
                        setServiceFee(
                            e.target.value
                        )
                    }
                    placeholder="50000"
                    className={inputClass}
                />
            </div>

            {/* CREDIT TERMS */}

            <div>
                <label className={labelClass}>
                    Credit Terms
                </label>

                <select
                    value={creditTerms}
                    onChange={(e) =>
                        setCreditTerms(
                            e.target.value
                        )
                    }
                    className={inputClass}
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

            {/* STATUS */}

            {isEdit && (
                <div>
                    <label className={labelClass}>
                        Status
                    </label>

                    <select
                        value={status}
                        onChange={(e) =>
                            setStatus(
                                e.target.value
                            )
                        }
                        className={inputClass}
                    >
                        <option value="Active">
                            Active
                        </option>

                        <option value="Inactive">
                            Inactive
                        </option>
                    </select>
                </div>
            )}

            {/* BILLING ADDRESS */}

            <div className="sm:col-span-2">

                <label className={labelClass}>
                    Billing Address
                </label>

                <textarea
                    rows="2"
                    value={billingAddress}
                    onChange={(e) =>
                        setBillingAddress(
                            e.target.value
                        )
                    }
                    placeholder="Mumbai, Maharashtra"
                    className={inputClass}
                />

            </div>

        </div>
    );
}

// =====================================================
// INFO ITEM
// =====================================================

function InfoItem({
    label,
    value,
}) {
    return (
        <div>

            <span className="block text-[11px] font-semibold text-slate-400 uppercase">
                {label}
            </span>

            <span className="font-semibold text-slate-800">
                {value || "N/A"}
            </span>

        </div>
    );
}

// =====================================================
// INFO CARD
// =====================================================

function InfoCard({
    label,
    value,
}) {
    return (
        <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">

            <span className="text-slate-400 block text-xs">
                {label}
            </span>

            <span className="font-semibold text-slate-900 text-xs break-words">
                {value || "N/A"}
            </span>

        </div>
    );
}

