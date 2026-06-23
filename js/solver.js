'use strict';

/**
 * Sudoku solver using constraint propagation (same strategy as the original
 * Web SQL version: track possible values per cell, eliminate by row/col/box,
 * and place singles + unique candidates in rows/columns).
 */

const SIZE = 9;
const BOX = 3;

/** @type {HTMLInputElement[][]} */
let inputs = [];

/** @type {number[][]} board — 0 means empty */
let board = [];

/** @type {Set<number>[][]} candidates — possible values per cell */
let candidates = [];

function createEmptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function createCandidates() {
    return Array.from({ length: SIZE }, () =>
        Array.from({ length: SIZE }, () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
    );
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
    const input = e.target;
    const digit = input.value.replace(/[^1-9]/g, '');
    input.value = digit.slice(-1);
    input.classList.remove('solved');
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
            inputs[r][c].classList.remove('solved');
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

/** Cells with exactly one candidate left (original controllaValoriUnici). */
function findNakedSingles() {
    const placed = [];
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (!board[r][c] && candidates[r][c].size === 1) {
                const n = candidates[r][c].values().next().value;
                placed.push({ r, c, n });
            }
        }
    }
    return placed;
}

/** Digit appears only once as candidate in a row (original controllaRigheUnivoche). */
function findHiddenSinglesInRows() {
    const placed = [];
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
                placed.push({ r, c: onlyCol, n });
            }
        }
    }
    return placed;
}

/** Digit appears only once as candidate in a column (original controllaColonneUnivoche). */
function findHiddenSinglesInCols() {
    const placed = [];
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
                placed.push({ r: onlyRow, c, n });
            }
        }
    }
    return placed;
}

function applyPlacements(placements) {
    let count = 0;
    const seen = new Set();
    for (const { r, c, n } of placements) {
        const key = `${r},${c}`;
        if (board[r][c] || seen.has(key)) continue;
        seen.add(key);
        placeValue(r, c, n);
        count++;
    }
    return count;
}

/**
 * One pass of constraint propagation (original elaboraTabella).
 * @returns {number} how many cells were newly filled
 */
function propagateOnce() {
    let total = 0;
    total += applyPlacements(findNakedSingles());
    total += applyPlacements(findHiddenSinglesInRows());
    total += applyPlacements(findHiddenSinglesInCols());
    return total;
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

function solveStepByStep() {
    readBoardFromInputs();
    resetCandidates();
    applyGivenClues();

    if (hasContradiction()) {
        setStatus('Invalid puzzle: conflicting clues.', true);
        return;
    }

    const btn = document.getElementById('btnSolve');
    btn.disabled = true;
    setStatus('Solving…');

    function tick() {
        const filled = propagateOnce();
        writeBoardToInputs(true);

        if (filled > 0) {
            setTimeout(tick, 120);
            return;
        }

        btn.disabled = false;
        if (isComplete()) {
            setStatus('Completed!');
        } else if (hasContradiction()) {
            setStatus('Stuck: no valid solution from these clues.', true);
        } else {
            setStatus('Partial: more advanced logic (or trial) needed for the rest.');
        }
    }

    setTimeout(tick, 0);
}

function clearGrid() {
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            inputs[r][c].value = '';
            inputs[r][c].classList.remove('given', 'solved');
        }
    }
    board = createEmptyBoard();
    setStatus('');
    inputs[0][0].focus();
}

document.addEventListener('DOMContentLoaded', () => {
    buildGrid();
    document.getElementById('btnSolve').addEventListener('click', solveStepByStep);
    document.getElementById('btnClear').addEventListener('click', clearGrid);
});
