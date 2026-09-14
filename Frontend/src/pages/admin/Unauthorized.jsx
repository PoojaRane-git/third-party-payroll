import React from "react";
import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">

            <div className="text-center max-w-md">

                <div className="text-7xl font-bold text-red-500">
                    403
                </div>

                <h1 className="mt-4 text-3xl font-bold text-slate-900">
                    Access Denied
                </h1>

                <p className="mt-3 text-slate-500">
                    You don't have permission to access this page.
                </p>

                <button
                    onClick={() => navigate(-1)}
                    className="mt-6 rounded-lg bg-slate-900 px-6 py-3 text-white hover:bg-slate-800 transition"
                >
                    Go Back
                </button>

            </div>

        </div>
    );
}