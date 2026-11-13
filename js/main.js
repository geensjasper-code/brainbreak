// Screens and flows: onboarding + level check, home, workout, games, stats, profile.

import * as store from './store.js';
import { APP, SKILLS, SKILL_IDS, ROUND, RATING, XP } from './config.js';
import { levelFromRating, rankName, clamp } from './rating.js';
import { makeRng } from './rng.js';
import { runRound } from './engine.js';
import { GAMES_BY_SKILL, GAME, ALL_GAMES } from './games/index.js';
import * as prog from './progress.js';
import { $, $$, esc, fmt, icon, sfx, haptic, confirmModal, toast } from './ui.js';

const app = $('#app');
let tab = 'home';

const S = () => store.get();
const lvl = (k) => levelFromRating(S().skills[k].r);
const lvlInt = (k) => Math.floor(lvl(k));

// ============================================================
// Shell
// ============================================================
function render() {
  const s = S();
  if (!s.onboarded) return renderWelcome();
  app.innerHTML = `<div class="shell">
    <div class="screen" id="screen"></div>
    <nav class="tabbar" aria-label="Main">
      ${[['home', 'Home', icon.home], ['games', 'Games', icon.grid], ['stats', 'Stats', icon.chart], ['profile', 'Profile', icon.user]]
        .map(([id, label, ic]) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${ic({ size: 24 })}<span>${label}</span></button>`).join('')}
    </nav></div>`;
  $$('.tab', app).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  const screen = $('#screen');
  ({ home: renderHome, games: renderGames, stats: renderStats, profile: renderProfile })[tab](screen);
  screen.scrollTop = 0;
}

function topBar() {
  const s = S();
  const streak = prog.displayStreak();
  const doneToday = prog.workoutDoneToday();
  return `<header class="topbar">
    <div class="wordmark">brain<span>break</span></div>
    <div class="chips">
      <span class="chip ${doneToday ? '' : 'dim'}" title="Day streak">${icon.flame({ size: 20, cls: doneToday ? '' : 'grey' })}<b>${streak}</b></span>
      <span class="chip" title="Total XP">${icon.bolt({ size: 19 })}<b>${fmt(s.xp)}</b></span>
    </div></header>`;
}

// ============================================================
// Home
// ============================================================
function ring(k, done) {
  const sk = SKILLS[k];
  const L = lvl(k);
  const frac = L - Math.floor(L);
  const C = 2 * Math.PI * 34;
  return `<button class="story ${done ? 'done' : ''}" data-quick="${k}" style="--c:${sk.color};--cd:${sk.dark};--cs:${sk.soft}" aria-label="Quick ${sk.name} round">
    <svg viewBox="0 0 80 80" class="story-ring">
      <circle cx="40" cy="40" r="34" class="ring-bg"/>
      <circle cx="40" cy="40" r="34" class="ring-fg" stroke-dasharray="${(C * Math.max(0.04, frac)).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 40 40)"/>
    </svg>
    <span class="story-in">${icon[k]({ size: 28, sw: 2.2 })}</span>
    <span class="story-name">${sk.name}</span>
    <span class="story-lv">Level ${Math.floor(L)}</span>
  </button>`;
}

function renderHome(el) {
  const s = S();
  const plan = prog.todaysPlan();
  const done = prog.workoutDoneToday();
  const playedToday = (k) => s.skills[k].lastPlayedDay === store.todayKey();
  const ch = prog.challengeGame();
  const chToday = s.challenges[store.todayKey()];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const streak = prog.displayStreak();

  el.innerHTML = `${topBar()}
    <section class="stories">${SKILL_IDS.map((k) => ring(k, playedToday(k))).join('')}</section>
    <p class="stories-hint">Tap a skill for a one-minute round</p>

    <section class="workout ${done ? 'is-done' : ''}">
      <div class="workout-head">
        <div>
          <h1>${done ? 'Workout done' : `${hello}${s.name ? ', ' + esc(s.name) : ''}`}</h1>
          <p>${done ? `Your streak is safe. Come back tomorrow for day ${streak + 1}.` : streak ? `Train today to make it ${streak + 1} days in a row.` : 'Three rounds, about four minutes.'}</p>
        </div>
        ${done ? `<span class="done-badge">${icon.check({ size: 22, sw: 3 })}</span>` : ''}
      </div>
      <ol class="plan">
        ${SKILL_IDS.map((k) => {
          const g = GAME[plan[k]];
          const fresh = !store.gameStats(g.id).plays;
          return `<li style="--c:${SKILLS[k].color};--cs:${SKILLS[k].soft}">
            <span class="plan-ic">${icon[k]({ size: 20 })}</span>
            <span class="plan-name">${g.name}${fresh ? '<em class="new">New</em>' : ''}</span>
            <span class="plan-meta">${g.mode === 'sprint' ? `${ROUND.sprintMs / 1000} s` : '3 lives'}</span></li>`;
        }).join('')}
      </ol>
      <button class="btn ${done ? 'btn-ghost' : 'btn-primary'} btn-big" data-act="workout">${done ? 'Train again' : 'Start workout'}</button>
    </section>

    <section class="challenge">
      <div class="challenge-top">
        <span class="challenge-tag">Daily challenge</span>
        <span class="challenge-skill" style="--c:${SKILLS[ch.skill].color}">${icon[ch.skill]({ size: 16 })}${SKILLS[ch.skill].name}</span>
      </div>
      <h2>${ch.name}</h2>
      <p>Same puzzles for every player today. ${chToday ? `Your best: <b>${fmt(chToday.best)}</b> points.` : 'One minute, rising difficulty.'}</p>
      <button class="btn btn-dark" data-act="challenge">${chToday ? 'Beat your score' : 'Play challenge'}</button>
    </section>

    <section class="levels">
      <h3 class="sec-title">Your levels</h3>
      ${SKILL_IDS.map((k) => {
        const L = lvl(k); const sk = SKILLS[k];
        return `<div class="lvl-row" style="--c:${sk.color};--cs:${sk.soft}">
          <span class="lvl-ic">${icon[k]({ size: 22 })}</span>
          <div class="lvl-body">
            <div class="lvl-top"><b>${sk.name}</b><span>${rankName(sk, L)}</span></div>
            <div class="bar"><i style="width:${((L - Math.floor(L)) * 100).toFixed(1)}%"></i></div>
          </div>
          <span class="lvl-num">${Math.floor(L)}</span></div>`;
      }).join('')}
    </section>`;

  $('[data-act="workout"]', el).addEventListener('click', startWorkout);
  $('[data-act="challenge"]', el).addEventListener('click', startChallenge);
  $$('[data-quick]', el).forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.quick;
    const open = GAMES_BY_SKILL[k].filter(prog.isUnlocked);
    const g = open.slice().sort((a, b2) => store.gameStats(a.id).lastPlayed - store.gameStats(b2.id).lastPlayed)[0];
    startQuick(g);
  }));
}

// ============================================================
// Games tab
// ============================================================
function renderGames(el) {
  el.innerHTML = `${topBar()}<h1 class="page-title">Games</h1>
    <p class="page-sub">New games unlock as you level up or keep your workouts going.</p>
    ${SKILL_IDS.map((k) => {
      const sk = SKILLS[k];
      return `<section class="game-sec" style="--c:${sk.color};--cd:${sk.dark};--cs:${sk.soft}">
        <h3 class="sec-title">${icon[k]({ size: 18 })} ${sk.name} <span class="sec-lv">Level ${lvlInt(k)}</span></h3>
        <div class="game-list">${GAMES_BY_SKILL[k].map((g) => {
          const open = prog.isUnlocked(g);
          const st = store.gameStats(g.id);
          return `<button class="game-card ${open ? '' : 'locked'}" data-game="${g.id}" ${open ? '' : 'aria-disabled="true"'}>
            <span class="gc-ic">${open ? icon[k]({ size: 22 }) : icon.lock({ size: 20 })}</span>
            <span class="gc-body"><b>${g.name}</b><small>${open ? esc(g.howto) : esc(prog.unlockHint(g))}</small></span>
            <span class="gc-best">${open && st.best ? `<b>${fmt(st.best)}</b><small>best</small>` : open && !st.plays ? '<em class="new">New</em>' : ''}</span>
          </button>`;
        }).join('')}</div></section>`;
    }).join('')}`;
  $$('[data-game]', el).forEach((b) => b.addEventListener('click', () => {
    const g = GAME[b.dataset.game];
    if (!prog.isUnlocked(g)) { toast(prog.unlockHint(g)); return; }
    startQuick(g);
  }));
}

// ============================================================
// Stats tab
// ============================================================
function radar() {
  const cx = 110, cy = 112, R = 84;
  const ang = { math: -90, logic: 150, memory: 30 };
  const pt = (k, f) => { const a = (ang[k] * Math.PI) / 180; return [cx + R * f * Math.cos(a), cy + R * f * Math.sin(a)]; };
  const ringPts = (f) => SKILL_IDS.map((k) => pt(k, f).join(',')).join(' ');
  const you = SKILL_IDS.map((k) => pt(k, Math.max(0.06, lvl(k) / 50)).map((v) => v.toFixed(1)).join(',')).join(' ');
  const labels = SKILL_IDS.map((k) => {
    const [x, y] = pt(k, 1.2);
    return `<text x="${x}" y="${y + 4}" text-anchor="middle" class="rad-lbl" fill="${SKILLS[k].dark}">${SKILLS[k].name} ${lvlInt(k)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 220 220" class="radar" role="img" aria-label="Brain profile">
    ${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ringPts(f)}" class="rad-grid"/>`).join('')}
    ${SKILL_IDS.map((k) => `<line x1="${cx}" y1="${cy}" x2="${pt(k, 1)[0]}" y2="${pt(k, 1)[1]}" class="rad-axis"/>`).join('')}
    <polygon points="${you}" class="rad-you"/>
    ${SKILL_IDS.map((k) => { const [x, y] = pt(k, Math.max(0.06, lvl(k) / 50)); return `<circle cx="${x}" cy="${y}" r="5" fill="${SKILLS[k].color}" stroke="#fff" stroke-width="2"/>`; }).join('')}
    ${labels}</svg>`;
}

function lineChart() {
  const s = S();
  const series = SKILL_IDS.map((k) => ({ k, pts: s.skills[k].history.slice(-30).map((h) => levelFromRating(h.r)) }));
  const n = Math.max(2, ...series.map((x) => x.pts.length));
  const all = series.flatMap((x) => x.pts);
  if (all.length < 2) return '<p class="empty">Play a few rounds and your progress chart appears here.</p>';
  const lo = Math.max(1, Math.floor(Math.min(...all)) - 1), hi = Math.min(50, Math.ceil(Math.max(...all)) + 1);
  const W = 320, H = 150, pad = 26;
  const x = (i, len) => pad + ((W - pad - 8) * (i + (n - len))) / (n - 1);
  const y = (v) => 10 + (H - 30) * (1 - (v - lo) / Math.max(1, hi - lo));
  const grid = [lo, Math.round((lo + hi) / 2), hi].map((v) => `<line x1="${pad}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" class="lc-grid"/><text x="${pad - 6}" y="${y(v) + 4}" text-anchor="end" class="lc-lbl">${v}</text>`).join('');
  const lines = series.filter((x0) => x0.pts.length).map(({ k, pts }) =>
    `<polyline fill="none" stroke="${SKILLS[k].color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((v, i) => `${x(i, pts.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="linechart" role="img" aria-label="Level over your last rounds">${grid}${lines}</svg>
    <div class="legend">${SKILL_IDS.map((k) => `<span><i style="background:${SKILLS[k].color}"></i>${SKILLS[k].name}</span>`).join('')}</div>`;
}

function renderStats(el) {
  const s = S();
  const tot = SKILL_IDS.reduce((a, k) => { const sk = s.skills[k]; a.items += sk.items; a.correct += sk.correct; a.tr += sk.timeRatioSum; a.ti += sk.timedItems; return a; }, { items: 0, correct: 0, tr: 0, ti: 0 });
  const acc = tot.items ? Math.round((100 * tot.correct) / tot.items) : 0;
  const speed = tot.ti ? tot.tr / tot.ti : 0;
  el.innerHTML = `${topBar()}<h1 class="page-title">Stats</h1>
    <section class="card radar-card"><h3 class="sec-title">Brain profile</h3>${radar()}</section>
    <section class="tiles four">
      <div class="tile"><b>${s.workouts}</b><span>Workouts</span></div>
      <div class="tile"><b>${fmt(tot.items)}</b><span>Answers</span></div>
      <div class="tile"><b>${acc}%</b><span>Accuracy</span></div>
      <div class="tile"><b>${speed ? speed.toFixed(2) + '×' : '–'}</b><span>Time vs target</span></div>
    </section>
    <section class="card"><h3 class="sec-title">Level over your last rounds</h3>${lineChart()}</section>
    <section class="card"><h3 class="sec-title">By skill</h3>
      <table class="stat-table"><thead><tr><th>Skill</th><th>Level</th><th>Accuracy</th><th>Speed</th></tr></thead><tbody>
      ${SKILL_IDS.map((k) => { const sk = s.skills[k]; return `<tr><td><i class="dot" style="background:${SKILLS[k].color}"></i>${SKILLS[k].name}</td><td>${lvl(k).toFixed(1)}</td><td>${sk.items ? Math.round((100 * sk.correct) / sk.items) + '%' : '–'}</td><td>${sk.timedItems ? (sk.timeRatioSum / sk.timedItems).toFixed(2) + '×' : '–'}</td></tr>`; }).join('')}
      </tbody></table>
      <p class="fine">Speed compares your correct answers with the target time for their level. Below 1.00× is faster than target.</p>
    </section>
    <section class="card"><h3 class="sec-title">Best scores</h3>
      <div class="bests">${ALL_GAMES.map((g) => { const st = store.gameStats(g.id); return `<div class="best-row ${st.plays ? '' : 'none'}"><i class="dot" style="background:${SKILLS[g.skill].color}"></i><span>${g.name}</span><b>${st.plays ? fmt(st.best) : '–'}</b></div>`; }).join('')}</div>
    </section>`;
}

// ============================================================
// Profile tab
// ============================================================
function renderProfile(el) {
  const s = S();
  const joined = new Date(s.createdAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  el.innerHTML = `${topBar()}
    <section class="profile-head">
      <div class="avatar">${esc((s.name || '?').slice(0, 1).toUpperCase())}</div>
      <div><input class="name-input" value="${esc(s.name)}" maxlength="24" placeholder="Your name" aria-label="Your name"><p>Training since ${joined}</p></div>
    </section>
    <section class="tiles">
      <div class="tile"><b>${prog.displayStreak()}</b><span>Day streak</span></div>
      <div class="tile"><b>${s.streak.best}</b><span>Longest streak</span></div>
      <div class="tile"><b>${s.streak.freezes}</b><span>Streak freezes</span></div>
    </section>
    <p class="fine padded">Every 7-day streak earns a freeze (max 2). A freeze saves your streak if you miss one day.</p>
    <section class="card"><h3 class="sec-title">Achievements</h3>
      <div class="ach-grid">${prog.ACHIEVEMENTS.map((a) => `<div class="ach ${s.achievements[a.id] ? 'got' : ''}"><span class="ach-medal">${s.achievements[a.id] ? icon.check({ size: 18, sw: 3 }) : icon.lock({ size: 16 })}</span><b>${a.name}</b><small>${a.desc}</small></div>`).join('')}</div>
    </section>
    <section class="card settings"><h3 class="sec-title">Settings</h3>
      <label class="toggle"><span>Sound effects</span><input type="checkbox" data-set="sound" ${s.settings.sound ? 'checked' : ''}><i></i></label>
      <label class="toggle"><span>Vibration <small>(Android)</small></span><input type="checkbox" data-set="haptics" ${s.settings.haptics ? 'checked' : ''}><i></i></label>
    </section>
    <section class="card"><h3 class="sec-title">Your data</h3>
      <p class="fine">Progress is saved on this phone. Copy a backup to move it to another device.</p>
      <div class="row-btns"><button class="btn btn-ghost" data-act="copy">Copy backup</button><button class="btn btn-ghost" data-act="restore">Restore backup</button></div>
      <div class="restore" hidden><textarea placeholder="Paste your backup here"></textarea><button class="btn btn-primary" data-act="do-restore">Restore</button></div>
      <div class="row-btns"><button class="btn btn-ghost" data-act="placement">Retake level check</button></div>
      <button class="link-danger" data-act="reset">Reset all progress</button>
    </section>
    <p class="fine center">${APP.name} ${APP.version}</p>`;

  $('.name-input', el).addEventListener('change', (e) => { s.name = e.target.value.trim(); store.save(); render(); });
  $$('[data-set]', el).forEach((c) => c.addEventListener('change', () => { s.settings[c.dataset.set] = c.checked; store.save(); if (c.checked && c.dataset.set === 'sound') sfx.good(); }));
  $('[data-act="copy"]', el).addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(store.exportJSON()); toast('Backup copied'); }
    catch (e) { const r = $('.restore', el); r.hidden = false; $('textarea', r).value = store.exportJSON(); $('textarea', r).select(); toast('Select all and copy the text'); }
  });
  $('[data-act="restore"]', el).addEventListener('click', () => { $('.restore', el).hidden = false; });
  $('[data-act="do-restore"]', el).addEventListener('click', () => {
    try { store.importJSON($('.restore textarea', el).value.trim()); toast('Backup restored'); render(); }
    catch (e) { toast(e.message.includes('Brainbreak') ? e.message : 'That text is not a valid backup.'); }
  });
  $('[data-act="placement"]', el).addEventListener('click', async () => {
    if (await confirmModal({ title: 'Retake the level check?', body: 'Three one-minute rounds set your levels again from scratch.', yes: 'Start level check', no: 'Cancel' })) startPlacement();
  });
  $('[data-act="reset"]', el).addEventListener('click', async () => {
    if (await confirmModal({ title: 'Reset all progress?', body: 'Levels, streak, XP and history on this phone are deleted. This cannot be undone.', yes: 'Reset progress', no: 'Keep my progress', danger: true })) { store.reset(); tab = 'home'; render(); }
  });
}

// ============================================================
// Onboarding
// ============================================================
function renderWelcome() {
  app.innerHTML = `<div class="onb">
    <div class="onb-art">${SKILL_IDS.map((k, i) => `<span class="onb-bubble b${i}" style="--c:${SKILLS[k].color}">${icon[k]({ size: 34, sw: 2.2 })}</span>`).join('')}</div>
    <h1 class="onb-title">Five minutes.<br>Sharper brain.</h1>
    <p class="onb-sub">Short, fast rounds of mental math, memory and logic that adapt to you. Built for the moments you'd otherwise scroll.</p>
    <button class="btn btn-primary btn-big" data-act="next">Get started</button>
  </div>`;
  $('[data-act="next"]', app).addEventListener('click', renderName);
}

function renderName() {
  app.innerHTML = `<div class="onb">
    <h1 class="onb-q">What should we call you?</h1>
    <input class="onb-input" maxlength="24" placeholder="First name" autocomplete="given-name" value="${esc(S().name)}">
    <div class="onb-steps">
      <h3>Next: a quick level check</h3>
      <p>Three one-minute rounds, one per skill. They start easy and adjust to you, so every problem after this fits your level.</p>
    </div>
    <button class="btn btn-primary btn-big" data-act="go">Start level check</button>
  </div>`;
  const input = $('.onb-input', app);
  setTimeout(() => input.focus(), 50);
  $('[data-act="go"]', app).addEventListener('click', () => { S().name = input.value.trim(); store.save(); startPlacement(); });
}

// ============================================================
// Sessions
// ============================================================
function startWorkout() {
  const plan = prog.todaysPlan();
  playSession({
    kind: 'workout',
    rounds: SKILL_IDS.map((k) => ({ game: GAME[plan[k]], durationMs: ROUND.sprintMs })),
  });
}

function startQuick(game) {
  playSession({ kind: 'quick', rounds: [{ game, durationMs: ROUND.quickSprintMs }] });
}

function startChallenge() {
  const day = store.todayKey();
  const g = prog.challengeGame(day);
  playSession({ kind: 'challenge', seed: `challenge-${day}`, rounds: [{ game: g, durationMs: ROUND.quickSprintMs }] });
}

function startPlacement() {
  SKILL_IDS.forEach(prog.resetSkillForPlacement);
  store.save();
  playSession({
    kind: 'placement',
    rounds: SKILL_IDS.map((k) => ({ game: GAMES_BY_SKILL[k][0], durationMs: ROUND.placementSprintMs })),
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function tapOnce(el) { return new Promise((res) => el.addEventListener('click', res, { once: true })); }

async function playSession({ kind, rounds, seed }) {
  const s = S();
  const before = Object.fromEntries(SKILL_IDS.map((k) => [k, s.skills[k].r]));
  const unlockedBefore = new Set(prog.unlockedIds());
  prog.touchSkills([...new Set(rounds.map((r) => r.game.skill))]);

  app.innerHTML = `<div class="session">
    <header class="ses-top">
      <button class="ses-x" aria-label="Quit">${icon.close({ size: 26 })}</button>
      <div class="segs">${rounds.map(() => '<span class="seg"><i></i></span>').join('')}</div>
    </header>
    <main class="ses-body"></main></div>`;
  const body = $('.ses-body', app);
  const segs = $$('.seg i', app);
  const control = {};
  let quitting = false;
  let inRound = false;
  $('.ses-x', app).addEventListener('click', async () => {
    if (kind === 'placement' && !S().onboarded) {
      control.pause?.(false);
      const ok = await confirmModal({ title: 'Skip the rest of the level check?', body: 'Skills you skip start at a medium level and adjust as you play.', yes: 'Skip', no: 'Keep going' });
      if (!ok) { control.resume?.(); return; }
    } else {
      control.pause?.(false);
      const ok = await confirmModal({ title: kind === 'workout' ? 'Quit this workout?' : 'Quit this round?', body: 'Finished rounds still count. This round will not.', yes: 'Quit', no: 'Keep playing', danger: true });
      if (!ok) { control.resume?.(); return; }
    }
    quitting = true;
    if (inRound) control.quit?.(); else finishSession();
  });

  const results = [];
  let finished = false;
  async function finishSession() {
    if (finished) return; finished = true;
    await showSummary({ kind, results, before, unlockedBefore, completed: results.length === rounds.length && !results.some((r) => r.reason === 'quit') });
  }

  for (let i = 0; i < rounds.length && !quitting; i++) {
    const { game, durationMs } = rounds[i];
    const skillDef = SKILLS[game.skill];
    const mode = game.mode;
    // Intro card
    await renderIntro(body, { game, skillDef, kind, mode, durationMs, index: i, total: rounds.length });
    if (quitting) break;
    // Countdown
    for (const n of [3, 2, 1]) {
      body.innerHTML = `<div class="countdown" style="--c:${skillDef.color}"><span>${n}</span></div>`;
      sfx.tick();
      await wait(600);
      if (quitting) break;
    }
    if (quitting) break;
    const rng = seed ? makeRng(`${seed}-${game.id}`) : makeRng();
    inRound = true;
    const res = await runRound({
      container: body, game, skillDef, skillState: s.skills[game.skill], rng, mode,
      durationMs, placement: kind === 'placement',
      ramp: kind === 'challenge' ? (n) => 3 + n * 2.2 : null,
      onProgress: (f) => { segs[i].style.width = `${(f * 100).toFixed(1)}%`; },
      control,
    });
    inRound = false;
    if (res.reason === 'quit') { if (kind === 'placement') markPlaced(game.skill); break; }
    res.game = game.id; res.skill = game.skill;
    results.push(res);
    recordRound(kind, game, res);
    if (kind === 'placement') markPlaced(game.skill);
    store.save();
    await showRoundResult(body, { game, skillDef, res, kind, last: i === rounds.length - 1 });
  }
  if (kind === 'placement') SKILL_IDS.forEach(markPlaced);
  await finishSession();
}

function markPlaced(k) {
  const sk = S().skills[k];
  if (!sk.placed) { sk.placed = true; sk.rd = RATING.placedRd; }
}

function recordRound(kind, game, res) {
  const s = S();
  const st = store.gameStats(game.id);
  st.plays++; st.lastPlayed = Date.now();
  res.newBest = kind !== 'placement' && res.points > st.best;
  if (kind !== 'placement' && kind !== 'challenge') st.best = Math.max(st.best, res.points);
  const sk = s.skills[game.skill];
  sk.lastPlayedDay = store.todayKey();
  sk.history.push({ t: Date.now(), r: Math.round(sk.r) });
  if (sk.history.length > 300) sk.history = sk.history.slice(-300);
  res.xp = Math.round(res.points * XP.perPoint) + XP.roundBonus;
  s.xp += res.xp;
  if (kind === 'challenge') {
    const day = store.todayKey();
    const c = s.challenges[day] || { gameId: game.id, first: res.points, best: 0, attempts: 0 };
    c.best = Math.max(c.best, res.points); c.attempts++;
    s.challenges[day] = c;
  }
}

function renderIntro(body, { game, skillDef, kind, mode, durationMs, index, total }) {
  const L = Math.floor(lvl(game.skill));
  const label = kind === 'placement' ? 'Level check' : kind === 'challenge' ? 'Daily challenge' : `Level ${L}`;
  const rule = mode === 'sprint'
    ? `${durationMs / 1000} seconds. Fast answers score more.`
    : kind === 'placement' ? 'Up to 10 rounds, or until you make 3 mistakes.' : 'Keeps going until you make 3 mistakes.';
  body.innerHTML = `<div class="intro" style="--c:${skillDef.color};--cd:${skillDef.dark}">
    <div class="intro-top">
      <span class="intro-skill">${icon[game.skill]({ size: 18 })}${skillDef.name}</span>
      <span class="intro-count">${total > 1 ? `Round ${index + 1} of ${total}` : label}</span>
    </div>
    <div class="intro-mid">
      <h2>${game.name}</h2>
      <p>${esc(game.howto)}</p>
      <div class="intro-rule">${mode === 'sprint' ? '' : `<span class="intro-hearts">${[0, 1, 2].map(() => icon.heart({ size: 20 })).join('')}</span>`}${rule}</div>
    </div>
    <div class="intro-bottom">
      ${total > 1 ? `<span class="intro-lv">${label}</span>` : ''}
      <button class="btn btn-white btn-big">Start</button>
    </div></div>`;
  return tapOnce($('.btn-white', body));
}

function showRoundResult(body, { game, skillDef, res, kind, last }) {
  const n = res.items.length;
  const acc = n ? Math.round((100 * res.correct) / n) : 0;
  const L0 = levelFromRating(res.ratingBefore), L1 = levelFromRating(res.ratingAfter);
  const d = L1 - L0;
  const showLevel = kind !== 'challenge';
  body.innerHTML = `<div class="rres" style="--c:${skillDef.color};--cd:${skillDef.dark};--cs:${skillDef.soft}">
    <p class="rres-game">${game.name}</p>
    <div class="rres-pts"><b data-count="${res.points}">0</b><span>points</span></div>
    ${res.newBest && res.points > 0 ? '<span class="best-badge">New personal best</span>' : ''}
    <div class="rres-stats">
      <div><b>${res.correct}/${n}</b><span>correct</span></div>
      <div><b>${acc}%</b><span>accuracy</span></div>
      <div><b>${res.bestCombo}</b><span>best streak</span></div>
    </div>
    ${showLevel ? `<div class="rres-level">
      <div class="rres-lv-top"><span>${skillDef.name}</span><b class="${d >= 0 ? 'up' : 'down'}">${kind === 'placement' ? `Level ${Math.floor(L1)}` : `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} level`}</b></div>
      <div class="bar big"><i style="width:${((L1 - Math.floor(L1)) * 100).toFixed(1)}%"></i></div>
      <div class="rres-lv-bottom"><span>Level ${Math.floor(L1)}</span><span>${rankName(skillDef, L1)}</span></div>
    </div>` : `<p class="fine center">Challenge scores don't change your level.</p>`}
    <button class="btn btn-skill btn-big">${last ? 'See results' : 'Next round'}</button>
  </div>`;
  countUp($('[data-count]', body));
  if (res.points > 0) sfx.win();
  return tapOnce($('.btn-skill', body));
}

function countUp(el, dur = 700) {
  const to = Number(el.dataset.count); const t0 = performance.now();
  const step = (t) => { const f = Math.min(1, (t - t0) / dur); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - f, 3)))); if (f < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

async function showSummary({ kind, results, before, unlockedBefore, completed }) {
  const s = S();
  let streakInfo = null;
  let bonus = 0;
  if (kind === 'workout' && completed) { streakInfo = prog.registerWorkout(); bonus = XP.workoutBonus; }
  if (kind === 'challenge' && completed) bonus = XP.challengeBonus;
  s.xp += bonus;
  const bestCombo = Math.max(0, ...results.map((r) => r.bestCombo));
  const fresh = prog.checkAchievements({ bestCombo });
  const newGames = prog.unlockedIds().filter((id) => !unlockedBefore.has(id)).map((id) => GAME[id]);
  if (kind === 'placement') s.onboarded = true;

  const session = {
    id: store.newId(), kind, deviceId: s.deviceId, userId: s.userId,
    startedAt: Date.now() - results.reduce((a, r) => a + r.durationMs, 0), endedAt: Date.now(),
    completed,
    rounds: results.map((r) => ({ game: r.game, skill: r.skill, points: r.points, correct: r.correct, durationMs: r.durationMs, ratingBefore: Math.round(r.ratingBefore), ratingAfter: Math.round(r.ratingAfter), reason: r.reason, items: r.items })),
  };
  if (results.length) store.addSession(session); else store.save();

  const xpTotal = results.reduce((a, r) => a + (r.xp || 0), 0) + bonus;
  const touched = SKILL_IDS.filter((k) => results.some((r) => r.skill === k));

  if (kind === 'placement') {
    app.innerHTML = `<div class="summary placement">
      <h1>Your starting levels</h1>
      <p class="sum-sub">From here, every round adapts to how fast and how accurately you answer.</p>
      ${radar()}
      <div class="sum-skills">${SKILL_IDS.map((k) => `<div class="sum-skill" style="--c:${SKILLS[k].color};--cs:${SKILLS[k].soft}"><span class="lvl-ic">${icon[k]({ size: 22 })}</span><div><b>${SKILLS[k].name}</b><span>${rankName(SKILLS[k], lvl(k))}</span></div><strong>${lvlInt(k)}</strong></div>`).join('')}</div>
      <button class="btn btn-primary btn-big" data-act="home">Go to home</button></div>`;
  } else {
    app.innerHTML = `<div class="summary">
      ${streakInfo ? `<div class="sum-flame">${icon.flame({ size: 128 })}<b data-count="${streakInfo.count}">${Math.max(0, streakInfo.count - (streakInfo.extended ? 1 : 0))}</b></div>
        <h1>${streakInfo.count === 1 ? 'Day one. Streak started.' : `${streakInfo.count} days in a row`}</h1>
        <p class="sum-sub">${streakInfo.usedFreeze ? 'A streak freeze covered the day you missed.' : streakInfo.earnedFreeze ? 'You earned a streak freeze for a full week.' : 'Come back tomorrow to keep it going.'}</p>`
        : `<h1>${completed ? (kind === 'challenge' ? 'Challenge complete' : 'Round complete') : 'Session ended'}</h1>`}
      <div class="sum-xp">${icon.bolt({ size: 26 })}<b data-count="${xpTotal}">0</b><span>XP earned</span></div>
      ${touched.length && kind !== 'challenge' ? `<div class="sum-skills">${touched.map((k) => {
        const d = levelFromRating(s.skills[k].r) - levelFromRating(before[k]);
        return `<div class="sum-skill" style="--c:${SKILLS[k].color};--cs:${SKILLS[k].soft}"><span class="lvl-ic">${icon[k]({ size: 22 })}</span><div><b>${SKILLS[k].name}</b><span>Level ${lvlInt(k)}, ${rankName(SKILLS[k], lvl(k))}</span></div><strong class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}</strong></div>`;
      }).join('')}</div>` : ''}
      ${newGames.length ? `<div class="sum-new"><h3>New game${newGames.length > 1 ? 's' : ''} unlocked</h3>${newGames.map((g) => `<span class="pill" style="--c:${SKILLS[g.skill].color}">${icon[g.skill]({ size: 16 })}${g.name}</span>`).join('')}</div>` : ''}
      ${fresh.length ? `<div class="sum-new"><h3>Achievement${fresh.length > 1 ? 's' : ''}</h3>${fresh.map((a) => `<span class="pill gold">${icon.check({ size: 16, sw: 3 })}${a.name}</span>`).join('')}</div>` : ''}
      <button class="btn btn-primary btn-big" data-act="home">Continue</button></div>`;
  }
  $$('[data-count]', app).forEach((e) => countUp(e, 900));
  if (streakInfo?.extended) { haptic([20, 60, 20]); sfx.win(); }
  store.save();
  await tapOnce($('[data-act="home"]', app));
  tab = 'home';
  render();
}

// ============================================================
// Boot
// ============================================================
store.load();
render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* not available here (e.g. preview) */ });
}
