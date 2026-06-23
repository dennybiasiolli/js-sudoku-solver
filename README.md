# Sudoku Solver

A simple browser sudoku solver using constraint propagation (naked singles and hidden singles in rows/columns).

Originally built with AngularJS + Web SQL; rewritten in vanilla HTML/CSS/JS because both AngularJS 1.x and `openDatabase` (Web SQL) are obsolete in modern browsers.

## Quick Start

Open `sudokuSolver.html` in your browser:

```bash
open sudokuSolver.html
# or serve locally, e.g.:
python3 -m http.server 8080
# then visit http://localhost:8080/sudokuSolver.html
```

1. Enter known digits (1–9), or pick a preset from **Load example**
2. Click **Solve!** to auto-play (one cell at a time with explanations), or **Step** for single placements
3. **Stop** pauses auto-play; **Resume** (Solve!) or **Step** continues from where you left off
4. Cells filled by the solver appear in green (latest step highlighted); your clues stay bold/dark

**Clear** resets the board.

### Example puzzles

| Name | Notes |
|------|--------|
| Easy | Fully solvable with singles — good first demo |
| Medium | More steps, still completes |
| Hard (partial) | Needs techniques beyond singles — solver stops mid-way |
| Classic | Another fully solvable reference grid |

## How it works

Same strategy as the original SQL-backed version, without a database:

1. Every empty cell starts with candidates `{1..9}`
2. Placing a digit removes it from the same row, column, and 3×3 box
3. Repeat:
   - **Naked single**: only one candidate left in a cell → place it
   - **Hidden single (row/col)**: a digit is possible in only one cell of a row or column → place it
4. Stops when no more progress is made (easy/medium puzzles fully; harder ones may only partially solve without trial-and-error)

## Project layout

| File | Role |
|------|------|
| `sudokuSolver.html` | Page shell |
| `css/class.css` | Layout & grid styling |
| `js/solver.js` | Grid UI + solver logic |

Legacy Angular/jQuery sources are gone; history remains in git if you need them.
