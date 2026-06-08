# Session State -- Deployment OS Sprint
Last updated: 2026-06-07 (tonight's sprint)

## Where We Are

The Spine is complete and deployed on Vercel.
The Head and Tail need to be built in n8n tonight.
The n8n MCP connection is configured but needs a Claude Code restart to activate.

## What Is Done

- [x] Spine deployed (webhook + scoring + DB + realtime dashboard)
- [x] Skill library scanned and mapped (Skills_Library)
- [x] 5 project skills extracted to .claude/skills/
- [x] n8n MCP wired to .claude/settings.json
- [x] PDF generated: ~/Desktop/Deployment_OS_Skill_Inventory.pdf

## What Is Left Tonight

### Step 1 -- Approve the n8n MCP server (ONE-TIME)
The server is registered in .mcp.json (project scope) but is "Pending approval"
-- this is a security gate, Claude Code will not auto-trust a project MCP server.

To approve: run `claude` fresh in this directory (exit and restart). On launch,
Claude Code will prompt you to approve the n8n MCP server listed in .mcp.json.
Approve it. After that, Claude has direct read/write/execute access to n8n workflows.

NOTE: an earlier attempt wrote the MCP config into .claude/settings.json under
"mcpServers" -- that is NOT the right location and was removed. The correct,
working config lives in .mcp.json at the project root (created via `claude mcp add`).

### Step 2 -- Build the Head in n8n
Blueprint: .claude/skills/n8n-head-workflow.md
- Manual Trigger node
- Set node with 3 demo payloads (Tier_1 / Standard / Killed)
- HTTP Request node: POST to Vercel webhook with x-webhook-secret header
- Activate workflow

### Step 3 -- Build the Tail in n8n
Blueprint: .claude/skills/n8n-tail-workflow.md
- Webhook Trigger node (copy production URL)
- Switch node: branch on routingTier field
- Tier_1 branch: HTTP (Lemlist or mock) + Slack notification
- Standard branch: log/nurture
- Killed branch: no-op

### Step 4 -- Wire the Tail back to the Spine
Set CRM_WEBHOOK_URL in Vercel env vars = Tail's production webhook URL.
Redeploy if needed.

### Step 5 -- Fire 3 test signals
Use Head workflow to fire all 3 demo payloads.
Confirm:
- Dashboard counter increments live
- All 3 routing tiers appear in SignalMatrix
- Tier_1 row shows webhook_fired timestamp
- Slack DM fires for Tier_1

### Step 6 -- Record the Loom
Script: .claude/skills/demo-playbook.md
Target runtime: 7-10 minutes.

## Key Config Values

| Thing | Value |
|---|---|
| Vercel webhook URL | https://[your-vercel-url]/api/webhooks/signal-catch |
| Auth header | x-webhook-secret: {WEBHOOK_SECRET env var} |
| n8n MCP URL | https://manto8.app.n8n.cloud/mcp-server/http |
| n8n MCP token | in .claude/settings.json |
| Tail webhook URL | NOT SET YET -- get from n8n after building Tail |
| CRM_WEBHOOK_URL | NOT SET YET -- paste Tail URL here in Vercel |

## Skill Files for This Project

| File | Purpose |
|---|---|
| .claude/skills/deployment-os-spine.md | Full Spine architecture reference |
| .claude/skills/n8n-head-workflow.md | Head build blueprint |
| .claude/skills/n8n-tail-workflow.md | Tail build blueprint |
| .claude/skills/scoring-model.md | 15-point scoring rubric |
| .claude/skills/demo-playbook.md | Loom recording script for Nick |

## Context for a Fresh LLM Session

If you are a new Claude session picking this up:
1. Read SESSION_STATE.md (this file) first
2. Read .claude/skills/deployment-os-spine.md to understand what is built
3. Read .claude/skills/n8n-head-workflow.md and n8n-tail-workflow.md for what to build
4. The n8n MCP is in .claude/settings.json -- if tools are available, use them to build workflows directly
5. The demo is for Nick at ColdIQ on Tuesday -- everything must be live and moving, not mocked
