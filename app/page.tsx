import { getSupabaseServerClient } from '@/lib/supabase-server';
import StatCard from '@/components/StatCard';
import SystemHealth from '@/components/SystemHealth';
import SignalMatrix, { MatrixRow } from '@/components/SignalMatrix';

export const dynamic = 'force-dynamic';

async function fetchDashboardData() {
  const supabase = getSupabaseServerClient();

  const [
    { count: totalSignals },
    { data: lastSignalData },
    { count: tier1Count },
    { count: standardCount },
    { count: killedCount },
    { data: matrixRaw },
  ] = await Promise.all([
    supabase
      .from('Signals_Ingested')
      .select('*', { count: 'exact', head: true }),

    supabase
      .from('Signals_Ingested')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('Routing_Status')
      .select('*', { count: 'exact', head: true })
      .eq('Status', 'Tier_1'),

    supabase
      .from('Routing_Status')
      .select('*', { count: 'exact', head: true })
      .eq('Status', 'Standard'),

    supabase
      .from('Routing_Status')
      .select('*', { count: 'exact', head: true })
      .eq('Status', 'Killed'),

    supabase
      .from('Signals_Ingested')
      .select(`
        id,
        Agency_Name,
        created_at,
        Routing_Status ( Status, Webhook_Fired_Timestamp ),
        Enrichment_Scores ( Total_Score )
      `)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const initialRows: MatrixRow[] = (matrixRaw ?? [])
    .filter(row => {
      const rs = row.Routing_Status as Array<{ Status: string; Webhook_Fired_Timestamp: string | null }>;
      return rs && rs.length > 0;
    })
    .map(row => {
      const rs = row.Routing_Status as Array<{ Status: string; Webhook_Fired_Timestamp: string | null }>;
      const es = row.Enrichment_Scores as Array<{ Total_Score: number }>;
      return {
        signal_id: row.id as string,
        agency_name: row.Agency_Name as string,
        total_score: es?.[0]?.Total_Score ?? 0,
        status: (rs?.[0]?.Status ?? 'Pending') as MatrixRow['status'],
        webhook_fired_timestamp: rs?.[0]?.Webhook_Fired_Timestamp ?? null,
        created_at: row.created_at as string,
      };
    });

  return {
    totalSignals: totalSignals ?? 0,
    lastReceived: (lastSignalData?.created_at as string) ?? null,
    breakdown: {
      Tier_1: tier1Count ?? 0,
      Standard: standardCount ?? 0,
      Killed: killedCount ?? 0,
    },
    initialRows,
  };
}

export default async function CommandCenter() {
  const { totalSignals, lastReceived, breakdown, initialRows } = await fetchDashboardData();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-surface-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-4 bg-cyan-500 rounded-sm" />
          <h1 className="text-sm uppercase tracking-[0.2em] text-zinc-200">
            Deployment OS <span className="text-zinc-600">//</span> Command Center
          </h1>
        </div>
        <span className="text-xs text-zinc-600 tracking-widest uppercase">GTM Signal Router</span>
      </header>

      {/* Body */}
      <main className="flex-1 p-6 flex flex-col gap-6">
        {/* Top row: stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Total Signals Caught"
            value={totalSignals}
            subtext="All-time ingested signals"
          />
          <div className="lg:col-span-2">
            <SystemHealth
              initialLastReceived={lastReceived}
              initialBreakdown={breakdown}
            />
          </div>
        </div>

        {/* Matrix */}
        <SignalMatrix initialRows={initialRows} />
      </main>
    </div>
  );
}
