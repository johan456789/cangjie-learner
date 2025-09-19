# README for agents

Use uv to manage dependencies.

Also use uv to run scripts.

For example, to run `download_auxiliary_svgs.py`, use:

```sh
uv run experiment/download_auxiliary_svgs.py
```

## Web

Use modern JS. If you see legacy code, try to rewrite it if it's not too complex.

### Naming and constants guidelines

- Prefer descriptive names:
  - Variables: `currentCharacter`, `keyboardElementMap`.
  - Booleans: positive phrasing `isRadicalModeSelected`, `isEnglishLayout`.
  - Functions: verb phrases `computeIndicators`, `renderKeyboardLabels`.
- Centralize magic strings in `src/js/constants.js`:
  - Selectors: `SELECTORS.inputBar`, `SELECTORS.keyboardMap`, `SELECTORS.toggleLayout`, etc.
  - Classes: `CLASSES.press`, `CLASSES.hint`, `CLASSES.hidden`, `CLASSES.noFocus`, etc.
  - Regex: `INVALID_KEY_REGEX` for allowed input.
  - Timings: `TIMINGS.pressMs`, `TIMINGS.overlayDelayMs`.
- Do not hardcode IDs/class names in components; import from `CJL.constants`.

## Local Development

The project uses ES modules, which require serving over HTTP (not `file://` protocol).

### Starting the Development Server

```sh
cd /Users/johan/Downloads/cangjie-learner
python3 -m http.server 5520
```

### Accessing the Application

Open `http://localhost:5520/keyExercise.html` in your browser.

### Sanity Checks

After loading the page, verify these interactions work:

- **Layout Toggle**: Click "英文鍵盤" button → labels become A-Z, button text flips to "倉頡鍵盤"
- **Mode Switch**: Change "模式" to "字根" → category dropdown becomes enabled
- **Category Selection**: In radical mode, change category → radical pool updates
- **Typing Input**: In "單字" mode, type letters → see visual feedback (right/wrong/cursor indicators)
- **Keyboard Hints**: Type partial input → matching key should highlight with hint class
