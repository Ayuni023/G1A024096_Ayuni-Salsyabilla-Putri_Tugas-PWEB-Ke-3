'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let size = 3;
let tiles = [];
let moves = 0;
let seconds = 0;
let timerInterval = null;
let isSolving = false;

// ─── DOM ──────────────────────────────────────────────────────────────────────
const board        = document.getElementById('board');
const timerEl      = document.getElementById('timer');
const movesEl      = document.getElementById('moves');
const sizeDisplay  = document.getElementById('size-display');
const winOverlay   = document.getElementById('win-overlay');
const winStats     = document.getElementById('win-stats');
const btnReset     = document.getElementById('btn-reset');
const btnShuffle   = document.getElementById('btn-shuffle');
const btnSolve     = document.getElementById('btn-solve');
const btnPlayAgain = document.getElementById('btn-play-again');
const sizeBtns     = document.querySelectorAll('.size-btn');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function goalState() {
  const arr = [];
  for (let i = 1; i < size * size; i++) arr.push(i);
  arr.push(0);
  return arr;
}

function isSolved(t) {
  const g = goalState();
  return t.every((v, i) => v === g[i]);
}

function emptyIdx(t) { return t.indexOf(0); }

function neighbors(idx) {
  const n = [];
  const row = Math.floor(idx / size), col = idx % size;
  if (row > 0) n.push(idx - size);
  if (row < size - 1) n.push(idx + size);
  if (col > 0) n.push(idx - 1);
  if (col < size - 1) n.push(idx + 1);
  return n;
}

function swap(arr, a, b) {
  const copy = [...arr];
  [copy[a], copy[b]] = [copy[b], copy[a]];
  return copy;
}

function countInversions(arr) {
  let inv = 0;
  const flat = arr.filter(v => v !== 0);
  for (let i = 0; i < flat.length; i++)
    for (let j = i + 1; j < flat.length; j++)
      if (flat[i] > flat[j]) inv++;
  return inv;
}

function isSolvable(arr) {
  const inv = countInversions(arr);
  if (size % 2 === 1) return inv % 2 === 0;
  const emptyRow = Math.floor(emptyIdx(arr) / size);
  const fromBottom = size - emptyRow;
  return (fromBottom % 2 === 1) ? (inv % 2 === 0) : (inv % 2 === 1);
}

function shuffle() {
  let arr = goalState();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (!isSolvable(arr)) {
    // swap first two non-empty tiles to fix parity
    const nz = arr.filter(v => v !== 0);
    const i0 = arr.indexOf(nz[0]);
    const i1 = arr.indexOf(nz[1]);
    [arr[i0], arr[i1]] = [arr[i1], arr[i0]];
  }
  return arr;
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    seconds++;
    timerEl.textContent = seconds >= 60
      ? `${Math.floor(seconds / 60)}m${seconds % 60}s`
      : `${seconds}s`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  seconds = 0;
  timerEl.textContent = '0s';
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  board.setAttribute('data-size', size);

  const goal = goalState();

  tiles.forEach((val, idx) => {
    const tile = document.createElement('div');
    tile.className = 'tile' + (val === 0 ? ' empty' : '');
    if (val !== 0) {
      tile.textContent = val;
      if (val === goal[idx]) tile.classList.add('correct');
      tile.addEventListener('click', () => handleTileClick(idx));
    }
    board.appendChild(tile);
  });
}

// ─── Game Logic ───────────────────────────────────────────────────────────────
function handleTileClick(idx) {
  if (isSolving) return;
  const empty = emptyIdx(tiles);
  if (!neighbors(empty).includes(idx)) return;

  // start timer on first move
  if (moves === 0) startTimer();

  tiles = swap(tiles, idx, empty);
  moves++;
  movesEl.textContent = moves;

  // animate clicked tile
  const tileEls = board.querySelectorAll('.tile');
  tileEls[idx].classList.add('moving');

  render();

  if (isSolved(tiles)) {
    stopTimer();
    setTimeout(showWin, 300);
  }
}

function showWin() {
  winStats.textContent = `${moves} MOVES · ${timerEl.textContent}`;
  winOverlay.classList.add('show');
}

function initGame(doShuffle = true) {
  stopSolve();
  winOverlay.classList.remove('show');
  moves = 0;
  movesEl.textContent = 0;
  resetTimer();
  sizeDisplay.textContent = `${size}×${size}`;
  tiles = doShuffle ? shuffle() : goalState();
  render();
}

// ─── A* Solver (for 3×3 only, BFS for guidance) ──────────────────────────────
function manhattan(arr) {
  let dist = 0;
  const goal = goalState();
  arr.forEach((val, idx) => {
    if (val === 0) return;
    const goalIdx = goal.indexOf(val);
    dist += Math.abs(Math.floor(idx / size) - Math.floor(goalIdx / size))
          + Math.abs(idx % size - goalIdx % size);
  });
  return dist;
}

function solveAStar(start) {
  if (size > 3) return null; // too complex for real-time A*
  const key = arr => arr.join(',');
  const startKey = key(start);
  const open = [{ tiles: start, g: 0, h: manhattan(start), path: [] }];
  const visited = new Set([startKey]);

  while (open.length) {
    open.sort((a, b) => (a.g + a.h) - (b.g + b.h));
    const curr = open.shift();
    if (isSolved(curr.tiles)) return curr.path;

    const empty = emptyIdx(curr.tiles);
    for (const nb of neighbors(empty)) {
      const next = swap(curr.tiles, empty, nb);
      const nk = key(next);
      if (visited.has(nk)) continue;
      visited.add(nk);
      if (visited.size > 200000) return null;
      open.push({
        tiles: next,
        g: curr.g + 1,
        h: manhattan(next),
        path: [...curr.path, nb]
      });
    }
  }
  return null;
}

// For 4x4 and 5x5, use a greedy random-walk approach
function solveGreedy(start) {
  // Simple approach: make random legal moves that decrease manhattan distance
  let current = [...start];
  const moves = [];
  let maxIter = 5000;

  while (!isSolved(current) && maxIter-- > 0) {
    const empty = emptyIdx(current);
    const nbs = neighbors(empty);
    let best = null, bestH = Infinity;

    // pick neighbor move that reduces heuristic
    for (const nb of nbs) {
      const next = swap(current, empty, nb);
      const h = manhattan(next);
      if (h < bestH) { bestH = h; best = { next, nb }; }
    }

    // add some randomness to escape local minima
    if (Math.random() < 0.15 || !best) {
      const nb = nbs[Math.floor(Math.random() * nbs.length)];
      best = { next: swap(current, empty, nb), nb };
    }

    moves.push(best.nb);
    current = best.next;
  }

  return isSolved(current) ? moves : null;
}

let solveTimeout = null;

function stopSolve() {
  isSolving = false;
  clearTimeout(solveTimeout);
  board.classList.remove('solving');
  btnSolve.textContent = 'Solve';
}

async function startSolve() {
  if (isSolving) { stopSolve(); return; }
  if (isSolved(tiles)) return;

  isSolving = true;
  board.classList.add('solving');
  btnSolve.textContent = 'Stop';

  // Solve
  let path = null;
  if (size === 3) {
    path = solveAStar([...tiles]);
  } else {
    // Try greedy multiple times
    for (let attempt = 0; attempt < 5; attempt++) {
      path = solveGreedy([...tiles]);
      if (path) break;
    }
  }

  if (!path) {
    board.classList.remove('solving');
    btnSolve.textContent = 'Solve';
    isSolving = false;
    alert('Could not find a solution. Try reshuffling.');
    return;
  }

  if (moves === 0) startTimer();

  const delay = size === 3 ? 200 : size === 4 ? 120 : 80;

  function step(i) {
    if (!isSolving || i >= path.length) {
      stopSolve();
      if (isSolved(tiles)) setTimeout(showWin, 300);
      return;
    }
    const empty = emptyIdx(tiles);
    tiles = swap(tiles, empty, path[i]);
    moves++;
    movesEl.textContent = moves;
    render();
    solveTimeout = setTimeout(() => step(i + 1), delay);
  }

  step(0);
}

// ─── Events ───────────────────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  initGame(false);
});

btnShuffle.addEventListener('click', () => {
  initGame(true);
});

btnSolve.addEventListener('click', () => {
  startSolve();
});

btnPlayAgain.addEventListener('click', () => {
  initGame(true);
});

sizeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sizeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    size = parseInt(btn.dataset.size);
    initGame(true);
  });
});

// keyboard support
document.addEventListener('keydown', e => {
  if (isSolving) return;
  const empty = emptyIdx(tiles);
  const map = {
    ArrowUp: empty + size,
    ArrowDown: empty - size,
    ArrowLeft: empty + 1,
    ArrowRight: empty - 1,
  };
  const target = map[e.key];
  if (target !== undefined && target >= 0 && target < size * size) {
    const row = Math.floor(empty / size), col = empty % size;
    const tRow = Math.floor(target / size), tCol = target % size;
    if (Math.abs(row - tRow) + Math.abs(col - tCol) === 1) {
      handleTileClick(target);
    }
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
initGame(true);
