// Frostline engine: the slide rule, the solver and the level maker.
// A plain script with no page code. In a browser it fills `Frostline`;
// under Node the same object is `require('./frost.js')`.
(function () {
  'use strict';

  const DIRS = ['up', 'down', 'left', 'right'];
  const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  // Par is the fewest moves that solve a level; these ranges set the difficulty.
  const DIFFICULTIES = {
    easy: { min: 3, max: 4 },
    medium: { min: 5, max: 7 },
    hard: { min: 8, max: 12 },
  };

  const SIZE = 9; // squares per side of a generated board
  const ROCKS = { min: 8, max: 14 }; // how many of each a generated board gets
  const SNOW = { min: 2, max: 5 };

  // The puck keeps going until a wall or rock is next, or it lands on snow
  // or the exit. `squares` 0 means it could not move at all.
  function slide(level, pos, dir) {
    const [dx, dy] = STEP[dir];
    let { x, y } = pos;
    for (let squares = 0; ; squares++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) {
        return { x, y, squares, stoppedBy: 'wall' };
      }
      const tile = level.rows[ny][nx];
      if (tile === '#') return { x, y, squares, stoppedBy: 'rock' };
      x = nx;
      y = ny;
      if (x === level.exit.x && y === level.exit.y) {
        return { x, y, squares: squares + 1, stoppedBy: 'exit' };
      }
      if (tile === '*') return { x, y, squares: squares + 1, stoppedBy: 'snow' };
    }
  }

  const cell = (level, pos) => pos.y * level.width + pos.x;

  // Breadth-first search over the places the puck can rest, so the first
  // time the exit turns up it is by a shortest list of moves.
  // Returns [] on the exit and null when there is no way out.
  function solve(level, from) {
    const start = from || level.start;
    const goal = cell(level, level.exit);
    const cameFrom = new Map([[cell(level, start), null]]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const pos = queue[i];
      if (cell(level, pos) === goal) {
        const moves = [];
        for (let at = goal; cameFrom.get(at); at = cameFrom.get(at).from) {
          moves.unshift(cameFrom.get(at).dir);
        }
        return moves;
      }
      for (const dir of DIRS) {
        const stop = slide(level, pos, dir);
        if (stop.squares === 0 || cameFrom.has(cell(level, stop))) continue;
        cameFrom.set(cell(level, stop), { from: cell(level, pos), dir });
        queue.push({ x: stop.x, y: stop.y });
      }
    }
    return null;
  }

  function hint(level, pos) {
    const moves = solve(level, pos);
    return moves && moves.length ? moves[0] : null;
  }

  // True when the puck can come to rest somewhere it can never leave for
  // the exit. Checked backwards: start from the exit and collect every
  // resting place that has a move toward one already collected.
  function hasTrap(level) {
    const moves = new Map(); // resting place -> the places one move away
    const queue = [level.start];
    moves.set(cell(level, level.start), null);
    for (let i = 0; i < queue.length; i++) {
      const stops = DIRS.map((dir) => slide(level, queue[i], dir)).filter((stop) => stop.squares > 0);
      moves.set(cell(level, queue[i]), stops.map((stop) => cell(level, stop)));
      for (const stop of stops) {
        if (moves.has(cell(level, stop)) || stop.stoppedBy === 'exit') continue;
        moves.set(cell(level, stop), null);
        queue.push({ x: stop.x, y: stop.y });
      }
    }
    const safe = new Set([cell(level, level.exit)]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const [place, next] of moves) {
        if (safe.has(place) || !next.some((to) => safe.has(to))) continue;
        safe.add(place);
        grew = true;
      }
    }
    return [...moves.keys()].some((place) => !safe.has(place));
  }

  // A seeded generator, so one seed always gives one level. The seed text is
  // hashed (FNV-1a) into the state of a linear congruential generator
  // (Numerical Recipes constants); only its high bits are used.
  function seeded(seed) {
    let state = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
    }
    const below = (n) => {
      state = (Math.imul(state, 1664525) + 1013904223) | 0;
      return Math.floor(((state >>> 0) / 4294967296) * n);
    };
    for (let i = 0; i < 8; i++) below(1); // similar seeds start far apart
    return below;
  }

  const between = (range, below) => range.min + below(range.max - range.min + 1);

  // One random board: rocks and snow scattered on ice, then a start and an
  // exit on two different ice squares.
  function scatter(below) {
    const tiles = new Array(SIZE * SIZE).fill('.');
    const place = (tile, count) => {
      while (count > 0) {
        const i = below(tiles.length);
        if (tiles[i] !== '.') continue;
        tiles[i] = tile;
        count--;
      }
    };
    place('#', between(ROCKS, below));
    place('*', between(SNOW, below));
    const ice = tiles.map((tile, i) => (tile === '.' ? i : -1)).filter((i) => i >= 0);
    const start = ice.splice(below(ice.length), 1)[0];
    const exit = ice[below(ice.length)];
    const pos = (i) => ({ x: i % SIZE, y: Math.floor(i / SIZE) });
    const rows = [];
    for (let y = 0; y < SIZE; y++) rows.push(tiles.slice(y * SIZE, (y + 1) * SIZE).join(''));
    return { width: SIZE, height: SIZE, rows, start: pos(start), exit: pos(exit) };
  }

  // Tries board after board from the seed and keeps the first that the
  // solver proves solvable in a number of moves inside the difficulty's
  // range, with no trap anywhere the puck can reach.
  function makeLevel(seed, difficulty) {
    const range = DIFFICULTIES[difficulty];
    if (!range) throw new RangeError('difficulty must be easy, medium or hard');
    seed = String(seed);
    const below = seeded(difficulty + '/' + seed);
    for (;;) {
      const board = scatter(below);
      const moves = solve(board);
      if (!moves || moves.length < range.min || moves.length > range.max) continue;
      if (hasTrap(board)) continue;
      return { seed, difficulty, ...board, par: moves.length };
    }
  }

  const two = (n) => String(n).padStart(2, '0');

  // The device's own date, so the daily level changes at the player's midnight.
  function dailySeed(date) {
    return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
  }

  // Reads a board drawn as text, with S for the start and E for the exit.
  // For tests and examples; the game itself only plays generated levels.
  function parseLevel(drawn) {
    const find = (mark) => {
      const y = drawn.findIndex((row) => row.includes(mark));
      return { x: drawn[y].indexOf(mark), y };
    };
    const level = {
      seed: null,
      difficulty: null,
      width: drawn[0].length,
      height: drawn.length,
      rows: drawn.map((row) => row.replace(/[SE]/g, '.')),
      start: find('S'),
      exit: find('E'),
    };
    const moves = solve(level);
    return { ...level, par: moves ? moves.length : null };
  }

  const api = { DIRS, DIFFICULTIES, slide, solve, hint, makeLevel, dailySeed, parseLevel };
  globalThis.Frostline = Object.assign(globalThis.Frostline || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.Frostline;
})();
