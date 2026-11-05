import React, { useState, useEffect } from "react";
import { teacherApi } from "../../api/teacherApi.js";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

export default function TeacherEarningsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await teacherApi.getStats();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const revenueSplit = stats?.teacherRevenueShare !== undefined
    ? `${(stats.teacherRevenueShare * 100).toFixed(0)}%`
    : "80%";

  const platformFee = stats?.commissionRate !== undefined
    ? `${(stats.commissionRate * 100).toFixed(0)}%`
    : "20%";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Earnings & Royalties
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Track sales splits, immutable financial settlements, and automated payout disbursement schedule
        </p>
      </div>

      {/* Notice Banner */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
          ℹ
        </div>
        <div>
          <p className="text-sm font-bold text-amber-300">Phase 3.3 Scope Notice</p>
          <p className="text-xs text-slate-300">
            Per development boundaries, automated teacher payout disbursements and ledger banking statements are scheduled for subsequent phases. Your sales royalties are calculated authoritatively upon every student enrollment.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <p className="text-xs font-medium text-slate-400">Teacher Net Royalty Split</p>
          <p className="text-2xl font-bold text-emerald-400">{revenueSplit}</p>
          <p className="text-[11px] text-slate-500">Author royalty on all sales</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <p className="text-xs font-medium text-slate-400">Platform Commission</p>
          <p className="text-2xl font-bold text-amber-400">{platformFee}</p>
          <p className="text-[11px] text-slate-500">Infrastructure & streaming fee</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-1">
          <p className="text-xs font-medium text-slate-400">Financial Immutability</p>
          <p className="text-2xl font-bold text-purple-400">Strict</p>
          <p className="text-[11px] text-slate-500">Server snapshot verified</p>
        </div>
      </div>

      {/* Ledger explanation */}
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-slate-200">Financial Snapshot Guarantee</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Every time a student payment is verified by the Super Administrator, the server calculates and locks an immutable financial snapshot recording the course price, your 80% share, and the 20% platform commission. These records can never be mutated, ensuring complete audit transparency for upcoming automated bank disbursements.
        </p>
      </div>
    </div>
  );
}
