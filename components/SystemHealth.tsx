'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

interface Breakdown {
  Tier_1: number;
  Standard: number;
  Killed: number;
}

interface SystemHealthProps {
  initialLastReceived: string | null;
  initialBreakdown: Breakdown;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'No signals yet';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function SystemHealth({ initialLastReceived, initialBreakdown }: SystemHealthProps) {
  const [lastReceived, setLastReceived] = useState<string | null>(initialLastReceived);
  const [breakdown, setBreakdown] = useState<Breakdown>(initialBreakdown);
  const [, setTick] = useState(0);

  // Refresh relative time every 30s
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel('system-health')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Signals_Ingested' },
        (payload) => {
          setLastReceived(payload.new.created_at as string);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Routing_Status' },
        (payload) => {
          const status = payload.new.Status as keyof Breakdown;
          if (status === 'Tier_1' || status === 'Standard' || status === 'Killed') {
            setBreakdown(prev => ({ ...prev, [status]: prev[status] + 1 }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg p-6 flex flex-col gap-4">
      <p className="text-xs uppercase tracking-widest text-zinc-500">System Health</p>

      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-green-400 text-sm tracking-widest uppercase">Online</span>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Last Signal</p>
        <p className="text-sm text-zinc-300">{formatRelativeTime(lastReceived)}</p>
      </div>

      <div className="flex gap-3">
        <span className="text-xs px-2 py-1 rounded border border-cyan-800 text-cyan-400 bg-cyan-950/30">
          T1 {breakdown.Tier_1}
        </span>
        <span className="text-xs px-2 py-1 rounded border border-yellow-800 text-yellow-400 bg-yellow-950/30">
          STD {breakdown.Standard}
        </span>
        <span className="text-xs px-2 py-1 rounded border border-red-900 text-red-500 bg-red-950/30">
          KLD {breakdown.Killed}
        </span>
      </div>
    </div>
  );
}
