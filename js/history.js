/*
 * history.js
 * Calculation history with localStorage persistence.
 *
 * Entries are stored newest first and capped so the panel (and storage)
 * never grows without limit. Only the expression, result, angle mode and a
 * timestamp are kept — no personal data.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'sci-calc:history';
  const MAX_ENTRIES = 60;

  let entries = [];
  let refs = {
    listEl: null,
    emptyEl: null,
    countEl: null,
    onSelect: null
  };
  let uid = 0;

  /* ----------------------------- storage ----------------------------- */

  function isValidEntry(entry) {
    return Boolean(entry) &&
      typeof entry.expression === 'string' &&
      typeof entry.result === 'string';
  }

  function readStore() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidEntry).slice(0, MAX_ENTRIES);
    } catch (error) {
      // Private browsing or corrupted data: start with an empty history.
      return [];
    }
  }

  function writeStore() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      // Storage may be unavailable; the panel still works for this session.
    }
  }

  function makeId() {
    uid += 1;
    return 'h' + Date.now().toString(36) + '-' + uid.toString(36);
  }

  /* ----------------------------- rendering --------------------------- */

  function updateMeta() {
    const count = entries.length;

    if (refs.countEl) {
      if (count === 0) {
        refs.countEl.textContent = 'No calculations yet';
      } else {
        refs.countEl.textContent = count + (count === 1 ? ' calculation saved' : ' calculations saved');
      }
    }
    if (refs.emptyEl) refs.emptyEl.hidden = count > 0;
    if (refs.listEl) refs.listEl.hidden = count === 0;
  }

  function buildItem(entry) {
    const item = document.createElement('li');
    item.className = 'history__item';

    const entryButton = document.createElement('button');
    entryButton.type = 'button';
    entryButton.className = 'history__entry';
    entryButton.dataset.id = entry.id;
    entryButton.setAttribute(
      'aria-label',
      'Reuse result ' + entry.result + ' from ' + entry.expression
    );

    const row = document.createElement('span');
    row.className = 'history__row';

    const expression = document.createElement('span');
    expression.className = 'history__expression';
    expression.textContent = entry.expression;

    const mode = document.createElement('span');
    mode.className = 'history__mode';
    mode.textContent = entry.mode === 'RAD' ? 'RAD' : 'DEG';

    const result = document.createElement('span');
    result.className = 'history__result';
    result.textContent = '= ' + entry.result;

    row.appendChild(expression);
    row.appendChild(mode);
    entryButton.appendChild(row);
    entryButton.appendChild(result);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'history__delete';
    deleteButton.dataset.delete = entry.id;
    deleteButton.setAttribute('aria-label', 'Delete this calculation');
    deleteButton.textContent = '×';

    item.appendChild(entryButton);
    item.appendChild(deleteButton);
    return item;
  }

  function render() {
    if (!refs.listEl) return;

    refs.listEl.textContent = '';
    entries.forEach(function (entry) {
      refs.listEl.appendChild(buildItem(entry));
    });
    updateMeta();
  }

  /* ----------------------------- actions ----------------------------- */

  function add(calculation) {
    entries.unshift({
      id: makeId(),
      expression: String(calculation.expression),
      result: String(calculation.result),
      mode: calculation.mode === 'RAD' ? 'RAD' : 'DEG',
      time: Date.now()
    });
    entries = entries.slice(0, MAX_ENTRIES);
    writeStore();
    render();
  }

  function remove(id) {
    const before = entries.length;
    entries = entries.filter(function (entry) { return entry.id !== id; });
    if (entries.length !== before) {
      writeStore();
      render();
    }
  }

  function clear() {
    if (entries.length === 0) return;
    entries = [];
    writeStore();
    render();
  }

  function getAll() {
    return entries.slice();
  }

  /* ----------------------------- events ------------------------------ */

  function handleClick(event) {
    const deleteButton = event.target.closest('[data-delete]');
    if (deleteButton) {
      remove(deleteButton.dataset.delete);
      return;
    }

    const entryButton = event.target.closest('[data-id]');
    if (!entryButton || typeof refs.onSelect !== 'function') return;

    const selected = entries.find(function (entry) {
      return entry.id === entryButton.dataset.id;
    });
    if (selected) refs.onSelect(selected);
  }

  function init(options) {
    const settings = options || {};
    refs.listEl = settings.listEl || null;
    refs.emptyEl = settings.emptyEl || null;
    refs.countEl = settings.countEl || null;
    refs.onSelect = typeof settings.onSelect === 'function' ? settings.onSelect : null;

    entries = readStore();
    if (refs.listEl) {
      refs.listEl.addEventListener('click', handleClick);
    }
    render();
  }

  global.CalcHistory = {
    init: init,
    add: add,
    remove: remove,
    clear: clear,
    getAll: getAll
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
