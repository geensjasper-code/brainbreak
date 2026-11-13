import { mathGames } from './math.js';
import { memoryGames } from './memory.js';
import { logicGames } from './logic.js';

// Order within each skill = unlock order.
export const GAMES_BY_SKILL = { math: mathGames, memory: memoryGames, logic: logicGames };
export const ALL_GAMES = [...mathGames, ...memoryGames, ...logicGames];
export const GAME = Object.fromEntries(ALL_GAMES.map((g) => [g.id, g]));
