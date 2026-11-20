'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./game.js');

const event = (id) => E.EVENTS.find((e) => e.id === id);
const seeds = (n) => Array.from({ length: n }, (_, i) => 'seed-' + i);
const mispriced = (r) => r.price * r.event.total !== r.event.hits * 100;
const round = (hits, total, price, happened) => ({ event: { hits, total }, price, happened });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('exact chances match known values', () => {
  assert.deepEqual([event('dice-sum-7').hits, event('dice-sum-7').total], [6, 36]);
  // 11 or more is half of 216 by symmetry; 27 ways make exactly 11
  assert.deepEqual([event('dice-3-sum-12-plus').hits, event('dice-3-sum-12-plus').total], [108 - 27, 216]);
  assert.deepEqual([event('coin-heads').hits, event('coin-heads').total], [1, 2]);
  assert.deepEqual([event('coins-3-two-heads').hits, event('coins-3-two-heads').total], [3, 8]);
  assert.deepEqual([event('card-heart').hits, event('card-heart').total], [13, 52]);
  // a pair in two cards is 3 in 51
  assert.equal(event('cards-pair').hits * 51, event('cards-pair').total * 3);
});

test('there are at least 12 events across dice, coins and cards', () => {
  assert.ok(E.EVENTS.length >= 12);
  assert.equal(new Set(E.EVENTS.map((e) => e.id)).size, E.EVENTS.length);
  assert.deepEqual([...new Set(E.EVENTS.map((e) => e.kind))].sort(), ['cards', 'coins', 'dice']);
  for (const e of E.EVENTS) {
    assert.ok(e.text.length > 0);
    assert.ok(Number.isInteger(e.hits) && e.hits > 0 && e.hits < e.total, e.id);
  }
});

test('the same seed gives the same ten rounds and outcomes', () => {
  assert.deepEqual(E.newGame('abc'), E.newGame('abc'));
  assert.notDeepEqual(E.newGame('abc'), E.newGame('abd'));
  assert.equal(E.newGame('abc').seed, 'abc');
});

test('a game is ten different events', () => {
  for (const seed of seeds(200)) {
    const { rounds } = E.newGame(seed);
    assert.equal(rounds.length, E.ROUNDS);
    assert.equal(new Set(rounds.map((r) => r.event.id)).size, E.ROUNDS);
  }
});

test('every price is a whole number from 1 to 99 and at least 7 in 10 are off', () => {
  for (const seed of seeds(500)) {
    const { rounds } = E.newGame(seed);
    for (const r of rounds) {
      assert.ok(Number.isInteger(r.price) && r.price >= 1 && r.price <= 99, `${seed} ${r.price}`);
    }
    assert.ok(rounds.filter(mispriced).length >= 7, seed);
  }
});

test('what came up agrees with whether it happened', () => {
  const checks = {
    'dice-sum-7': (d) => d[0] + d[1] === 7,
    'dice-3-sum-12-plus': (d) => d[0] + d[1] + d[2] >= 12,
    'coin-heads': (d) => d[0] === 'H',
    'coins-3-two-heads': (d) => d.filter((s) => s === 'H').length === 2,
    'card-heart': (d) => d[0].endsWith('♥'),
    'cards-pair': (d) => d[0].slice(0, -1) === d[1].slice(0, -1),
  };
  const seen = {};
  for (const seed of seeds(500)) {
    for (const r of E.newGame(seed).rounds) {
      const check = checks[r.event.id];
      if (!check) continue;
      assert.equal(check(r.drawn), r.happened, `${seed} ${r.event.id} ${r.drawn}`);
      seen[r.event.id] = (seen[r.event.id] || 0) + 1;
    }
  }
  assert.deepEqual(Object.keys(seen).sort(), Object.keys(checks).sort());
});

test('two cards are never the same card', () => {
  for (const seed of seeds(500)) {
    for (const r of E.newGame(seed).rounds) {
      if (r.event.kind === 'cards') assert.equal(new Set(r.drawn).size, r.drawn.length);
    }
  }
});

test('a coin lands heads about half the time', () => {
  let heads = 0;
  let flips = 0;
  for (const seed of seeds(3000)) {
    for (const r of E.newGame(seed).rounds) {
      if (r.event.id !== 'coin-heads') continue;
      flips += 1;
      heads += r.happened ? 1 : 0;
    }
  }
  assert.ok(flips > 1000);
  assert.ok(heads / flips > 0.45 && heads / flips < 0.55, `${heads} of ${flips}`);
});

test('payouts for yes, no and pass', () => {
  assert.equal(E.STAKE, 100);
  assert.equal(E.START, 1000);
  near(E.settle(round(1, 4, 25, true), 'yes'), 300); // 100 x 100 / 25 back, less the stake
  near(E.settle(round(1, 4, 25, false), 'yes'), -100);
  near(E.settle(round(1, 4, 25, false), 'no'), 100 * 100 / 75 - 100);
  near(E.settle(round(1, 4, 25, true), 'no'), -100);
  near(E.settle(round(1, 4, 25, true), 'pass'), 0);
  near(E.settle(round(1, 4, 25, false), 'pass'), 0);
  assert.throws(() => E.settle(round(1, 4, 25, true), 'maybe'), TypeError);
});

test('the perfect judge backs yes above the price, no below, and passes when equal', () => {
  assert.equal(E.perfectCall(round(1, 2, 50, true)), 'pass');
  assert.equal(E.perfectCall(round(1, 2, 40, true)), 'yes');
  assert.equal(E.perfectCall(round(1, 2, 60, true)), 'no');
  assert.equal(E.perfectCall(round(1, 6, 17, true)), 'no'); // 16.67 is below 17
  assert.equal(E.perfectCall(round(1, 6, 16, true)), 'yes');
});

test('expected points: fair price is worth nothing and the perfect call is never beaten', () => {
  near(E.expected(round(1, 2, 50, true), 'yes'), 0);
  near(E.expected(round(1, 2, 50, true), 'no'), 0);
  near(E.expected(round(1, 2, 40, true), 'yes'), 25); // half the time 250 back, less 100
  near(E.expected(round(1, 2, 40, false), 'yes'), 25); // what happened does not matter
  near(E.expected(round(1, 2, 40, true), 'pass'), 0);
  for (const seed of seeds(200)) {
    for (const r of E.newGame(seed).rounds) {
      const best = E.expected(r, E.perfectCall(r));
      for (const call of ['yes', 'no', 'pass']) assert.ok(best >= E.expected(r, call) - 1e-9);
    }
  }
});

test('summary adds up from the starting points', () => {
  const game = E.newGame('sum');
  const calls = ['yes', 'no', 'pass', 'yes', 'no', 'pass', 'yes', 'no', 'pass', 'yes'];
  const s = E.summary(game, calls);
  assert.equal(s.rows.length, 10);
  let player = E.START;
  let perfect = E.START;
  let playerExpected = E.START;
  let perfectExpected = E.START;
  game.rounds.forEach((r, i) => {
    const row = s.rows[i];
    assert.equal(row.call, calls[i]);
    assert.equal(row.perfectCall, E.perfectCall(r));
    near(row.change, E.settle(r, calls[i]));
    near(row.expected, E.expected(r, calls[i]));
    near(row.perfectChange, E.settle(r, row.perfectCall));
    player += row.change;
    perfect += row.perfectChange;
    playerExpected += row.expected;
    perfectExpected += E.expected(r, row.perfectCall);
  });
  near(s.player, player);
  near(s.perfect, perfect);
  near(s.playerExpected, playerExpected);
  near(s.perfectExpected, perfectExpected);
  assert.ok(s.perfectExpected >= s.playerExpected);
  assert.throws(() => E.summary(game, ['yes']), TypeError);
});

test('feedback depends on how the player played, not on luck', () => {
  const game = E.newGame('feedback');
  const perfect = game.rounds.map((r) => E.perfectCall(r));
  const allPass = game.rounds.map(() => 'pass');
  const allYes = game.rounds.map(() => 'yes');
  const allNo = game.rounds.map(() => 'no');
  const said = [perfect, allPass, allYes, allNo].map((calls) => E.summary(game, calls).feedback);
  assert.equal(new Set(said).size, 4, said.join(' | '));
  for (const sentence of said) assert.ok(sentence.length > 20 && !sentence.includes('\n'));

  const unlucky = { seed: game.seed, rounds: game.rounds.map((r) => ({ ...r, happened: !r.happened })) };
  for (const calls of [perfect, allPass, allYes, allNo]) {
    assert.equal(E.summary(unlucky, calls).feedback, E.summary(game, calls).feedback);
  }
});
