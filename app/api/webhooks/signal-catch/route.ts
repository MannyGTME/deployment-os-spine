import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Destructure the new 15-point payload
    const {
      agency_name,
      job_url,
      posting_date,
      raw_html,
      intent_score = 0,
      growth_score = 0,
      tech_stack_score = 0,
      service_alignment_score = 0,
      channel_maturity_score = 0,
      reasoning_string = "No reasoning provided."
    } = body;

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
    const signalId = signalData.id;

    // 5. Insert the new 15-point matrix and Reasoning String
    const { error: scoreError } = await supabase
      .from('Enrichment_Scores')
      .insert([{
        signal_id: signalId,
        "Intent_Score": intent_score,
        "Growth_Score": growth_score,
        "Tech_Stack_Score": tech_stack_score,
        "Service_Alignment_Score": service_alignment_score,
        "Channel_Maturity_Score": channel_maturity_score,
        "Reasoning_String": reasoning_string
      }]);

    if (scoreError) throw scoreError;

    // 6. Record the final routing status
    const { error: routingError } = await supabase
      .from('Routing_Status')
      .insert([{
        signal_id: signalId,
        status: routingTier
      }]);

    if (routingError) throw routingError;

    // 7. Fire to the dummy CRM webhook ONLY if it is a Tier 1 VIP
    let webhookFired = false;
    if (routingTier === 'Tier_1' && process.env.CRM_WEBHOOK_URL) {
      await fetch(process.env.CRM_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agency_name, totalScore, reasoning_string, routingTier })
      });
      webhookFired = true;
    }

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
