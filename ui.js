(() => {
  'use strict';

  const F = window.Frostline;
  const el = id => document.getElementById(id);
  const board = F.Board(el('board'));
  const arrows = Array.from(document.querySelectorAll('[data-dir]'));
  const choose = el('difficulty');
  const status = el('status');
  const playback = el('playback');
  const playLabel = playback.textContent;
  let level;
  let trail = [];
  let sliding = false;
  let watching = false;
  let run = 0;

  const position = () => trail[trail.length - 1];
  const solved = () => position().x === level.exit.x && position().y === level.exit.y;
  const seed = () => Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-');
  const link = (difficulty, value) => '#' + difficulty + '/' + encodeURIComponent(value);

  function paintControls() {
    const finished = solved() && !sliding;
    const focusNext = finished && arrows.includes(document.activeElement);
    el('moves').textContent = trail.length - 1;
    el('par').textContent = level.par;
    el('undo').disabled = trail.length === 1 || watching;
    el('hint').disabled = watching || sliding || finished;
    arrows.forEach(button => { button.disabled = watching || finished; });
    playback.textContent = watching ? 'Stop playback' : playLabel;
    el('next-level').hidden = !finished;
    if (focusNext) el('next-level').focus({ preventScroll: true });
  }

  function place(trailToShow) {
    run++;
    watching = false;
    sliding = false;
    trail = trailToShow;
    board.draw(level, position());
    paintControls();
  }

  function readLink() {
    let difficulty = 'easy';
    let value;
    const daily = location.hash === '#daily';
    const match = /^#(easy|medium|hard)\/(.+)$/.exec(location.hash);
    if (daily) {
      difficulty = 'medium';
      value = F.dailySeed(new Date());
    } else if (match) {
      try {
        value = decodeURIComponent(match[2]);
        difficulty = match[1];
      } catch {
        // An incomplete percent escape cannot identify a shared level.
      }
    }
    if (value === undefined) {
      value = seed();
      history.replaceState(null, '', link(difficulty, value));
    }
    level = F.makeLevel(value, difficulty);
    choose.value = difficulty;
    el('daily').setAttribute('aria-pressed', String(daily));
    el('share').href = link(difficulty, value);
    place([level.start]);
    status.textContent = daily ? 'Daily puzzle · ' + value : 'Slide the puck to the ringed exit.';
  }

  function navigate(hash) {
    if (location.hash === hash) readLink();
    else location.hash = hash;
  }

  function result() {
    const over = trail.length - 1 - level.par;
    return over === 0 ? 'Solved at par!' : 'Solved ' + over + ' above par.';
  }

  async function slide(dir) {
    if (sliding || solved()) return;
    const to = F.slide(level, position(), dir);
    if (to.squares === 0) {
      status.textContent = 'Blocked by a ' + to.stoppedBy + '. Try another direction.';
      return;
    }
    const currentRun = run;
    sliding = true;
    trail.push({ x: to.x, y: to.y });
    paintControls();
    await board.move(to);
    if (currentRun !== run) return;
    sliding = false;
    const stop = { wall: 'at a wall', rock: 'at a rock', snow: 'on snow', exit: 'on the exit' };
    const distance = to.squares + (to.squares === 1 ? ' square' : ' squares');
    status.textContent = 'Slid ' + dir + ' ' + distance + ', stopped ' + stop[to.stoppedBy] + '.' +
      (solved() ? ' ' + result() : '');
    paintControls();
  }

  function input(dir) {
    if (!watching) void slide(dir);
  }

  async function showSolution() {
    if (watching) {
      place(trail);
      status.textContent = 'Playback stopped. You can play from here.';
      return;
    }
    const directions = F.solve(level, level.start);
    if (!directions) {
      status.textContent = 'No route to the exit. Choose a new level.';
      return;
    }
    place([level.start]);
    const currentRun = run;
    watching = true;
    paintControls();
    for (const direction of directions) {
      await slide(direction);
      if (currentRun !== run) return;
      if (!solved()) await new Promise(resolve => setTimeout(resolve, 300));
      if (currentRun !== run) return;
    }
    watching = false;
    paintControls();
  }

  board.onInput = input;
  arrows.forEach(button => button.addEventListener('click', () => input(button.dataset.dir)));
  choose.addEventListener('change', () => navigate(link(choose.value, seed())));
  el('new-level').addEventListener('click', () => navigate(link(choose.value, seed())));
  el('daily').addEventListener('click', () => navigate('#daily'));
  el('next-level').addEventListener('click', () => {
    navigate(link(choose.value, seed()));
    el('board').querySelector('[tabindex]')?.focus();
  });
  el('undo').addEventListener('click', () => {
    if (trail.length < 2) return;
    place(trail.slice(0, -1));
    status.textContent = 'Last move undone.';
  });
  el('restart').addEventListener('click', () => {
    place([level.start]);
    status.textContent = 'Restarted at the beginning.';
  });
  el('hint').addEventListener('click', () => {
    const direction = F.hint(level, position());
    status.textContent = direction ? 'Hint: slide ' + direction + '.' : 'No way out from here. Undo or restart.';
  });
  playback.addEventListener('click', showSolution);
  window.addEventListener('hashchange', readLink);
  readLink();
})();
