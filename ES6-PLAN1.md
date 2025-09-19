### ES6+ Plan 1 — Safe modernizations with zero behavior change

Goal: Make purely mechanical, low‑risk ES6 upgrades while keeping the current IIFE + `window.CJL` architecture intact. After this phase there must be zero usages of `var` in the codebase.

#### Scope
- Files: `src/js/**/*.js`, `keyExercise.js` (no HTML changes yet).
- No module system changes; no public API changes; no DOM structure changes.

#### Objectives
- Replace all `var` with `const` or `let` (prefer `const`; use `let` only when a binding is reassigned or loop indices are needed).
- Keep function bodies and control flow identical; avoid algorithmic changes.
- Modernize a few trivially safe expressions:
  - Replace `Object.prototype.hasOwnProperty.call(obj, key)` with `Object.hasOwn(obj, key)`.
  - Use template literals instead of string concatenation where it does not change semantics.
  - Prefer strict equality `===` / `!==` where intent is obvious and safe.
- Maintain all timers, `requestAnimationFrame`, and event wiring as‑is.

#### Step‑by‑step
1) Eliminate `var` project‑wide
   - For each file, update declarations:
     - Default to `const`.
     - Use `let` only if the variable is reassigned (e.g., loop counters, timers that are later cleared/updated).
   - Convert `for` loop indices to `let`.
   - Do not move declarations across scopes; keep hoisting behavior equivalent.

2) Safe micro‑modernizations (still non‑functional)
   - `Object.hasOwn(obj, key)` in place of `Object.prototype.hasOwnProperty.call(...)`.
   - Template literals for simple UI strings and logs where order/spacing is identical.
   - Optional: In `src/js/constants.js`, generate `RADICAL_POOLS.all` via array spread while preserving values and order.

3) Keep all IIFEs and `window.CJL.*` assignments unchanged in this phase.

#### Verification (after each edited file)
- Reload the page and exercise both modes:
  - Normal mode: input correctness, cursor movement, right/wrong indicators, key press flash, layout toggle, keyboard visibility toggle, overlay focus behavior.
  - Radical mode: allowed/disabled keys, radical hint and wrong highlighting, category select enable/disable.
- Sanity check that no behavior has changed (visuals and timings feel identical).
- Grep to confirm zero `var` remain:
  - macOS/Linux: `rg -n "\\bvar\\b" /Users/johan/Downloads/cangjie-learner | cat`
  - Or: `git grep -n "\\bvar\\b" | cat`

#### Exit criteria
- No `var` anywhere in `src/js/**` and `keyExercise.js`.
- All UI interactions verified manually with no regressions.

