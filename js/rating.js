// Glicko-inspired skill rating with speed built in.
// Each skill has a rating r (400–2360, i.e. level 1–50) and an uncertainty rd.
// Every answer moves the rating: right + fast moves it up a lot,
// right + slow a little, wrong moves it down.

import { RATING } from './config.js';

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const levelFromRating = (r) => clamp(1 + (r - RATING.min) / RATING.perLevel, 1, 50);
export const ratingFromLevel = (L) => RATING.min + (clamp(L, 1, 50) - 1) * RATING.perLevel;

// 1.0 for an answer in half the expected time, ~0.85 at expected time,
// 0.55 floor for slow-but-right. Wrong = 0.
export function speedScore(correct, ms, expectedMs) {
  if (!correct) return 0;
  return clamp(1.15 - 0.3 * (ms / expectedMs), 0.55, 1);
}

// Probability the player "beats" an item of level L.
export function expectedScore(r, L) {
  return 1 / (1 + Math.pow(10, (ratingFromLevel(L) - r) / 400));
}

// Updates the skill in place and returns the rating change.
export function applyItem(skill, L, s, kOverride) {
  const E = expectedScore(skill.r, L);
  const K = kOverride ?? clamp(skill.rd * 0.22, 10, 80);
  const before = skill.r;
  skill.r = clamp(skill.r + K * (s - E), RATING.min, RATING.max);
  skill.rd = Math.max(RATING.minRd, skill.rd * 0.95);
  return skill.r - before;
}

// Uncertainty grows while you don't play, so ratings re-adjust faster after a break.
export function inflateRd(skill, days) {
  if (days <= 0) return;
  skill.rd = Math.min(RATING.startRd, Math.sqrt(skill.rd ** 2 + days * RATING.idleRdPerDay ** 2));
}

export function rankIndex(L) { return Math.min(6, Math.floor((Math.floor(L) - 1) / 7)); }
export function rankName(skillDef, L) { return skillDef.ranks[rankIndex(L)]; }
