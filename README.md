# Frostline

An ice-sliding puzzle where the computer makes every level and proves it can be solved before you see it.

A practice entry for IceHacks 2026. The event has closed: nothing was registered, submitted or published to it. No paid service was used and no account was created.

## What it does

You slide a puck across a board of ice to reach the exit.

- The puck does not stop when you want it to. It keeps sliding until a wall or a rock is in the way, a snow patch holds it, or it reaches the exit.
- No level you play is drawn by hand or stored in this repository. Each one is made from a seed, a short piece of text, so the same seed always gives the same level. (The only hand-drawn boards are a few tiny ones in the tests.)
- Before a level is shown, a solver searches it. That gives two promises: the level can be solved, and its **par**, the fewest moves that solve it, is known exactly.
- Three difficulties, set by par: easy is 3 or 4 moves, medium is 5 to 7, hard is 8 to 12.
- A daily level is the same for everyone on the same date.
- The page counts your moves against par and tells you how you did when you finish.
- You can undo, restart or ask for a hint. A hint is the next move of a shortest solution from where the puck is right now, not from the start.
- "Show me" plays a shortest solution on the board, then puts the puck back where you had it so you can carry on.
- Every level has a short code at the end of its address, such as `#easy/offline-check-0`, and "Link to this level" opens the same level again. To share a level, send the code: a friend with their own copy of the game adds it to the end of their own address and gets the same board. A daily level's code names its date, so it still gives the same level tomorrow.
- It plays with arrow keys (or W, A, S, D), swipes, or on-screen buttons. Each move is also put into words for screen readers, such as "Slid right 2 squares, stopped on snow."
- No sign-in. Nothing leaves your browser.

## Run it

Open `index.html` in a browser. That is the whole step: there is nothing to install or build, and it works with the network off.

For a first level to try, add `#easy/offline-check-0` to the end of the address. Up, right, right, down solves it at par.

To run the tests you need Node 20 or later and nothing else:

```
node --test
```

## How it was built

Plain HTML, CSS and JavaScript in four small parts, each with one job.

- `frost.js` holds the rules, the solver and the level maker. It has no page code, so it can be tested on its own.
- `board.js` and `board.css` draw the board, animate the slide, and report keys and swipes. They hold no game state.
- `index.html`, `style.css` and `ui.js` are the page around the board: choosing a level, moves against par, undo, restart, hint, "Show me", the level link and the words a screen reader speaks.
- `frost.test.js` holds the tests.

### How a level is proven solvable

The puck can only come to rest in a few places on a board. The solver starts from where the puck is and tries all four directions, then all four from each new resting place, and so on, one move further out each round. This is called a breadth-first search. The first time it reaches the exit, it has found a shortest solution, because every shorter list of moves was already tried.

The level maker scatters rocks and snow on a 9 by 9 board from the seed, picks a start and an exit, and asks the solver for par. It keeps the first board whose par fits the difficulty and throws the rest away. An easy level takes about 4 tries, a medium about 7 and a hard one about 41. There is no fixed limit on the number of tries; in our measurements the slowest level took about 2 thousandths of a second to make.

### No traps

A board can be solvable from the start and still be unfair: one wrong turn and the puck slides into a corner it can never leave. About 1 board in 8 that passed the par check had a trap like that. The level maker now checks every place the puck can come to rest and throws the board away unless each of them still has a way to the exit. That is why a hint is always available.

### Tests that don't trust the solver

The tests make 200 levels in each difficulty and check each one two ways. They play the solver's answer back through the same slide rule the player uses and check it lands on the exit in exactly par moves. They also measure the distance to the exit with their own separate search, written in the test file, and check it agrees with the solver. Smaller hand-drawn boards cover the slide rule itself, a board with no solution, and a board with a trap.

## Challenges

- **Traps.** Our first level maker only checked that a level could be solved from the start. A teammate pointed out that the promise "a hint from anywhere" would then be false. Fixing it meant checking every resting place, not just the first.
- **Hard levels are rare.** Most random boards are solved in a few moves. The par ranges were set by measuring what the level maker could reach reliably, not by picking round numbers.
- **Testing a solver.** If the solver is wrong, a test that asks the solver is wrong too. The tests had to reach the same answers by another route.
- **Fitting a phone.** The whole board and its controls have to be on screen at once with no scrolling, which is what settled the board at 9 by 9.
- **Changing course.** We built the rules for a different game first, then set it aside when a better idea won. Keeping each part small made that cheap.

## What we learned

- Proving something is cheaper than hoping for it. The search that proves a level solvable is under 30 lines, and it also gives par, the hint and the playback for free.
- "Solvable" was not the promise players care about. "You can always still win from here" was. Writing the promise down in plain words showed the gap.
- Agreeing how the parts talk to each other before writing them let three parts be built at the same time.

## What's next

- A level editor that refuses to save a level the solver cannot finish.
- New tiles, such as ice that cracks after one crossing.
- Saved progress and a streak for daily levels.
- Sound.

## Built with

- HTML, CSS and JavaScript, with no framework and no library
- Node's built-in test runner (`node --test`)
- AI coding tools: Claude Code and OpenAI Codex
- Playwright and headless Chrome, used only to check the page in a browser. The game needs neither.

## Tracks

- Design & Craft

## Credits and AI disclosure

- **AI wrote the code.** All of the code, the tests and this write-up were written by AI coding tools, working from a goal and judging criteria set by the project's owner. Claude Code, running Anthropic's Claude models, wrote the rules, solver, level maker and tests, the board, and this write-up. OpenAI Codex wrote the page, its controls and its styles. The tools planned the work, checked each other's changes and ran the tests. A person chose what to build and approved the goal.
- **No libraries, templates, datasets or outside assets** are used. Every shape on the board is drawn with CSS. There are no images or sounds. The stylesheet names a few fonts it would like, but none is included or downloaded, so the text uses fonts already on your device.
- **Ideas that are not ours.** Ice-sliding puzzles are an old kind of puzzle found in many games; this one copies no particular game, level or artwork. Breadth-first search is a textbook method. The level maker's random numbers come from a linear congruential generator using the constants given in *Numerical Recipes*, seeded with an FNV-1a hash; both are published methods, written out here by hand.
- Everything in this repository was written after its first commit.
