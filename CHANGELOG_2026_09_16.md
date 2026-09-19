# Technical Changelog - 2026-09-16

## 1. Backend Core & Policy Engine
- **Exposure Axis Implementation:** Introduced `DIRECT` and `TRANSITIVE` exposure states in `finding-policy.ts`.
- **Gate Decision Decoupling:** Separated severity scores from blocking logic. Vulnerabilities originating from transitive dependencies are now evaluated as non-blocking advisories (`WARN`), while direct dependencies remain blocking.
- **Queue/Worker Fixes:** 
  - Resolved BullMQ v5 crash by changing the legacy `settings.backoffStrategies` parameter to `settings.backoffStrategy`.
  - Fixed Job ID syntax for the email worker pipeline (changed `run-completed:106` to `run-completed-106`).
- **AWS Bedrock Provider:** Fixed initialization errors by setting the correct region (`us-east-1`) and implemented a forced translation from Zod to raw JSON Schema to support Bedrock tool parsing.

## 2. Frontend UI Overhaul (Component Architecture)
- **Design System Standardization:** Migrated to a professional SaaS design language featuring tabular-nums, 1px solid borders (`border-zinc-800`), Lucide icons, and WCAG AA typography.
- **Component Reusability:** Replaced disparate list implementations across the Dashboard, Alerts, Security, Debt Report, and Issues & PRs tabs with unified `FindingRow` (44px) components.
- **Progressive Disclosure:** Implemented `FindingDrawer` to handle large technical payloads without cluttering the primary list views.
- **Live Feed Refactor:** Replaced the legacy card grid with a `RunTimeline` component and a monospace terminal log stream.
- **Codebase Pruning:** Deleted 533 lines of unused custom CSS (`AgentCanvas.css`) in favor of native Tailwind utility classes.

## 3. Frontend State & Reactivity
- **Eventual Consistency (Live Feed):** Fixed the infinite-loading bug caused by dropped WebSocket frames. Implemented a debounced DB reconciliation fetch (`loadCanvas()`) accompanied by a 10s fallback polling interval that automatically tears down when no scans are active.
- **Notification Badge Watermark:** Implemented `lib/alert-seen.ts` to manage unread badge state locally without backend schema modifications. Uses a `localStorage` watermark capped at 1000 items, clearing automatically based on `location.pathname` routing.
- **Pagination & Virtual DOM:** Replaced unbounded `.map()` loops with a `usePagedList` hook and a `LoadMoreRow` component. Wrapped list items in `React.memo` to guarantee 60fps scrolling on large datasets (200+ findings) while preserving native browser Ctrl+F searchability.

## 4. AI Orchestration Refactoring (Opus / Chesterton's Fence)
- **Phase 1 (Data Contracts):** Centralized `confidence` and `exposure` schema properties in `shared-finding-fields.ts`. Added detailed Zod `.describe()` annotations to inject instructions directly into the LLM JSON schemas. Applied these fields to all 7 sub-agents while maintaining `.optional()` backward compatibility.
- **Phase 2 (Chain of Custody & Memory Provenance):** 
  - Bound finding validation to execution logs: if an agent cites a tool it did not run (checked via `toolsExecuted`), the evidence is automatically capped at `WEAK` and stripped of blocking authority.
  - Implemented memory provenance tracking (`HUMAN` vs `AGENT`). Agent-generated memories can only de-escalate a finding to an advisory (`dismissalSource: "MEMORY"`), whereas human-generated memories fully suppress the finding.
- **Phase 3 (Prompt Engineering & Budgets):** 
  - Adjusted math/token budgets for agents (`data_dx` increased to 24 steps; `bloat` to 32 steps) to prevent premature backend truncation.
  - Re-wrote the Phase 3 Orchestrator `REASONING_FRAMEWORK` to strictly reflect the 5-part policy engine predicate (Severity + Direct Exposure + High Confidence + Proven Evidence + Executed Tool), explicitly commanding it never to block on transitive issues.
  - Fixed data transport pipeline in `agent.queue.ts` via `reportMeta.report` to correctly pass top-level metrics (`testSuiteResult`, `migrationRollbackPassed`) to the aggregators.
- **Phase 4 (Orchestration Architecture):** Restructured inter-phase data handoffs to ensure Phase 2 and Phase 3 agents receive the parsed diffs and context from Phase 1. Removed or stubbed phantom tools (e.g., `post_github_check_run`) to eliminate forced hallucination states in the LLM outputs.
