import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function GET() {
  const supabase = getSupabaseServerClient();

  const { data: routing, error: routingError } = await supabase
    .from('Routing_Status')
    .select('signal_id, Status, Webhook_Fired_Timestamp')
    .limit(10);

  if (routingError || !routing || routing.length === 0) {
    return NextResponse.json({ step: 'routing_query', routing, routingError });
  }

  const signalIds = routing.map(r => r.signal_id).filter(Boolean);

  const { data: signals, error: signalsError } = await supabase
    .from('Signals_Ingested')
    .select('id, Agency_Name, created_at')
    .in('id', signalIds);

  const { data: scores, error: scoresError } = await supabase
    .from('Enrichment_Scores')
    .select('signal_id, Total_Score')
    .in('signal_id', signalIds);

  return NextResponse.json({
    routing,
    signalIds,
    signals,
    scores,
    errors: { routingError, signalsError, scoresError },
  });
}
