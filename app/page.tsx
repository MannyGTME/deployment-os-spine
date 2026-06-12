import { getSupabaseServerClient } from '@/lib/supabase-server';
import TotalSignalsCard from '@/components/TotalSignalsCard';
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
      .from('Routing_Status')
      .select('signal_id, Status, Webhook_Fired_Timestamp')
      .limit(50),
  ]);

  const routingRows = matrixRaw ?? [];
  const signalIds = routingRows.map(r => r.signal_id as string).filter(Boolean);

  let initialRows: MatrixRow[] = [];
  if (signalIds.length > 0) {
    const [{ data: signalsData }, { data: scoresData }] = await Promise.all([
      supabase
        .from('Signals_Ingested')
        .select('id, Agency_Name, created_at')
        .in('id', signalIds),
      supabase
        .from('Enrichment_Scores')
        .select('signal_id, Total_Score')
        .in('signal_id', signalIds),
    ]);

    const mapped = routingRows.map(rs => {
      const signal = (signalsData ?? []).find(s => s.id === rs.signal_id);
      const score = (scoresData ?? []).find(s => s.signal_id === rs.signal_id);
      if (!signal) return null;
      return {
        signal_id: rs.signal_id as string,
        agency_name: signal.Agency_Name as string,
        total_score: (score?.Total_Score as number) ?? 0,
        status: (rs.Status ?? 'Pending') as MatrixRow['status'],
        webhook_fired_timestamp: (rs.Webhook_Fired_Timestamp as string | null) ?? null,
        created_at: signal.created_at as string,
      } satisfies MatrixRow;
    });
    initialRows = (mapped.filter(r => r !== null) as MatrixRow[])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

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
      {/* Body */}
      <main className="flex-1 p-6 flex flex-col gap-6">
        {/* Top row: stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <TotalSignalsCard initialCount={totalSignals} />
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
