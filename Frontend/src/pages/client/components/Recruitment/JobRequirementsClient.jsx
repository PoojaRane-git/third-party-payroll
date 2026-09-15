
import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Building,
  Plus,
  Search,
  MapPin,
  DollarSign,
  Users,
  Trash2
} from 'lucide-react';
import Sidebar from "../Layout/Sidebar";
import api from '../../../services/api';

function JobRequirementsClient() {

  // -----------------------------------
  // STATE
  // -----------------------------------

  const [jobRequirements, setJobRequirements] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [clientName, setClientName] = useState('Loading Workspace...');
  const [deletingId, setDeletingId] = useState(null);

  const [formData, setFormData] = useState({
    client_id: '',
    job_title: '',
    skills_required: '',
    positions_count: 1,
    location: '',
    experience_min: 0,
    experience_max: 0,
    salary_lpa: '',
    status: 'Open'
  });


  // -----------------------------------
  // LOAD CLIENT + JOB REQUIREMENTS
  // -----------------------------------
  useEffect(() => {
    const storedClientId = sessionStorage.getItem("client_id");
    const storedCompany = sessionStorage.getItem("company_name");

    console.log("=================================");
    console.log("JOB REQUIREMENTS PAGE");
    console.log("Stored client_id:", storedClientId);
    console.log("Stored company:", storedCompany);
    console.log("=================================");

    if (storedCompany) {
      setClientName(storedCompany);
    }

    if (storedClientId) {
      setFormData((prev) => ({
        ...prev,
        client_id: storedClientId,
      }));
    }

    // Load ALL job requirements first
   
  }, []);

  useEffect(() => {
    fetchJobs();   // called with NO clientId
}, []);

  // -----------------------------------
  // FETCH JOB REQUIREMENTS
  // -----------------------------------
const fetchJobs = async (clientId = null) => {
    try {
        const url = clientId
            ? `/job-requirements?client_id=${clientId}`
            : `/job-requirements`;

        const response = await api.get(url);   // ← was axios.get(url)

        const jobs = Array.isArray(response.data?.data)
            ? response.data.data
            : [];

        setJobRequirements(jobs);
    } catch (error) {
        console.error("JOB REQUIREMENTS ERROR", error.response?.data || error.message);
        setJobRequirements([]);
    }
};
  // -----------------------------------
  // CREATE JOB REQUIREMENT
  // -----------------------------------

  const handleCreate = async (e) => {

    e.preventDefault();

    try {

      await api.post(
        "/job-requirements",
        formData
      );

      // Close modal
      setShowModal(false);

      // Refresh jobs
      await fetchJobs(formData.client_id);

      // Keep client ID but reset other fields
      const currentClientId =
        formData.client_id;

      setFormData({
        client_id: currentClientId,
        job_title: '',
        skills_required: '',
        positions_count: 1,
        location: '',
        experience_min: 0,
        experience_max: 0,
        salary_lpa: '',
        status: 'Open'
      });

    } catch (err) {

      console.error(
        'Error creating job requirement:',
        err
      );

      alert(
        err.response?.data?.error ||
        'Failed to create job requirement.'
      );
    }
  };


  // -----------------------------------
  // REMOVE JOB REQUIREMENT
  // -----------------------------------
  const handleDelete = async (jobId) => {

    console.log("Deleting job ID:", jobId);

    if (!jobId) {
      alert("Invalid job ID");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this job requirement?"
    );

    if (!confirmed) return;

    try {

      setDeletingId(jobId);


      const response = await api.delete(
        `/job-requirements/${jobId}`
      );
      console.log(
        "Delete response:",
        response.data
      );

      setJobRequirements(prev =>
        prev.filter(job => job.id !== jobId)
      );

    } catch (error) {

      console.error(
        "DELETE REQUEST FAILED:",
        error
      );

      console.error(
        "Response:",
        error.response?.data
      );

      alert(
        error.response?.data?.error ||
        "Failed to remove job requirement."
      );

    } finally {

      setDeletingId(null);

    }
  };

  // -----------------------------------
  // LOGOUT
  // -----------------------------------

  const handleLogout = () => {

    sessionStorage.clear();

    window.location.href = '/login';

  };


  // -----------------------------------
  // SEARCH
  // -----------------------------------

  const filteredJobs =
    jobRequirements.filter(job => {

      const query =
        searchQuery.toLowerCase();

      return (
        job.job_title
          ?.toLowerCase()
          .includes(query) ||

        job.location
          ?.toLowerCase()
          .includes(query)
      );

    });


  // -----------------------------------
  // UI
  // -----------------------------------

  return (

    <div className="flex min-h-screen bg-[#0b0f19] text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white">

      {/* -------------------------------- */}
      {/* SIDEBAR */}
      {/* -------------------------------- */}

      <Sidebar
        clientName={clientName}
        onLogout={handleLogout}
      />


      {/* -------------------------------- */}
      {/* MAIN CONTENT */}
      {/* -------------------------------- */}

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 md:p-10 space-y-6">

        <div className="max-w-[1500px] mx-auto w-full space-y-6">


          {/* -------------------------------- */}
          {/* HEADER */}
          {/* -------------------------------- */}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111627] border border-slate-800/80 p-6 rounded-2xl shadow-sm">

            <div>

              <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                Job Requirements
              </h1>

              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Manage manpower requisitions and hiring mandates for your workspace.
              </p>

            </div>


            {/* SEARCH + ADD */}

            <div className="flex items-center gap-3 w-full sm:w-auto">

              {/* SEARCH */}

              <div className="relative flex-1 sm:w-64">

                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">

                  <Search className="h-4 w-4" />

                </span>

                <input
                  type="text"
                  placeholder="Search title or location..."
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(e.target.value)
                  }
                  className="w-full pl-9 pr-4 py-2 bg-[#0b0f19] border border-slate-700/60 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500 shadow-inner"
                />

              </div>


              {/* ADD BUTTON */}

              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm shrink-0"
              >

                <Plus className="h-4 w-4" />

                Add Requisition

              </button>

            </div>

          </div>


          {/* -------------------------------- */}
          {/* JOB CARDS */}
          {/* -------------------------------- */}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

            {filteredJobs.length === 0 ? (

              <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-[#111627] border border-slate-800/80 rounded-2xl">

                No job requirements found for this workspace.

              </div>

            ) : (

              filteredJobs.map(job => (

                <div
                  key={job.id}
                  className="bg-[#111627] border border-slate-800/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4"
                >

                  {/* -------------------------------- */}
                  {/* CARD TOP */}
                  {/* -------------------------------- */}

                  <div className="space-y-2">

                    <div className="flex justify-between items-start">

                      {/* STATUS */}

                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${job.status === 'Open'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                          : job.status === 'In Progress'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                            : 'bg-slate-800 text-slate-400'
                          }`}
                      >

                        {job.status}

                      </span>


                      {/* SLOTS */}

                      <span className="text-[10px] font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">

                        <Users className="h-3 w-3" />

                        {job.positions_count} Slots

                      </span>

                    </div>


                    {/* JOB TITLE */}

                    <h3 className="text-base font-black text-slate-100">

                      {job.job_title}

                    </h3>


                    {/* CLIENT */}

                    <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">

                      <Building className="h-3.5 w-3.5 text-slate-500" />

                      ID: {job.client_id}

                    </p>

                  </div>


                  {/* -------------------------------- */}
                  {/* JOB DETAILS */}
                  {/* -------------------------------- */}

                  <div className="space-y-2 pt-3 border-t border-slate-800/60 text-xs text-slate-300">

                    {/* LOCATION */}

                    <div className="flex items-center gap-2">

                      <MapPin className="h-3.5 w-3.5 text-indigo-400 shrink-0" />

                      {job.location || 'Remote / Unspecified'}

                    </div>


                    {/* EXPERIENCE */}

                    <div className="flex items-center gap-2">

                      <Briefcase className="h-3.5 w-3.5 text-indigo-400 shrink-0" />

                      Exp: {job.experience_min} - {job.experience_max} Years

                    </div>


                    {/* SALARY */}

                    <div className="flex items-center gap-2">

                      <DollarSign className="h-3.5 w-3.5 text-indigo-400 shrink-0" />

                      {job.salary_lpa || 'Competitive'} LPA

                    </div>


                    {/* -------------------------------- */}
                    {/* REMOVE BUTTON */}
                    {/* -------------------------------- */}

                    <div className="flex justify-end pt-3">

                      <button
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleDelete(job.id)}
                        disabled={deletingId === job.id}
                      >
                        {deletingId === job.id
                          ? "Removing..."
                          : "Remove Requirement"}
                      </button>

                    </div>

                  </div>

                </div>

              ))

            )}

          </div>


          {/* -------------------------------- */}
          {/* ADD REQUIREMENT MODAL */}
          {/* -------------------------------- */}

          {showModal && (

            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">

              <div className="bg-[#111627] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">


                {/* MODAL HEADER */}

                <div className="flex justify-between items-center">

                  <h3 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">

                    Add Job Requirement

                  </h3>

                  <button
                    type="button"
                    onClick={() =>
                      setShowModal(false)
                    }
                    className="text-slate-400 hover:text-white text-xl"
                  >
                    ×
                  </button>

                </div>


                {/* FORM */}

                <form
                  onSubmit={handleCreate}
                  className="space-y-4 text-xs"
                >


                  {/* JOB TITLE */}

                  <div>

                    <label className="block font-bold text-slate-300 mb-1">
                      Job Title
                    </label>

                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Fullstack Engineer"
                      value={formData.job_title}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          job_title: e.target.value
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700/60 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                    />

                  </div>


                  {/* SKILLS */}

                  <div>

                    <label className="block font-bold text-slate-300 mb-1">
                      Skills Required
                    </label>

                    <input
                      type="text"
                      placeholder="e.g. React, Node.js, PostgreSQL"
                      value={formData.skills_required}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          skills_required: e.target.value
                        })
                      }
                      className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700/60 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                    />

                  </div>


                  {/* POSITIONS + LOCATION */}

                  <div className="grid grid-cols-2 gap-4">

                    <div>

                      <label className="block font-bold text-slate-300 mb-1">
                        Positions Count
                      </label>

                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.positions_count}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            positions_count:
                              Number(e.target.value)
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700/60 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                      />

                    </div>


                    <div>

                      <label className="block font-bold text-slate-300 mb-1">
                        Location
                      </label>

                      <input
                        type="text"
                        placeholder="e.g. Mumbai / Hybrid"
                        value={formData.location}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            location: e.target.value
                          })
                        }
                        className="w-full px-3.5 py-2.5 bg-[#0b0f19] border border-slate-700/60 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                      />

                    </div>

                  </div>


                  {/* EXPERIENCE + SALARY */}

                  <div className="grid grid-cols-3 gap-3">

                    <div>

                      <label className="block font-bold text-slate-300 mb-1">
                        Min Exp (Yrs)
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={formData.experience_min}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            experience_min:
                              Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700/60 rounded-xl text-slate-100 font-mono"
                      />

                    </div>


                    <div>

                      <label className="block font-bold text-slate-300 mb-1">
                        Max Exp (Yrs)
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={formData.experience_max}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            experience_max:
                              Number(e.target.value)
                          })
                        }
                        className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700/60 rounded-xl text-slate-100 font-mono"
                      />

                    </div>


                    <div>

                      <label className="block font-bold text-slate-300 mb-1">
                        Salary (LPA)
                      </label>

                      <input
                        type="text"
                        placeholder="e.g. 12"
                        value={formData.salary_lpa}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            salary_lpa: e.target.value
                          })
                        }
                        className="w-full px-3 py-2 bg-[#0b0f19] border border-slate-700/60 rounded-xl text-slate-100 font-mono"
                      />

                    </div>

                  </div>


                  {/* BUTTONS */}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">

                    <button
                      type="button"
                      onClick={() =>
                        setShowModal(false)
                      }
                      className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl font-semibold transition"
                    >
                      Cancel
                    </button>


                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-sm"
                    >
                      Save Requisition
                    </button>

                  </div>

                </form>

              </div>

            </div>

          )}

        </div>

      </main>

    </div>
  );
}

export default JobRequirementsClient;