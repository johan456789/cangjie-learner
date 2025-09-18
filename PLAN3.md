### PLAN 3 — Event flow, performance, and UX robustness (medium priority)

**Why this matters**
- **Event handling scattered**: Input logic (`oninput`), focus management (`focusOnKeyboard`), overlay timers, layout/visibility toggles live in multiple places with implicit coupling.
- **Repeated DOM mutations per keystroke**: Multiple `classList` operations on many nodes in `indicate`, and re-querying DOM for labels during layout toggles.
- **Focus/overlay edge cases**: Potential flickers and missed focus on click due to timing and broad `focusin` listener.

**Goals**
- Centralize event flow and reduce redundant DOM writes.
- Batch UI updates and cache DOM references for speed.
- Eliminate focus flicker and ensure predictable UX across interactions.

---

**Scope**
- Maintain current features and visuals.
- Improve internal event orchestration and update efficiency.

**Staged steps**
1) Centralize event wiring
   - In a controller (from Plan 1), wire all events in one place:
     - `input`, `change` for mode/category, `click` for layout and visibility, `focus/blur` for overlay.
   - Replace inline `document.getElementById(...).oninput = ...` with `addEventListener` and named handlers.

2) Cache and batch DOM work
   - Cache `questBar` span references once; avoid re-querying or recalculating per keystroke.
   - Compute diffs of class states to only apply changes:
     - Track previous `right/wrong/cursor` indices; update only changed indices.
     - Maintain current `hintKey` and update highlight only when it actually changes.
   - Use `requestAnimationFrame` to schedule visual updates when input bursts occur.

3) Improve key press visual feedback
   - Replace per-press `setTimeout` with a single debounced press-state manager that:
     - Adds `press` immediately, removes after `PRESS_MS`, resets the timer if the same key repeats quickly.
   - Avoid stacking timers for rapid typing.

4) Solidify focus/overlay behavior
   - Replace `focusin` blanket listener with targeted listeners on input and overlay only.
   - On overlay click, focus input and synchronously hide overlay; cancel pending timers.
   - Use a single `OVERLAY_DELAY_MS` constant and document the rationale.

5) Accessibility and keyboard-only flow
   - Ensure buttons and selects are reachable by keyboard and that pressing keys when the keyboard is hidden still works.
   - Add `aria-pressed`/`aria-hidden` updates in the view layer for toggles and the on-screen keyboard.

6) Lightweight performance measurement
   - Add a debug flag to log timings of `computeIndicators` and DOM apply phases for a few keystrokes.
   - Document target budgets (e.g., <2ms compute, <4ms apply on mid-range laptop).

---

**Deliverables**
- Unified event wiring in controller with named handlers.
- Cached element references and rAF-batched updates for quest bar and keyboard states.
- Press-state manager and debounced timeouts.
- A11y attributes for toggles and overlay.
- Optional debug instrumentation guarded by a flag.

**Acceptance criteria**
- Typing at >8 cps does not exhibit visual lag or missed highlights.
- No overlay flicker when switching focus between controls and the input bar.
- Toggling visibility/layout does not reflow or re-query more than once per action.
- Lighthouse a11y score for the page improves (where applicable) without visual regressions.

**Risks and mitigations**
- Risk: rAF batching could delay updates under extremely low framerates. Mitigation: fall back to immediate apply if rAF not available or frame is delayed.
- Risk: Over-optimization complicates code. Mitigation: keep updates declarative and isolated inside the view layer.

**Rollback plan**
- Keep feature flags for batched updates and press-state manager; disable to return to current behavior if regressions are found.


