// Mental math: Falling blocks, Higher or lower, Chain, Hit the target, Estimate.

import { clamp } from '../rating.js';
import { waitTap, fmt } from '../ui.js';
import { makeAsker, ri } from './common.js';

// ---------- Arithmetic generator ----------
// Each template: active level range, expected solve time (s), generator.
const ARITH = [
  { min: 1, max: 7, T: 2.2, g: (r) => { const a = ri(r, 1, 9), b = ri(r, 1, 9); return [`${a} + ${b}`, a + b]; } },
  { min: 1, max: 9, T: 2.5, g: (r) => { const b = ri(r, 1, 9), a = b + ri(r, 0, 9); return [`${a} − ${b}`, a - b]; } },
  { min: 3, max: 16, T: 3.0, g: (r) => { const a = ri(r, 11, 89), b = ri(r, 2, 9); return [`${a} + ${b}`, a + b]; } },
  { min: 5, max: 12, T: 2.6, g: (r) => { const a = ri(r, 2, 5), b = ri(r, 2, 10); return [`${a} × ${b}`, a * b]; } },
  { min: 8, max: 24, T: 2.8, g: (r) => { const a = ri(r, 3, 9), b = ri(r, 3, 9); return [`${a} × ${b}`, a * b]; } },
  { min: 8, max: 26, T: 4.0, g: (r) => { const a = ri(r, 12, 79), b = ri(r, 12, 79); return [`${a} + ${b}`, a + b]; } },
  { min: 9, max: 28, T: 4.5, g: (r) => { const a = ri(r, 30, 99), b = ri(r, 11, a - 1); return [`${a} − ${b}`, a - b]; } },
  { min: 10, max: 28, T: 3.2, g: (r) => { const b = ri(r, 2, 9), q = ri(r, 2, 12); return [`${b * q} ÷ ${b}`, q]; } },
  { min: 13, max: 36, T: 6.0, g: (r) => { const a = ri(r, 12, 49), b = ri(r, 3, 9); return [`${a} × ${b}`, a * b]; } },
  { min: 15, max: 34, T: 4.5, g: (r) => { const p = r.pick([10, 20, 25, 50]); const base = p === 25 ? 4 * ri(r, 3, 30) : p === 50 ? 2 * ri(r, 6, 60) : 10 * ri(r, 2, 30); return [`${p}% of ${base}`, (base * p) / 100]; } },
  { min: 18, max: 40, T: 6.0, g: (r) => { const a = ri(r, 120, 699), b = ri(r, 120, 299); return [`${a} + ${b}`, a + b]; } },
  { min: 20, max: 40, T: 5.0, g: (r) => { const n = ri(r, 11, 25); return [`${n}²`, n * n]; } },
  { min: 22, max: 44, T: 6.5, g: (r) => { const a = ri(r, 51, 99), b = ri(r, 3, 9); return [`${a} × ${b}`, a * b]; } },
  { min: 22, max: 44, T: 6.5, g: (r) => { const a = ri(r, 300, 999), b = ri(r, 101, a - 50); return [`${a} − ${b}`, a - b]; } },
  { min: 24, max: 46, T: 9.0, g: (r) => { const a = ri(r, 11, 25), b = ri(r, 11, 19); return [`${a} × ${b}`, a * b]; } },
  { min: 26, max: 50, T: 7.0, g: (r) => { const b = ri(r, 3, 9), q = ri(r, 13, 99); return [`${b * q} ÷ ${b}`, q]; } },
  { min: 28, max: 50, T: 7.0, g: (r) => { const p = r.pick([5, 15, 30, 40, 60, 75]); const base = 20 * ri(r, 3, 40); return [`${p}% of ${base}`, (base * p) / 100]; } },
  { min: 32, max: 50, T: 8.5, g: (r) => { const a = ri(r, 101, 499), b = ri(r, 3, 9); return [`${a} × ${b}`, a * b]; } },
  { min: 34, max: 50, T: 8.0, g: (r) => { const n = ri(r, 26, 60); return [`${n}²`, n * n]; } },
  { min: 36, max: 50, T: 13, g: (r) => { const a = ri(r, 21, 99), b = ri(r, 21, 99); return [`${a} × ${b}`, a * b]; } },
  { min: 38, max: 50, T: 10, g: (r) => { const a = ri(r, 6, 19), b = ri(r, 4, 12); const c = ri(r, 11, Math.min(99, a * b - 1)); return r.chance(0.5) ? [`${a} × ${b} + ${c}`, a * b + c] : [`${a} × ${b} − ${c}`, a * b - c]; } },
];

export function genArith(L, rng) {
  const pool = ARITH.filter((t) => L >= t.min && L < t.max + 1);
  const t = rng.pick(pool);
  const [text, answer] = t.g(rng);
  return { text, answer, T: t.T * 1000 };
}

// ---------- Falling blocks ----------
const falling = {
  id: 'falling', skill: 'math', name: 'Falling blocks', mode: 'sprint',
  howto: 'Type the answer before the block hits the floor.',
  async run(api) {
    api.el.innerHTML = `<div class="fall-well"><div class="fall-floor"></div></div>
      <div class="answer-line"><span class="answer-val"></span></div><div class="pad-host"></div>`;
    const well = api.el.querySelector('.fall-well');
    const asker = makeAsker(api, api.el.querySelector('.pad-host'), api.el.querySelector('.answer-val'));
    let streak = 0;
    while (!api.done) {
      const L = api.level();
      const p = genArith(L, api.rng);
      const fallMs = p.T * 2.6 * clamp(1 - streak * 0.025, 0.75, 1);
      const block = document.createElement('div');
      block.className = 'fall-block';
      block.textContent = p.text;
      well.appendChild(block);
      const start = api.now();
      let live = true;
      const step = () => {
        if (!live || api.over) return;
        const t = Math.min(1, (api.now() - start) / fallMs);
        const H = Math.max(0, well.clientHeight - block.offsetHeight - 10);
        block.style.transform = `translate(-50%, ${t * H}px)`;
        block.classList.toggle('danger', t > 0.7);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      const res = await asker.ask(p.answer, fallMs);
      live = false;
      if (!res) break;
      const ms = api.now() - start;
      api.report({ correct: res.correct, ms, expectedMs: p.T, level: L, q: p.text, a: p.answer, given: res.given });
      if (res.correct) { streak++; block.classList.add('pop'); }
      else { streak = 0; block.classList.add('crash'); api.reveal(`${p.text} = ${fmt(p.answer)}`, 900); }
      await api.wait(res.correct ? 200 : 950);
      block.remove();
    }
  },
};

// ---------- Higher or lower ----------
export function genPair(L, rng) {
  const A = genArith(L, rng);
  const gap = 0.5 * (1 - L / 55) + 0.03;
  let B = null;
  for (let i = 0; i < 60 && !B; i++) {
    const c = genArith(L, rng);
    const d = Math.abs(c.answer - A.answer) / Math.max(1, Math.abs(A.answer));
    if (c.answer !== A.answer && d <= gap && c.text !== A.text) B = c;
  }
  if (!B || rng.chance(L < 15 ? 0.3 : 0.15)) {
    const delta = Math.max(1, Math.round(Math.abs(A.answer) * gap * rng.float(0.2, 1)));
    const v = A.answer + (rng.chance(0.5) ? delta : -delta);
    B = { text: fmt(v), answer: v, T: 1000 };
  }
  const pair = rng.chance(0.5) ? [A, B] : [B, A];
  return { pair, bigger: pair[0].answer > pair[1].answer ? 0 : 1, T: Math.max(1800, (A.T + B.T) * 0.55) };
}

const higherlower = {
  id: 'higherlower', skill: 'math', name: 'Higher or lower', mode: 'sprint',
  howto: 'Two sums. Tap the one with the bigger result.',
  async run(api) {
    api.el.innerHTML = `<p class="game-prompt">Which is bigger?</p>
      <div class="hl-pair"><button class="hl-card"></button><div class="hl-vs">or</div><button class="hl-card"></button></div>`;
    const cards = [...api.el.querySelectorAll('.hl-card')];
    while (!api.done) {
      const L = api.level();
      const { pair, bigger, T } = genPair(L, api.rng);
      cards.forEach((c, i) => { c.textContent = pair[i].text; c.className = 'hl-card in'; });
      const start = api.now();
      const pick = await waitTap(api, cards, api.cutoff(T));
      if (pick === -2) break;
      const ok = pick === bigger;
      api.report({ correct: ok, ms: api.now() - start, expectedMs: T, level: L, q: `${pair[0].text} vs ${pair[1].text}`, a: pair[bigger].text, given: pick >= 0 ? pair[pick].text : '' });
      cards.forEach((c, i) => c.classList.add(i === bigger ? 'right' : 'wrong'));
      if (!ok) api.reveal(`${pair[0].text} = ${fmt(pair[0].answer)}, ${pair[1].text} = ${fmt(pair[1].answer)}`);
      await api.wait(ok ? 260 : 1100);
    }
  },
};

// ---------- Chain ----------
export function genChain(L, rng) {
  const steps = clamp(2 + Math.floor(L / 8), 2, 8);
  const limit = L < 15 ? 50 : L < 30 ? 150 : 500;
  let v = L < 15 ? ri(rng, 2, 9) : ri(rng, 5, 30);
  const start = v;
  const ops = [];
  for (let i = 0; i < steps; i++) {
    const opts = [];
    const addMax = L < 15 ? 9 : L < 30 ? 30 : 60;
    const n = ri(rng, L < 15 ? 1 : 5, addMax);
    if (v + n <= limit) opts.push(['+', n, v + n]);
    const m = ri(rng, L < 15 ? 1 : 5, addMax);
    if (v - m >= 0) opts.push(['−', m, v - m]);
    if (L >= 8) { const k = ri(rng, 2, L < 25 ? 4 : 9); if (v * k <= limit && v > 0) opts.push(['×', k, v * k]); }
    if (L >= 12) { const ds = [2, 3, 4, 5, 6, 7, 8, 9].filter((d) => v > d && v % d === 0); if (ds.length) { const d = rng.pick(ds); opts.push(['÷', d, v / d]); } }
    if (!opts.length) opts.push(['+', 1, v + 1]);
    const [op, num, nv] = rng.pick(opts);
    ops.push(`${op} ${num}`); v = nv;
  }
  return { start, ops, answer: v, stepMs: Math.max(800, 1900 - L * 22), T: 3500 + steps * 150 };
}

const chain = {
  id: 'chain', skill: 'math', name: 'Chain', mode: 'sprint',
  howto: 'Keep a running total in your head, one step at a time.',
  async run(api) {
    api.el.innerHTML = `<div class="chain-stage"><div class="chain-dots"></div><div class="chain-card"></div></div>
      <div class="answer-line"><span class="answer-val"></span></div><div class="pad-host"></div>`;
    const card = api.el.querySelector('.chain-card');
    const dots = api.el.querySelector('.chain-dots');
    const padHost = api.el.querySelector('.pad-host');
    const asker = makeAsker(api, padHost, api.el.querySelector('.answer-val'));
    asker.pad.enable(false);
    const show = (html, cls = '') => { card.className = `chain-card ${cls}`; card.innerHTML = html; void card.offsetWidth; card.classList.add('in'); };
    while (!api.done) {
      const L = api.level();
      const c = genChain(L, api.rng);
      dots.innerHTML = c.ops.map(() => '<i></i>').join('');
      asker.pad.enable(false);
      show(`<small>Start with</small><b>${c.start}</b>`);
      if (!(await api.wait(c.stepMs))) break;
      let alive = true;
      for (let i = 0; i < c.ops.length; i++) {
        show(`<b>${c.ops[i]}</b>`, 'op');
        dots.children[i].classList.add('on');
        if (!(await api.wait(c.stepMs))) { alive = false; break; }
      }
      if (!alive) break;
      show('<b>= ?</b>', 'ask');
      const start = api.now();
      const res = await asker.ask(c.answer, api.cutoff(c.T));
      asker.pad.enable(false);
      if (!res) break;
      api.report({ correct: res.correct, ms: api.now() - start, expectedMs: c.T, level: L, q: `${c.start} ${c.ops.join(' ')}`, a: c.answer, given: res.given });
      if (res.correct) show(`<b>${c.answer}</b>`, 'right');
      else { show(`<b>${c.answer}</b>`, 'wrong'); api.reveal(`The total was ${c.answer}`); }
      await api.wait(res.correct ? 450 : 1100);
    }
  },
};

// ---------- Hit the target ----------
function exprEqual(t, L, rng) {
  const forms = [];
  if (t >= 2) { const a = ri(rng, 1, t - 1); forms.push(`${a} + ${t - a}`); }
  { const b = ri(rng, 1, L < 15 ? 9 : Math.max(9, t)); forms.push(`${t + b} − ${b}`); }
  const fs = [];
  for (let f = 2; f * f <= t; f++) if (t % f === 0) fs.push(f);
  if (fs.length && L >= 5) { const f = rng.pick(fs); forms.push(rng.chance(0.5) ? `${f} × ${t / f}` : `${t / f} × ${f}`); }
  if (L >= 10) { const b = ri(rng, 2, 9); forms.push(`${t * b} ÷ ${b}`); }
  if (L >= 25) {
    const a = ri(rng, 2, 9); const bMax = Math.floor((t - 1) / a);
    if (bMax >= 2) { const b = ri(rng, 2, bMax); forms.push(`${a} × ${b} + ${t - a * b}`); }
  }
  return rng.pick(forms);
}

export function genTarget(L, rng) {
  const t = L < 10 ? ri(rng, 6, 20) : L < 25 ? ri(rng, 12, 60) : ri(rng, 24, 150);
  const k = L < 15 ? 3 : rng.pick([2, 3, 4]);
  const cells = []; const seen = new Set();
  let guard = 0;
  while (cells.length < k && guard++ < 200) { const e = exprEqual(t, L, rng); if (!seen.has(e)) { seen.add(e); cells.push({ text: e, hit: true }); } }
  const deltas = L < 20 ? [-3, -2, -1, 1, 2, 3, 10, -10] : [-2, -1, 1, 2, -10, 10];
  guard = 0;
  while (cells.length < 9 && guard++ < 400) {
    const v = t + rng.pick(deltas);
    if (v < 2) continue;
    const e = exprEqual(v, L, rng);
    if (!seen.has(e)) { seen.add(e); cells.push({ text: e, hit: false }); }
  }
  return { target: t, cells: rng.shuffle(cells), k: cells.filter((c) => c.hit).length, T: cells.filter((c) => c.hit).length * 2200 + 3000 + L * 60 };
}

const target = {
  id: 'target', skill: 'math', name: 'Hit the target', mode: 'sprint',
  howto: 'Tap every sum that equals the target. One wrong tap ends the grid.',
  async run(api) {
    api.el.innerHTML = `<div class="tg-head"><div class="tg-ring"><span class="tg-num"></span></div><div class="tg-left"></div></div><div class="tg-grid"></div>`;
    const num = api.el.querySelector('.tg-num');
    const left = api.el.querySelector('.tg-left');
    const grid = api.el.querySelector('.tg-grid');
    while (!api.done) {
      const L = api.level();
      const g = genTarget(L, api.rng);
      num.textContent = g.target;
      grid.innerHTML = g.cells.map((c, i) => `<button class="tg-cell" data-i="${i}">${c.text}</button>`).join('');
      const btns = [...grid.children];
      let found = 0; const start = api.now();
      left.textContent = `${g.k} to find`;
      const result = await new Promise((resolve) => {
        let done = false;
        const end = (v) => { if (!done) { done = true; btns.forEach((b) => { b.onpointerdown = null; }); resolve(v); } };
        btns.forEach((b, i) => {
          b.onpointerdown = (e) => {
            e.preventDefault();
            if (b.classList.contains('hit')) return;
            if (g.cells[i].hit) {
              b.classList.add('hit'); found++;
              left.textContent = found < g.k ? `${g.k - found} to find` : 'All found';
              if (found === g.k) end('ok');
            } else { b.classList.add('miss'); end('wrong'); }
          };
        });
        api.onOver(() => end('over'));
        api.wait(api.cutoff(g.T)).then((alive) => end(alive ? 'timeout' : 'over'));
      });
      if (result === 'over') break;
      const ok = result === 'ok';
      api.report({ correct: ok, ms: api.now() - start, expectedMs: g.T, level: L, q: `target ${g.target}`, a: g.k, given: found });
      if (!ok) {
        btns.forEach((b, i) => { if (g.cells[i].hit && !b.classList.contains('hit')) b.classList.add('show'); });
        api.reveal(result === 'timeout' ? 'Time ran out on this grid' : `That one isn't ${g.target}`);
      }
      await api.wait(ok ? 350 : 1200);
    }
  },
};

// ---------- Estimate ----------
function niceCeil(x) {
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= x) return m * mag;
  return 10 * mag;
}

export function genEstimate(L, rng) {
  let text, answer;
  if (L < 15) { const a = ri(rng, 21, 99), b = ri(rng, 3, 9); text = `${a} × ${b}`; answer = a * b; }
  else if (L < 30) { const a = ri(rng, 21, 99), b = ri(rng, 21, 99); text = `${a} × ${b}`; answer = a * b; }
  else if (L < 40) { const a = ri(rng, 120, 999), b = ri(rng, 12, 99); text = `${a} × ${b}`; answer = a * b; }
  else if (rng.chance(0.5)) { const a = ri(rng, 1200, 9999), b = ri(rng, 3, 9); text = `${fmt(a)} ÷ ${b}`; answer = a / b; }
  else { const p = ri(rng, 11, 89), base = ri(rng, 1200, 9999); text = `${p}% of ${fmt(base)}`; answer = (p * base) / 100; }
  const max = niceCeil(answer * rng.float(1.45, 2.2));
  const tol = 0.22 - (clamp(L, 1, 50) / 50) * 0.15;
  return { text, answer, max, tol, T: 6500 + L * 40 };
}

const estimate = {
  id: 'estimate', skill: 'math', name: 'Estimate', mode: 'sprint',
  howto: 'No exact answer needed. Slide to your best guess and lock it in.',
  async run(api) {
    api.el.innerHTML = `<div class="est-q"></div><div class="est-tol"></div>
      <div class="est-guess"></div>
      <div class="est-line"><input type="range" class="est-range" min="0" max="1000" step="1" aria-label="Your estimate"><div class="est-true"></div>
      <div class="est-ticks"><span>0</span><span class="est-mid"></span><span class="est-max"></span></div></div>
      <button class="btn btn-skill est-lock">Lock it in</button>`;
    const q = api.el.querySelector('.est-q');
    const tolEl = api.el.querySelector('.est-tol');
    const guessEl = api.el.querySelector('.est-guess');
    const range = api.el.querySelector('.est-range');
    const trueEl = api.el.querySelector('.est-true');
    const lock = api.el.querySelector('.est-lock');
    while (!api.done) {
      const L = api.level();
      const e = genEstimate(L, api.rng);
      q.textContent = `${e.text} ≈ ?`;
      tolEl.textContent = `Within ${Math.round(e.tol * 100)}% counts`;
      api.el.querySelector('.est-mid').textContent = fmt(e.max / 2);
      api.el.querySelector('.est-max').textContent = fmt(e.max);
      range.value = 500; trueEl.style.opacity = 0; range.disabled = false;
      const val = () => (Number(range.value) / 1000) * e.max;
      const step = niceCeil(e.max / 200);
      const show = () => { guessEl.textContent = fmt(Math.round(val() / step) * step); };
      range.oninput = show; show();
      const start = api.now();
      const r = await waitTap(api, [lock], api.cutoff(e.T));
      if (r === -2) break;
      range.disabled = true;
      const g = val();
      const err = Math.abs(g - e.answer) / e.answer;
      const ok = r === 0 && err <= e.tol;
      trueEl.style.left = `${clamp(e.answer / e.max, 0, 1) * 100}%`;
      trueEl.style.opacity = 1;
      api.report({ correct: ok, ms: api.now() - start, expectedMs: e.T, level: L, q: e.text, a: Math.round(e.answer), given: Math.round(g) });
      const exact = fmt(Math.round(e.answer));
      if (ok) api.good(`Exact: ${exact}. You were ${Math.round(err * 100)}% off`, 1100);
      else api.reveal(r === -1 ? `Time's up. Exact: ${exact}` : `Exact: ${exact}. You were ${Math.round(err * 100)}% off`, 1400);
      await api.wait(ok ? 1100 : 1500);
    }
  },
};

export const mathGames = [falling, higherlower, chain, target, estimate];
