// Every tunable number lives here, so balancing the app never means
// digging through game code.

export const APP = {
  name: 'Brainbreak',
  version: '1.0.0',
  storageKey: 'brainbreak:v1',
  schemaVersion: 1,
};

export const SKILL_IDS = ['math', 'memory', 'logic'];

export const SKILLS = {
  math: {
    id: 'math', name: 'Mental math', color: '#FF7A1A', dark: '#D85F00', soft: '#FFF0E3',
    ranks: ['Counter', 'Adder', 'Abacus', 'Calculator', 'Quant', 'Human computer', 'Savant'],
  },
  memory: {
    id: 'memory', name: 'Memory', color: '#2F6BFF', dark: '#1C4FD6', soft: '#E8EFFF',
    ranks: ['Goldfish', 'Notetaker', 'Recaller', 'Archivist', 'Elephant', 'Photographic', 'Mnemonist'],
  },
  logic: {
    id: 'logic', name: 'Logic', color: '#12B57A', dark: '#0B9060', soft: '#E2F7EE',
    ranks: ['Puzzled', 'Thinker', 'Detective', 'Analyst', 'Strategist', 'Mastermind', 'Oracle'],
  },
};

export const ROUND = {
  sprintMs: 75000,          // math + logic rounds in the daily workout
  quickSprintMs: 60000,     // single quick round
  placementSprintMs: 60000, // level check rounds
  lives: 3,                 // memory rounds end after 3 mistakes
  memorySafetyCapMs: 180000,// hard stop so a memory round can never run away
  placementMaxTrials: 10,
  cutoffFactor: 3,          // a question times out at 3x its expected time
};

export const RATING = {
  min: 400,
  max: 2360,       // = level 50
  perLevel: 40,    // rating points per level
  start: 900,      // where the level check starts (level ~13.5)
  startRd: 350,    // uncertainty for a brand-new player
  placedRd: 150,   // uncertainty after the level check
  minRd: 60,
  idleRdPerDay: 12,// uncertainty grows when you skip days
};

// Game i of a skill unlocks at skill level levels[i] OR after workouts[i] workouts.
export const UNLOCK = {
  levels: [0, 6, 12, 18, 24],
  workouts: [0, 2, 4, 7, 10],
};

export const XP = { perPoint: 0.25, roundBonus: 10, workoutBonus: 25, challengeBonus: 15 };
