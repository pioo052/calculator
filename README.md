# Advanced Scientific Calculator

A polished, fully functional scientific calculator built with **HTML5, CSS3 and vanilla
JavaScript** — no frameworks, no libraries, no build step. It evaluates typed expressions
with a purpose-written recursive descent parser, so there is no `eval()` or `new Function()`
anywhere in the source.

> **DIGITAL CLUB — LEARN. CREATE. INNOVATE.**
>
> Digital Club Level 1 competition entry.

---

## Description

The calculator combines a clean emerald-green and white interface with a real mathematical
engine. You can type a whole expression such as `sin(30) + √(81) - log(100)`, watch a live
preview of the answer, and press `=` to commit it to a persistent history panel. Angle mode
(DEG/RAD), theme, and the last 60 calculations are remembered between visits.

Everything — parsing, evaluation, history, animations, keyboard support — is native code in
three small, focused JavaScript files.

## Features

### Calculations
- Addition, subtraction, multiplication, division and decimals.
- Negative numbers, unary minus and brackets.
- Correct operator precedence and nested parentheses.
- Right-associative powers (`2^3^2 = 512`) and implicit multiplication (`2π`, `3(4+1)`, `2sin(30)`).
- Calculator-style percentages (`50% = 0.5`, `200 + 10% = 220`, `200 − 10% = 180`).
- Automatic closing bracket for unfinished input such as `sin(30`.

### Scientific functions
- `sin`, `cos`, `tan` and their inverses `asin`, `acos`, `atan`.
- `log` (base 10) and `ln` (natural logarithm).
- Square root `√`, square `x²`, power `xʸ`, reciprocal `1/x`.
- Constants `π` and `e`.
- Factorial `x!` (whole numbers 0–170).
- Absolute value `|x|`.

### Interface
- Two-line display: live result preview above, current expression/result below.
- DEG / RAD segmented switch with an active state and persisted preference.
- Calculation history drawer with reuse, per-entry delete and clear-all.
- Copy-result button with clipboard fallback for older browsers.
- Light and dark theme, remembered between visits and following the OS by default.
- Keyboard input for every common operation.
- Fully responsive: desktop, laptop, tablet and phone layouts with no horizontal overflow.
- Subtle press, hover, display-pop, shake-on-error and panel-slide animations, all disabled
  automatically when the visitor prefers reduced motion.

### Error handling
Human-readable messages instead of crashes:

| Input | Message |
| --- | --- |
| `1 ÷ 0`, `0^(-1)` | Cannot divide by zero |
| `√(-4)` | Square root of a negative number is not a real number |
| `log(0)`, `ln(-2)` | Logarithm is undefined for zero or negative numbers |
| `tan(90)` | Tangent is undefined at this angle |
| `2.5!`, `(-1)!` | Factorial only works with whole numbers / of a negative number is undefined |
| `171!` | Factorial input is too large (maximum is 170) |
| `asin(2)` | asin needs a value between -1 and 1 |
| `5+` | Incomplete expression |
| `9^9^9` | Result is too large to display |
| `(-8)^(1÷3)` | Result is not a real number |

## Technologies used

| Technology | Purpose |
| --- | --- |
| HTML5 | Semantic page structure and accessible controls |
| CSS3 | Design system, layout, responsive rules, animations, dark theme |
| Vanilla JavaScript (ES2015+) | Expression parser, calculator logic, history, keyboard and UI behaviour |
| `localStorage` | Persisting history, angle mode and theme |
| Clipboard API | Copying results (with `document.execCommand` fallback) |

No React, Vue, Angular, Bootstrap, Tailwind, jQuery, UI kit, backend or database is used.
There is no build step and no dependency to install.

## Project structure

```
scientific-calculator/
├── index.html              # Page structure and all calculator buttons
├── css/
│   └── style.css           # Design system, layout, responsive rules, animations
├── js/
│   ├── parser.js           # Tokenizer, recursive descent parser, evaluator, formatting
│   ├── calculator.js       # Display, keypad, keyboard, history panel, theme, clipboard
│   └── history.js          # localStorage history store and rendering
├── assets/
│   └── icons/
│       └── favicon.svg     # Browser tab icon
└── README.md
```

## Installation and running

There is nothing to install.

1. Download or clone the repository.
2. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox or Safari).

Or serve it locally:

```bash
# Option A — XAMPP / Apache
#   place the folder in htdocs and visit:
#   http://localhost/scientific-calculator/

# Option B — Python's built-in server
python -m http.server 8000
# then open http://localhost:8000

# Option C — Node.js
npx serve .
```

## Example calculations

| Expression | Mode | Result |
| --- | --- | --- |
| `10 + 5` | DEG | `15` |
| `20 − 8` | DEG | `12` |
| `6 × 7` | DEG | `42` |
| `20 ÷ 4` | DEG | `5` |
| `sin(30)` | DEG | `0.5` |
| `cos(60)` | DEG | `0.5` |
| `tan(45)` | DEG | `1` |
| `sin(π ÷ 2)` | RAD | `1` |
| `√(81)` | DEG | `9` |
| `5²` | DEG | `25` |
| `2^3^2` | DEG | `512` |
| `log(100)` | DEG | `2` |
| `ln(e)` | DEG | `1` |
| `5!` | DEG | `120` |
| `asin(0.5)` | DEG | `30` |
| `2 + 3 × 4` | DEG | `14` |
| `(2 + 3) × 4` | DEG | `20` |
| `200 + 10%` | DEG | `220` |
| `0.1 + 0.2` | DEG | `0.3` |

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `0`–`9` | Enter digits |
| `.` or `,` | Decimal point |
| `+` `-` `*` `/` | Operators |
| `^` | Power |
| `%` | Percent |
| `!` | Factorial |
| `(` `)` | Brackets |
| `Enter` or `=` | Calculate |
| `Backspace` | Delete last character |
| `Esc` | Clear everything (or close the history panel if open) |

## How the math is kept safe

`js/parser.js` never executes strings as code:

1. **Tokenize** — display symbols are normalised (`×` → `*`, `√` → `sqrt`, `π` → `pi`) and the
   input becomes a list of numbers, constants, functions and operators.
2. **Parse** — a recursive descent grammar builds an abstract syntax tree:
   `expression → additive → multiplicative → unary → power → postfix → primary`.
   This encodes precedence, right-associative powers and implicit multiplication.
3. **Evaluate** — the tree is walked with explicit domain checks for division by zero,
   logarithms, roots, inverse trigonometry, factorials and non-finite results.
4. **Format** — results are rounded to 12 significant digits so binary floating point noise
   (`0.30000000000000004`) never reaches the display, with exponential notation for very large
   or very small values.

## Testing

The parser was exercised against 69 automated cases covering every required operation,
precedence, implicit multiplication, angle modes, percentage semantics, formatting and every
error path above — all passing. The interface was then checked in the browser:

- arithmetic, scientific functions, brackets and precedence from the keypad;
- live preview, `=`, `AC`, `DEL` and reuse of previous results;
- division by zero and invalid expressions showing inline error messages plus the shake cue;
- DEG/RAD switching changing results (`sin(30)` → `0.5` vs `−0.988031624093`);
- keyboard entry (`Enter`, `Backspace`, `Esc`, operators) driving the same handlers;
- history add, per-entry delete, clear-all and persistence after a page reload;
- light/dark theme switching and persistence;
- layout at 390 px and 1280 px widths with no horizontal overflow and no console errors.

## Notes and limits

- Display precision is 12 significant digits; results are not a substitute for a symbolic
  maths engine.
- Factorials are limited to whole numbers up to 170, the largest value a 64-bit float can hold.
- Percentages follow calculator convention: `a + b%` means "a plus b percent of a". Elsewhere
  `b%` simply means `b ÷ 100`.
- Calculations run entirely in the browser; no data leaves the device and no personal
  information is stored.

## Publishing to GitHub

```bash
git init
git add .
git commit -m "Advanced scientific calculator"
git branch -M main
git remote add origin https://github.com/<your-username>/scientific-calculator.git
git push -u origin main
```

No hosting, backend or secrets are required — a static host or GitHub Pages works as-is.
