// Game progression rules: unlocks, daily plan, streaks, achievements.

import * as store from './store.js';
import { SKILL_IDS, UNLOCK, RATING } from './config.js';
import { GAMES_BY_SKILL, ALL_GAMES, GAME } from './games/index.js';
import { levelFromRating, inflateRd } from './rating.js';
import { makeRng } from './rng.js';

export const skillLevel = (skillId) => levelFromRating(store.get().skills[skillId].r);

export function gameIndex(game) { return GAMES_BY_SKILL[game.skill].indexOf(game); }

export function isUnlocked(game) {
  const i = gameIndex(game);
  if (i === 0) return true;
  const s = store.get();
  return Math.floor(skillLevel(game.skill)) >= UNLOCK.levels[i] || s.workouts >= UNLOCK.workouts[i];
}

export function unlockHint(game) {
  const i = gameIndex(game);
  const s = store.get();
  const left = UNLOCK.workouts[i] - s.workouts;
  return `Reach level ${UNLOCK.levels[i]} or finish ${left} more workout${left === 1 ? '' : 's'}`;
}

export const unlockedIds = () => ALL_GAMES.filter(isUnlocked).map((g) => g.id);

// Today's workout: one game per skill. New games first, then the one you played least recently.
export function todaysPlan() {
  const s = store.get();
  const day = store.todayKey();
  if (s.plan?.day === day && s.plan.games && SKILL_IDS.every((k) => GAME[s.plan.games[k]] && isUnlocked(GAME[s.plan.games[k]]))) return s.plan.games;
  const rng = makeRng(`plan-${day}-${s.deviceId}`);
  const games = {};
  for (const k of SKILL_IDS) {
    const open = GAMES_BY_SKILL[k].filter(isUnlocked);
    const fresh = open.filter((g) => !store.gameStats(g.id).plays);
    const pool = fresh.length ? fresh : open.slice().sort((a, b) => store.gameStats(a.id).lastPlayed - store.gameStats(b.id).lastPlayed).slice(0, Math.max(1, Math.ceil(open.length / 2)));
    games[k] = rng.pick(pool).id;
  }
  s.plan = { day, games };
  store.save();
  return games;
}

// After finishing a workout, tomorrow's plan should be recomputed.
export function clearPlan() { const s = store.get(); s.plan = null; }

export function workoutDoneToday() { return store.get().lastWorkoutDay === store.todayKey(); }

export function challengeGame(day = store.todayKey()) {
  const rng = makeRng(`challenge-${day}`);
  return rng.pick(ALL_GAMES);
}

export function displayStreak() {
  const st = store.get().streak;
  const gap = store.dayDiff(st.lastDay, store.todayKey());
  if (gap <= 1) return st.count;
  if (gap === 2 && st.freezes > 0) return st.count; // still saveable today
  return 0;
}

export function registerWorkout() {
  const s = store.get();
  const today = store.todayKey();
  const st = s.streak;
  let usedFreeze = false, earnedFreeze = false, extended = false;
  if (st.lastDay !== today) {
    const gap = store.dayDiff(st.lastDay, today);
    if (gap === 1) st.count++;
    else if (gap === 2 && st.freezes > 0) { st.freezes--; st.count++; usedFreeze = true; }
    else st.count = 1;
    st.lastDay = today;
    st.best = Math.max(st.best, st.count);
    extended = true;
    if (st.count % 7 === 0 && st.freezes < 2) { st.freezes++; earnedFreeze = true; }
  }
  s.workouts++;
  s.lastWorkoutDay = today;
  clearPlan();
  return { extended, usedFreeze, earnedFreeze, count: st.count };
}

// Uncertainty grows when a skill hasn't been played for a while.
export function touchSkills(skillIds) {
  const s = store.get();
  const today = store.todayKey();
  for (const k of skillIds) {
    const sk = s.skills[k];
    if (sk.lastPlayedDay) inflateRd(sk, store.dayDiff(sk.lastPlayedDay, today) - 1);
  }
}

export function resetSkillForPlacement(k) {
  const sk = store.get().skills[k];
  sk.r = RATING.start; sk.rd = RATING.startRd; sk.placed = false;
}

// ---------- Achievements ----------
const maxLevel = () => Math.max(...SKILL_IDS.map(skillLevel));
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First workout', desc: 'Finish your first daily workout', test: (s) => s.workouts >= 1 },
  { id: 'streak3', name: 'Warming up', desc: 'Reach a 3-day streak', test: (s) => s.streak.best >= 3 },
  { id: 'streak7', name: 'One full week', desc: 'Reach a 7-day streak', test: (s) => s.streak.best >= 7 },
  { id: 'streak30', name: 'Habit formed', desc: 'Reach a 30-day streak', test: (s) => s.streak.best >= 30 },
  { id: 'combo10', name: 'On fire', desc: 'Get 10 right in a row', test: (s, ctx) => (ctx?.bestCombo ?? 0) >= 10 },
  { id: 'combo25', name: 'Unstoppable', desc: 'Get 25 right in a row', test: (s, ctx) => (ctx?.bestCombo ?? 0) >= 25 },
  { id: 'lv10', name: 'Double digits', desc: 'Reach level 10 in any skill', test: () => maxLevel() >= 10 },
  { id: 'lv25', name: 'Halfway there', desc: 'Reach level 25 in any skill', test: () => maxLevel() >= 25 },
  { id: 'lv40', name: 'Elite', desc: 'Reach level 40 in any skill', test: () => maxLevel() >= 40 },
  { id: 'all', name: 'Collector', desc: 'Unlock all 15 games', test: () => unlockedIds().length === ALL_GAMES.length },
  { id: 'challenge', name: 'Challenger', desc: 'Play a daily challenge', test: (s) => Object.keys(s.challenges).length >= 1 },
  { id: 'answers500', name: '500 answers', desc: 'Answer 500 questions', test: (s) => SKILL_IDS.reduce((n, k) => n + s.skills[k].items, 0) >= 500 },
];

export function checkAchievements(ctx) {
  const s = store.get();
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements[a.id] && a.test(s, ctx)) { s.achievements[a.id] = Date.now(); fresh.push(a); }
  }
  return fresh;
}
