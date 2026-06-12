'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export interface Commitment {
  promise: string;
  category: 'timeline' | 'volume' | 'integration' | 'support' | 'reporting' | 'other';
  classification: 'SAFE' | 'STRETCH' | 'VIOLATION';
  constraint_reference: string;
  why: string;
}

export interface FlaggedRisk {
  promise: string;
  severity: 'moderate' | 'critical';
  why: string;
  suggested_intervention: string;
}

export interface Deal {
  client_id: string;
  client_name: string;
  sales_notes: string;
  tech_reality_score: number;
  commitments: Commitment[];
  flagged_risks: FlaggedRisk[];
  status: 'Pending' | 'Escalated' | 'Clear';
  created_at: string;
}

function formatRelativeTime(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function StatusBadge({ status }: { status: Deal['status'] }) {
  const styles: Record<Deal['status'], string> = {
    Clear: 'text-emerald-400 border-emerald-800 bg-emerald-950/30',
    Escalated: 'text-red-500 border-red-900 bg-red-950/30',
    Pending: 'text-zinc-400 border-zinc-700 bg-zinc-900/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border tracking-wider ${styles[status] ?? styles.Pending}`}>
      {status}
    </span>
  );
}

function TechRealityBadge({ score }: { score: number }) {
  const color = score >= 8
    ? 'text-emerald-400 border-emerald-800 bg-emerald-950/30'
    : score >= 5
    ? 'text-amber-400 border-amber-800 bg-amber-950/30'
    : 'text-red-500 border-red-900 bg-red-950/30';
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${color}`}>
      {score}/10
    </span>
  );
}

export default function ScopeGuardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function fetchInitialDeals() {
      const { data, error } = await supabase
        .from('client_onboarding')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setDeals(data as Deal[]);
      }
      setLoading(false);
    }

    fetchInitialDeals();

    const channel = supabase
      .channel('client-onboarding-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'client_onboarding' },
        (payload) => {
          setDeals(prev => [payload.new as Deal, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Body */}
      <main className="flex-1 p-6 flex flex-col gap-6">
        <div className="bg-surface-800 border border-surface-700 rounded-lg flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Onboarding Queue</p>
            <span className="text-xs text-zinc-600">{deals.length} deals</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  <th className="text-left px-6 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Client</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Tech Reality</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Status</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Flagged Risks</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Received</th>
                </tr>
              </thead>
              <tbody>
                {!loading && deals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-600 text-xs uppercase tracking-widest">
                      No deals yet...
                    </td>
                  </tr>
                )}
                {deals.map(deal => (
                  <tr
                    key={deal.client_id}
                    onClick={() => setSelectedDeal(deal)}
                    className="border-b border-surface-700/50 transition-colors hover:bg-surface-700/30 cursor-pointer"
                  >
                    <td className="px-6 py-3 text-zinc-200 font-mono text-xs">{deal.client_name}</td>
                    <td className="px-4 py-3"><TechRealityBadge score={deal.tech_reality_score} /></td>
                    <td className="px-4 py-3"><StatusBadge status={deal.status} /></td>
                    <td className="px-4 py-3 text-zinc-400 text-xs font-mono">
                      {deal.flagged_risks?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {formatRelativeTime(deal.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Formatted Inspection Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-[#1c1c1c] rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex justify-between items-start p-6 border-b border-[#1c1c1c]">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{selectedDeal.client_name}</h2>
                <div className="flex items-center gap-3 text-sm">
                  <span className={`px-2 py-0.5 rounded font-semibold ${selectedDeal.status === "Clear" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {selectedDeal.status}
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-400">Tech Reality Score: <span className="text-white font-bold">{selectedDeal.tech_reality_score}/10</span></span>
                </div>
              </div>
              <button onClick={() => setSelectedDeal(null)} className="text-zinc-500 hover:text-white transition-colors p-1">
                ✕ Close
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-8">

              {/* Actionable Interventions (Only shows if there are risks) */}
              {selectedDeal.flagged_risks && selectedDeal.flagged_risks.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">Critical Action Items</h3>
                  <div className="grid gap-4">
                    {selectedDeal.flagged_risks.map((risk: FlaggedRisk, i: number) => (
                      <div key={i} className="bg-red-500/5 border border-red-500/20 p-5 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-red-200">{risk.promise}</h4>
                          <span className="text-[10px] px-2 py-1 bg-red-500/20 text-red-400 rounded-full font-bold uppercase tracking-wider">{risk.severity}</span>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed"><span className="font-semibold text-white">The Risk:</span> {risk.why}</p>
                        <div className="mt-4 p-4 bg-red-500/10 rounded-md border border-red-500/20">
                          <p className="text-sm text-red-200 leading-relaxed">
                            <span className="block font-bold text-red-400 mb-1">CS Intervention Required:</span>
                            {risk.suggested_intervention}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete Audit Log */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Complete Audit Log</h3>
                <div className="grid gap-3">
                  {selectedDeal.commitments?.map((item: Commitment, i: number) => {
                    const isSafe = item.classification === "SAFE";
                    const isStretch = item.classification === "STRETCH";
                    const badgeClass = isSafe
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : isStretch
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20";

                    return (
                      <div key={i} className="bg-[#161616] border border-[#222] p-4 rounded-lg flex flex-col md:flex-row md:items-start gap-4">
                        <div className="w-24 shrink-0 mt-0.5">
                          <span className={`text-[10px] px-2 py-1 rounded border font-bold uppercase tracking-wider ${badgeClass}`}>
                            {item.classification}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-medium text-zinc-100 text-sm">{item.promise}</h4>
                          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{item.why}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
