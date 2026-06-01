import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

interface SignalPayload {
  agency_name: string;
  job_url: string;
  posting_date: string;
  raw_html: string;
  tech_stack_score: number;
  service_alignment_score: number;
}

function computeRoutingStatus(totalScore: number): 'Tier_1' | 'Standard' | 'Killed' {
  if (totalScore >= 5) return 'Tier_1';
  if (totalScore >= 3) return 'Standard';
  return 'Killed';
}

function validatePayload(body: Record<string, unknown>): { valid: boolean; error?: string } {
  const required = ['agency_name', 'job_url', 'posting_date', 'raw_html', 'tech_stack_score', 'service_alignment_score'];
  const missing = required.filter(f => body[f] === undefined || body[f] === null);
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
  }
  const techScore = Number(body.tech_stack_score);
  const svcScore = Number(body.service_alignment_score);
  if (isNaN(techScore) || techScore < 0 || techScore > 3) {
    return { valid: false, error: 'tech_stack_score must be an integer between 0 and 3' };
  }
  if (isNaN(svcScore) || svcScore < 0 || svcScore > 3) {
    return { valid: false, error: 'service_alignment_score must be an integer between 0 and 3' };
  }
  return { valid: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;

    const validation = validatePayload(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const payload = body as unknown as SignalPayload;
    const totalScore = Number(payload.tech_stack_score) + Number(payload.service_alignment_score);
    const supabase = getSupabaseServerClient();

    // Step 1: Insert into Signals_Ingested
    const { data: signalData, error: signalError } = await supabase
      .from('Signals_Ingested')
      .insert({
        Agency_Name: payload.agency_name,
        Job_URL: payload.job_url,
        Posting_Date: payload.posting_date,
        Raw_HTML: payload.raw_html,
      })
      .select('id')
      .single();

    if (signalError || !signalData) {
      console.error('Signals_Ingested insert failed:', signalError);
      return NextResponse.json({ error: 'Failed to ingest signal' }, { status: 500 });
    }

    const signalId: string = signalData.id;

    // Step 2: Insert into Enrichment_Scores
    const { error: enrichError } = await supabase
      .from('Enrichment_Scores')
      .insert({
        signal_id: signalId,
        Tech_Stack_Score: Number(payload.tech_stack_score),
        Service_Alignment_Score: Number(payload.service_alignment_score),
        Total_Score: totalScore,
      });

    if (enrichError) {
      console.error('Enrichment_Scores insert failed:', enrichError);
      return NextResponse.json({ error: 'Failed to record enrichment scores', signal_id: signalId }, { status: 500 });
    }

    // Step 3: Compute routing status
    const routingStatus = computeRoutingStatus(totalScore);

    // Step 4: Fire outbound webhook for Tier_1 and Standard
    let webhookFiredTimestamp: string | null = null;
    let webhookFired = false;

    if (routingStatus !== 'Killed') {
      webhookFiredTimestamp = new Date().toISOString();
      try {
        const crmResponse = await fetch(process.env.CRM_WEBHOOK_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signal_id: signalId,
            agency_name: payload.agency_name,
            job_url: payload.job_url,
            total_score: totalScore,
            routing_status: routingStatus,
          }),
        });
        webhookFired = crmResponse.ok;
        if (!crmResponse.ok) {
          console.error('CRM webhook returned non-2xx:', crmResponse.status);
        }
      } catch (fireError) {
        console.error('CRM webhook fire failed:', fireError);
        // Best-effort — continue to record routing status
      }
    }

    // Step 5: Insert into Routing_Status
    const { error: routingError } = await supabase
      .from('Routing_Status')
      .insert({
        signal_id: signalId,
        Status: routingStatus,
        Webhook_Fired_Timestamp: webhookFiredTimestamp,
      });

    if (routingError) {
      console.error('Routing_Status insert failed:', routingError);
      return NextResponse.json(
        { error: 'Failed to record routing status', signal_id: signalId, status: routingStatus },
        { status: 500 }
      );
    }

    return NextResponse.json({ signal_id: signalId, status: routingStatus, webhook_fired: webhookFired });
  } catch (err) {
    console.error('Unhandled error in signal-catch:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
