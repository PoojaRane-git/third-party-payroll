import React, { useState, useEffect } from 'react';
import { Briefcase, Building, Search, MapPin, DollarSign, Users, UserCheck } from 'lucide-react';
import axios from 'axios';
import Sidebar from '../Layout/Sidebar';

const API_BASE = 'http://localhost:5000/api';

export default function JobRequirements() {
  const [jobRequirements, setJobRequirements] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchJobsAndClients();
    fetchCandidates();
  }, []);

  const fetchJobsAndClients = async () => {
    try {
      const [jobsRes, clientsRes] = await Promise.all([
        axios.get(`${API_BASE}/job-requirements`),
        axios.get(`${API_BASE}/clients`).catch(() => ({ data: [] }))
      ]);

      const jobsData = jobsRes.data.data || jobsRes.data || [];
      const clientsData = clientsRes.data.data || clientsRes.data || [];

      // Map client_id to the company name using safe fallbacks
      const clientMap = {};
      clientsData.forEach(client => {
        // Adjust these keys based on your actual columns in the 'clients' table
        clientMap[client.id] = client.company_name || client.name || client.full_name || 'Enterprise Client';
      });

      const enrichedJobs = jobsData.map(job => ({
        ...job,
        resolved_company_name: clientMap[job.client_id] || job.company_name || `Enterprise Client (ID: ${job.client_id})`
      }));

      setJobRequirements(enrichedJobs);
    } catch (err) {
      console.error('Error fetching jobs or clients:', err);
    }
  };

  const fetchCandidates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/candidates`);
      setCandidates(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error fetching candidates:', err);
    }
  };

  const handleOpenAssign = (job) => {
    setSelectedJob(job);
    setSelectedCandidateId('');
    setShowAssignModal(true);
  };

  const handleAssignCandidate = async (e) => {
    e.preventDefault();
    if (!selectedJob || !selectedCandidateId) return;

    try {
      setAssigning(true);
      await axios.post(`${API_BASE}/job-requirements/${selectedJob.id}/assign`, {
        candidate_id: selectedCandidateId,
        client_id: selectedJob.client_id
      });
      
      setShowAssignModal(false);
      fetchJobsAndClients();
      alert('Candidate successfully assigned and deployed!');
    } catch (err) {
      console.error('Error assigning candidate:', err);
      alert('Failed to assign candidate to requirement.');
    } finally {
      setAssigning(false);
    }
  };

  const filteredJobs = jobRequirements.filter(job =>
    job.job_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.resolved_company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans antialiased">
      {/* Admin Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-8 space-y-6">
        <div className="max-w-[1500px] mx-auto w-full space-y-6">
          
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Job Requirements Review & Assignment</h1>
              <p className="text-sm text-slate-500 mt-0.5">Review active client requisitions and assign vetted candidates to open slots.</p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search title, location or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Job Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredJobs.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm bg-white border border-slate-200 rounded-2xl">
                No job requirements found in the database.
              </div>
            ) : (
              filteredJobs.map(job => (
                <div key={job.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        job.status === 'Open' ? 'bg-emerald-50 text-emerald-600' :
                        job.status === 'In Progress' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {job.status}
                      </span>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md flex items-center gap-1">
                        <Users className="h-3 w-3" /> {job.positions_count} Slots
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{job.job_title}</h3>
                      
                      {/* Explicit Client & Company Display Box */}
                      <div className="mt-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <Building className="h-4 w-4 text-blue-600 shrink-0" />
                          <span>{job.resolved_company_name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono pl-6">
                          Client ID: {job.client_id}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {job.location || 'Remote / Unspecified'}</div>
                    <div className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-slate-400" /> Exp: {job.experience_min} - {job.experience_max} Years</div>
                    <div className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5 text-slate-400" /> {job.salary_lpa || 'Competitive'} LPA</div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => handleOpenAssign(job)}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-semibold transition shadow-sm"
                    >
                      <UserCheck className="h-4 w-4" /> Assign Candidate
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Assign Candidate Modal */}
          {showAssignModal && selectedJob && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Assign Candidate to Requisition</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Role: <span className="font-semibold text-slate-700">{selectedJob.job_title}</span> at <span className="font-semibold text-slate-700">{selectedJob.resolved_company_name}</span> (Client ID: {selectedJob.client_id})
                  </p>
                </div>
                
                <form onSubmit={handleAssignCandidate} className="space-y-4 text-sm">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Select Vetted Candidate / Contractor</label>
                    <select
                      required
                      value={selectedCandidateId}
                      onChange={(e) => setSelectedCandidateId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="">-- Choose Candidate --</option>
                      {candidates.map(candidate => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name || candidate.full_name} ({candidate.email || candidate.primary_skill || 'Candidate'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">Deployment Workflow Note:</p>
                    <p>Assigning this candidate will link them to {selectedJob.resolved_company_name}, queue operational documentation, and update active staffing volumes.</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button 
                      type="button" 
                      onClick={() => setShowAssignModal(false)} 
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={assigning}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                      {assigning ? 'Assigning...' : 'Confirm Assignment'}
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