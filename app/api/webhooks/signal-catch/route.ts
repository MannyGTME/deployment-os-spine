import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function clampScore(value: unknown, max: number): number {
  const n = Number(value);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.floor(n)));
}

export async function POST(req: Request) {
  // Verify shared secret when configured
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers.get('x-webhook-secret');
    if (incoming !== secret) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
  }

  try {
    const body = await req.json();

    // 1. Destructure and sanitise the payload
    const {
      agency_name,
      job_url = "",
      posting_date = new Date().toISOString(),
      raw_html = "",
      reasoning_string = "No reasoning provided."
    } = body;

    if (!agency_name || typeof agency_name !== 'string' || agency_name.trim() === '') {
      return NextResponse.json({ error: 'agency_name is required' }, { status: 400 });
    }

    const intent_score             = clampScore(body.intent_score, 5);
    const growth_score             = clampScore(body.growth_score, 4);
    const tech_stack_score         = clampScore(body.tech_stack_score, 3);
    const service_alignment_score  = clampScore(body.service_alignment_score, 2);
    const channel_maturity_score   = clampScore(body.channel_maturity_score, 1);

    // 2. Calculate the total score out of 15
    const totalScore = intent_score + growth_score + tech_stack_score + service_alignment_score + channel_maturity_score;

    // 3. Apply the ColdIQ Gating Logic
    let routingTier = 'Killed'; // Default to Kill (0-5)
    if (totalScore >= 11) {
        routingTier = 'Tier_1'; // VIPs (11-15)
    } else if (totalScore >= 6) {
        routingTier = 'Standard'; // The Bench (6-10)
    }

    // 4. Ingest the raw signal
    const { data: signalData, error: signalError } = await supabase
      .from('Signals_Ingested')
      .insert([{
        "Agency_Name": agency_name,
        "Job_URL": job_url,
        "Posting_Date": posting_date,
        "Raw_HTML": raw_html
      }])
      .select()
      .single();

    if (signalError) throw signalError;
    if (!signalData) throw new Error("No data returned from signal insert.");
    const signalId = signalData.id;

    // 5. Insert the new 15-point matrix, Total_Score, and Reasoning String
    const { error: scoreError } = await supabase
      .from('Enrichment_Scores')
      .insert([{
        signal_id: signalId,
        "Intent_Score": intent_score,
        "Growth_Score": growth_score,
        "Tech_Stack_Score": tech_stack_score,
        "Service_Alignment_Score": service_alignment_score,
        "Channel_Maturity_Score": channel_maturity_score,
        "Total_Score": totalScore,
        "Reasoning_String": reasoning_string
      }]);

    if (scoreError) throw scoreError;

    // 6. Isolated CRM Webhook Fire (Fails gracefully without crashing DB commits)
    let webhookFired = false;
    let webhookTimestamp = null;

    if (routingTier === 'Tier_1' && process.env.CRM_WEBHOOK_URL) {
      try {
        const response = await fetch(process.env.CRM_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agency_name, totalScore, reasoning_string, routingTier })
        });

        if (response.ok) {
          webhookFired = true;
          webhookTimestamp = new Date().toISOString();
        } else {
          console.error("CRM Webhook failed with status:", response.status);
        }
      } catch (fetchError) {
        console.error("Network error hitting CRM Webhook:", fetchError);
        // Do NOT throw here. The signal was successfully scored and stored.
      }
    }

    // 7. Record the final routing status (Capital 'Status' for DB match)
    const { error: routingError } = await supabase
      .from('Routing_Status')
      .insert([{
        signal_id: signalId,
        "Status": routingTier,
        "Webhook_Fired_Timestamp": webhookTimestamp
      }]);

    if (routingError) throw routingError;

    return NextResponse.json({
        status: routingTier,
        total_score: totalScore,
        webhook_fired: webhookFired
    });

  } catch (error) {
    console.error("Pipeline Error:", error);
    return NextResponse.json({ error: 'Failed to process signal' }, { status: 500 });
  }
}
