// Runs one round of one game: the clock (pause-aware), lives, scoring,
// combo, rating updates, and difficulty that adapts answer by answer.

import { ROUND } from './config.js';
import { clamp, levelFromRating, speedScore, applyItem } from './rating.js';
import { icon, sfx, haptic, $ } from './ui.js';

/**
 * opts: {
 *   container, game, skillDef, skillState, rng,
 *   mode: 'sprint' | 'trials', durationMs,
 *   placement: bool,          // level check: big rating jumps
 *   ramp: (i) => level|null,  // fixed difficulty (daily challenge), no rating change
 *   onProgress: (fraction) => void,
 *   control: {}               // filled with pause/resume/quit
 * }
 */
export function runRound(opts) {
  const { container, game, skillDef, skillState, rng, mode, durationMs, placement = false, ramp = null, onProgress, control = {} } = opts;

  container.innerHTML = `<div class="round" style="--c:${skillDef.color};--cd:${skillDef.dark};--cs:${skillDef.soft}">
    <div class="round-hud">
      <div class="hud-left"></div>
      <div class="hud-combo" aria-live="polite"></div>
      <div class="hud-points"><span class="hud-pts">0</span><span class="hud-float"></span></div>
    </div>
    <div class="round-stage game-${game.id}"></div>
    <div class="round-fb" aria-live="polite"></div>
    <div class="round-paused" hidden>
      <div class="paused-card"><h3>Paused</h3><p>Your round is waiting for you.</p>
      <button class="btn btn-primary" data-act="resume">Resume</button></div>
    </div>
  </div>`;

  const root = $('.round', container);
  const stage = $('.round-stage', root);
  const hudLeft = $('.hud-left', root);
  const hudCombo = $('.hud-combo', root);
  const hudPts = $('.hud-pts', root);
  const hudFloat = $('.hud-float', root);
  const fb = $('.round-fb', root);
  const pausedEl = $('.round-paused', root);

  return new Promise((resolve) => {
    let active = 0, last = performance.now(), paused = false, over = false, raf = 0;
    let lives = ROUND.lives, points = 0, combo = 0, bestCombo = 0, offset = 0, itemIdx = 0;
    const waiters = [];
    const overHandlers = [];
    const items = [];
    const ratingBefore = skillState.r;
    let lastSecShown = -1;

    function renderLeft() {
      if (mode === 'sprint') {
        const left = Math.max(0, Math.ceil((durationMs - active) / 1000));
        if (left !== lastSecShown) {
          lastSecShown = left;
          hudLeft.innerHTML = `<span class="hud-time ${left <= 10 ? 'low' : ''}">${left}s</span>`;
        }
      } else {
        hudLeft.innerHTML = `<span class="hud-lives">${[0, 1, 2].map((i) => icon.heart({ off: i >= lives })).join('')}</span>`;
      }
    }

    function tick(t) {
      const dt = Math.min(100, t - last); last = t;
      if (!paused && !over) active += dt;
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (over || active >= waiters[i].at) waiters.splice(i, 1)[0].res(!over);
      }
      if (!over) {
        if (mode === 'sprint') {
          renderLeft();
          onProgress?.(Math.min(1, active / durationMs));
          if (active >= durationMs) finish('time');
        } else {
          onProgress?.(Math.min(0.97, active / 90000));
          if (active >= ROUND.memorySafetyCapMs) finish('cap');
        }
      }
      if (!over) raf = requestAnimationFrame(tick);
    }

    function finish(reason) {
      if (over) return;
      over = true;
      cancelAnimationFrame(raf);
      waiters.splice(0).forEach((w) => w.res(false));
      overHandlers.splice(0).forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
      document.removeEventListener('visibilitychange', onVis);
      onProgress?.(1);
      resolve({
        reason, items, points, bestCombo,
        durationMs: Math.round(active),
        ratingBefore, ratingAfter: skillState.r,
        correct: items.filter((i) => i.correct).length,
      });
    }

    function pause(showOverlay = true) { if (over || paused) return; paused = true; pausedEl.hidden = !showOverlay; }
    function resume() { if (!paused) return; paused = false; last = performance.now(); pausedEl.hidden = true; }
    const onVis = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onVis);
    pausedEl.querySelector('[data-act="resume"]').addEventListener('click', resume);
    control.pause = pause; control.resume = resume; control.quit = () => finish('quit');

    let fbTimer = 0;
    function showFb(html, kind, ms) {
      fb.className = `round-fb show ${kind}`;
      fb.innerHTML = html;
      clearTimeout(fbTimer);
      fbTimer = setTimeout(() => { fb.className = 'round-fb'; }, ms);
    }

    function loseLife() {
      if (mode !== 'trials' || over) return;
      lives = Math.max(0, lives - 1);
      renderLeft();
      haptic([30, 40, 30]);
      if (lives === 0) setTimeout(() => finish('lives'), 900);
    }

    const api = {
      el: stage,
      rng,
      skill: skillDef,
      mode,
      get over() { return over; },
      get lives() { return lives; },
      // True once no new item should start (round over, or last life just lost).
      get done() { return over || (mode === 'trials' && lives === 0) || (placement && mode === 'trials' && itemIdx >= ROUND.placementMaxTrials); },
      get index() { return itemIdx; },
      now: () => active,
      onOver(fn) { if (over) fn(); else overHandlers.push(fn); },
      // Pause-aware sleep. Resolves true, or false if the round ended meanwhile.
      wait(ms) { return new Promise((res) => { if (over) return res(false); waiters.push({ at: active + ms, res }); }); },
      // Level for the next item: your rating plus a within-round staircase.
      level() {
        if (ramp) return clamp(ramp(itemIdx), 1, 50);
        return clamp(levelFromRating(skillState.r) + offset, 1, 50);
      },
      cutoff(expectedMs) { return expectedMs * ROUND.cutoffFactor; },
      report({ correct, ms, expectedMs, level, q = '', a = '', given = '', s: sOverride, noLife = false }) {
        if (over) return { pts: 0 };
        const s = sOverride ?? speedScore(correct, ms, expectedMs);
        if (!ramp) {
          const K = placement ? Math.max(30, 140 * Math.pow(0.9, itemIdx)) : undefined;
          applyItem(skillState, level, s, K);
          if (!placement) offset = clamp(offset + (correct ? (s >= 0.85 ? 0.8 : 0.25) : -1.6), -8, 8);
        }
        let pts = 0;
        if (correct) {
          combo++; bestCombo = Math.max(bestCombo, combo);
          pts = Math.round(10 * (1 + level / 25) * (0.5 + 0.5 * s) * (1 + Math.min(combo, 10) * 0.1));
          points += pts;
          hudPts.textContent = points;
          hudFloat.textContent = `+${pts}`;
          hudFloat.classList.remove('go'); void hudFloat.offsetWidth; hudFloat.classList.add('go');
          root.classList.remove('flash-bad', 'flash-good'); void root.offsetWidth; root.classList.add('flash-good');
          sfx.good(combo); haptic(10);
        } else {
          combo = 0;
          root.classList.remove('flash-bad', 'flash-good'); void root.offsetWidth; root.classList.add('flash-bad');
          sfx.bad();
        }
        hudCombo.innerHTML = combo >= 3 ? `<span class="combo-pill">${combo} in a row ×${(1 + Math.min(combo, 10) * 0.1).toFixed(1)}</span>` : '';
        items.push({
          q: String(q), a: String(a), given: String(given), correct,
          ms: Math.round(ms), exp: Math.round(expectedMs), L: +level.toFixed(1), s: +s.toFixed(2),
        });
        itemIdx++;
        skillState.items++;
        if (correct) {
          skillState.correct++;
          skillState.timeRatioSum += Math.min(3, ms / expectedMs);
          skillState.timedItems++;
        }
        if (!correct && !noLife) loseLife();
        if (placement && mode === 'trials' && itemIdx >= ROUND.placementMaxTrials) setTimeout(() => finish('done'), 700);
        return { pts, s, combo };
      },
      mistake() { loseLife(); },
      good(text, ms = 700) { showFb(text, 'good', ms); },
      reveal(text, ms = 1100) { showFb(text, 'bad', ms); },
      info(text, ms = 1200) { showFb(text, 'info', ms); },
    };

    renderLeft();
    raf = requestAnimationFrame(tick);
    Promise.resolve()
      .then(() => game.run(api))
      .catch((e) => { console.error(e); })
      .finally(() => { if (!over) finish('ended'); });
  });
}
