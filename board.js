// Frostline board: draws a level, slides the puck and reports arrow keys, WASD and swipes.
// Holds no game state and makes no rules; the page decides what each input does.
(function (root) {
  'use strict';

  const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  };
  const CELL = { '.': 'ice', '#': 'rock', '*': 'snow' };
  const SWIPE_MIN = 24; // px of travel before a drag counts as a swipe
  const MS_PER_SQUARE = 70;

  const reducedMotion = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Board(container) {
    const el = document.createElement('div');
    el.className = 'fl-board';
    el.tabIndex = 0;
    el.setAttribute('role', 'application');
    el.setAttribute('aria-roledescription', 'puzzle board');
    el.setAttribute('aria-label', 'Frostline board. Use the arrow keys to slide the puck.');

    const grid = document.createElement('div');
    grid.className = 'fl-grid';
    const puck = document.createElement('div');
    puck.className = 'fl-puck';
    puck.setAttribute('aria-hidden', 'true');
    el.append(grid, puck);
    container.replaceChildren(el);

    let at = { x: 0, y: 0 };
    let pending = null;

    function place(pos, ms) {
      puck.style.transitionDuration = `${ms}ms`;
      puck.style.setProperty('--fl-x', pos.x);
      puck.style.setProperty('--fl-y', pos.y);
      at = { x: pos.x, y: pos.y };
    }

    const board = {
      onInput: null,

      draw(level, pos) {
        const w = level.width, h = level.height;
        el.style.setProperty('--fl-w', w);
        el.style.setProperty('--fl-h', h);
        const cells = [];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const c = document.createElement('div');
            const isExit = level.exit && level.exit.x === x && level.exit.y === y;
            c.className = `fl-cell fl-${isExit ? 'exit' : CELL[level.rows[y][x]] || 'ice'}`;
            cells.push(c);
          }
        }
        grid.replaceChildren(...cells);
        if (pending) pending();
        place(pos, 0);
      },

      // Resolves when the puck has arrived; at once under reduced motion.
      move(to) {
        if (pending) pending();
        const squares = Math.abs(to.x - at.x) + Math.abs(to.y - at.y);
        if (reducedMotion() || squares === 0) {
          place(to, 0);
          return Promise.resolve();
        }
        const ms = Math.min(600, 80 + squares * MS_PER_SQUARE);
        return new Promise((resolve) => {
          let timer = 0;
          const done = () => {
            if (pending !== done) return;
            pending = null;
            clearTimeout(timer);
            puck.removeEventListener('transitionend', done);
            resolve();
          };
          pending = done;
          puck.addEventListener('transitionend', done);
          timer = setTimeout(done, ms + 100); // transitionend can be skipped, e.g. in a hidden tab
          // Force the start position to apply before the new transform.
          void puck.offsetWidth;
          place(to, ms);
        });
      },
    };

    const send = (dir) => { if (typeof board.onInput === 'function') board.onInput(dir); };

    el.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const dir = KEYS[e.key];
      if (!dir) return;
      e.preventDefault();
      send(dir);
    });

    let start = null;
    el.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      el.focus({ preventScroll: true });
    });
    el.addEventListener('pointerup', (e) => {
      if (!start || start.id !== e.pointerId) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
      send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    el.addEventListener('pointercancel', () => { start = null; });

    return board;
  }

  root.Frostline = root.Frostline || {};
  root.Frostline.Board = Board;
})(typeof globalThis !== 'undefined' ? globalThis : this);
