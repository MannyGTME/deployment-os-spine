'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export interface MatrixRow {
  signal_id: string;
  agency_name: string;
  total_score: number;
  status: 'Tier_1' | 'Standard' | 'Killed' | 'Pending';
  webhook_fired_timestamp: string | null;
  created_at: string;
}

interface SignalMatrixProps {
  initialRows: MatrixRow[];
}

function formatRelativeTime(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 11
    ? 'text-cyan-400 border-cyan-800 bg-cyan-950/30'
    : score >= 6
    ? 'text-yellow-400 border-yellow-800 bg-yellow-950/30'
    : 'text-red-500 border-red-900 bg-red-950/30';
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${color}`}>
      {score}/15
    </span>
  );
}

function StatusBadge({ status }: { status: MatrixRow['status'] }) {
  const styles: Record<string, string> = {
    Tier_1: 'text-cyan-400 border-cyan-800 bg-cyan-950/30',
    Standard: 'text-yellow-400 border-yellow-800 bg-yellow-950/30',
    Killed: 'text-red-500 border-red-900 bg-red-950/30',
    Pending: 'text-zinc-400 border-zinc-700 bg-zinc-900/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border tracking-wider ${styles[status] ?? styles.Pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function SignalMatrix({ initialRows }: SignalMatrixProps) {
  const [rows, setRows] = useState<MatrixRow[]>(initialRows);
  const [newRowIds, setNewRowIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  // Refresh relative times every 30s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel('routing-status-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Routing_Status' },
        async (payload) => {
          const signalId = payload.new.signal_id as string;

          const [{ data: signalData }, { data: scoreData }] = await Promise.all([
            supabase
              .from('Signals_Ingested')
              .select('Agency_Name, created_at')
              .eq('id', signalId)
              .single(),
            supabase
              .from('Enrichment_Scores')
              .select('Total_Score')
              .eq('signal_id', signalId)
              .single(),
          ]);

          if (signalData) {
            const newRow: MatrixRow = {
              signal_id: signalId,
              agency_name: signalData.Agency_Name as string,
              total_score: (scoreData?.Total_Score as number) ?? 0,
              status: payload.new.Status as MatrixRow['status'],
              webhook_fired_timestamp: payload.new.Webhook_Fired_Timestamp as string | null,
              created_at: signalData.created_at as string,
            };

            setRows(prev => [newRow, ...prev]);
            setNewRowIds(prev => new Set([...prev, signalId]));
            setTimeout(() => {
              setNewRowIds(prev => {
                const next = new Set(prev);
                next.delete(signalId);
                return next;
              });
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-700 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Routing Matrix</p>
        <span className="text-xs text-zinc-600">{rows.length} signals</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="text-left px-6 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Agency</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Score</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Status</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Webhook Fired</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-zinc-500 font-normal">Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-600 text-xs uppercase tracking-widest">
                  Awaiting signals...
                </td>
              </tr>
            )}
            {rows.map(row => (
              <tr
                key={row.signal_id}
                className={`border-b border-surface-700/50 transition-colors ${
                  newRowIds.has(row.signal_id)
                    ? 'animate-row-flash'
                    : 'hover:bg-surface-700/30'
                }`}
              >
                <td className="px-6 py-3 text-zinc-200 font-mono text-xs">{row.agency_name}</td>
                <td className="px-4 py-3"><ScoreBadge score={row.total_score} /></td>
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-3 text-zinc-400 text-xs font-mono">
                  {formatTimestamp(row.webhook_fired_timestamp)}
                </td>
                <td className="px-4 py-3 text-zinc-500 text-xs">
                  {formatRelativeTime(row.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
