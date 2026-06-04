'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function TotalSignalsCard({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel('total-signals')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Signals_Ingested' },
        () => setCount(n => n + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg p-6 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-widest text-zinc-500">Total Signals Caught</p>
      <p className="text-4xl font-mono text-zinc-100">{count}</p>
      <p className="text-xs text-zinc-600 mt-1">All-time ingested signals</p>
    </div>
  );
}
