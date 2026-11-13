// Logic: Sequences, Odd one out, Balance scales, Pattern grid, True or false.

import { clamp } from '../rating.js';
import { waitTap, esc } from '../ui.js';
import { makeAsker, ri } from './common.js';
import { glyph, SHAPES, COLORS, FILLS, SIZES, glyphKey } from './shapes.js';

// ---------- Sequences ----------
const P = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79];
const SEQ = [
  { min: 1, max: 14, T: 5, rule: 'add', g: (r) => { const d = ri(r, 2, 9) * (r.chance(0.25) ? -1 : 1); const a = d < 0 ? ri(r, 1, 20) + 6 * -d : ri(r, 1, 20); return Array.from({ length: 6 }, (_, i) => a + i * d); } },
  { min: 8, max: 24, T: 7, rule: 'multiply', g: (r) => { const q = r.pick([2, 3]); const a = ri(r, 1, q === 2 ? 6 : 3); return Array.from({ length: 6 }, (_, i) => a * q ** i); } },
  { min: 10, max: 26, T: 7, rule: 'squares', g: (r) => { const k = ri(r, 1, 7), c = r.pick([0, 0, 1, -1, 2]); return Array.from({ length: 6 }, (_, i) => (k + i) ** 2 + c); } },
  { min: 14, max: 34, T: 9, rule: 'growing steps', g: (r) => { const a = ri(r, 1, 15), d = ri(r, 1, 5), inc = ri(r, 1, 3); const o = [a]; for (let i = 0; i < 5; i++) o.push(o[i] + d + i * inc); return o; } },
  { min: 16, max: 34, T: 9, rule: 'up, down', g: (r) => { const a = ri(r, 20, 40), up = ri(r, 3, 9), dn = ri(r, 1, up - 1); const o = [a]; for (let i = 0; i < 5; i++) o.push(o[i] + (i % 2 === 0 ? up : -dn)); return o; } },
  { min: 18, max: 40, T: 10, rule: 'sum of previous two', g: (r) => { const o = [ri(r, 1, 6), ri(r, 2, 9)]; while (o.length < 6) o.push(o.at(-1) + o.at(-2)); return o; } },
  { min: 24, max: 44, T: 12, rule: 'two interleaved', g: (r) => { const a = ri(r, 1, 9), b = ri(r, 20, 40), da = ri(r, 2, 6), db = -ri(r, 1, 4); return Array.from({ length: 7 }, (_, i) => (i % 2 === 0 ? a + (i / 2) * da : b + ((i - 1) / 2) * db)); } },
  { min: 26, max: 50, T: 12, rule: 'multiply then add', g: (r) => { const k = r.pick([2, 3]), c = r.pick([-1, 1, 2, 3, -2]); const o = [ri(r, 3, 6)]; while (o.length < 6) o.push(o.at(-1) * k + c); return o; } },
  { min: 30, max: 50, T: 12, rule: 'cubes', g: (r) => { const k = ri(r, 1, 4); return Array.from({ length: 5 }, (_, i) => (k + i) ** 3); } },
  { min: 30, max: 50, T: 13, rule: 'primes', g: (r) => { const s = ri(r, 0, P.length - 6); return P.slice(s, s + 6); } },
  { min: 36, max: 50, T: 15, rule: 'doubling steps', g: (r) => { const a = ri(r, 1, 10), d = ri(r, 1, 3); const o = [a]; for (let i = 0; i < 5; i++) o.push(o[i] + d * 2 ** i); return o; } },
  { min: 40, max: 50, T: 15, rule: 'triangle numbers', g: (r) => { const c = ri(r, 0, 5), k = ri(r, 1, 4); return Array.from({ length: 6 }, (_, i) => ((k + i) * (k + i + 1)) / 2 + c); } },
  { min: 40, max: 50, T: 15, rule: '×2, −3', g: (r) => { const o = [ri(r, 4, 8)]; while (o.length < 7) o.push(o.length % 2 ? o.at(-1) * 2 : o.at(-1) - 3); return o; } },
];

export function genSequence(L, rng) {
  const pool = SEQ.filter((t) => L >= t.min && L < t.max + 1);
  for (let i = 0; i < 30; i++) {
    const t = rng.pick(pool);
    const terms = t.g(rng);
    const bad = terms.some((v, k) => !Number.isInteger(v) || (k > 0 && v === terms[k - 1]));
    if (bad) continue;
    return { shown: terms.slice(0, -1), answer: terms.at(-1), rule: t.rule, T: t.T * 1000 };
  }
  return { shown: [2, 4, 6, 8, 10], answer: 12, rule: 'add', T: 5000 };
}

const sequence = {
  id: 'sequence', skill: 'logic', name: 'Sequences', mode: 'sprint',
  howto: 'Find the rule and type the next number.',
  async run(api) {
    api.el.innerHTML = `<p class="game-prompt">What comes next?</p><div class="seq-row"></div>
      <div class="answer-line"><span class="answer-val"></span></div><div class="pad-host"></div>`;
    const row = api.el.querySelector('.seq-row');
    const asker = makeAsker(api, api.el.querySelector('.pad-host'), api.el.querySelector('.answer-val'));
    while (!api.done) {
      const L = api.level();
      const s = genSequence(L, api.rng);
      row.innerHTML = s.shown.map((v) => `<span class="seq-chip">${v}</span>`).join('') + '<span class="seq-chip q">?</span>';
      const start = api.now();
      const res = await asker.ask(s.answer, api.cutoff(s.T));
      if (!res) break;
      api.report({ correct: res.correct, ms: api.now() - start, expectedMs: s.T, level: L, q: s.shown.join(','), a: s.answer, given: res.given });
      const q = row.querySelector('.q'); q.textContent = s.answer; q.classList.add(res.correct ? 'right' : 'wrong');
      if (!res.correct) api.reveal(`${s.answer}. Rule: ${s.rule}`, 1400);
      await api.wait(res.correct ? 350 : 1400);
    }
  },
};

// ---------- Odd one out ----------
const ODD_ATTRS = { shape: SHAPES.slice(0, 5), color: COLORS.slice(0, 5), size: SIZES, fill: FILLS, count: [1, 2, 3] };
const PATTERNS = { 4: [0, 0, 1, 1], 5: [0, 0, 1, 1, 1], 6: [0, 0, 1, 1, 2, 2] };

export function genOddOne(L, rng) {
  const n = L < 15 ? 4 : L < 30 ? 5 : 6;
  const nd = L < 8 ? 0 : L < 20 ? 1 : L < 35 ? 2 : 3;
  const keys = rng.shuffle(Object.keys(ODD_ATTRS));
  const rule = keys[0];
  const dist = keys.slice(1, 1 + nd);
  const items = Array.from({ length: n }, () => ({}));
  for (const k of keys.slice(1 + nd)) { const v = rng.pick(ODD_ATTRS[k]); items.forEach((it) => { it[k] = v; }); }
  const [v, w] = rng.sample(ODD_ATTRS[rule], 2);
  const odd = ri(rng, 0, n - 1);
  items.forEach((it, i) => { it[rule] = i === odd ? w : v; });
  for (const k of dist) {
    const vals = rng.sample(ODD_ATTRS[k], 3);
    const pat = rng.shuffle(PATTERNS[n]);
    items.forEach((it, i) => { it[k] = vals[pat[i]]; });
  }
  return { items, odd, rule, T: 3000 + nd * 1500 + n * 300 };
}

const oddone = {
  id: 'oddone', skill: 'logic', name: 'Odd one out', mode: 'sprint',
  howto: 'All shapes but one share a rule. Tap the one that breaks it.',
  async run(api) {
    api.el.innerHTML = `<p class="game-prompt">Tap the odd one out</p><div class="odd-grid"></div>`;
    const gridEl = api.el.querySelector('.odd-grid');
    while (!api.done) {
      const L = api.level();
      const g = genOddOne(L, api.rng);
      gridEl.dataset.n = g.items.length;
      gridEl.innerHTML = g.items.map((it) => `<button class="odd-cell">${glyph(it)}</button>`).join('');
      const cells = [...gridEl.children];
      const start = api.now();
      const t = await waitTap(api, cells, api.cutoff(g.T));
      if (t === -2) break;
      const ok = t === g.odd;
      cells[g.odd].classList.add('right');
      if (t >= 0 && !ok) cells[t].classList.add('bad');
      api.report({ correct: ok, ms: api.now() - start, expectedMs: g.T, level: L, q: g.rule, a: g.odd, given: t });
      if (!ok) api.reveal(`The odd one differs in ${g.rule === 'fill' ? 'fill style' : g.rule}`, 1200);
      await api.wait(ok ? 350 : 1300);
    }
  },
};

// ---------- Balance scales ----------
const TOKENS = [
  { l: 'A', c: '#FF4D5E' }, { l: 'B', c: '#2F6BFF' }, { l: 'C', c: '#FFB400' },
  { l: 'D', c: '#12B57A' }, { l: 'E', c: '#8A5CF6' }, { l: 'F', c: '#172033' },
];

export function genScales(L, rng) {
  const k = L < 10 ? 3 : L < 22 ? 4 : L < 36 ? 5 : 6;
  const items = rng.sample(TOKENS, k);
  const order = rng.shuffle(items); // order[0] is heaviest
  const clues = [];
  for (let i = 0; i < k - 1; i++) clues.push([order[i], order[i + 1]]);
  if (L >= 20) {
    const extra = L >= 36 ? 2 : 1;
    for (let e = 0; e < extra; e++) {
      const i = ri(rng, 0, k - 3), j = ri(rng, i + 2, k - 1);
      clues.push([order[i], order[j]]);
    }
  }
  const qs = [['heaviest', 0], ['lightest', k - 1]];
  if (L >= 15 && k >= 4) qs.push(['second heaviest', 1], ['second lightest', k - 2]);
  const [question, idx] = rng.pick(qs);
  return {
    items: rng.shuffle(items),
    clues: rng.shuffle(clues).map(([heavy, light]) => (rng.chance(0.5) ? { left: heavy, right: light, tilt: 'left' } : { left: light, right: heavy, tilt: 'right' })),
    question, answer: order[idx],
    T: 2500 + k * 1800 + (question.startsWith('second') ? 1500 : 0),
  };
}

function scaleSVG({ left, right, tilt }) {
  const a = tilt === 'left' ? -11 : 11;
  const token = (t, x) => `<g transform="translate(${x} 0)"><circle cx="0" cy="-17" r="15" fill="${t.c}"/><text x="0" y="-11.5" text-anchor="middle" font-size="16" font-weight="700" fill="#fff" font-family="Fredoka, sans-serif">${t.l}</text></g>`;
  return `<svg viewBox="0 0 160 92" class="scale-svg" aria-label="${tilt === 'left' ? left.l : right.l} is heavier than ${tilt === 'left' ? right.l : left.l}">
    <polygon points="80,58 68,84 92,84" fill="#C9D1E0"/>
    <g transform="rotate(${a} 80 56)">
      <rect x="18" y="53" width="124" height="6" rx="3" fill="#172033"/>
      <rect x="20" y="51" width="34" height="5" rx="2.5" fill="#5B6478"/>
      <rect x="106" y="51" width="34" height="5" rx="2.5" fill="#5B6478"/>
      <g transform="translate(0 51)">${token(left, 37)}${token(right, 123)}</g>
    </g></svg>`;
}

const scales = {
  id: 'scales', skill: 'logic', name: 'Balance scales', mode: 'sprint',
  howto: 'Each scale tips toward the heavier ball. Combine the clues to answer.',
  async run(api) {
    api.el.innerHTML = `<div class="sc-clues"></div><p class="game-prompt sc-q"></p><div class="sc-opts"></div>`;
    const cluesEl = api.el.querySelector('.sc-clues');
    const qEl = api.el.querySelector('.sc-q');
    const opts = api.el.querySelector('.sc-opts');
    while (!api.done) {
      const L = api.level();
      const g = genScales(L, api.rng);
      cluesEl.innerHTML = g.clues.map((c) => `<div class="sc-clue">${scaleSVG(c)}</div>`).join('');
      cluesEl.dataset.n = g.clues.length;
      qEl.innerHTML = `Which ball is <b>${g.question}</b>?`;
      opts.innerHTML = g.items.map((t) => `<button class="sc-opt" style="--t:${t.c}">${t.l}</button>`).join('');
      const btns = [...opts.children];
      const start = api.now();
      const t = await waitTap(api, btns, api.cutoff(g.T));
      if (t === -2) break;
      const ok = t >= 0 && g.items[t] === g.answer;
      btns[g.items.indexOf(g.answer)].classList.add('right');
      if (t >= 0 && !ok) btns[t].classList.add('bad');
      api.report({ correct: ok, ms: api.now() - start, expectedMs: g.T, level: L, q: g.question, a: g.answer.l, given: t >= 0 ? g.items[t].l : '' });
      if (!ok) api.reveal(`${g.answer.l} is the ${g.question}`, 1200);
      await api.wait(ok ? 400 : 1300);
    }
  },
};

// ---------- Pattern grid ----------
const PAT_DOMAIN = { shape: SHAPES, color: COLORS.slice(0, 5), count: [1, 2, 3], fill: FILLS };

export function genPattern(L, rng) {
  const m = L < 10 ? 1 : L < 22 ? 2 : 3;
  const attrPool = L >= 40 ? ['shape', 'color', 'count', 'fill'] : ['shape', 'color', 'count'];
  const varying = rng.sample(attrPool, m);
  const types = L < 22 ? ['row', 'col'] : ['row', 'col', 'latin'];
  const spec = {};
  for (const a of ['shape', 'color', 'count', 'fill']) {
    const vals = rng.sample(PAT_DOMAIN[a], 3);
    if (a === 'fill' && !varying.includes('fill')) { spec[a] = { type: 'const', vals: ['solid'] }; continue; }
    spec[a] = { type: varying.includes(a) ? rng.pick(types) : 'const', vals, dir: rng.pick([1, 2]), shift: ri(rng, 0, 2) };
  }
  if (L >= 30 && !varying.some((a) => spec[a].type === 'latin')) spec[varying[0]].type = 'latin';
  const val = (a, r, c) => {
    const s = spec[a];
    if (s.type === 'const') return s.vals[0];
    if (s.type === 'row') return s.vals[r];
    if (s.type === 'col') return s.vals[c];
    return s.vals[(r + c * s.dir + s.shift) % 3];
  };
  const cells = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push({ shape: val('shape', r, c), color: val('color', r, c), count: val('count', r, c), fill: val('fill', r, c), size: 1 });
  const answer = cells[8];
  const nOpts = L < 20 ? 4 : 6;
  const seen = new Set([glyphKey(answer)]);
  const options = [answer];
  const mutate = (g, a) => {
    const inGrid = [...new Set(cells.slice(0, 8).map((x) => x[a]))].filter((v) => v !== g[a]);
    const pool = inGrid.length && rng.chance(0.7) ? inGrid : PAT_DOMAIN[a].filter((v) => v !== g[a]);
    return { ...g, [a]: rng.pick(pool) };
  };
  let guard = 0;
  while (options.length < nOpts && guard++ < 300) {
    const a1 = rng.pick(guard < 40 ? varying : ['shape', 'color', 'count']);
    let g = mutate(answer, a1);
    if (guard > 20 && rng.chance(0.5)) g = mutate(g, rng.pick(['shape', 'color', 'count']));
    const key = glyphKey(g);
    if (!seen.has(key)) { seen.add(key); options.push(g); }
  }
  const shuffled = rng.shuffle(options);
  return { cells, options: shuffled, answerIdx: shuffled.indexOf(answer), rules: varying.map((a) => `${a}: ${spec[a].type}`), T: 5000 + m * 3000 };
}

const pattern = {
  id: 'pattern', skill: 'logic', name: 'Pattern grid', mode: 'sprint',
  howto: 'Each row and column follows a rule. Pick the tile that completes the grid.',
  async run(api) {
    api.el.innerHTML = `<div class="pt-grid"></div><div class="pt-opts"></div>`;
    const gridEl = api.el.querySelector('.pt-grid');
    const optsEl = api.el.querySelector('.pt-opts');
    while (!api.done) {
      const L = api.level();
      const g = genPattern(L, api.rng);
      gridEl.innerHTML = g.cells.map((c, i) => `<div class="pt-cell ${i === 8 ? 'q' : ''}">${i === 8 ? '?' : glyph(c)}</div>`).join('');
      optsEl.dataset.n = g.options.length;
      optsEl.innerHTML = g.options.map((o) => `<button class="pt-opt">${glyph(o)}</button>`).join('');
      const btns = [...optsEl.children];
      const start = api.now();
      const t = await waitTap(api, btns, api.cutoff(g.T));
      if (t === -2) break;
      const ok = t === g.answerIdx;
      btns[g.answerIdx].classList.add('right');
      if (t >= 0 && !ok) btns[t].classList.add('bad');
      gridEl.lastElementChild.innerHTML = glyph(g.cells[8]);
      gridEl.lastElementChild.classList.add(ok ? 'right' : 'wrong');
      api.report({ correct: ok, ms: api.now() - start, expectedMs: g.T, level: L, q: g.rules.join('; '), a: g.answerIdx, given: t });
      if (!ok) api.reveal('Check each row and column for the rule', 1200);
      await api.wait(ok ? 500 : 1500);
    }
  },
};

// ---------- True or false ----------
const NOUNS = ['blips', 'zorgs', 'flens', 'wumps', 'trels', 'gorbs', 'plinks', 'dravs', 'snurfs', 'quibs', 'morls', 'vonks', 'yibs', 'kreels', 'tazzes', 'brols'];
const NAMES = ['Ana', 'Bram', 'Cas', 'Dina', 'Eli', 'Femke', 'Jonas', 'Lotte', 'Milan', 'Noor', 'Ruben', 'Sara'];
const RELS = [['taller than', 'shorter than'], ['older than', 'younger than'], ['faster than', 'slower than']];

// Each template: min level, valid?, and a builder. Words are made up so that
// only the logic counts, not what you know about the world.
const TF = [
  { min: 1, v: true, f: (A, B, C) => [[`All ${A} are ${B}.`, `All ${B} are ${C}.`], `All ${A} are ${C}.`] },
  { min: 1, v: true, f: (A, B) => [[`Some ${A} are ${B}.`], `Some ${B} are ${A}.`] },
  { min: 1, v: false, f: (A, B) => [[`All ${A} are ${B}.`], `All ${B} are ${A}.`] },
  { min: 1, v: true, f: (A, B) => [[`No ${A} are ${B}.`], `No ${B} are ${A}.`] },
  { min: 1, rel: true, v: true, f: (X, Y, Z, r) => [[`${X} is ${r[0]} ${Y}.`, `${Y} is ${r[0]} ${Z}.`], `${X} is ${r[0]} ${Z}.`] },
  { min: 12, v: false, f: (A, B, C) => [[`All ${A} are ${B}.`, `All ${B} are ${C}.`], `All ${C} are ${A}.`] },
  { min: 12, v: true, f: (A, B, C) => [[`No ${A} are ${B}.`, `All ${C} are ${A}.`], `No ${C} are ${B}.`] },
  { min: 12, v: true, f: (A, B, C) => [[`All ${A} are ${B}.`, `No ${B} are ${C}.`], `No ${A} are ${C}.`] },
  { min: 12, v: true, f: (A, B, C) => [[`All ${A} are ${B}.`, `No ${C} are ${B}.`], `No ${C} are ${A}.`] },
  { min: 12, rel: true, v: true, f: (X, Y, Z, r) => [[`${X} is ${r[0]} ${Y}.`, `${Z} is ${r[1]} ${Y}.`], `${X} is ${r[0]} ${Z}.`] },
  { min: 12, rel: true, v: false, f: (X, Y, Z, r) => [[`${X} is ${r[0]} ${Y}.`, `${Z} is ${r[0]} ${Y}.`], `${X} is ${r[0]} ${Z}.`] },
  { min: 25, v: false, f: (A, B, C) => [[`All ${A} are ${B}.`, `Some ${B} are ${C}.`], `Some ${A} are ${C}.`] },
  { min: 25, v: true, f: (A, B, C) => [[`Some ${A} are ${B}.`, `All ${B} are ${C}.`], `Some ${A} are ${C}.`] },
  { min: 25, v: false, f: (A, B, C) => [[`Some ${A} are ${B}.`, `Some ${B} are ${C}.`], `Some ${A} are ${C}.`] },
  { min: 25, v: true, f: (A, B, C) => [[`All ${A} are ${B}.`, `Some ${C} are ${A}.`], `Some ${C} are ${B}.`] },
  { min: 25, v: true, f: (A, B, C) => [[`No ${A} are ${B}.`, `Some ${C} are ${B}.`], `Some ${C} are not ${A}.`] },
  { min: 25, v: true, f: (A, B, C) => [[`All ${A} are ${B}.`, `Some ${C} are not ${B}.`], `Some ${C} are not ${A}.`] },
  { min: 25, v: false, f: (A, B, C) => [[`All ${A} are ${B}.`, `Some ${C} are not ${A}.`], `Some ${C} are not ${B}.`] },
  { min: 25, v: false, f: (A, B, C) => [[`No ${A} are ${B}.`, `No ${B} are ${C}.`], `No ${A} are ${C}.`] },
  { min: 38, v: true, f: (A, B, C, D) => [[`All ${A} are ${B}.`, `All ${B} are ${C}.`, `All ${C} are ${D}.`], `All ${A} are ${D}.`] },
  { min: 38, v: false, f: (A, B, C, D) => [[`All ${A} are ${B}.`, `All ${C} are ${B}.`, `All ${C} are ${D}.`], `All ${A} are ${D}.`] },
  { min: 38, v: true, f: (A, B, C, D) => [[`All ${A} are ${B}.`, `No ${B} are ${C}.`, `All ${D} are ${C}.`], `No ${A} are ${D}.`] },
  { min: 38, rel: true, v: true, f: (X, Y, Z, r, W) => [[`${X} is ${r[0]} ${Y}.`, `${Y} is ${r[0]} ${Z}.`, `${W} is ${r[1]} ${Z}.`], `${X} is ${r[0]} ${W}.`] },
  { min: 38, rel: true, v: false, f: (X, Y, Z, r, W) => [[`${X} is ${r[0]} ${Y}.`, `${Z} is ${r[1]} ${Y}.`, `${W} is ${r[0]} ${Z}.`], `${W} is ${r[0]} ${X}.`] },
];

export function genTrueFalse(L, rng) {
  // Draw from the newest tier more often so higher levels feel harder.
  const pool = TF.filter((t) => L >= t.min);
  const top = pool.filter((t) => t.min === Math.max(...pool.map((x) => x.min)));
  const t = rng.chance(0.55) ? rng.pick(top) : rng.pick(pool);
  let premises, conclusion;
  if (t.rel) {
    const [X, Y, Z, W] = rng.sample(NAMES, 4);
    [premises, conclusion] = t.f(X, Y, Z, rng.pick(RELS), W);
  } else {
    const [A, B, C, D] = rng.sample(NOUNS, 4);
    [premises, conclusion] = t.f(A, B, C, D);
  }
  return { premises, conclusion, valid: t.v, T: premises.length >= 3 ? 11000 : 7500 };
}

const truefalse = {
  id: 'truefalse', skill: 'logic', name: 'True or false', mode: 'sprint',
  howto: 'The words are made up. Decide whether the conclusion must follow from the facts.',
  async run(api) {
    api.el.innerHTML = `<div class="tf-card"><div class="tf-prem"></div><div class="tf-concl"></div></div>
      <div class="tf-btns"><button class="btn tf-yes">Must be true</button><button class="btn tf-no">Not necessarily</button></div>`;
    const prem = api.el.querySelector('.tf-prem');
    const concl = api.el.querySelector('.tf-concl');
    const btns = [api.el.querySelector('.tf-yes'), api.el.querySelector('.tf-no')];
    const card = api.el.querySelector('.tf-card');
    while (!api.done) {
      const L = api.level();
      const g = genTrueFalse(L, api.rng);
      prem.innerHTML = g.premises.map((p) => `<p>${esc(p)}</p>`).join('');
      concl.innerHTML = `<span>So:</span> ${esc(g.conclusion)}`;
      card.className = 'tf-card';
      const start = api.now();
      const t = await waitTap(api, btns, api.cutoff(g.T));
      if (t === -2) break;
      const ok = t >= 0 && (t === 0) === g.valid;
      card.classList.add(ok ? 'right' : 'wrong');
      api.report({ correct: ok, ms: api.now() - start, expectedMs: g.T, level: L, q: `${g.premises.join(' ')} => ${g.conclusion}`, a: g.valid ? 'true' : 'not necessarily', given: t === 0 ? 'true' : t === 1 ? 'not necessarily' : '' });
      if (!ok) api.reveal(g.valid ? 'It must be true' : 'It could be false, so not necessarily', 1300);
      await api.wait(ok ? 350 : 1400);
    }
  },
};

export const logicGames = [sequence, oddone, scales, pattern, truefalse];
