# Cangjie Learner — Engineer Onboarding

Welcome to Cangjie Learner. This document helps you get productive quickly: local setup, project structure, runtime architecture, key flows, a terminology section, and guidance for extending the app.

## What this app does

An in-browser trainer for the Cangjie input method. It helps you learn:

- **單字 (Characters)**: type full Cangjie codes for common characters
- **字根 (Radicals)**: practice mapping keys to radicals by category
- **輔助字形 (Auxiliary forms)**: drill auxiliary glyph forms with visual aids

## Local development

This is a static ES Modules web app; no Node build is required.

- Start a simple HTTP server (modules require http://, not file://):
  - macOS example:
    - `cd cangjie-learner`
    - `python -m http.server 5520`
  - Open `http://localhost:5520/keyExercise.html`.

- Optional: Python utilities (assets/data) are run with uv:
  - `uv run experiment/download_auxiliary_svgs.py`

Sanity checks after loading the page:

- Layout Toggle: Click “英文鍵盤” → labels become A–Z, button flips to “倉頡鍵盤”
- Mode Switch: Change “模式” to “字根” → category dropdown becomes enabled
- Category Selection: Change category → radical pool updates
- Typing Input: In “單字” mode, type letters → visual feedback (right/wrong/cursor)
- Keyboard Hints: Partial input → matching key highlights with hint class

## Project structure

Top-level highlights:

- `keyExercise.html`: The single page app host and DOM source of default character list.
- `keyExercise.css`: Styles.
- `src/js/` (ES modules):
  - `index.js`: Bootstraps the app; calls `init()` and `wireEvents()`.
  - `constants.js`: Centralized selectors, class names, regex, timings, paths, pools.
  - `controller/questController.js`: Orchestrates state + views; mode switching; weighted selection; aux handling.
  - `state/questState.js`: Pure state machine for characters/radicals; indicator computation.
  - `state/questWeights.js`: LocalStorage-backed weighted selection with in-memory fallback.
  - `view/keyboardView.js`: Keyboard rendering, pressed/disabled/hint states, layout toggle.
  - `view/questBarView.js`: Renders the quest (radical + slots) and applies indicators.
  - `view/auxiliaryView.js`: Renders auxiliary strip and explanation.
- `experiment/`: Auxiliary glyph assets and scripts
  - `auxiliary_forms.json`: Mapping used by aux mode
  - `輔助字形/*.svg`: Visuals for aux/fuzhu/zili
  - Python utilities (`uv run ...`) to fetch/export assets

## Runtime architecture

### Entry and boot

- `src/js/index.js` imports `init` and `wireEvents` from `questController.js` and executes them on DOM ready.
- A `#debug` URL hash enables lightweight performance logging.

### Controller orchestration

- `questController.js` stitches together:
  - `questState` (pure state/logic)
  - `questWeights` (weighted sampling + outcome-based adjustments)
  - `keyboardView`, `questBarView`, `auxiliaryView` (DOM updates)
- It owns the app session (`app` object): current state, cached labels, layout toggle, aux cache, and per-round bookkeeping for weight adjustments.

### State model

- `questState.initializeState` returns a serializable state object:
  - `mode`: 'char' | 'radical' | 'aux'
  - `defaultCharacterArray` and active `characterArray`
  - `radicalPools`, `activeCategoryKey`
  - `nowCharacter` (the target code string, e.g., "mgbuu")
- `setMode(state, { mode, categoryKey })` switches between modes and prepares selection arrays.
- `pickRandomCharacter` ensures no immediate repeat in non-char modes.
- `computeIndicators(state, input)` returns `{ right, wrong, cursorIndex, hintKey, radicalWrong }` for the views.

### Views

- `keyboardView`: Caches DOM nodes, renders labels (Cangjie vs English), tracks `press` classes, applies `hint` and `disabled` states.
- `questBarView`: Renders radical glyph (or an aux SVG) and slot labels; applies diffs for right/wrong/cursor and `radical-wrong` state.
- `auxiliaryView`: Shows the auxiliary strip and explanation. Converts a subset of MediaWiki-style notation in `shuo_ming` to inline `<img>` and text.

### Weighted selection and outcomes

- `questWeights` persists per-entity weights in `localStorage` (with in-memory fallback):
  - `registerCharacters(mode, characters)` tracks the universe.
  - `pickWeightedCharacter(mode, list)` samples by weight.
  - `weightedPickAvoidRepeat(mode, list, last)` avoids immediate repeats.
  - `adjustByOutcome(mode, entity, outcome)` updates weights: wrong +5, right -2 (bounded by `minWeight`).
- The controller ensures only one adjustment per round (first wrong or completion) to avoid overcounting.

## Key UI/data flows

### Boot and first render

1. `init()` reads defaults from `#character` list in `keyExercise.html`.
2. Initializes state with radical pools from `constants.js`.
3. Picks the first target and renders the quest (radical + code slots).
4. Schedules the first indicator render.

### Input handling

1. `wireEvents()` binds `input` on `#inputBar` and filters invalid keys via `INVALID_KEY_REGEX`.
2. Calls `controller.check(value)`:
   - Computes progress; if completed, picks and renders the next target per mode.
   - Triggers `updateIndicators(value)`.
3. `updateIndicators` (rAF-batched) computes diffs and updates `questBarView` + `keyboardView` (hints/disabled keys). In aux mode, toggles visibility of the aux panel on wrong input.

### Modes

- **單字 (char)**
  - Random character from `#character` list.
  - `hintKey` is the next expected letter of the target code.
  - Cursor moves to input+1; hides when past end.

- **字根 (radical)**
  - Category (`philosophy`, `stroke`, `human`, `shape`, `all`) selects a pool from `constants.RADICAL_POOLS`.
  - Controller registers letters for weighting and performs `weightedPickAvoidRepeat`.
  - Disabled keys restrict to the current pool; `hintKey` points to the correct radical only when input is wrong.
  - Outcome-based weight adjustment once per round.

- **輔助字形 (aux)**
  - Loads `experiment/auxiliary_forms.json`, maps current category’s letters to rows containing `fuzhu` (aux forms) and `zili` (sub-glyph files).
  - The quest’s first slot renders an SVG of the selected `zili`; code is still the letter (e.g., "m").
  - On wrong input, the aux panel shows the strip of related `fuzhu` and an explanation (`shuo_ming`) rendered with inline images.
  - Weighted selection and one-adjustment-per-round apply to `zili` files.

## Terminology (glossary)

- **Quest**: A single practice item to solve. In char mode, “type the full code for a character”. In radical/aux, “press the correct key for the current letter/radical/zili”.
- **Quest Bar (`questBar`)**: The top strip showing the current target. Slot 0 shows the radical (or an aux SVG); subsequent slots show mapped labels of the Cangjie code (hidden in radical/aux modes). Indicators (right/wrong/cursor and radical-wrong) update here.
- **Radical**: One of the 24 Cangjie component keys mapped to letters a–y (plus x for 難). Pools group radicals by category.
- **Code**: The Cangjie sequence for a character (e.g., `mgbuu`). Stored in the `#character` list and rendered as slot labels in char mode.
- **Hint Key**: The keyboard letter to highlight. In char mode it’s the next required letter; in radical mode it appears only when the input is wrong; in aux mode behavior follows radical mode.
- **Right/Wrong Arrays**: Zero-based code-slot indices that should be marked `right` or `wrong` in the quest bar.
- **Cursor Index**: 1-based index into quest bar slots for the blinking cursor; -1 means “no cursor”. In radical/aux modes it stays at slot 1.
- **Category / Pool**: A named set of radicals used in radical/aux modes (see `RADICAL_POOLS`).
- **Aux / Fuzhu / Zili**: Aux mode terms from the Wikibooks dataset: fuzhu (auxiliary form groups) and zili (individual SVG files). The quest renders a selected zili.
- **Round**: One attempt at a quest. The controller limits outcome-based weight adjustment to once per round (first wrong or success) to avoid biasing multiple times.
- **Weight**: Sampling bias per entity (letter or zili). Defaults to 20 and adjusts by outcomes; stored per mode in `localStorage`.

## Constants and conventions

- Use `src/js/constants.js` for shared selectors, class names, timings, regex, and data paths.
  - Avoid hardcoding IDs or classes in views/controllers; import from `constants`.
  - Regex: `INVALID_KEY_REGEX` ensures only a–y are accepted.
  - Timings: `TIMINGS.pressMs`, `TIMINGS.overlayDelayMs`.

## Extending the app

### Add a new character to char mode

1. Edit `keyExercise.html` `#character` `<pre>` list; add a new line like `漢xxxx` (no code change needed).
2. Reload the page; the app reads this list at boot.

### Add/modify radical categories

1. Update `RADICAL_POOLS` in `src/js/constants.js`.
2. If you add a category option in the HTML select, ensure the `value` matches the key.

### Tweak hint/indicator behavior

- Adjust logic in `computeIndicators` in `src/js/state/questState.js`.

### Adjust weighting policy

- Update deltas in `DEFAULTS` (`wrongDelta`, `rightDelta`) in `src/js/state/questWeights.js`.

### Add a new mode

1. Extend `questState.setMode` to recognize the new mode.
2. Teach `questController` how to pick/render next items and when/how to adjust weights.
3. Update views if the representation differs (e.g., slot 0 content, indicators).

## Accessibility and UX details

- Buttons update `aria-pressed`; the keyboard container uses `aria-hidden` when hidden.
- An overlay prompts refocus on the input when blurred; delay is configurable via `TIMINGS.overlayDelayMs`.
- Images in aux mode set `decoding="async"` and avoid referrer leakage for external-like paths.

## Debugging tips

- Add `#debug` to the URL to log compute/apply timings to the console.
- Indicators are rAF-batched; if you modify rendering, keep the batching to avoid layout thrash.
- Views cache DOM references; remember to call their ensure/render entrypoints instead of querying repeatedly.

## Licensing and content sources

- Forked from `https://gholk.github.io/cjns/index.html`.
- Auxiliary forms data from Wikibooks under CC BY-SA 4.0.

## Quick reference (files)

- `src/js/index.js`: Entry; boot and debug toggle
- `src/js/constants.js`: Selectors, classes, regex, timings, data, pools
- `src/js/controller/questController.js`: Orchestration, modes, picking, events
- `src/js/state/questState.js`: Pure logic (state, indicators, mode switching)
- `src/js/state/questWeights.js`: LocalStorage weights, picking, adjustments
- `src/js/view/keyboardView.js`: Keyboard rendering + key states
- `src/js/view/questBarView.js`: Quest render + indicators
- `src/js/view/auxiliaryView.js`: Aux strip + explanation
