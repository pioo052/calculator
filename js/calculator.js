/*
 * calculator.js
 * Interface logic: display, keypad, scientific functions, keyboard support,
 * history panel, DEG/RAD mode, theme and clipboard.
 *
 * The maths lives in parser.js and persistence lives in history.js; this
 * file only turns user intent into an expression string and renders state.
 */
(function () {
  'use strict';

  const Parser = window.CalcParser;
  const History = window.CalcHistory;

  const MODE_KEY = 'sci-calc:mode';
  const THEME_KEY = 'sci-calc:theme';
  const BINARY_OPERATORS = ['+', '−', '×', '÷', '^'];
  const OPERAND_END = /[0-9)πe!%]/;

  const state = {
    expression: '',      // what the user sees and edits
    angleMode: 'DEG',    // DEG or RAD
    justEvaluated: false,
    lastResult: '',      // formatted text of the last answer
    error: ''
  };

  const els = {};

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                      */
  /* ------------------------------------------------------------------ */

  function readStored(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // Storage can be blocked; the calculator keeps working.
    }
  }

  function cacheElements() {
    els.workspace = document.getElementById('workspace');
    els.calculator = document.getElementById('calculator');
    els.displayMain = document.getElementById('displayMain');
    els.displayContext = document.getElementById('displayContext');
    els.modeChip = document.getElementById('modeChip');
    els.themeToggle = document.getElementById('themeToggle');
    els.themeToggleIcon = document.getElementById('themeToggleIcon');
    els.historyToggle = document.getElementById('historyToggle');
    els.historyPanel = document.getElementById('historyPanel');
    els.historyClose = document.getElementById('historyClose');
    els.historyClear = document.getElementById('historyClear');
    els.historyList = document.getElementById('historyList');
    els.historyEmpty = document.getElementById('historyEmpty');
    els.historyCount = document.getElementById('historyCount');
    els.copyBtn = document.getElementById('copyBtn');
    els.toast = document.getElementById('toast');
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                          */
  /* ------------------------------------------------------------------ */

  // A live preview of the current expression, shown in the small line above
  // the main display once the input is a complete, computable expression.
  function buildPreview() {
    if (!state.expression) return '';
    try {
      return '= ' + Parser.format(Parser.evaluate(state.expression, state.angleMode));
    } catch (error) {
      return '';
    }
  }

  function render() {
    const main = els.displayMain;
    const context = els.displayContext;

    if (state.error) {
      context.textContent = state.error;
      context.classList.add('is-error');
      main.textContent = state.expression || '0';
    } else {
      context.classList.remove('is-error');
      if (state.justEvaluated) {
        context.textContent = state.expression;
        main.textContent = state.lastResult;
      } else {
        main.textContent = state.expression || '0';
        context.textContent = buildPreview();
      }
    }

    const length = main.textContent.length;
    main.classList.toggle('is-long', length > 16);
    main.classList.toggle('is-longer', length > 26);
    main.scrollLeft = main.scrollWidth;

    els.modeChip.textContent = state.angleMode;
  }

  function pulseDisplay() {
    els.displayMain.classList.remove('is-pop');
    void els.displayMain.offsetWidth; // restart the animation
    els.displayMain.classList.add('is-pop');
  }

  function shakeCalculator() {
    els.calculator.classList.remove('is-shaking');
    void els.calculator.offsetWidth;
    els.calculator.classList.add('is-shaking');
  }

  /* ------------------------------------------------------------------ */
  /* Input handling                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Prepare the expression for the next keystroke.
   * After "=" the answer can either start a fresh entry (digits, functions,
   * constants) or continue the calculation (operators and postfix symbols).
   */
  function beginInput(continueFromResult) {
    state.error = '';
    if (state.justEvaluated) {
      state.expression = continueFromResult ? state.lastResult : '';
      state.justEvaluated = false;
    }
  }

  function pressDigit(digit) {
    beginInput(false);
    const expression = state.expression;
    // Typing a digit after a lone zero replaces it ("0" -> "7", "−0" -> "−7").
    if (/(^|[+−×÷^(])0$/.test(expression)) {
      state.expression = expression.slice(0, -1) + digit;
    } else {
      state.expression = expression + digit;
    }
    render();
  }

  function pressDecimal() {
    beginInput(false);
    const expression = state.expression;
    const last = expression.slice(-1);

    // A decimal point cannot follow a completed value or constant directly.
    if (expression && /[)π!%e]/.test(last)) return;

    const trailing = /[0-9.]*$/.exec(expression)[0];
    if (trailing.indexOf('.') !== -1) return;

    state.expression = expression + (trailing ? '.' : '0.');
    render();
  }

  function pressOperator(operator) {
    beginInput(true);

    if (state.expression === '') {
      if (operator === '−') state.expression = '−';
      render();
      return;
    }

    const last = state.expression.slice(-1);
    if (BINARY_OPERATORS.indexOf(last) !== -1) {
      // Typing another operator swaps it, but "−" is allowed after it so
      // negative values and powers like 5^−2 can be entered.
      if (operator === '−' && last !== '−') {
        state.expression += '−';
      } else {
        state.expression = state.expression.slice(0, -1) + operator;
      }
    } else if (last === '(') {
      if (operator === '−') state.expression += '−';
    } else {
      state.expression += operator;
    }
    render();
  }

  function pressFunction(name) {
    beginInput(false);
    state.expression += name + '(';
    render();
  }

  function pressConstant(value) {
    beginInput(false);
    state.expression += value;
    render();
  }

  function pressOpenParen() {
    beginInput(false);
    state.expression += '(';
    render();
  }

  function pressCloseParen() {
    if (state.justEvaluated) return;

    const opens = (state.expression.match(/\(/g) || []).length;
    const closes = (state.expression.match(/\)/g) || []).length;
    const last = state.expression.slice(-1);

    if (opens <= closes) return;
    if (!last || BINARY_OPERATORS.indexOf(last) !== -1 || last === '(') return;

    state.error = '';
    state.expression += ')';
    render();
  }

  function pressPostfix(symbol) {
    beginInput(true);
    if (!state.expression) return;

    const last = state.expression.slice(-1);
    if (!OPERAND_END.test(last)) return;
    if (last === symbol) return;

    state.expression += symbol;
    render();
  }

  function pressSquared() {
    beginInput(true);
    if (!state.expression) return;
    if (!OPERAND_END.test(state.expression.slice(-1))) return;

    state.expression += '^2';
    render();
  }

  function pressReciprocal() {
    beginInput(true);
    if (!state.expression) return;
    if (!OPERAND_END.test(state.expression.slice(-1))) return;

    state.expression += '^(-1)';
    render();
  }

  function clearAll() {
    state.expression = '';
    state.justEvaluated = false;
    state.lastResult = '';
    state.error = '';
    render();
  }

  function backspace() {
    state.error = '';

    if (state.justEvaluated) {
      state.justEvaluated = false;
      render();
      return;
    }

    // Delete a whole function token ("sin(", "√(") when one ends the input.
    const functionMatch = state.expression.match(/(?:asin|acos|atan|sin|cos|tan|log|ln|abs|√)\($/);
    if (functionMatch) {
      state.expression = state.expression.slice(0, -functionMatch[0].length);
    } else {
      state.expression = state.expression.slice(0, -1);
    }
    render();
  }

  function calculate() {
    if (!state.expression.trim() || state.justEvaluated) return;

    try {
      const value = Parser.evaluate(state.expression, state.angleMode);
      const result = Parser.format(value);

      state.lastResult = result;
      state.justEvaluated = true;
      state.error = '';

      History.add({
        expression: state.expression,
        result: result,
        mode: state.angleMode
      });
      pulseDisplay();
    } catch (error) {
      state.error = error instanceof Parser.CalcError ? error.message : 'Invalid expression';
      state.justEvaluated = false;
      shakeCalculator();
    }
    render();
  }

  /* ------------------------------------------------------------------ */
  /* Mode, theme, clipboard                                             */
  /* ------------------------------------------------------------------ */

  function setMode(mode) {
    state.angleMode = mode === 'RAD' ? 'RAD' : 'DEG';
    writeStored(MODE_KEY, state.angleMode);

    document.querySelectorAll('.segmented__btn').forEach(function (button) {
      const active = button.dataset.mode === state.angleMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    render();
  }

  function setTheme(theme, persist) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);

    els.themeToggleIcon.textContent = next === 'dark' ? '☀' : '☾';
    els.themeToggle.setAttribute(
      'aria-label',
      next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    );
    els.themeToggle.setAttribute('aria-pressed', String(next === 'dark'));

    if (persist !== false) writeStored(THEME_KEY, next);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  // Fallback for browsers or contexts without the Clipboard API.
  function legacyCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }
    document.body.removeChild(area);
    return copied;
  }

  function copyResult() {
    let text = '';

    if (state.justEvaluated) {
      text = state.lastResult;
    } else if (state.expression) {
      try {
        text = Parser.format(Parser.evaluate(state.expression, state.angleMode));
      } catch (error) {
        text = '';
      }
    }

    if (!text) {
      showToast('Nothing to copy yet');
      return;
    }

    copyText(text).then(function (copied) {
      showToast(copied ? 'Result copied' : 'Copy is not available');
    });
  }

  let toastTimer = 0;

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      els.toast.classList.remove('is-visible');
    }, 1800);
  }

  /* ------------------------------------------------------------------ */
  /* History panel                                                      */
  /* ------------------------------------------------------------------ */

  function isHistoryOpen() {
    return els.workspace.classList.contains('is-history-open');
  }

  function toggleHistory(forceOpen) {
    const open = typeof forceOpen === 'boolean' ? forceOpen : !isHistoryOpen();
    els.workspace.classList.toggle('is-history-open', open);
    els.historyToggle.setAttribute('aria-expanded', String(open));
    els.historyPanel.setAttribute('aria-hidden', String(!open));
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                             */
  /* ------------------------------------------------------------------ */

  function bindKeys() {
    els.calculator.addEventListener('click', function (event) {
      const button = event.target.closest('button[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const value = button.dataset.value;

      switch (action) {
        case 'digit': pressDigit(value); break;
        case 'decimal': pressDecimal(); break;
        case 'operator': pressOperator(value); break;
        case 'function': pressFunction(value); break;
        case 'constant': pressConstant(value); break;
        case 'open-paren': pressOpenParen(); break;
        case 'close-paren': pressCloseParen(); break;
        case 'postfix': pressPostfix(value); break;
        case 'squared': pressSquared(); break;
        case 'power': pressOperator('^'); break;
        case 'reciprocal': pressReciprocal(); break;
        case 'clear': clearAll(); break;
        case 'delete': backspace(); break;
        case 'equals': calculate(); break;
        default: break;
      }
    });

    document.querySelectorAll('.segmented__btn').forEach(function (button) {
      button.addEventListener('click', function () {
        setMode(button.dataset.mode);
      });
    });

    els.displayMain.addEventListener('animationend', function () {
      els.displayMain.classList.remove('is-pop');
    });
    els.calculator.addEventListener('animationend', function () {
      els.calculator.classList.remove('is-shaking');
    });
  }

  function bindKeyboard() {
    window.addEventListener('keydown', function (event) {
      // Never hijack browser shortcuts (copy, paste, refresh, devtools …).
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key;

      if (/^[0-9]$/.test(key)) {
        pressDigit(key);
      } else if (key === '.' || key === ',') {
        pressDecimal();
      } else if (key === '+') {
        pressOperator('+');
      } else if (key === '-') {
        pressOperator('−');
      } else if (key === '*') {
        pressOperator('×');
      } else if (key === '/') {
        pressOperator('÷');
      } else if (key === '^') {
        pressOperator('^');
      } else if (key === '%') {
        pressPostfix('%');
      } else if (key === '!') {
        pressPostfix('!');
      } else if (key === '(') {
        pressOpenParen();
      } else if (key === ')') {
        pressCloseParen();
      } else if (key === 'Enter' || key === '=') {
        calculate();
      } else if (key === 'Backspace') {
        backspace();
      } else if (key === 'Escape') {
        if (isHistoryOpen()) toggleHistory(false);
        else clearAll();
      } else {
        return;
      }

      event.preventDefault();
    });
  }

  function init() {
    cacheElements();

    // Restore the angle mode used last time.
    const savedMode = readStored(MODE_KEY);
    state.angleMode = savedMode === 'RAD' ? 'RAD' : 'DEG';

    // The inline head script already applied the theme; sync the button.
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setTheme(currentTheme === 'dark' ? 'dark' : 'light', false);

    History.init({
      listEl: els.historyList,
      emptyEl: els.historyEmpty,
      countEl: els.historyCount,
      onSelect: function (entry) {
        state.expression = entry.result;
        state.justEvaluated = false;
        state.error = '';
        render();
        if (window.matchMedia('(max-width: 820px)').matches) toggleHistory(false);
        showToast('Result inserted');
      }
    });

    bindKeys();
    bindKeyboard();

    els.themeToggle.addEventListener('click', function () {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setTheme(isDark ? 'light' : 'dark', true);
    });

    els.historyToggle.addEventListener('click', function () { toggleHistory(); });
    els.historyClose.addEventListener('click', function () { toggleHistory(false); });
    els.historyClear.addEventListener('click', function () {
      History.clear();
      showToast('History cleared');
    });
    els.copyBtn.addEventListener('click', copyResult);

    setMode(state.angleMode);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
