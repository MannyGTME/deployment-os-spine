import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import constraints from '@/lib/scopeguard/constraints.json';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const VALID_CATEGORIES = ['timeline', 'volume', 'integration', 'support', 'reporting', 'other'];
const VALID_CLASSIFICATIONS = ['SAFE', 'STRETCH', 'VIOLATION'];
const VALID_SEVERITIES = ['moderate', 'critical'];
const VALID_STATUSES = ['Clear', 'Escalated', 'Pending'];

const SYSTEM_PROMPT = `You are ScopeGuard, an evaluator that checks a salesperson's notes from a closed deal against a fixed set of fulfillment constraints. Your job is to catch promises that the delivery team cannot actually meet.

Constraints (the operational reality your evaluation must be checked against):
${JSON.stringify(constraints, null, 2)}

Read the sales notes and identify every commitment (explicit or implied) made to the client. For each commitment, classify it against the constraints above.

You must respond with ONLY valid JSON matching this exact schema, with no markdown formatting, no code fences, and no extra commentary:
{
  "tech_reality_score": "1-10 (integer) - overall feasibility of what was promised, where 10 is fully deliverable as-is and 1 is severely overcommitted",
  "commitments": [
    {
      "promise": "string - the commitment as stated/implied",
      "category": "timeline | volume | integration | support | reporting | other",
      "classification": "SAFE | STRETCH | VIOLATION",
      "constraint_reference": "which constraint it was checked against",
      "why": "one-sentence reasoning"
    }
  ],
  "flagged_risks": [
    {
      "promise": "string",
      "severity": "moderate | critical",
      "why": "string",
      "suggested_intervention": "string - what CS should do at/before kickoff"
    }
  ],
  "recommended_status": "Clear | Escalated"
}

Only include items in flagged_risks that are STRETCH or VIOLATION classifications. recommended_status must be "Escalated" if any commitment is classified VIOLATION, or if a STRETCH commitment is severe enough to require sign-off before kickoff. Otherwise "Clear".`;

interface Commitment {
  promise: string;
  category: string;
  classification: string;
  constraint_reference: string;
  why: string;
}

interface FlaggedRisk {
  promise: string;
  severity: string;
  why: string;
  suggested_intervention: string;
}

interface ScopeGuardResult {
  tech_reality_score: number;
  commitments: Commitment[];
  flagged_risks: FlaggedRisk[];
  recommended_status: string;
}

function clampScore(value: unknown): number {
  const n = Number(value);
  if (!isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function sanitizeCommitments(value: unknown): Commitment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => ({
      promise: typeof c.promise === 'string' ? c.promise : '',
      category: VALID_CATEGORIES.includes(c.category as string) ? (c.category as string) : 'other',
      classification: VALID_CLASSIFICATIONS.includes(c.classification as string)
        ? (c.classification as string)
        : 'STRETCH',
      constraint_reference: typeof c.constraint_reference === 'string' ? c.constraint_reference : '',
      why: typeof c.why === 'string' ? c.why : '',
    }));
}

function sanitizeFlaggedRisks(value: unknown): FlaggedRisk[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({
      promise: typeof r.promise === 'string' ? r.promise : '',
      severity: VALID_SEVERITIES.includes(r.severity as string) ? (r.severity as string) : 'moderate',
      why: typeof r.why === 'string' ? r.why : '',
      suggested_intervention: typeof r.suggested_intervention === 'string' ? r.suggested_intervention : '',
    }));
}

function parseScopeGuardResult(raw: string): ScopeGuardResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('LLM response was not valid JSON');
  }

  return {
    tech_reality_score: clampScore(parsed.tech_reality_score),
    commitments: sanitizeCommitments(parsed.commitments),
    flagged_risks: sanitizeFlaggedRisks(parsed.flagged_risks),
    recommended_status: VALID_STATUSES.includes(parsed.recommended_status as string)
      ? (parsed.recommended_status as string)
      : 'Escalated',
  };
}

export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const incoming = req.headers.get('x-webhook-secret');
  if (incoming !== secret) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { client_name, sales_notes } = body;

  if (typeof client_name !== 'string' || client_name.trim() === '') {
    return NextResponse.json({ error: 'client_name is required' }, { status: 400 });
  }
  if (typeof sales_notes !== 'string' || sales_notes.trim() === '') {
    return NextResponse.json({ error: 'sales_notes is required' }, { status: 400 });
  }

  let result: ScopeGuardResult;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Sales notes to evaluate:\n\n${sales_notes}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in LLM response');
    }

    result = parseScopeGuardResult(textBlock.text);
  } catch (error) {
    console.error('ScopeGuard LLM evaluation failed:', error);
    return NextResponse.json({ error: 'Failed to evaluate sales notes' }, { status: 502 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('client_onboarding')
      .insert([{
        client_name,
        sales_notes,
        tech_reality_score: result.tech_reality_score,
        commitments: result.commitments,
        flagged_risks: result.flagged_risks,
        status: result.recommended_status,
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ status: 'ok', record: data });
  } catch (error) {
    console.error('ScopeGuard insert failed:', error);
    return NextResponse.json({ error: 'Failed to save onboarding record' }, { status: 500 });
  }
}
