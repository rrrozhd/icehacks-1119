// Edgewise rules: the events, their exact chances, seeded games and scoring.
// A plain script with no page code. In a browser it fills `Edgewise`;
// under Node the same object is `require('./game.js')`.
(function () {
  'use strict';

  const ROUNDS = 10;
  const STAKE = 100; // points staked on every yes or no
  const START = 1000; // ten lost rounds end at exactly zero
  const FAIR_ROUNDS = 2; // rounds priced at the true chance, where passing is right
  const MIN_SHIFT = 4; // how far, in points per 100, the other prices sit from the true chance
  const MAX_SHIFT = 15;

  // Every equally likely outcome of throwing `count` things with these `sides`.
  function throws(sides, count) {
    let all = [[]];
    for (let i = 0; i < count; i++) {
      all = all.flatMap((sofar) => sides.map((side) => sofar.concat([side])));
    }
    return all;
  }

  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const DECK = SUITS.flatMap((suit) => RANKS.map((rank) => rank + suit));
  const rank = (card) => card.slice(0, -1);
  const suit = (card) => card.slice(-1);
  const red = (card) => suit(card) === '♥' || suit(card) === '♦';

  const DIE = [1, 2, 3, 4, 5, 6];
  const SPACES = {
    dice2: throws(DIE, 2),
    dice3: throws(DIE, 3),
    coins1: throws(['H', 'T'], 1),
    coins3: throws(['H', 'T'], 3),
    coins4: throws(['H', 'T'], 4),
    coins5: throws(['H', 'T'], 5),
    cards1: DECK.map((card) => [card]),
    // two cards off the top, in order, never the same card twice
    cards2: DECK.flatMap((a) => DECK.filter((b) => b !== a).map((b) => [a, b])),
  };

  const sum = (dice) => dice.reduce((a, b) => a + b, 0);
  const heads = (coins) => coins.filter((side) => side === 'H').length;

  // [id, kind, outcome space, text, does this outcome count?]
  const DEFS = [
    ['dice-sum-7', 'dice', 'dice2', 'Two dice add up to 7', (d) => sum(d) === 7],
    ['dice-double', 'dice', 'dice2', 'Two dice show the same number', (d) => d[0] === d[1]],
    ['dice-sum-5-less', 'dice', 'dice2', 'Two dice add up to 5 or less', (d) => sum(d) <= 5],
    ['dice-2-a-six', 'dice', 'dice2', 'Two dice show at least one six', (d) => d.includes(6)],
    ['dice-3-sum-12-plus', 'dice', 'dice3', 'Three dice add up to 12 or more', (d) => sum(d) >= 12],
    ['dice-3-a-six', 'dice', 'dice3', 'Three dice show at least one six', (d) => d.includes(6)],
    ['dice-3-all-different', 'dice', 'dice3', 'Three dice all show different numbers', (d) => new Set(d).size === 3],
    ['coin-heads', 'coins', 'coins1', 'One coin lands heads', (c) => heads(c) === 1],
    ['coins-3-two-heads', 'coins', 'coins3', 'Three coins show exactly two heads', (c) => heads(c) === 2],
    ['coins-3-all-same', 'coins', 'coins3', 'Three coins all land the same way', (c) => new Set(c).size === 1],
    ['coins-4-two-heads', 'coins', 'coins4', 'Four coins show exactly two heads', (c) => heads(c) === 2],
    ['coins-5-four-plus', 'coins', 'coins5', 'Five coins show four or more heads', (c) => heads(c) >= 4],
    ['card-heart', 'cards', 'cards1', 'One card is a heart', (k) => suit(k[0]) === '♥'],
    ['card-face', 'cards', 'cards1', 'One card is a jack, queen or king', (k) => 'JQK'.includes(rank(k[0]))],
    ['cards-pair', 'cards', 'cards2', 'Two cards have the same rank', (k) => rank(k[0]) === rank(k[1])],
    ['cards-same-suit', 'cards', 'cards2', 'Two cards share a suit', (k) => suit(k[0]) === suit(k[1])],
    ['cards-an-ace', 'cards', 'cards2', 'Two cards include at least one ace', (k) => k.some((c) => rank(c) === 'A')],
    ['cards-both-red', 'cards', 'cards2', 'Two cards are both red', (k) => k.every(red)],
  ].map(([id, kind, space, text, counts]) => ({
    space: SPACES[space],
    counts,
    // hits and total are counted here, never typed in
    event: Object.freeze({
      id, kind, text,
      hits: SPACES[space].filter(counts).length,
      total: SPACES[space].length,
    }),
  }));

  const EVENTS = Object.freeze(DEFS.map((def) => def.event));

  // A seeded generator, so one seed always gives one game. The seed text is
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

  function shuffled(items, below) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = below(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function newGame(seed) {
    seed = String(seed);
    const below = seeded(seed);
    const defs = shuffled(DEFS, below).slice(0, ROUNDS);
    // which rounds are fairly priced is itself shuffled
    const fair = shuffled(defs.map((_, i) => i < FAIR_ROUNDS), below);
    const rounds = defs.map((def, i) => {
      const { hits, total } = def.event;
      const size = fair[i] ? 0 : MIN_SHIFT + below(MAX_SHIFT - MIN_SHIFT + 1);
      const shift = below(2) ? size : -size;
      const price = Math.min(99, Math.max(1, Math.round((hits * 100) / total) + shift));
      const drawn = def.space[below(total)];
      return { event: def.event, price, happened: def.counts(drawn), drawn: drawn.slice() };
    });
    return { seed, rounds };
  }

  // Net change in points. A ticket costs its price and pays 100, so STAKE
  // buys STAKE / price tickets. Yes costs `price`; no costs `100 - price`.
  function settle(round, call) {
    if (call === 'pass') return 0;
    if (call !== 'yes' && call !== 'no') throw new TypeError('call must be yes, no or pass');
    const cost = call === 'yes' ? round.price : 100 - round.price;
    const won = (call === 'yes') === round.happened;
    return (won ? (STAKE * 100) / cost : 0) - STAKE;
  }

  // The average of `settle` over the true chance: what the call is worth before luck.
  function expected(round, call) {
    if (call === 'pass') return 0;
    if (call !== 'yes' && call !== 'no') throw new TypeError('call must be yes, no or pass');
    const { hits, total } = round.event;
    const chance = (call === 'yes' ? hits : total - hits) / total;
    const cost = call === 'yes' ? round.price : 100 - round.price;
    return (chance * STAKE * 100) / cost - STAKE;
  }

  // Compared as whole numbers so 1 in 6 against a price of 17 is exact.
  function perfectCall(round) {
    const chance = round.event.hits * 100;
    const price = round.price * round.event.total;
    return chance > price ? 'yes' : chance < price ? 'no' : 'pass';
  }

  const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times');

  const FEEDBACK = {
    yes: (n) => `You paid too much for yes ${times(n)}: the true chance was lower than the price, so no was the better ticket.`,
    no: (n) => `You backed no ${times(n)} when the event was likelier than its price said: yes was the better ticket.`,
    pass: (n) => `You passed on a good price ${times(n)}: when the price is far from the true chance, back the side it favours.`,
  };
  const NO_MISTAKES = 'You made every call a perfect judge would: no price fooled you.';

  function summary(game, calls) {
    if (!Array.isArray(calls) || calls.length !== game.rounds.length) {
      throw new TypeError('one call is needed for every round');
    }
    const perfectCalls = game.rounds.map(perfectCall);
    const perfectExpected = game.rounds.map((round, i) => expected(round, perfectCalls[i]));
    const rows = game.rounds.map((round, i) => ({
      call: calls[i],
      change: settle(round, calls[i]),
      expected: expected(round, calls[i]),
      perfectCall: perfectCalls[i],
      perfectChange: settle(round, perfectCalls[i]),
    }));
    const total = (points) => points.reduce((a, b) => a + b, START);

    // Feedback names the kind of call that cost the most expected points,
    // so a lucky or unlucky game reads the same.
    const cost = { yes: 0, no: 0, pass: 0 };
    const count = { yes: 0, no: 0, pass: 0 };
    rows.forEach((row, i) => {
      if (row.call === row.perfectCall || row.perfectCall === 'pass') return;
      cost[row.call] += perfectExpected[i] - row.expected;
      count[row.call] += 1;
    });
    const worst = Object.keys(cost).reduce((a, b) => (cost[b] > cost[a] ? b : a));

    return {
      player: total(rows.map((row) => row.change)),
      perfect: total(rows.map((row) => row.perfectChange)),
      playerExpected: total(rows.map((row) => row.expected)),
      perfectExpected: total(perfectExpected),
      rows,
      feedback: count[worst] ? FEEDBACK[worst](count[worst]) : NO_MISTAKES,
    };
  }

  const api = { ROUNDS, STAKE, START, EVENTS, newGame, settle, expected, perfectCall, summary };
  globalThis.Edgewise = Object.assign(globalThis.Edgewise || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.Edgewise;
})();
