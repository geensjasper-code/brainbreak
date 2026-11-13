// Memory: Flashing squares, Number span, What changed?, Pairs, Stream (n-back).
// Every memory round ends after 3 mistakes.

import { clamp } from '../rating.js';
import { waitTap } from '../ui.js';
import { makeAsker, ri } from './common.js';
import { glyph, SHAPES, COLORS, glyphKey } from './shapes.js';

// ---------- Flashing squares ----------
export function genSquares(L, rng) {
  const n = L < 12 ? 3 : L < 30 ? 4 : 5;
  const len = clamp(3 + Math.floor((L - 1) / 6), 3, n * n - 1);
  const seq = rng.sample([...Array(n * n).keys()], len);
  return { n, seq, flashMs: Math.max(380, 650 - L * 5), T: len * 650 + 900 };
}

const squares = {
  id: 'squares', skill: 'memory', name: 'Flashing squares', mode: 'trials',
  howto: 'Watch the squares light up, then tap them in the same order.',
  async run(api) {
    api.el.innerHTML = `<p class="game-prompt sq-status">Watch</p><div class="sq-grid"></div><div class="sq-progress"></div>`;
    const status = api.el.querySelector('.sq-status');
    const gridEl = api.el.querySelector('.sq-grid');
    const prog = api.el.querySelector('.sq-progress');
    while (!api.done) {
      const L = api.level();
      const p = genSquares(L, api.rng);
      gridEl.style.setProperty('--n', p.n);
      gridEl.innerHTML = Array.from({ length: p.n * p.n }, (_, i) => `<button class="sq-cell" data-i="${i}" aria-label="Square ${i + 1}"></button>`).join('');
      const cells = [...gridEl.children];
      prog.innerHTML = p.seq.map(() => '<i></i>').join('');
      status.textContent = `Watch ${p.seq.length} squares`;
      gridEl.classList.add('locked');
      if (!(await api.wait(650))) break;
      let alive = true;
      for (const idx of p.seq) {
        cells[idx].classList.add('lit');
        if (!(await api.wait(p.flashMs))) { alive = false; break; }
        cells[idx].classList.remove('lit');
        if (!(await api.wait(170))) { alive = false; break; }
      }
      if (!alive) break;
      status.textContent = 'Your turn';
      gridEl.classList.remove('locked');
      const start = api.now();
      let pos = 0; let ok = true; let over = false;
      while (pos < p.seq.length) {
        const t = await waitTap(api, cells, api.cutoff(p.T) - (api.now() - start));
        if (t === -2) { over = true; break; }
        if (t === -1) { ok = false; break; }
        const c = cells[t];
        c.classList.remove('tap'); void c.offsetWidth; c.classList.add('tap');
        if (t !== p.seq[pos]) { ok = false; c.classList.add('bad'); cells[p.seq[pos]].classList.add('show'); break; }
        prog.children[pos].classList.add('on');
        pos++;
      }
      if (over) break;
      gridEl.classList.add('locked');
      api.report({ correct: ok, ms: api.now() - start, expectedMs: p.T, level: L, q: p.seq.join(','), a: p.seq.length, given: pos });
      status.textContent = ok ? 'Perfect' : 'Not quite';
      await api.wait(ok ? 600 : 1100);
    }
  },
};

// ---------- Number span ----------
export function genSpan(L, rng, trial) {
  const reverse = L >= 24 && trial % 2 === 1;
  let len = clamp(3 + Math.floor((L - 1) / 5), 3, 12);
  if (reverse) len = Math.max(3, len - 1);
  const digits = [];
  for (let i = 0; i < len; i++) {
    let d; do { d = ri(rng, 0, 9); } while (i > 0 && d === digits[i - 1]);
    digits.push(d);
  }
  const answerDigits = reverse ? digits.slice().reverse() : digits;
  return { digits, reverse, answer: answerDigits.join(''), flashMs: Math.max(450, 900 - L * 9), T: len * 700 + 1200 };
}

const span = {
  id: 'span', skill: 'memory', name: 'Number span', mode: 'trials',
  howto: 'Digits appear one by one. Type them back in order. Later levels ask for them backwards.',
  async run(api) {
    api.el.innerHTML = `<p class="game-prompt sp-status"></p><div class="sp-show"></div>
      <div class="answer-line sp-answer"><span class="answer-val"></span></div><div class="pad-host"></div>`;
    const status = api.el.querySelector('.sp-status');
    const show = api.el.querySelector('.sp-show');
    const ansVal = api.el.querySelector('.answer-val');
    // Numbers with leading zeros: compare as strings, not numbers.
    const asker = makeAsker(api, api.el.querySelector('.pad-host'), ansVal, { allowNeg: false });
    asker.pad.enable(false);
    let trial = 0;
    while (!api.done) {
      const L = api.level();
      const p = genSpan(L, api.rng, trial++);
      status.textContent = p.reverse ? 'Remember them, then type them backwards' : `Remember ${p.digits.length} digits`;
      status.classList.toggle('warn', p.reverse);
      asker.pad.clear(); asker.pad.enable(false);
      show.textContent = ''; show.className = 'sp-show';
      if (!(await api.wait(p.reverse ? 1300 : 700))) break;
      let alive = true;
      for (const d of p.digits) {
        show.textContent = d; show.classList.remove('in'); void show.offsetWidth; show.classList.add('in');
        if (!(await api.wait(p.flashMs))) { alive = false; break; }
        show.textContent = '';
        if (!(await api.wait(150))) { alive = false; break; }
      }
      if (!alive) break;
      show.innerHTML = p.digits.map(() => '<i></i>').join('');
      show.classList.add('dots');
      status.textContent = p.reverse ? 'Type them backwards' : 'Type them in order';
      const start = api.now();
      const res = await asker.ask(p.answer, api.cutoff(p.T));
      asker.pad.enable(false);
      if (!res) break;
      const ok = res.correct;
      api.report({ correct: ok, ms: api.now() - start, expectedMs: p.T, level: L, q: p.digits.join(''), a: p.answer, given: res.given });
      if (!ok) api.reveal(`It was ${p.answer.split('').join(' ')}`, 1300);
      await api.wait(ok ? 500 : 1300);
    }
  },
};

// ---------- What changed? ----------
export function genChanged(L, rng) {
  const N = clamp(3 + Math.floor(L / 6), 3, 11);
  const cells = Array(16).fill(null);
  const pos = rng.sample([...Array(16).keys()], N);
  for (const p of pos) cells[p] = { shape: rng.pick(SHAPES), color: rng.pick(COLORS) };
  const after = cells.map((c) => (c ? { ...c } : null));
  const kinds = L < 10 ? ['remove', 'add', 'color'] : ['remove', 'add', 'color', 'shape', 'move'];
  const kind = rng.pick(kinds);
  const filled = pos;
  const empty = [...Array(16).keys()].filter((i) => !cells[i]);
  let answers;
  if (kind === 'remove') { const i = rng.pick(filled); after[i] = null; answers = [i]; }
  else if (kind === 'add') { const i = rng.pick(empty); after[i] = { shape: rng.pick(SHAPES), color: rng.pick(COLORS) }; answers = [i]; }
  else if (kind === 'color') { const i = rng.pick(filled); after[i].color = rng.pick(COLORS.filter((c) => c !== cells[i].color)); answers = [i]; }
  else if (kind === 'shape') { const i = rng.pick(filled); after[i].shape = rng.pick(SHAPES.filter((s) => s !== cells[i].shape)); answers = [i]; }
  else { const i = rng.pick(filled), j = rng.pick(empty); after[j] = after[i]; after[i] = null; answers = [i, j]; }
  return { cells, after, answers, kind, studyMs: Math.max(1500, 4200 - L * 55), T: 3500 + N * 150 };
}

const changed = {
  id: 'changed', skill: 'memory', name: 'What changed?', mode: 'trials',
  howto: 'Study the board. When it comes back, tap the spot that changed.',
  async run(api) {
    api.el.innerHTML = `<p class="game-prompt wc-status"></p><div class="wc-timer"><i></i></div><div class="wc-grid"></div>`;
    const status = api.el.querySelector('.wc-status');
    const bar = api.el.querySelector('.wc-timer i');
    const gridEl = api.el.querySelector('.wc-grid');
    const paint = (cells) => { gridEl.innerHTML = cells.map((c, i) => `<button class="wc-cell" data-i="${i}">${c ? glyph({ ...c, fill: 'solid' }) : ''}</button>`).join(''); };
    while (!api.done) {
      const L = api.level();
      const p = genChanged(L, api.rng);
      status.textContent = 'Study the board';
      paint(p.cells);
      gridEl.classList.add('locked');
      bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth;
      bar.style.transition = `width ${p.studyMs}ms linear`; bar.style.width = '0%';
      if (!(await api.wait(p.studyMs))) break;
      gridEl.classList.add('blank');
      if (!(await api.wait(700))) break;
      paint(p.after);
      gridEl.classList.remove('blank', 'locked');
      status.textContent = 'Tap what changed';
      const cells = [...gridEl.children];
      const start = api.now();
      const t = await waitTap(api, cells, api.cutoff(p.T));
      if (t === -2) break;
      gridEl.classList.add('locked');
      const ok = p.answers.includes(t);
      if (t >= 0) cells[t].classList.add(ok ? 'right' : 'bad');
      p.answers.forEach((i) => cells[i].classList.add('show'));
      api.report({ correct: ok, ms: api.now() - start, expectedMs: p.T, level: L, q: p.kind, a: p.answers.join('/'), given: t });
      const label = { remove: 'A shape disappeared', add: 'A shape appeared', color: 'A shape changed colour', shape: 'A shape changed form', move: 'A shape moved' }[p.kind];
      if (ok) api.good(label, 800); else api.reveal(label, 1300);
      await api.wait(ok ? 800 : 1400);
    }
  },
};

// ---------- Pairs ----------
export function genPairs(L, rng) {
  const p = clamp(3 + Math.floor(L / 8), 3, 9);
  const all = [];
  for (const s of SHAPES) for (const c of COLORS) all.push({ shape: s, color: c });
  const picks = rng.sample(all, p);
  const deck = rng.shuffle([...picks, ...picks].map((g, i) => ({ ...g, key: glyphKey(g), id: i })));
  const n = deck.length;
  const cols = { 6: 3, 8: 4, 10: 5, 12: 4, 14: 4, 16: 4, 18: 6 }[n] || 4;
  return { pairs: p, deck, cols, previewMs: Math.round(Math.max(1400, p * (1100 - L * 12))), T: p * 1600 };
}

const pairs = {
  id: 'pairs', skill: 'memory', name: 'Pairs', mode: 'trials',
  howto: 'Memorise the cards before they flip, then match every pair. Each wrong match costs a life.',
  async run(api) {
    api.el.innerHTML = `<p class="game-prompt pr-status"></p><div class="wc-timer"><i></i></div><div class="pr-grid"></div>`;
    const status = api.el.querySelector('.pr-status');
    const bar = api.el.querySelector('.wc-timer i');
    const gridEl = api.el.querySelector('.pr-grid');
    while (!api.done) {
      const L = api.level();
      const p = genPairs(L, api.rng);
      gridEl.style.setProperty('--cols', p.cols);
      gridEl.innerHTML = p.deck.map((c, i) => `<button class="pr-card up" data-i="${i}"><span class="pr-face">${glyph({ ...c, fill: 'solid' })}</span></button>`).join('');
      const cards = [...gridEl.children];
      status.textContent = `Memorise ${p.pairs} pairs`;
      gridEl.classList.add('locked');
      bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth;
      bar.style.transition = `width ${p.previewMs}ms linear`; bar.style.width = '0%';
      if (!(await api.wait(p.previewMs))) break;
      cards.forEach((c) => c.classList.remove('up'));
      gridEl.classList.remove('locked');
      status.textContent = 'Find the pairs';
      const start = api.now();
      let matched = 0, misses = 0, first = -1, ended = false, failed = false;
      while (matched < p.pairs) {
        const open = cards.map((c, i) => i).filter((i) => !cards[i].classList.contains('done') && i !== first);
        const t = await waitTap(api, open.map((i) => cards[i]));
        if (t === -2) { ended = true; break; }
        const idx = open[t];
        cards[idx].classList.add('up');
        if (first < 0) { first = idx; continue; }
        const a = first; first = -1;
        if (p.deck[a].key === p.deck[idx].key) {
          cards[a].classList.add('done'); cards[idx].classList.add('done'); matched++;
        } else {
          misses++;
          cards[a].classList.add('bad'); cards[idx].classList.add('bad');
          api.mistake();
          gridEl.classList.add('locked');
          await api.wait(650);
          cards[a].classList.remove('up', 'bad'); cards[idx].classList.remove('up', 'bad');
          gridEl.classList.remove('locked');
          if (api.lives === 0) { failed = true; break; }
        }
      }
      if (ended) break;
      const ms = api.now() - start;
      if (failed) {
        cards.forEach((c) => c.classList.add('up'));
        api.report({ correct: false, ms, expectedMs: p.T, level: L, q: `${p.pairs} pairs`, a: p.pairs, given: matched, noLife: true });
        await api.wait(1000);
        break;
      }
      const s = clamp((1.15 - 0.3 * (ms / p.T)) * (1 - 0.15 * misses), 0.4, 1);
      api.report({ correct: true, ms, expectedMs: p.T, level: L, q: `${p.pairs} pairs`, a: p.pairs, given: matched, s });
      api.good(misses ? `Board cleared with ${misses} miss${misses > 1 ? 'es' : ''}` : 'Flawless board', 900);
      await api.wait(900);
    }
  },
};

// ---------- Stream (n-back) ----------
const LETTERS = 'BCDFGHJKLMNPRSTVXZ'.split('');
export function genStream(L, rng) {
  const n = L < 12 ? 1 : L < 32 ? 2 : 3;
  const len = 14 + n;
  const seq = [];
  const isMatch = [];
  for (let i = 0; i < len; i++) {
    if (i >= n && rng.chance(0.32)) { seq.push(seq[i - n]); isMatch.push(true); }
    else {
      let c; do { c = rng.pick(LETTERS); } while (i >= n && c === seq[i - n]);
      seq.push(c); isMatch.push(false);
    }
  }
  const interval = Math.max(1400, 2300 - L * 16);
  return { n, seq, isMatch, interval, showMs: Math.round(interval * 0.7) };
}

const stream = {
  id: 'stream', skill: 'memory', name: 'Stream', mode: 'trials',
  howto: 'Letters stream past. Tap Match when the letter equals the one N steps back. A block with 3+ errors costs a life.',
  async run(api) {
    api.el.innerHTML = `<p class="game-prompt st-status"></p><div class="st-trail"></div>
      <div class="st-card"><span></span></div><div class="st-score"></div>
      <button class="btn btn-skill st-match">Match</button>`;
    const status = api.el.querySelector('.st-status');
    const card = api.el.querySelector('.st-card');
    const letter = card.querySelector('span');
    const trail = api.el.querySelector('.st-trail');
    const score = api.el.querySelector('.st-score');
    const btn = api.el.querySelector('.st-match');
    let current = -1, block = null, tapped = [], fa = 0, hits = 0;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!block || current < 0 || tapped[current]) return;
      tapped[current] = true;
      if (current >= block.n && block.isMatch[current]) { hits++; card.classList.add('hit'); }
      else { fa++; card.classList.add('fa'); }
      btn.classList.add('down'); setTimeout(() => btn.classList.remove('down'), 120);
    });
    while (!api.done) {
      const L = api.level();
      block = genStream(L, api.rng);
      tapped = []; fa = 0; hits = 0; current = -1;
      status.innerHTML = `<b>${block.n}-back</b>: tap when the letter matches the one ${block.n === 1 ? 'just before' : `${block.n} steps back`}`;
      trail.innerHTML = ''; letter.textContent = ''; score.textContent = '';
      if (!(await api.wait(1800))) break;
      let alive = true;
      for (let i = 0; i < block.seq.length; i++) {
        current = i;
        card.className = 'st-card';
        letter.textContent = block.seq[i];
        card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
        if (!(await api.wait(block.showMs))) { alive = false; break; }
        letter.textContent = '';
        if (!(await api.wait(block.interval - block.showMs))) { alive = false; break; }
        if (block.isMatch[i] && !tapped[i]) card.classList.add('miss');
        trail.innerHTML = block.seq.slice(Math.max(0, i - 5), i + 1).map((c, k, arr) => `<span class="${k === arr.length - 1 ? 'last' : ''}">${c}</span>`).join('');
      }
      current = -1;
      if (!alive) break;
      const targets = block.isMatch.filter(Boolean).length;
      const misses = targets - hits;
      const errors = misses + fa;
      const ok = errors <= 2;
      score.textContent = `${hits}/${targets} matches, ${fa} false tap${fa === 1 ? '' : 's'}`;
      api.report({ correct: ok, ms: block.seq.length * block.interval, expectedMs: block.seq.length * block.interval, level: L, q: `${block.n}-back`, a: targets, given: hits, s: ok ? clamp(1 - errors * 0.15, 0.55, 1) : 0 });
      if (ok) api.good(`Block cleared: ${hits}/${targets} matches`, 1000); else api.reveal(`${errors} errors in this block`, 1200);
      await api.wait(1300);
    }
  },
};

export const memoryGames = [squares, span, changed, pairs, stream];
