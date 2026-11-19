'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./frost.js');

const at = (x, y) => ({ x, y });
const key = (p) => p.x + ',' + p.y;
const seeds = (n) => Array.from({ length: n }, (_, i) => 'seed-' + i);
const LEVELS_PER_DIFFICULTY = 200;

// Play a list of moves through the same slide rule the player uses.
function replay(level, from, dirs) {
  let pos = from;
  for (const dir of dirs) {
    const stop = F.slide(level, pos, dir);
    assert.ok(stop.squares > 0, `${dir} from ${key(pos)} did not move`);
    pos = at(stop.x, stop.y);
  }
  return pos;
}

// Every place the puck can come to rest, found with slide alone (not the solver).
function restingPlaces(level) {
  const seen = new Map([[key(level.start), level.start]]);
  const queue = [level.start];
  while (queue.length) {
    const pos = queue.shift();
    for (const dir of F.DIRS) {
      const stop = F.slide(level, pos, dir);
      if (stop.squares === 0 || stop.stoppedBy === 'exit' || seen.has(key(stop))) continue;
      seen.set(key(stop), at(stop.x, stop.y));
      queue.push(at(stop.x, stop.y));
    }
  }
  return [...seen.values()];
}

// The shortest number of moves to the exit from every resting place, by
// working outward from the start with slide alone: an answer the solver
// has to match.
function distanceToExit(level, from) {
  let frontier = [from];
  const seen = new Set([key(from)]);
  for (let moves = 0; frontier.length; moves++) {
    const next = [];
    for (const pos of frontier) {
      if (pos.x === level.exit.x && pos.y === level.exit.y) return moves;
      for (const dir of F.DIRS) {
        const stop = F.slide(level, pos, dir);
        if (stop.squares === 0 || seen.has(key(stop))) continue;
        seen.add(key(stop));
        next.push(at(stop.x, stop.y));
      }
    }
    frontier = next;
  }
  return null;
}

const OPEN = F.parseLevel([
  'S...#',
  '.....',
  '..*..',
  '....E',
]);

// One way in, no way out: sliding down or up from S lands in the left
// column, which only ever leads back to itself.
const TRAP = F.parseLevel([
  '.#E',
  'S..',
  '.##',
  '.##',
]);

const BLOCKED = F.parseLevel([
  'S#.',
  '##.',
  '..E',
]);

test('a hand-made board is read as a level', () => {
  assert.deepEqual(OPEN.start, at(0, 0));
  assert.deepEqual(OPEN.exit, at(4, 3));
  assert.equal(OPEN.width, 5);
  assert.equal(OPEN.height, 4);
  assert.deepEqual(OPEN.rows, ['....#', '.....', '..*..', '.....']);
  assert.equal(OPEN.par, 2);
  assert.equal(BLOCKED.par, null);
});

test('the puck stops before a wall', () => {
  assert.deepEqual(F.slide(OPEN, at(0, 0), 'down'), { x: 0, y: 3, squares: 3, stoppedBy: 'wall' });
  assert.deepEqual(F.slide(OPEN, at(0, 0), 'left'), { x: 0, y: 0, squares: 0, stoppedBy: 'wall' });
  assert.deepEqual(F.slide(OPEN, at(0, 0), 'up'), { x: 0, y: 0, squares: 0, stoppedBy: 'wall' });
});

test('the puck stops before a rock', () => {
  assert.deepEqual(F.slide(OPEN, at(0, 0), 'right'), { x: 3, y: 0, squares: 3, stoppedBy: 'rock' });
  assert.deepEqual(F.slide(OPEN, at(4, 1), 'up'), { x: 4, y: 1, squares: 0, stoppedBy: 'rock' });
});

test('the puck stops on a snow patch and can leave it', () => {
  assert.deepEqual(F.slide(OPEN, at(2, 0), 'down'), { x: 2, y: 2, squares: 2, stoppedBy: 'snow' });
  assert.deepEqual(F.slide(OPEN, at(0, 2), 'right'), { x: 2, y: 2, squares: 2, stoppedBy: 'snow' });
  assert.deepEqual(F.slide(OPEN, at(2, 2), 'right'), { x: 4, y: 2, squares: 2, stoppedBy: 'wall' });
});

test('the puck stops on the exit, even with ice beyond it', () => {
  assert.deepEqual(F.slide(OPEN, at(0, 3), 'right'), { x: 4, y: 3, squares: 4, stoppedBy: 'exit' });
  const through = F.parseLevel(['S.E..']);
  assert.deepEqual(F.slide(through, at(0, 0), 'right'), { x: 2, y: 0, squares: 2, stoppedBy: 'exit' });
});

test('the solver finds a shortest solution that can be checked by hand', () => {
  // down to the bottom wall, then right into the exit; nothing does it in one
  assert.deepEqual(F.solve(OPEN), ['down', 'right']);
  assert.deepEqual(replay(OPEN, OPEN.start, F.solve(OPEN)), OPEN.exit);
  assert.deepEqual(F.solve(OPEN, at(0, 3)), ['right']);
  assert.deepEqual(F.solve(OPEN, OPEN.exit), []);
  assert.deepEqual(F.solve(TRAP), ['right', 'up']);
});

test('an impossible board is reported as unsolvable', () => {
  assert.equal(F.solve(BLOCKED), null);
  assert.equal(F.hint(BLOCKED, BLOCKED.start), null);
});

test('a trap gives no solution and no hint', () => {
  const fell = F.slide(TRAP, TRAP.start, 'down');
  assert.deepEqual([fell.x, fell.y], [0, 3]);
  assert.equal(F.solve(TRAP, at(0, 3)), null);
  assert.equal(F.hint(TRAP, at(0, 3)), null);
  assert.equal(F.solve(TRAP, at(0, 0)), null);
  assert.equal(F.hint(TRAP, TRAP.start), 'right');
});

test('the three par ranges do not overlap and rise from easy to hard', () => {
  const { easy, medium, hard } = F.DIFFICULTIES;
  assert.deepEqual(Object.keys(F.DIFFICULTIES), ['easy', 'medium', 'hard']);
  for (const range of [easy, medium, hard]) {
    assert.ok(Number.isInteger(range.min) && Number.isInteger(range.max) && range.min <= range.max);
  }
  assert.ok(easy.min >= 2);
  assert.ok(easy.max < medium.min);
  assert.ok(medium.max < hard.min);
});

for (const difficulty of ['easy', 'medium', 'hard']) {
  test(`${difficulty}: ${LEVELS_PER_DIFFICULTY} generated levels are solvable in exactly par, inside the range`, () => {
    const { min, max } = F.DIFFICULTIES[difficulty];
    for (const seed of seeds(LEVELS_PER_DIFFICULTY)) {
      const level = F.makeLevel(seed, difficulty);
      const moves = F.solve(level);
      assert.ok(moves, `${seed} has no solution`);
      assert.equal(moves.length, level.par, seed);
      assert.deepEqual(replay(level, level.start, moves), level.exit, seed);
      assert.equal(distanceToExit(level, level.start), level.par, seed);
      assert.ok(level.par >= min && level.par <= max, `${seed} par ${level.par}`);
    }
  });

  test(`${difficulty}: ${LEVELS_PER_DIFFICULTY} generated levels have no traps, and every hint starts a shortest solution`, () => {
    for (const seed of seeds(LEVELS_PER_DIFFICULTY)) {
      const level = F.makeLevel(seed, difficulty);
      for (const pos of restingPlaces(level)) {
        const best = distanceToExit(level, pos);
        assert.notEqual(best, null, `${seed} traps the puck at ${key(pos)}`);
        const stop = F.slide(level, pos, F.hint(level, pos));
        assert.ok(stop.squares > 0, seed);
        assert.equal(distanceToExit(level, at(stop.x, stop.y)), best - 1, `${seed} hint at ${key(pos)}`);
      }
    }
  });
}

test('a generated level has the promised shape', () => {
  const level = F.makeLevel('shape', 'medium');
  assert.equal(level.seed, 'shape');
  assert.equal(level.difficulty, 'medium');
  assert.equal(level.rows.length, level.height);
  for (const row of level.rows) {
    assert.equal(row.length, level.width);
    assert.match(row, /^[.#*]+$/);
  }
  assert.equal(level.rows[level.start.y][level.start.x], '.');
  assert.equal(level.rows[level.exit.y][level.exit.x], '.');
  assert.notDeepEqual(level.start, level.exit);
  assert.ok(level.rows.join('').includes('#'));
});

test('generated boards use both rocks and snow', () => {
  const tiles = seeds(50).map((seed) => F.makeLevel(seed, 'medium').rows.join('')).join('');
  assert.ok(tiles.includes('#') && tiles.includes('*'));
});

test('the same seed and difficulty give the same level, and others differ', () => {
  assert.deepEqual(F.makeLevel('abc', 'hard'), F.makeLevel('abc', 'hard'));
  assert.notDeepEqual(F.makeLevel('abc', 'hard').rows, F.makeLevel('abd', 'hard').rows);
  assert.notDeepEqual(F.makeLevel('abc', 'easy').rows, F.makeLevel('abc', 'hard').rows);
  assert.throws(() => F.makeLevel('abc', 'impossible'), RangeError);
});

test('the daily seed is the local date passed in', () => {
  assert.equal(F.dailySeed(new Date(2026, 10, 19, 9, 30)), '2026-11-19');
  assert.equal(F.dailySeed(new Date(2026, 10, 19, 23, 59)), '2026-11-19');
  assert.equal(F.dailySeed(new Date(2027, 0, 5)), '2027-01-05');
  const morning = F.makeLevel(F.dailySeed(new Date(2026, 10, 19, 9)), 'medium');
  const evening = F.makeLevel(F.dailySeed(new Date(2026, 10, 19, 21)), 'medium');
  assert.deepEqual(morning, evening);
});
