# Frostline: demo script

A script for a video of at most 3 minutes. The spoken words are the quoted lines; everything else says what to do on screen. The spoken part is under 420 words.

To follow it exactly, open `index.html#easy/offline-check-0`.

## The problem (about 30 seconds)

*On screen: the page, just opened on the easy level above.*

> You push a puck on ice and it will not stop until something stops it. That makes a small board surprisingly hard. And it makes one question matter: can this level even be solved?
>
> A designer could draw every level and test each one by hand. Frostline never draws a level. The computer makes each one, and proves it can be solved before you see it.

## The demo (about 1 minute 45 seconds)

*On screen: click the board, or press Tab until it shows its focus ring. Then press the up arrow key and the right arrow key. The line under the score reads "Slid right 1 square, stopped on snow."*

> Here is an easy level. Arrow keys, swipes or these on-screen arrows all slide the puck. It stops at a wall or a rock, and a snow patch holds it.

*On screen: point at Moves and Par.*

> This is par: the fewest slides that solve this level. That number is not a guess. A solver searched the level and found it.

*On screen: press Hint. The line reads "Hint: slide right."*

> If I am stuck, a hint gives the next move of a shortest solution from exactly where I am now, not from the start.

*On screen: press Show me. The puck plays four slides to the exit, then returns to where it was.*

> Or I can watch a shortest solution, and then I am put back where I was to finish it myself.

*On screen: click the on-screen right arrow, then the on-screen down arrow. The line reads "Solved at par!" and Next level appears.*

> Four slides, and par was four. It tells me so and offers the next level.

*On screen: choose Hard in the difficulty menu. Par reads 8 or more.*

> Hard levels need eight to twelve slides. There is Undo and Restart when a plan goes wrong.

*On screen: press Daily. The line reads "Daily puzzle" and today's date. Open "Link to this level" in a new tab: the same board appears. Point at the code at the end of the address.*

> The daily level is the same for everyone today. And every level has a short code at the end of its address. A friend adds that code to their own copy and gets the exact board that beat me.

*On screen: turn the network off and reload. The same level is still there.*

> It is one page. No sign-in, nothing to install, and it works offline.

## How it was built (about 45 seconds)

*On screen: `frost.js` at the `solve` function.*

> The solver tries every direction, then every direction from each place the puck comes to rest, one move further each round. The first time it reaches the exit, that is a shortest solution.
>
> The level maker scatters rocks and snow, asks the solver for par, and throws the board away if par does not fit the difficulty. It also throws away any board with a trap: a spot the puck can slide into and never leave. About one board in eight had one.

*On screen: a terminal running `node --test`, all passing.*

> The tests make two hundred levels in each difficulty and check every one, without taking the solver's word for it.
>
> It is plain HTML, CSS and JavaScript with no libraries, and the code was written by AI coding tools: Claude Code and OpenAI Codex.

*On screen: the daily level.*

> That is Frostline. Today's level is waiting.
