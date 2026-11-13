// Shared UI helpers: icons, number pad, sound, haptics, tap handling, modals.

import * as store from './store.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => Number(n).toLocaleString('en-US').replace(/,/g, ' ');

// ---------- Icons (inline SVG, stroke-based, 24px grid) ----------
const P = (d, extra = '') => `<path d="${d}" ${extra}/>`;
const svg = (inner, { size = 24, fill = 'none', sw = 2.4, cls = '' } = {}) =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const icon = {
  flame: (o) => `<svg class="ic ${o?.cls || ''}" width="${o?.size || 22}" height="${o?.size || 22}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF3D71"/><stop offset="1" stop-color="#FFB020"/></linearGradient></defs><path fill="url(#fl)" d="M12.6 2.2c.4 3-1.2 4.6-2.6 6.1C8.4 10 7 11.6 7 14.4A5 5 0 0 0 12 19.5a5 5 0 0 0 5-5.1c0-1.6-.6-2.9-1.5-4 .1 1.2-.4 2.2-1.3 2.6.3-3.9-1.3-8-1.6-10.8Z"/><path fill="#FFE08A" d="M12 19.5a2.6 2.6 0 0 1-2.6-2.7c0-1.6 1.3-2.5 2.2-3.6.2 1.1.9 1.5 1.5 1.6a2.6 2.6 0 0 1 1.5 2.3A2.6 2.6 0 0 1 12 19.5Z"/></svg>`,
  bolt: (o) => `<svg class="ic" width="${o?.size || 20}" height="${o?.size || 20}" viewBox="0 0 24 24" aria-hidden="true"><path fill="#FFC21A" stroke="#E0A000" stroke-width="1.4" stroke-linejoin="round" d="M13.5 2 5 13.2h6.2L10 22l9-11.6h-6.3L13.5 2Z"/></svg>`,
  heart: (o) => `<svg class="ic" width="${o?.size || 22}" height="${o?.size || 22}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${o?.off ? '#E3E7EF' : '#F0435A'}" d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.2C21 15 12 20.5 12 20.5Z"/></svg>`,
  home: (o) => svg(P('M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z'), o),
  grid: (o) => svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>', o),
  chart: (o) => svg(P('M4 20V10M10 20V4M16 20v-7M22 20H2'), o),
  user: (o) => svg('<circle cx="12" cy="8" r="4"/>' + P('M4 21a8 8 0 0 1 16 0'), o),
  close: (o) => svg(P('M6 6l12 12M18 6 6 18'), o),
  lock: (o) => svg('<rect x="5" y="11" width="14" height="10" rx="2.5"/>' + P('M8 11V8a4 4 0 0 1 8 0v3'), o),
  check: (o) => svg(P('M4.5 12.5l5 5 10-11'), o),
  back: (o) => svg(P('M15 5l-7 7 7 7'), o),
  pause: (o) => svg(P('M8 5v14M16 5v14'), o),
  del: (o) => svg(P('M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z') + P('M12 9.5l5 5M17 9.5l-5 5'), { sw: 2, ...o }),
  // skill glyphs
  math: (o) => svg(P('M5 7h6M8 4v6M14 7h5M5 17l5-5M10 17l-5-5M14 15h5M14 19h5'), o),
  memory: (o) => svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.8" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" fill="currentColor"/>', o),
  logic: (o) => svg('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/>' + P('M7.8 7.8 10.6 15.8M16.2 7.8l-2.8 8M8.5 6h7'), o),
};

// ---------- Sound + haptics ----------
let audioCtx = null;
function tone(freq, dur = 0.09, type = 'sine', gain = 0.06, delay = 0) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime + delay;
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* no audio */ }
}
export const sfx = {
  good(combo = 0) { if (!store.get().settings.sound) return; const b = 660 + Math.min(combo, 10) * 30; tone(b, 0.07); tone(b * 1.5, 0.1, 'sine', 0.05, 0.06); },
  bad() { if (!store.get().settings.sound) return; tone(180, 0.18, 'square', 0.03); },
  tick() { if (!store.get().settings.sound) return; tone(900, 0.03, 'sine', 0.03); },
  win() { if (!store.get().settings.sound) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.05, i * 0.09)); },
};
export function haptic(pattern = 12) {
  if (!store.get().settings.haptics) return;
  try { navigator.vibrate?.(pattern); } catch (e) { /* not supported (iOS) */ }
}

// ---------- Tap helpers ----------
// Resolves with the tapped index, -1 on timeout, -2 when the round ends.
export function waitTap(api, els, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return; done = true;
      els.forEach((e) => { e.onpointerdown = null; });
      resolve(v);
    };
    els.forEach((e, i) => { e.onpointerdown = (ev) => { ev.preventDefault(); finish(i); }; });
    api.onOver(() => finish(-2));
    if (timeoutMs) api.wait(timeoutMs).then((alive) => finish(alive ? -1 : -2));
  });
}

// ---------- Number pad ----------
// Auto-submits once the typed answer reaches the length of the right answer,
// so fast players never have to press "enter".
export function numberPad(host, { display, allowNeg = false, onSubmit, answerLength = () => null, maxLen = 9 }) {
  let value = '';
  let enabled = true;
  host.innerHTML = `<div class="pad">
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="pad-k" data-k="${n}">${n}</button>`).join('')}
    <button class="pad-k pad-alt" data-k="neg" ${allowNeg ? '' : 'disabled aria-hidden="true" style="visibility:hidden"'}>−</button>
    <button class="pad-k" data-k="0">0</button>
    <button class="pad-k pad-alt" data-k="del" aria-label="Delete">${icon.del({ size: 26 })}</button>
  </div>`;
  const render = () => { if (display) display.textContent = value || ' '; };
  const press = (k) => {
    if (!enabled) return;
    if (k === 'del') value = value.slice(0, -1);
    else if (k === 'neg') value = value.startsWith('-') ? value.slice(1) : '-' + value;
    else if (k === 'enter') { if (value && value !== '-') onSubmit(value); return; }
    else if (value.replace('-', '').length < maxLen) value += k;
    render();
    const len = answerLength();
    if (len && value.length >= len && value !== '-') onSubmit(value);
  };
  host.querySelectorAll('.pad-k').forEach((b) => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); press(b.dataset.k); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => b.classList.remove('down')));
  });
  const onKey = (e) => {
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === '-' && allowNeg) press('neg');
    else if (e.key === 'Enter') press('enter');
  };
  window.addEventListener('keydown', onKey);
  render();
  return {
    clear() { value = ''; render(); },
    get value() { return value; },
    enable(on) { enabled = on; host.classList.toggle('pad-off', !on); },
    destroy() { window.removeEventListener('keydown', onKey); },
  };
}

// ---------- Modal ----------
export function confirmModal({ title, body, yes, no, danger = false }) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">
      <h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ''}
      <div class="modal-actions">
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-v="1">${esc(yes)}</button>
        <button class="btn btn-ghost" data-v="0">${esc(no)}</button>
      </div></div></div>`;
    root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { root.innerHTML = ''; resolve(b.dataset.v === '1'); }));
  });
}

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2200);
}
