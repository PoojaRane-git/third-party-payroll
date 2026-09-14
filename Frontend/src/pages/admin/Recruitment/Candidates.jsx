import React, { useState, useEffect } from "react";
import {
    UserCheck,
    ArrowRight,
    X,
    FileText,
    Mail,
    Briefcase,
    Award,
    CheckSquare,
    Square,
    Filter,
    Download,
    Star,
    History,
    Send,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";
import api from "../../services/api";

const STAGES = [
    "Applied",
    "Screening",
    "Interview",
    "Selected",
    "Offer Sent",
    "Joined",
];

export default function Candidates({
    activeTab,
    setActiveTab,
}) {
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidate, setSelectedCandidate] =
        useState(null);
    const [selectedIds, setSelectedIds] = useState([]);

    // ==========================================================
    // FILTERS & SEARCH
    // ==========================================================

    const [roleFilter, setRoleFilter] = useState("All");
    const [experienceFilter, setExperienceFilter] =
        useState("All");
    const [searchTerm, setSearchTerm] = useState("");

    // ==========================================================
    // FEEDBACK & NOTES
    // ==========================================================

    const [interviewNotes, setInterviewNotes] =
        useState("");
    const [techScore, setTechScore] = useState(4);

    // ==========================================================
    // FETCH CANDIDATES
    // ==========================================================

    useEffect(() => {
        const fetchCandidates = async () => {
            try {
                const response = await api.get(
                    "/candidates"
                );

                const data = response.data;

                const fetched = Array.isArray(data)
                    ? data
                    : data?.data || [];

                // Add mock timeline & audit log
                // if not already present
                const enriched = fetched.map((candidate) => ({
                    ...candidate,

                    timeline:
                        candidate.timeline ||
                        [
                            `Applied on ${new Date().toLocaleDateString()}`,
                        ],

                    notes:
                        candidate.notes ||
                        "Initial screening pending review.",
                }));

                setCandidates(enriched);
            } catch (err) {
                console.error(
                    "Error fetching candidates:",
                    err
                );

                const errorMessage =
                    err.response?.data?.message ||
                    err.response?.data?.error ||
                    err.message ||
                    "Failed to fetch candidates.";

                alert(errorMessage);
            }
        };

        fetchCandidates();
    }, []);

    // ==========================================================
    // UPDATE CANDIDATE STAGE
    // ==========================================================

    const updateStage = async (id, newStage) => {
        try {
            const response = await api.patch(
                `/candidates/${id}/status`,
                {
                    status: newStage,
                }
            );

            const data = response.data;

            console.log(
                "Candidate stage updated:",
                data
            );

            const timeLog = `Moved to ${newStage} on ${new Date().toLocaleDateString()}`;

            setCandidates((prevCandidates) =>
                prevCandidates.map((candidate) => {
                    if (candidate.id !== id) {
                        return candidate;
                    }

                    const updatedTimeline = [
                        timeLog,
                        ...(candidate.timeline || []),
                    ];

                    const updated = {
                        ...candidate,
                        status: newStage,
                        timeline: updatedTimeline,
                    };

                    // Keep selected candidate modal updated
                    if (
                        selectedCandidate &&
                        selectedCandidate.id === id
                    ) {
                        setSelectedCandidate(updated);
                    }

                    return updated;
                })
            );

            if (newStage === "Joined") {
                alert(
                    "Candidate marked as Joined! Official staff record created & pushed to deployment registry automatically."
                );
            }
        } catch (err) {
            console.error(
                "Error updating candidate stage:",
                err
            );

            const errorMessage =
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                "Failed to update candidate stage.";

            alert(errorMessage);
        }
    };

    // ==========================================================
    // BULK ACTION HANDLER
    // ==========================================================

    const handleBulkMove = async (targetStage) => {
        if (selectedIds.length === 0) {
            alert("No candidates selected!");
            return;
        }

        const count = selectedIds.length;

        try {
            await Promise.all(
                selectedIds.map((id) =>
                    updateStage(id, targetStage)
                )
            );

            setSelectedIds([]);

            alert(
                `Successfully moved ${count} candidates to ${targetStage}!`
            );
        } catch (err) {
            console.error(
                "Error during bulk stage update:",
                err
            );

            alert(
                "Some candidates could not be moved."
            );

            setSelectedIds([]);
        }
    };

    // ==========================================================
    // SELECT / DESELECT ALL
    // ==========================================================

    const toggleSelectAll = (stageCandidates) => {
        const stageIds = stageCandidates.map(
            (candidate) => candidate.id
        );

        const allSelected = stageIds.every((id) =>
            selectedIds.includes(id)
        );

        if (allSelected) {
            setSelectedIds((prev) =>
                prev.filter(
                    (id) => !stageIds.includes(id)
                )
            );
        } else {
            setSelectedIds((prev) =>
                Array.from(
                    new Set([...prev, ...stageIds])
                )
            );
        }
    };

    // ==========================================================
    // SELECT / DESELECT CANDIDATE
    // ==========================================================

    const toggleSelectCandidate = (id) => {
        setSelectedIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter(
                    (candidateId) =>
                        candidateId !== id
                );
            }

            return [...prev, id];
        });
    };

    // ==========================================================
    // OFFER LETTER GENERATOR
    // ==========================================================

    const generateOfferLetter = (candidate) => {
        const printWindow = window.open(
            "",
            "_blank"
        );

        if (!printWindow) {
            alert(
                "Unable to open offer letter. Please allow pop-ups for this site."
            );
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>
                        Offer Letter - ${candidate.full_name}
                    </title>

                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 40px;
                            color: #333;
                            line-height: 1.6;
                        }

                        .header {
                            text-align: center;
                            border-bottom: 2px solid #0056b3;
                            padding-bottom: 20px;
                            margin-bottom: 30px;
                        }

                        .content {
                            margin-bottom: 40px;
                        }

                        .footer {
                            margin-top: 50px;
                            border-top: 1px solid #ccc;
                            padding-top: 20px;
                            display: flex;
                            justify-content: space-between;
                        }
                    </style>
                </head>

                <body>
                    <div class="header">
                        <h2>
                            OFFICIAL EMPLOYMENT OFFER LETTER
                        </h2>

                        <p>
                            Talent Corner & Payroll Solutions Inc.
                        </p>
                    </div>

                    <div class="content">
                        <p>
                            Dear
                            <strong>
                                ${candidate.full_name}
                            </strong>,
                        </p>

                        <p>
                            We are thrilled to offer you
                            the position of
                            <strong>
                                ${
                                    candidate.position ||
                                    candidate
                                        .job_requirements
                                        ?.job_title ||
                                    "Software Specialist"
                                }
                            </strong>
                            with our organization.
                        </p>

                        <p>
                            Based on your profile and
                            technical evaluation, your
                            starting annual CTC will be
                            structured competitively inline
                            with industry benchmarks.
                        </p>

                        <p>
                            Please review this digital offer
                            and confirm your acceptance to
                            trigger automatic onboarding and
                            deployment mapping.
                        </p>
                    </div>

                    <div class="footer">
                        <div>
                            <p>Authorized Signature</p>
                            <br />
                            <p>
                                <strong>
                                    HR Executive
                                </strong>
                            </p>
                        </div>

                        <div>
                            <p>Candidate Acceptance</p>
                            <br />
                            <p>
                                <strong>
                                    ${candidate.full_name}
                                </strong>
                            </p>
                        </div>
                    </div>
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.print();
    };

    // ==========================================================
    // FILTER LOGIC
    // ==========================================================

    const filteredCandidates = candidates.filter(
        (candidate) => {
            const search =
                searchTerm.toLowerCase();

            const matchesSearch =
                candidate.full_name
                    ?.toLowerCase()
                    .includes(search) ||
                candidate.email
                    ?.toLowerCase()
                    .includes(search);

            const roleTitle =
                candidate.position ||
                candidate.job_requirements
                    ?.job_title ||
                "General";

            const matchesRole =
                roleFilter === "All" ||
                roleTitle === roleFilter;

            let matchesExp = true;

            const exp = Number(
                candidate.experience_years || 0
            );

            if (experienceFilter === "Junior") {
                matchesExp = exp <= 2;
            } else if (
                experienceFilter === "Mid"
            ) {
                matchesExp =
                    exp > 2 && exp <= 5;
            } else if (
                experienceFilter === "Senior"
            ) {
                matchesExp = exp > 5;
            }

            return (
                matchesSearch &&
                matchesRole &&
                matchesExp
            );
        }
    );

    // ==========================================================
    // UNIQUE ROLES
    // ==========================================================

    const uniqueRoles = [
        "All",
        ...new Set(
            candidates.map(
                (candidate) =>
                    candidate.position ||
                    candidate.job_requirements
                        ?.job_title ||
                    "General"
            )
        ),
    ];

    // ==========================================================
    // UI
    // ==========================================================

    return (
        <div className="flex min-h-screen bg-slate-50/50 relative">

            {/* SIDEBAR */}

            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />

            {/* MAIN CONTENT */}

            <main className="flex-1 p-8 space-y-6 overflow-y-auto">

                {/* ==================================================
                    HEADER
                ================================================== */}

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                            ATS Pipeline & Talent Hub
                        </h2>

                        <p className="text-sm text-slate-500">
                            Manage recruitment stages,
                            review audit histories, and
                            generate digital offer letters.
                        </p>
                    </div>

                    {/* BULK ACTION CONTROLS */}

                    {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl animate-fadeIn">

                            <span className="text-xs font-bold text-blue-700">
                                {selectedIds.length} Selected
                            </span>

                            <select
                                onChange={(e) => {
                                    if (
                                        e.target.value
                                    ) {
                                        handleBulkMove(
                                            e.target.value
                                        );
                                    }
                                }}
                                defaultValue=""
                                className="text-xs bg-white border border-blue-300 rounded-lg p-1 font-semibold text-blue-800"
                            >
                                <option
                                    value=""
                                    disabled
                                >
                                    Bulk Move Stage...
                                </option>

                                {STAGES.map(
                                    (stage) => (
                                        <option
                                            key={stage}
                                            value={stage}
                                        >
                                            {stage}
                                        </option>
                                    )
                                )}
                            </select>
                        </div>
                    )}
                </div>

                {/* ==================================================
                    FILTERS & SEARCH
                ================================================== */}

                <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">

                    <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <Filter className="h-4 w-4" />
                        Filters:
                    </div>

                    <input
                        type="text"
                        placeholder="Search candidate name..."
                        value={searchTerm}
                        onChange={(e) =>
                            setSearchTerm(
                                e.target.value
                            )
                        }
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <select
                        value={roleFilter}
                        onChange={(e) =>
                            setRoleFilter(
                                e.target.value
                            )
                        }
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
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
                        value={experienceFilter}
                        onChange={(e) =>
                            setExperienceFilter(
                                e.target.value
                            )
                        }
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                    >
                        <option value="All">
                            Experience: All
                        </option>

                        <option value="Junior">
                            Junior (0-2 yrs)
                        </option>

                        <option value="Mid">
                            Mid (3-5 yrs)
                        </option>

                        <option value="Senior">
                            Senior (5+ yrs)
                        </option>
                    </select>
                </div>

                {/* ==================================================
                    KANBAN BOARD
                ================================================== */}

                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">

                    {STAGES.map((stage) => {
                        const stageCandidates =
                            filteredCandidates.filter(
                                (candidate) =>
                                    (
                                        candidate.status ||
                                        "Applied"
                                    ) === stage
                            );

                        const allStageIds =
                            stageCandidates.map(
                                (candidate) =>
                                    candidate.id
                            );

                        const isAllSelected =
                            allStageIds.length > 0 &&
                            allStageIds.every(
                                (id) =>
                                    selectedIds.includes(
                                        id
                                    )
                            );

                        return (
                            <div
                                key={stage}
                                className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm flex flex-col h-[68vh]"
                            >

                                {/* STAGE HEADER */}

                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">

                                    <div className="flex items-center gap-2">

                                        {stageCandidates.length >
                                            0 && (
                                            <button
                                                onClick={() =>
                                                    toggleSelectAll(
                                                        stageCandidates
                                                    )
                                                }
                                                className="text-slate-400 hover:text-blue-600"
                                            >
                                                {isAllSelected ? (
                                                    <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
                                                ) : (
                                                    <Square className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        )}

                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                            {stage}
                                        </span>
                                    </div>

                                    <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600">
                                        {
                                            stageCandidates.length
                                        }
                                    </span>
                                </div>

                                {/* CANDIDATE CARDS */}

                                <div className="space-y-3 overflow-y-auto flex-1 pr-1">

                                    {stageCandidates.map(
                                        (candidate) => {
                                            const currentIndex =
                                                STAGES.indexOf(
                                                    stage
                                                );

                                            const nextStage =
                                                STAGES[
                                                    currentIndex +
                                                        1
                                                ];

                                            const isSelected =
                                                selectedIds.includes(
                                                    candidate.id
                                                );

                                            return (
                                                <div
                                                    key={
                                                        candidate.id
                                                    }
                                                    className={`p-3 bg-slate-50 border rounded-xl space-y-2 shadow-sm transition ${
                                                        isSelected
                                                            ? "border-blue-500 bg-blue-50/30"
                                                            : "border-slate-100"
                                                    }`}
                                                >

                                                    <div className="flex items-start justify-between">

                                                        <button
                                                            onClick={() =>
                                                                setSelectedCandidate(
                                                                    candidate
                                                                )
                                                            }
                                                            className="text-xs font-bold text-slate-900 hover:text-blue-600 transition text-left block truncate flex-1"
                                                        >
                                                            {
                                                                candidate.full_name
                                                            }
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                toggleSelectCandidate(
                                                                    candidate.id
                                                                )
                                                            }
                                                            className="text-slate-400 hover:text-blue-600 ml-1"
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
                                                            ) : (
                                                                <Square className="h-3.5 w-3.5" />
                                                            )}
                                                        </button>

                                                    </div>

                                                    <p className="text-[11px] text-slate-500 truncate">
                                                        {candidate.position ||
                                                            candidate
                                                                .job_requirements
                                                                ?.job_title}
                                                    </p>

                                                    {nextStage && (
                                                        <button
                                                            onClick={() =>
                                                                updateStage(
                                                                    candidate.id,
                                                                    nextStage
                                                                )
                                                            }
                                                            className="w-full mt-2 py-1 px-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-semibold flex items-center justify-center space-x-1 transition"
                                                        >
                                                            <span>
                                                                Move to{" "}
                                                                {
                                                                    nextStage
                                                                }
                                                            </span>

                                                            <ArrowRight className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        }
                                    )}

                                </div>
                            </div>
                        );
                    })}

                </div>
            </main>

            {/* ======================================================
                CANDIDATE DETAILS MODAL
            ====================================================== */}

            {selectedCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">

                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden p-6 space-y-6 relative max-h-[90vh] overflow-y-auto">

                        {/* CLOSE BUTTON */}

                        <button
                            onClick={() =>
                                setSelectedCandidate(
                                    null
                                )
                            }
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {/* HEADER */}

                        <div className="space-y-1 pr-8">

                            <div className="flex items-center gap-3">

                                <h3 className="text-xl font-bold text-slate-900">
                                    {
                                        selectedCandidate.full_name
                                    }
                                </h3>

                                <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                                    {
                                        selectedCandidate.status ||
                                        "Applied"
                                    }
                                </span>
                            </div>

                            <p className="text-xs text-slate-500 flex items-center gap-1.5">

                                <Mail className="h-3.5 w-3.5 text-slate-400" />

                                {
                                    selectedCandidate.email ||
                                    "No email provided"
                                }
                            </p>
                        </div>

                        {/* DETAILS GRID */}

                        <div className="grid grid-cols-2 gap-4">

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">

                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Position
                                </span>

                                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 truncate">

                                    <Briefcase className="h-3.5 w-3.5 text-blue-600" />

                                    {
                                        selectedCandidate.position ||
                                        selectedCandidate
                                            .job_requirements
                                            ?.job_title ||
                                        "General"
                                    }
                                </p>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">

                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Experience
                                </span>

                                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">

                                    <Award className="h-3.5 w-3.5 text-emerald-600" />

                                    {selectedCandidate.experience_years
                                        ? `${selectedCandidate.experience_years} Years`
                                        : "N/A"}
                                </p>
                            </div>

                        </div>

                        {/* ==================================================
                            INTERVIEW FEEDBACK & SCORECARD
                        ================================================== */}

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">

                            <div className="flex items-center justify-between">

                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Interview Scorecard
                                </span>

                                <div className="flex items-center gap-1 text-amber-500">

                                    {[1, 2, 3, 4, 5].map(
                                        (star) => (
                                            <Star
                                                key={star}
                                                className={`h-4 w-4 ${
                                                    star <=
                                                    techScore
                                                        ? "fill-amber-400 text-amber-400"
                                                        : "text-slate-300"
                                                }`}
                                            />
                                        )
                                    )}

                                </div>
                            </div>

                            <p className="text-xs text-slate-600 italic">
                                "
                                {
                                    selectedCandidate.notes
                                }
                                "
                            </p>

                        </div>

                        {/* ==================================================
                            AUDIT TIMELINE
                        ================================================== */}

                        <div className="space-y-2">

                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">

                                <History className="h-3.5 w-3.5 text-blue-600" />

                                Activity Audit Timeline
                            </span>

                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 max-h-32 overflow-y-auto">

                                {selectedCandidate.timeline?.map(
                                    (log, index) => (
                                        <div
                                            key={index}
                                            className="text-xs text-slate-600 flex items-center gap-2 border-b border-slate-200/50 pb-1 last:border-0"
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>

                                            <span>
                                                {log}
                                            </span>
                                        </div>
                                    )
                                )}

                            </div>
                        </div>

                        {/* ==================================================
                            OFFER LETTER
                        ================================================== */}

                        {(
                            selectedCandidate.status ===
                                "Selected" ||
                            selectedCandidate.status ===
                                "Offer Sent" ||
                            selectedCandidate.status ===
                                "Joined"
                        ) && (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">

                                <div>
                                    <p className="text-xs font-bold text-emerald-900">
                                        Offer Letter Approved
                                    </p>

                                    <p className="text-[11px] text-emerald-700">
                                        Ready for candidate dispatch & digital signature verification.
                                    </p>
                                </div>

                                <button
                                    onClick={() =>
                                        generateOfferLetter(
                                            selectedCandidate
                                        )
                                    }
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition"
                                >
                                    <Download className="h-3.5 w-3.5" />

                                    Print / Export Offer PDF
                                </button>

                            </div>
                        )}

                        {/* ==================================================
                            STAGE CONTROLS
                        ================================================== */}

                        <div className="pt-4 border-t border-slate-100 space-y-2">

                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Change Stage
                            </span>

                            <div className="flex flex-wrap gap-1.5">

                                {STAGES.map(
                                    (stage) => (
                                        <button
                                            key={stage}
                                            onClick={() =>
                                                updateStage(
                                                    selectedCandidate.id,
                                                    stage
                                                )
                                            }
                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                                                (
                                                    selectedCandidate.status ||
                                                    "Applied"
                                                ) ===
                                                stage
                                                    ? "bg-blue-600 text-white shadow-sm"
                                                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                            }`}
                                        >
                                            {stage}
                                        </button>
                                    )
                                )}

                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}