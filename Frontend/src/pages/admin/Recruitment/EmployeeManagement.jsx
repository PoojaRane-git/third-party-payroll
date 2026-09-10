import React, { useState, useEffect } from 'react';
import { User, Building, DollarSign, Shield, FileText, X, ChevronRight, Briefcase } from 'lucide-react';
import axios from 'axios';
import Sidebar from "../Layout/Sidebar";

const API_BASE = 'http://localhost:5000/api';

export default function EmployeeManagement({ activeTab, setActiveTab }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_BASE}/employees`);
      setEmployees(res.data.data || res.data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content View */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Employee Registry</h1>
            <p className="text-sm text-slate-500">Manage employee records, salary structures, and compliance information.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">
                <th className="p-4">Employee ID & Name</th>
                <th className="p-4">Company</th>
                <th className="p-4">Designation / Dept</th>
                <th className="p-4">Joining Date</th>
                <th className="p-4">CTC (INR)</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-bold text-slate-900">
                    EMP-{emp.id}
                    <div className="text-xs font-normal text-slate-500">{emp.full_name}</div>
                  </td>
                   <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                      {emp.company_name}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{emp.designation}</div>
                    <div className="text-xs text-slate-400">{emp.department}</div>
                  </td>

                  <td className="p-4 text-slate-600">{emp.joining_date}</td>
                  <td className="p-4 font-semibold text-slate-800">₹ {Number(emp.ctc || 0).toLocaleString()}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 rounded-full">
                      {emp.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedEmployee(emp)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition"
                    >
                      View Profile <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Comprehensive Employee Profile Modal / Slide-over */}
        {selectedEmployee && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-end z-50 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
              
              {/* Header */}
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-base shadow-sm">
                    {selectedEmployee.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedEmployee.full_name}</h2>
                    <p className="text-xs text-slate-500">EMP-{selectedEmployee.id} • {selectedEmployee.employment_type || 'Full-time'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEmployee(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content Body */}
              <div className="p-8 space-y-6 flex-1 text-sm text-slate-700">
                
                {/* Personal Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <User className="h-4 w-4" /> Personal Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div><span className="text-xs text-slate-400 block">Date of Birth</span> {selectedEmployee.dob || 'N/A'}</div>
                    <div><span className="text-xs text-slate-400 block">Gender</span> {selectedEmployee.gender || 'N/A'}</div>
                    <div><span className="text-xs text-slate-400 block">Phone</span> {selectedEmployee.phone || 'N/A'}</div>
                    <div><span className="text-xs text-slate-400 block">Email</span> {selectedEmployee.email || 'N/A'}</div>
                    <div className="col-span-2"><span className="text-xs text-slate-400 block">Address</span> {selectedEmployee.address || 'N/A'}</div>
                  </div>
                </div>

                {/* Employment Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" /> Employment Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div><span className="text-xs text-slate-400 block">Department</span> {selectedEmployee.department || 'N/A'}</div>
                    <div><span className="text-xs text-slate-400 block">Designation</span> {selectedEmployee.designation || 'N/A'}</div>
                    <div><span className="text-xs text-slate-400 block">Joining Date</span> {selectedEmployee.joining_date || 'N/A'}</div>
                    <div><span className="text-xs text-slate-400 block">Employment Type</span> {selectedEmployee.employment_type || 'N/A'}</div>
                  </div>
                </div>

                {/* Salary Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" /> Salary Structure
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="col-span-2 font-bold text-slate-900 border-b pb-2 flex justify-between">
                      <span>Annual CTC</span>
                      <span className="text-blue-600">₹ {Number(selectedEmployee.ctc || 0).toLocaleString()}</span>
                    </div>
                    <div><span className="text-xs text-slate-400 block">Basic Salary</span> ₹ {Number(selectedEmployee.basic_salary || 0).toLocaleString()}</div>
                    <div><span className="text-xs text-slate-400 block">HRA</span> ₹ {Number(selectedEmployee.hra || 0).toLocaleString()}</div>
                    <div className="col-span-2"><span className="text-xs text-slate-400 block">Allowance</span> ₹ {Number(selectedEmployee.allowance || 0).toLocaleString()}</div>
                  </div>
                </div>

                {/* Bank Details */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <Building className="h-4 w-4" /> Bank Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div><span className="text-xs text-slate-400 block">Account Number</span> {selectedEmployee.bank_account_number || 'N/A'}</div>
                    <div><span className="text-xs text-slate-400 block">IFSC Code</span> {selectedEmployee.ifsc_code || 'N/A'}</div>
                    <div className="col-span-2"><span className="text-xs text-slate-400 block">Bank Name</span> {selectedEmployee.bank_name || 'N/A'}</div>
                  </div>
                </div>

                {/* Compliance Details */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <Shield className="h-4 w-4" /> Compliance & Statutory
                  </h3>
                  <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div><span className="text-xs text-slate-400 block">PAN Number</span> {selectedEmployee.pan_number || 'N/A'}</div>
                    <div><span className="text-xs text-slate-400 block">PF Number</span> {selectedEmployee.pf_number || 'N/A'}</div>
                    <div><span className="text-xs text-slate-400 block">ESIC Number</span> {selectedEmployee.esic_number || 'N/A'}</div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
                >
                  Close Profile
                </button>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}