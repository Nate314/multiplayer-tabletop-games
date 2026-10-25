# Rules Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One Rules button (header and join dialog) opens a dialog showing the game's README, with a switch to the FAQ.

**Architecture:** The server serves `games/<id>/README.md` at `/api/rules/<id>`. An in-house markdown parser turns it into a small tree that a React component renders (no HTML injection). `RulesButton` replaces `FaqButton`; the dialog has two views, Rules and FAQ.

**Tech Stack:** Express 5, React 19, node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-assets-rules-loading-polish-design.md` (changeset 2). Read the index plan for Global Constraints, ports (PORT 3102, E2E_PORT_BASE 6130) and delivery.

## Review Focus (this changeset)

- Raw HTML or `<script>` text in a README renders as visible text (Task 1).
- A relative link (`../catan/README.md`, `rules.ts`) opens the file on GitHub at `https://github.com/Nate314/multiplayer-tabletop-games/blob/master/games/<id>/<path>` in a new tab; `#anchor` links scroll within the dialog or render as text (Task 1, Task 3).
- README fetch fails (offline): the dialog shows "Could not load the rules" with Retry, and the FAQ view still works (Task 3).
- A long README scrolls inside the dialog; the Close button stays reachable at 320 px (browser check).
- The header row still fits at 320 px with Rules in place of FAQ (browser check).

---

### Task 1: Markdown parser

**Files:** Create `src/markdown/parseMarkdown.ts`, `src/markdown/Markdown.tsx`; test `src/markdown/parseMarkdown.test.ts`

**Interfaces:**
- Produces: `type Inline = { kind: 'text' | 'strong' | 'em' | 'code'; text: string } | { kind: 'link'; href: string; children: Inline[] }`; `type Block = { kind: 'heading'; level: 1|2|3|4|5|6; children: Inline[] } | { kind: 'paragraph'; children: Inline[] } | { kind: 'list'; ordered: boolean; items: Block[][] } | { kind: 'code'; text: string } | { kind: 'table'; header: Inline[][]; rows: Inline[][][] } | { kind: 'rule' }`; `parseMarkdown(source: string): Block[]`.
- `<Markdown blocks={Block[]} resolveLink={(href: string) => string | null} />` renders React elements; `null` from `resolveLink` renders the link text without a link.
- First grep `games/*/README.md` for what is used (nested lists, tables, numbered lists, code spans, bold in list items, links) and cover exactly that.

- [ ] **Step 1: Failing tests**: `# Title` gives a level-1 heading; two lines joined into one paragraph, a blank line splits; `- a\n  - b` nests b in a's item; `1. x` is ordered; `**b** and *i* and \`c\`` gives strong, text, em, text, code; `[t](u)` gives a link; a pipe table with a `---` row gives header and rows; `<script>x</script>` comes through as plain text; parse every real README without throwing and with at least one heading each.
- [ ] **Step 2:** Run, fail. **Step 3:** Implement line-based block parsing and a small inline tokenizer. **Step 4:** Pass. **Step 5:** Commit `Add a small markdown parser for the game rules`.

### Task 2: `/api/rules/:gameType` route

**Files:** Create `server/rules.ts` (`mountRulesRoute(app: Express, gamesDir: string, ids: string[]): void`); modify `server/server.ts`; test `server/rules.test.ts`

- [ ] **Step 1: Failing tests**: `/api/rules/chess` is 200 `text/markdown; charset=utf-8` with the README's text and `Cache-Control: no-cache`; `/api/rules/nope` and `/api/rules/..%2Fpackage.json` are 404 (only ids from the registry are served).
- [ ] **Steps 2 to 5:** run, implement (read the file per request or cache at startup), pass, commit `Serve each game's README at /api/rules`.

### Task 3: Rules dialog with FAQ view

**Files:** Create `src/components/RulesButton.tsx`, `RulesDialog.tsx`; delete `FaqButton.tsx`; keep `FaqDialog`'s list as an exported `FaqList` used by the dialog's FAQ view (delete the rest); modify `GameView.tsx`, `JoinDialog.tsx`, `src/App.scss` (rename `.faq-button` rules to `.rules-button`, keep the phone header rules), e2e specs that click FAQ (grep `e2e/` for `FAQ`), `docs/architecture.md`.

**Interfaces:**
- `RulesButton({ game: GameInfo; faq: FaqItem[] })` renders the button "Rules" and, when open, `<div data-game={game.id}><RulesDialog ... /></div>` as FaqButton does now.
- `RulesDialog({ game, faq, onClose })`: title "<Game> rules", a two-button switch "Rules" / "FAQ" (`aria-pressed`), the body scrolls, Close at the bottom, Escape closes. Rules view fetches `/api/rules/<id>` once per open: "Loading the rules..." then the markdown, or "Could not load the rules" with Retry. The README's first `#` heading is dropped since the dialog title says it.
- `resolveLink`: `http(s)` links pass through (open in a new tab with `rel="noreferrer"`); relative paths become GitHub blob URLs under `games/<id>/`; `#...` returns null.

- [ ] **Step 1: Failing e2e** (`e2e/rules.spec.ts`): open chess's join dialog, click Rules, a heading from the chess README is visible; click FAQ, a chess FAQ question is visible; click Rules, the README is back; Escape closes. In a game view the header has a Rules button and no FAQ button.
- [ ] **Step 2:** Run, fail. **Step 3:** Implement. **Step 4:** `E2E_PORT_BASE=6130 npx playwright test e2e/rules.spec.ts` plus every spec you changed passes; `npm test`. Browser check: chess, catan (a long README), and a card game, light and dark, 390 and 320 px; the header fits one row at 320 px. **Step 5:** Commit `Replace the FAQ button with a Rules dialog`, open the PR titled "Rules dialog rendering each game's README".
