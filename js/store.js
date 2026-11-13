// All saving and loading goes through this module.
// v1: the phone's localStorage. v2: the same shape syncs to Supabase —
// every finished session is queued in `syncQueue` with its full answer log,
// so the server can recompute ratings and nothing is lost when accounts arrive.

import { APP, SKILL_IDS, RATING } from './config.js';

let state = null;
let memoryCopy = null; // fallback when localStorage is unavailable

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'd-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayDiff(a, b) {
  if (!a || !b) return Infinity;
  return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

function freshSkill() {
  return {
    r: RATING.start, rd: RATING.startRd, placed: false,
    history: [],            // [{t, r}] rating after each round
    lastPlayedDay: null,
    items: 0, correct: 0,
    timeRatioSum: 0, timedItems: 0, // actual / expected time, for the speed stat
  };
}

function fresh() {
  const skills = {};
  for (const s of SKILL_IDS) skills[s] = freshSkill();
  return {
    schema: APP.schemaVersion,
    deviceId: uid(),
    userId: null,          // filled in by v2 when the player signs in
    createdAt: Date.now(),
    name: '',
    onboarded: false,
    xp: 0,
    skills,
    games: {},             // gameId -> {best, plays, lastPlayed, seen}
    streak: { count: 0, best: 0, lastDay: null, freezes: 0 },
    workouts: 0,
    lastWorkoutDay: null,
    challenges: {},        // day -> {gameId, score}
    sessions: [],
    achievements: {},      // id -> timestamp
    settings: { sound: false, haptics: true },
    syncQueue: [],         // session ids not yet uploaded (v2)
  };
}

function migrate(saved) {
  const base = fresh();
  const out = { ...base, ...saved };
  out.skills = {};
  for (const k of SKILL_IDS) out.skills[k] = { ...freshSkill(), ...(saved.skills || {})[k] };
  out.streak = { ...base.streak, ...saved.streak };
  out.settings = { ...base.settings, ...saved.settings };
  out.schema = APP.schemaVersion;
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(APP.storageKey);
    if (raw) { state = migrate(JSON.parse(raw)); return state; }
  } catch (e) { /* storage blocked or corrupt: fall through */ }
  state = memoryCopy || fresh();
  return state;
}

export function get() { return state || load(); }

export function save() {
  memoryCopy = state;
  try { localStorage.setItem(APP.storageKey, JSON.stringify(state)); } catch (e) { /* keep in memory */ }
}

export function reset() { state = fresh(); save(); return state; }

export function exportJSON() { return JSON.stringify(get()); }

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !parsed.skills || !parsed.deviceId) throw new Error('This is not a Brainbreak backup.');
  state = migrate(parsed);
  save();
}

export function gameStats(id) {
  const s = get();
  if (!s.games[id]) s.games[id] = { best: 0, plays: 0, lastPlayed: 0, seen: false };
  return s.games[id];
}

// Keeps full answer logs for the most recent sessions and summaries for older ones.
export function addSession(session) {
  const s = get();
  s.sessions.push(session);
  s.syncQueue.push(session.id);
  const KEEP_DETAIL = 150, KEEP_TOTAL = 1000;
  if (s.sessions.length > KEEP_TOTAL) s.sessions = s.sessions.slice(-KEEP_TOTAL);
  const cut = s.sessions.length - KEEP_DETAIL;
  for (let i = 0; i < cut; i++) {
    for (const r of s.sessions[i].rounds || []) if (r.items) { r.itemCount = r.items.length; delete r.items; }
  }
  save();
}

export function newId() { return uid(); }
