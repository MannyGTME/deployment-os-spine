# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Workspace Is

This is the **Deployment-OS-Spine** — the foundational template and operating instructions for all WAT-framework projects. It defines how Claude should think, plan, and act across every build that uses this system.

**WAT framework:** Workflows, Agents, Tools. Claude acts as the agent layer — reading workflow instructions, calling tools in sequence, and recovering from failures. AI handles reasoning and coordination; Python scripts handle deterministic execution.

## Files in This Workspace

| File | Purpose |
|---|---|
| `planning_phase.md` | Step-by-step checklist to complete before any build begins |
| `secure.md` | QA and Security skill checklists + shell permission model |
| `WAT_AGENT_GUIDE.md` | Extended agent operating instructions (WAT framework detail) |

When this spine is deployed to a new project, `workflows/` and `tools/` directories are added alongside these files.

## Operating Rules

**Before every new build:** read `planning_phase.md` in full. Complete every section in order — setup, brief, architecture, tech stack, clarifying questions — before writing any code.

**Before writing any tool:** scan `tools/` for existing scripts. Build new ones only when nothing covers the task.

**When a task has a workflow:** read `workflows/<name>.md` first. It defines the objective, inputs, tool sequence, expected outputs, and edge case handling.

**When something breaks:**
1. Read the full error and trace
2. Fix the script and retest — ask before rerunning anything that uses paid API calls
3. Update the relevant workflow with what you learned (rate limits, timing quirks, unexpected behaviour)
4. Never create or overwrite workflow files without asking unless explicitly told to

**Self-improvement loop:** every failure is an opportunity — fix the tool, verify the fix, update the workflow, continue with a stronger system.

## Planning a New Build

Enter **Plan Mode** before writing any code. Answer these five questions first:

- **UI** — what does the user see and interact with?
- **Workflow/orchestration** — what steps run automatically?
- **Business logic** — what decisions does the system make?
- **Data access** — what gets stored, retrieved, or transformed?
- **External integrations** — which APIs or third-party tools are involved?

Default tech stack: **Supabase** for database, **Tailwind** for CSS, **Netlify or Vercel** for deployment. Use **Opus** for anything technically complex.

Only move to execution once the plan is reviewed and approved.

## Build Prompt Format

```
Goal:
Relevant files/systems:
Constraints:
Expected output:
Verification steps:
```

## Skills (defined in `secure.md`)

Two runnable skills are available. Trigger them with these phrases:

| Goal | Trigger phrase |
|---|---|
| QA pass | `"Run QA skill — check for typos, dead code, and data exposure"` |
| Security audit | `"Run Security skill — check for exposed keys, rate limiting, and input validation"` |
| Pre-ship combined | `"Run QA and Security skills. Give me a pre-ship readiness report."` |

## Shell Permission Model

Auto-approved (no confirmation needed): `cat`, `touch`, `mkdir`, `ls`, `pwd`, `echo`

Always require explicit confirmation: `rm -rf`, `rm -fdr`, `rm -fr`, `rmdir`

## Definition of Done

A build is complete when:
- The workflow's verification steps all pass
- Final output is accessible in the expected cloud service (Google Sheets, Slides, etc.) — never a local file
- The workflow reflects any new constraints or improvements discovered during the build
