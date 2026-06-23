'use strict';

/**
 * Sudoku solver using constraint propagation (same strategy as the original
 * Web SQL version: track possible values per cell, eliminate by row/col/box,
 * and place singles + unique candidates in rows/columns).
 *
 * Supports auto-play, single-step, and step-back with human-readable explanations.
 */

const SIZE = 9;
const BOX = 3;
const STEP_DELAY_MS = 150;

/** @type {HTMLInputElement[][]} */
let inputs = [];

/** @type {number[][]} board — 0 means empty */
let board = [];

/** @type {Set<number>[][]} candidates — possible values per cell */
let candidates = [];

/** Clues frozen at solve-session start (for rebuild / step-back). */
/** @type {number[][]} */
let clueBoard = [];

/**
 * Solver placements applied in order (for step-back).
 * @type {{ r: number, c: number, n: number, reason: string }[]}
 */
let stepHistory = [];

/** Active solve session state */
let solving = false;
let autoPlaying = false;
/** True after no more singles (complete, stuck, or partial) — Back still works. */
let sessionFinished = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let autoTimer = null;
/** @type {HTMLInputElement | null} */
let lastHighlighted = null;

/**
 * Built-in examples (81 chars, 0 = empty).
 * Easy/medium fully solve with singles; hard demonstrates partial solve.
 */
const EXAMPLES = [
    {
        id: 'easy',
        label: 'Easy',
        // Fully solvable with naked/hidden singles
        puzzle: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    },
    {
        id: 'medium',
        label: 'Medium',
        puzzle: '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
    },
    {
        id: 'hard',
        label: 'Hard (partial)',
        // Makes progress with singles, then stalls (needs advanced techniques)
        puzzle: '000260701680070090090000500820000000004600000050003008000300004040000036700018000',
    },
    {
        id: 'classic',
        label: 'Classic',
        puzzle: '003020600900305001001806400008102900700000008006708200002609500800203009005010300',
    },
];

function createEmptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function createCandidates() {
    return Array.from({ length: SIZE }, () =>
        Array.from({ length: SIZE }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    );
}

function cellRef(r, c) {
    return `R${r + 1}C${c + 1}`;
}

function buildGrid() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    inputs = [];

    for (let r = 0; r < SIZE; r++) {
        const rowInputs = [];
        for (let c = 0; c < SIZE; c++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'numeric';
            input.maxLength = 1;
            input.className = 'cell';
            input.dataset.row = String(r);
            input.dataset.col = String(c);
            input.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}`);

            if (c % BOX === 0 && c > 0) input.classList.add('border-left');
            if (r % BOX === 0 && r > 0) input.classList.add('border-top');
            if (c === SIZE - 1) input.classList.add('border-right');
            if (r === SIZE - 1) input.classList.add('border-bottom');
            if (c === 0) input.classList.add('border-left-outer');
            if (r === 0) input.classList.add('border-top-outer');

            input.addEventListener('input', onCellInput);
            input.addEventListener('keydown', onCellKeydown);
            input.addEventListener('focus', (e) => e.target.select());

            grid.appendChild(input);
            rowInputs.push(input);
        }
        inputs.push(rowInputs);
    }
}

function onCellInput(e) {
    if (solving || stepHistory.length > 0) endSolveSession(false);
    const input = e.target;
    const digit = input.value.replace(/[^1-9]/g, '');
    input.value = digit.slice(-1);
    input.classList.remove('solved', 'just-placed');
}

function onCellKeydown(e) {
    const r = Number(e.target.dataset.row);
    const c = Number(e.target.dataset.col);
    let nr = r;
    let nc = c;

    switch (e.key) {
        case 'ArrowUp': nr = Math.max(0, r - 1); break;
        case 'ArrowDown': nr = Math.min(SIZE - 1, r + 1); break;
        case 'ArrowLeft': nc = Math.max(0, c - 1); break;
        case 'ArrowRight': nc = Math.min(SIZE - 1, c + 1); break;
        default: return;
    }

    if (nr !== r || nc !== c) {
        e.preventDefault();
        inputs[nr][nc].focus();
    }
}

function readBoardFromInputs() {
    board = createEmptyBoard();
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const v = inputs[r][c].value.trim();
            board[r][c] = v ? Number(v) : 0;
            inputs[r][c].classList.toggle('given', !!v);
            inputs[r][c].classList.remove('solved', 'just-placed');
        }
    }
}

function writeBoardToInputs(markSolved = false) {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const val = board[r][c];
            const input = inputs[r][c];
            const wasEmpty = !input.classList.contains('given');
            input.value = val ? String(val) : '';
            if (markSolved && val && wasEmpty) {
                input.classList.add('solved');
            }
        }
    }
}

function setStatus(msg, isError = false) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.classList.toggle('error', isError);
}

function clearHighlight() {
    if (lastHighlighted) {
        lastHighlighted.classList.remove('just-placed');
        lastHighlighted = null;
    }
}

function highlightCell(r, c) {
    clearHighlight();
    const input = inputs[r][c];
    input.classList.add('just-placed');
    lastHighlighted = input;
}

function resetCandidates() {
    candidates = createCandidates();
}

/**
 * Place a value and eliminate it from peers (row, column, box).
 * Mirrors the original impostaVal() SQL deletes.
 */
function placeValue(r, c, n) {
    board[r][c] = n;
    candidates[r][c] = new Set([n]);

    for (let i = 0; i < SIZE; i++) {
        if (i !== c) candidates[r][i].delete(n);
        if (i !== r) candidates[i][c].delete(n);
    }

    const br = Math.floor(r / BOX) * BOX;
    const bc = Math.floor(c / BOX) * BOX;
    for (let i = br; i < br + BOX; i++) {
        for (let j = bc; j < bc + BOX; j++) {
            if (i !== r || j !== c) candidates[i][j].delete(n);
        }
    }
}

function applyGivenClues() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const n = board[r][c];
            if (n) placeValue(r, c, n);
        }
    }
}

/**
 * Find the next single placement with an explanation.
 * Priority: naked singles, then hidden singles in rows, then columns.
 * @returns {{ r: number, c: number, n: number, reason: string } | null}
 */
function findNextStep() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (!board[r][c] && candidates[r][c].size === 1) {
                const n = candidates[r][c].values().next().value;
                return {
                    r,
                    c,
                    n,
                    reason: `only one candidate left in ${cellRef(r, c)} (naked single)`,
                };
            }
        }
    }

    for (let r = 0; r < SIZE; r++) {
        for (let n = 1; n <= SIZE; n++) {
            let onlyCol = -1;
            let count = 0;
            for (let c = 0; c < SIZE; c++) {
                if (!board[r][c] && candidates[r][c].has(n)) {
                    count++;
                    onlyCol = c;
                }
            }
            if (count === 1 && onlyCol >= 0 && !board[r][onlyCol]) {
                return {
                    r,
                    c: onlyCol,
                    n,
                    reason: `only candidate for ${n} in row ${r + 1} (hidden single)`,
                };
            }
        }
    }

    for (let c = 0; c < SIZE; c++) {
        for (let n = 1; n <= SIZE; n++) {
            let onlyRow = -1;
            let count = 0;
            for (let r = 0; r < SIZE; r++) {
                if (!board[r][c] && candidates[r][c].has(n)) {
                    count++;
                    onlyRow = r;
                }
            }
            if (count === 1 && onlyRow >= 0 && !board[onlyRow][c]) {
                return {
                    r: onlyRow,
                    c,
                    n,
                    reason: `only candidate for ${n} in column ${c + 1} (hidden single)`,
                };
            }
        }
    }

    return null;
}

function isComplete() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (!board[r][c]) return false;
        }
    }
    return true;
}

function hasContradiction() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (!board[r][c] && candidates[r][c].size === 0) return true;
        }
    }
    return false;
}

function stepCount() {
    return stepHistory.length;
}

function copyBoard(src) {
    return src.map((row) => row.slice());
}

function updateSolveButtons() {
    const btnSolve = document.getElementById('btnSolve');
    const btnBack = document.getElementById('btnBack');
    const btnStep = document.getElementById('btnStep');
    const btnStop = document.getElementById('btnStop');
    const steps = stepCount();
    const canForward = !autoPlaying && !(sessionFinished && isComplete());

    btnSolve.disabled = !canForward || (sessionFinished && !isComplete() && steps === 0);
    btnStep.disabled = autoPlaying || sessionFinished;
    btnBack.disabled = autoPlaying || steps === 0;
    btnStop.disabled = !autoPlaying;
    btnSolve.textContent =
        solving && !autoPlaying && !sessionFinished && steps > 0 ? 'Resume' : 'Solve!';
}

function stopAutoPlay() {
    if (autoTimer !== null) {
        clearTimeout(autoTimer);
        autoTimer = null;
    }
    autoPlaying = false;
}

function endSolveSession(clearHistory = true) {
    stopAutoPlay();
    solving = false;
    sessionFinished = false;
    if (clearHistory) {
        stepHistory = [];
        clueBoard = [];
    }
    updateSolveButtons();
}

function markSessionFinished(message, isError = false) {
    stopAutoPlay();
    sessionFinished = true;
    updateSolveButtons();
    setStatus(message, isError);
}

function stopSolving(showPaused = true) {
    stopAutoPlay();
    if (!solving) {
        updateSolveButtons();
        return;
    }
    updateSolveButtons();
    if (showPaused && !sessionFinished) {
        setStatus(`Paused at step ${stepCount()}. Click Step, Back, or Resume to continue.`);
    }
}

/**
 * Rebuild board/candidates from frozen clues + step history, then refresh the grid.
 * @param {{ r: number, c: number } | null} [highlight] cell to emphasize (last step after undo)
 */
function rebuildFromHistory(highlight = null) {
    board = copyBoard(clueBoard);
    resetCandidates();
    applyGivenClues();
    for (const { r, c, n } of stepHistory) {
        placeValue(r, c, n);
    }

    clearHighlight();
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const input = inputs[r][c];
            const isClue = clueBoard[r][c] !== 0;
            const val = board[r][c];
            input.value = val ? String(val) : '';
            input.classList.toggle('given', isClue);
            input.classList.toggle('solved', !isClue && !!val);
            input.classList.remove('just-placed');
        }
    }

    if (highlight) {
        highlightCell(highlight.r, highlight.c);
    } else if (stepHistory.length > 0) {
        const last = stepHistory[stepHistory.length - 1];
        highlightCell(last.r, last.c);
    }
}

/**
 * Start or resume a solve session from the current grid inputs (only if not yet solving).
 * @returns {boolean} false if init failed (invalid puzzle)
 */
function beginSolveSession() {
    if (solving) {
        if (sessionFinished) {
            // User stepped back from a finished state — allow forward again
            sessionFinished = false;
        }
        return true;
    }

    readBoardFromInputs();
    clueBoard = copyBoard(board);
    stepHistory = [];
    sessionFinished = false;
    resetCandidates();
    applyGivenClues();
    clearHighlight();

    if (hasContradiction()) {
        setStatus('Invalid puzzle: conflicting clues.', true);
        return false;
    }

    solving = true;
    return true;
}

function formatStepStatus(step, index, suffix = '') {
    const base = `Step ${index}: placed ${step.n} at ${cellRef(step.r, step.c)} — ${step.reason}`;
    return suffix ? `${base}${suffix}` : base;
}

/**
 * Apply one placement step.
 * @returns {'placed' | 'done' | 'stuck' | 'invalid'}
 */
function applyOneStep() {
    if (!beginSolveSession()) return 'invalid';
    sessionFinished = false;

    const step = findNextStep();
    if (!step) {
        if (isComplete()) {
            markSessionFinished(
                stepCount() > 0
                    ? `Completed in ${stepCount()} step${stepCount() === 1 ? '' : 's'}!`
                    : 'Already complete!'
            );
            return 'done';
        }
        if (hasContradiction()) {
            markSessionFinished('Stuck: no valid solution from these clues.', true);
            return 'stuck';
        }
        markSessionFinished(
            stepCount() > 0
                ? `Partial after ${stepCount()} step${stepCount() === 1 ? '' : 's'}: more advanced logic (or trial) needed for the rest.`
                : 'No singles to place. Try different clues or a harder technique set.'
        );
        return 'stuck';
    }

    placeValue(step.r, step.c, step.n);
    stepHistory.push(step);

    const input = inputs[step.r][step.c];
    if (!input.classList.contains('given')) {
        input.value = String(step.n);
        input.classList.add('solved');
    }
    highlightCell(step.r, step.c);

    if (isComplete()) {
        markSessionFinished(`${formatStepStatus(step, stepCount())}. Completed!`);
        return 'done';
    }
    if (hasContradiction()) {
        markSessionFinished('Stuck: no valid solution from these clues.', true);
        return 'stuck';
    }

    setStatus(formatStepStatus(step, stepCount()));
    return 'placed';
}

/**
 * Undo the last solver placement and restore the previous board state.
 */
function stepBack() {
    if (autoPlaying || stepHistory.length === 0) return;

    stopAutoPlay();
    sessionFinished = false;
    solving = true;

    const undone = stepHistory.pop();
    rebuildFromHistory();

    if (stepHistory.length === 0) {
        setStatus(
            `Undid step at ${cellRef(undone.r, undone.c)} (placed ${undone.n}). ` +
            'Back at starting clues. Click Step or Solve! to continue.'
        );
    } else {
        const prev = stepHistory[stepHistory.length - 1];
        setStatus(
            `Undid step at ${cellRef(undone.r, undone.c)} (placed ${undone.n}). ` +
            `Now at step ${stepCount()}: ${prev.n} at ${cellRef(prev.r, prev.c)} — ${prev.reason}`
        );
    }

    updateSolveButtons();
}

function scheduleAutoTick() {
    if (!autoPlaying) return;
    autoTimer = setTimeout(() => {
        autoTimer = null;
        if (!autoPlaying) return;
        const result = applyOneStep();
        if (result === 'placed') {
            scheduleAutoTick();
        } else {
            autoPlaying = false;
            updateSolveButtons();
        }
    }, STEP_DELAY_MS);
}

function startAutoSolve() {
    if (sessionFinished && isComplete()) {
        setStatus('Already complete! Use Back to review steps, or Clear / load another puzzle.');
        return;
    }

    if (!beginSolveSession()) return;

    if (isComplete() && stepCount() === 0) {
        markSessionFinished('Already complete!');
        return;
    }

    sessionFinished = false;
    autoPlaying = true;
    updateSolveButtons();
    setStatus(stepCount() === 0 ? 'Solving…' : `Resuming from step ${stepCount()}…`);
    scheduleAutoTick();
}

function stepOnce() {
    if (autoPlaying) return;
    applyOneStep();
    updateSolveButtons();
}

/**
 * Load an 81-char puzzle string (0 or . = empty) onto the grid.
 * @param {string} puzzle
 * @param {string} [label]
 */
function loadPuzzle(puzzle, label) {
    endSolveSession(true);
    clearHighlight();

    const cleaned = puzzle.replace(/[^0-9.]/g, '').replace(/\./g, '0');
    if (cleaned.length !== SIZE * SIZE) {
        setStatus('Invalid example puzzle data.', true);
        return;
    }

    for (let i = 0; i < SIZE * SIZE; i++) {
        const r = Math.floor(i / SIZE);
        const c = i % SIZE;
        const ch = cleaned[i];
        const n = ch === '0' ? 0 : Number(ch);
        const input = inputs[r][c];
        input.value = n ? String(n) : '';
        input.classList.toggle('given', !!n);
        input.classList.remove('solved', 'just-placed');
    }

    board = createEmptyBoard();
    updateSolveButtons();
    setStatus(label ? `Loaded “${label}”. Click Solve! or Step to begin.` : 'Example loaded.');
    inputs[0][0].focus();
}

function onExampleChange(e) {
    const id = e.target.value;
    if (!id) return;
    const example = EXAMPLES.find((ex) => ex.id === id);
    if (example) loadPuzzle(example.puzzle, example.label);
    e.target.value = '';
}

function clearGrid() {
    endSolveSession(true);
    clearHighlight();

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            inputs[r][c].value = '';
            inputs[r][c].classList.remove('given', 'solved', 'just-placed');
        }
    }
    board = createEmptyBoard();
    updateSolveButtons();
    setStatus('');
    inputs[0][0].focus();
}

function populateExampleSelect() {
    const select = document.getElementById('exampleSelect');
    for (const ex of EXAMPLES) {
        const opt = document.createElement('option');
        opt.value = ex.id;
        opt.textContent = ex.label;
        select.appendChild(opt);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    buildGrid();
    populateExampleSelect();
    updateSolveButtons();

    document.getElementById('btnSolve').addEventListener('click', startAutoSolve);
    document.getElementById('btnBack').addEventListener('click', stepBack);
    document.getElementById('btnStep').addEventListener('click', stepOnce);
    document.getElementById('btnStop').addEventListener('click', () => stopSolving(true));
    document.getElementById('btnClear').addEventListener('click', clearGrid);
    document.getElementById('exampleSelect').addEventListener('change', onExampleChange);
});
