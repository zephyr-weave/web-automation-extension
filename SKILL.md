---
name: web-automation-extension
description: Build browser automation extensions (Chrome/Edge Manifest V3) and automation scripts for arbitrary websites—auto-clicking, auto-exporting data, batch form filling, paginated scraping, scheduled page operations. This skill should be used when the user asks to automate operations on a website, build or fix a browser extension for a site, make a userscript/automation helper, or asks why a page automation "gets stuck", "stops working when minimized", or "clicks stop responding". Provides a six-step methodology (site reconnaissance, main-flow + exception design, incremental implementation, jsdom end-to-end testing, four-part delivery, feedback-driven layered fixing), platform gotchas (timer throttling, silent-audio keep-alive, synthetic click isTrusted, SPA selector drift, rate-limit handling), a jsdom test harness template, and a worked production case study.
agent_created: true
---

# Web Automation Extension Builder

## Overview

Build and ship browser automation for arbitrary websites: auto-click flows, data export, pagination loops, and Chrome/Edge MV3 extensions with a control panel. This skill encodes a six-step methodology proven on a production auto-export plugin (v1.0 → v1.5.0), plus the platform traps that break web automation and a ready-to-run jsdom end-to-end test harness.

## Core Principle: Classify Before Acting

Before writing any code for an automation task, classify the problem into one of three layers. The fix differs completely per layer—miscategorizing wastes effort.

| Layer | Criterion | Fix |
|---|---|---|
| A. Own code logic error | A definite defect found by walking the code path | Fix directly + add defense |
| B. Insufficient understanding of platform mechanics | Code looks correct but a platform/environment constraint was missed | Consult official docs + community-proven patterns; do not invent wheels |
| C. Both叠加 | Platform constraint amplifies the code defect | Fix each layer separately |

Real examples from the case study: "picks an element, then the task dies" was layer A (own capture listener swallowed the loop's synthetic click); "stops working when minimized" was layer B (Chrome intensive throttling—the code was correct).

## Workflow (Six Steps)

### Step 1 — Reconnaissance: Treat the target site as a black box first

Do not write code yet. Map the target into a checklist: full operation flow and per-step timing (click → how long until dialog/result), DOM structure of key elements (tag / class / title / aria / data-* attributes, and which are stable vs. drifting across re-renders), constraints and red lines (rate limits, captcha, login session, permission prompts), and failure surfaces (offline, API error, missing element—how each manifests).

Output: operation flow diagram + constraints list + failure-surface table. See `references/site-recon.md` for the full checklist.

### Step 2 — Design: main flow in one sentence; spend effort on the exception table

Draw the main loop (what one iteration does, when the task is complete, when it must stop). Then build the exception table—every failure mode gets an explicit action (pause / retry / stop / notify). Silent failure is forbidden. Layer detection strategy: precise detection (e.g. download events) with a crude but always-available fallback (e.g. fixed wait), and graded alerts (hint first, auto-pause second).

See `references/exception-playbook.md` for the table template and detection design rules.

### Step 3 — Implement incrementally with full observability

Change one place at a time; verify after each change (syntax check + existing tests, no regression before moving on). Observability is part of the feature: run state, progress counters, timestamped logs—the log is the only clue when things break. Model state explicitly as three states (idle / running / paused); paused ≠ stopped (paused keeps context and can resume, stopped returns fully to idle). When a tool fights large content (e.g. long base64 blobs), insert via script instead of wrestling the editor.

### Step 4 — Self-test with a simulated environment and scenario matrix

Automate everything automatable. Build a fake target site that replicates the four interaction elements (target button responses, dialogs, state changes, async result event stream), then run the matrix: happy path × every exception branch × every new feature—one file per scenario, named as documentation. Assert observable behavior ("export button clicked 3 times"), never implementation details. When the test environment has hard limits, adjust the test strategy—never bend product semantics to fit the test. Measure single-cycle duration before setting test timeouts. Maintain an explicit "real-machine only" verification list.

See `references/testing-harness.md` and bootstrap new tests from `scripts/new-test-template.js`.

### Step 5 — Deliver the four-part package

Delivery ≠ code alone. Ship all four: (1) installable artifact (zip with the expected directory structure), (2) user-facing docs explaining **why**, not just what—users must find an explanation for any surprising side effect in the docs, or they will panic, (3) a continuation archive (completed items, key decisions, pitfalls, TODOs) for future sessions, (4) the real-machine verification list covering what tests cannot prove.

### Step 6 — Iterate: translate feedback → classify → fix in layers → full regression

Translate vague feedback ("it stopped working") into "operation sequence + observed phenomenon"; ask for screenshots when useful. Classify per the core principle table. Then fix in three independent layers: direct fix (the precise strike at root cause), safety net (degrades gracefully even if the user repeats the wrong sequence), notify + fallback (tell the user once, auto-downgrade to a working path—never fail silently). Harden only adjacent weak points on the same path as the feedback; resist refactoring the world. Run new tests plus the entire existing suite green before shipping.

## Bundled Resources

### references/

- `site-recon.md` — Step 1 checklist: what to collect about any target site before coding
- `exception-playbook.md` — Step 2 templates: exception table, detection layering, state machine, rate-limit handling
- `platform-gotchas.md` — Load before debugging any "it hangs / it stopped / clicks do nothing" issue: Chrome intensive throttling and the silent-audio keep-alive, synthetic click isTrusted and capture-listener swallowing, SPA selector drift and stable-attribute hooks, jsdom test-environment limits, downloads API detection
- `case-production-plugin.md` — The worked production case: site quirks, architecture, and how each of the three v1.5.0 bugs was root-caused and fixed in three layers
- `testing-harness.md` — How to use the test template, the four-element fake site, chrome API mocking, timing budget rules

### scripts/

- `new-test-template.js` — jsdom end-to-end test harness bootstrap; copy and edit to test any automation main loop
- `make_silent_wav.py` — Generate the silent WAV data URI used for background keep-alive (Chrome audible-tab exemption)

## Quality Bar

- Every wait has an upper bound; every pause has a resume path; every failure tells the user what to do next
- Default conservative on rate limits: pace below the red line, never answer captcha on the user's behalf—pause and hand control back
- The log alone must let a stranger reconstruct what just happened
- Ship only when new tests and the full existing suite are green
