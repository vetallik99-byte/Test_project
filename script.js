(function () {
  const GRID_SIZE = 5;
  const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 25

  // Distribution per spec (fixed, sums to 25)
  const COUNTS = {
    BOMB: 5,
    MUL_0_5: 4,
    MUL_1_5: 9,
    MUL_2: 4,
    WIN_X2: 3,   // three global x2 tiles
  };

  const CELL_LABEL = {
    BOMB: '💣',
    MUL_0_5: '0.5x',
    MUL_1_5: '1.5x',
    MUL_2: '2x',
    WIN_X2: '×2',
  };

  const CELL_CLASS = {
    BOMB: 'bomb',
    MUL_0_5: 'neutral',
    MUL_1_5: 'gold',
    MUL_2: 'gold',
    WIN_X2: 'bonus',
  };

  // State
  let balance = 1000.0;
  let betPerClick = 10.0;
  let totalWin = 0.0;
  let roundOver = false;
  let revealed = new Set();
  let grid = [];
  let isAnimatingTotalWin = false;
  let globalStack = 1.0; // 1, 2, or 4

  // Elements
  const gridEl = document.getElementById('grid');
  const balanceEl = document.getElementById('balance');
  const totalWinEl = document.getElementById('totalWin');
  const messageEl = document.getElementById('message');
  const betInputEl = document.getElementById('betInput');
  const betPlusEl = document.getElementById('betPlus');
  const betMinusEl = document.getElementById('betMinus');
  const collectBtn = document.getElementById('collectBtn');
  const newRoundBtn = document.getElementById('newRoundBtn');

  // Utils
  function formatMoney(val) { return `$${val.toFixed(2)}`; }
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  function buildGrid() {
    const items = [];
    items.push(...Array(COUNTS.BOMB).fill('BOMB'));
    items.push(...Array(COUNTS.MUL_0_5).fill('MUL_0_5'));
    items.push(...Array(COUNTS.MUL_1_5).fill('MUL_1_5'));
    items.push(...Array(COUNTS.MUL_2).fill('MUL_2'));
    items.push(...Array(COUNTS.WIN_X2).fill('WIN_X2'));

    if (items.length !== TOTAL_CELLS) {
      console.warn('Grid counts do not add up to 25. Current:', items.length);
    }
    return shuffle(items);
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    for (let i = 0; i < TOTAL_CELLS; i += 1) {
      const btn = document.createElement('button');
      btn.className = 'cell';
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('aria-label', `Cell ${i + 1}`);
      btn.dataset.index = String(i);

      const span = document.createElement('span');
      span.className = 'inner';
      span.textContent = '';
      btn.appendChild(span);

      btn.addEventListener('click', onCellClick);
      gridEl.appendChild(btn);
    }
    fitGridToMain();
  }

  function updateHUD() {
    balanceEl.textContent = formatMoney(balance);
    if (!isAnimatingTotalWin) totalWinEl.textContent = formatMoney(totalWin);
    betInputEl.value = betPerClick.toFixed(2);

    const canPlay = !roundOver && balance >= minBet();
    Array.from(gridEl.children).forEach((c) => {
      const btn = c;
      btn.classList.toggle('disabled', !canPlay);
    });

    collectBtn.disabled = totalWin <= 0 || roundOver;
  }

  function minBet() {
    const min = parseFloat(betInputEl.min || '0.1');
    return Math.max(min, 0.1);
  }

  function setMessage(text, tone = 'info') {
    messageEl.textContent = text || '';
    messageEl.style.color = tone === 'danger' ? 'var(--danger)'
      : tone === 'warn' ? 'var(--warn)'
      : tone === 'success' ? 'var(--primary)'
      : 'var(--accent)';
  }

  function beginRound() {
    grid = buildGrid();
    revealed = new Set();
    totalWin = 0.0;
    globalStack = 1.0;
    roundOver = false;
    setMessage('Good luck!');
    document.body.classList.remove('energized');
    renderGrid();
    updateHUD();
  }

  function endRound(showMessage) {
    roundOver = true;
    if (showMessage) setMessage(showMessage);
    revealAll();
    updateHUD();
  }

  function revealAll() {
    Array.from(gridEl.children).forEach((c, idx) => {
      const btn = c;
      const type = grid[idx];
      renderCell(btn, type, revealed.has(idx));
    });
  }

  function renderCell(btn, type, alreadyRevealed, amountValue, multLabel) {
    btn.classList.add('open');
    btn.classList.add(CELL_CLASS[type]);
    const inner = btn.querySelector('.inner');

    if (type === 'BOMB') {
      inner.textContent = CELL_LABEL[type];
    } else if (type === 'WIN_X2') {
      inner.textContent = CELL_LABEL[type];
    } else {
      inner.textContent = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'cell-content';

      const amount = document.createElement('div');
      amount.className = 'cell-amount';
      amount.textContent = formatMoney(amountValue || 0);

      const bottom = document.createElement('div');
      bottom.className = 'bottom-label cell-mult';
      bottom.textContent = multLabel || '';

      // If global is active, apply strike + glow (but keep base color until strike)
      if (globalStack > 1 && amountValue && amountValue > 0) {
        btn.classList.add('strike');
        amount.classList.add('value-glow');
        bottom.classList.add('value-glow');
        setTimeout(() => {
          btn.classList.remove('strike');
          amount.classList.remove('value-glow');
          bottom.classList.remove('value-glow');
        }, 950);
      }

      wrapper.appendChild(amount);
      wrapper.appendChild(bottom);
      inner.appendChild(wrapper);

      // Ensure amount fits inside the cell
      requestAnimationFrame(() => fitAmountText(amount, wrapper));
    }

    if (!alreadyRevealed) {
      btn.animate(
        [
          { transform: 'scale(0.96)', filter: 'brightness(0.9)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 140, easing: 'ease-out' }
      );
    }
  }

  function fitAmountText(amountEl, containerEl) {
    if (!amountEl || !containerEl) return;
    // Reset to CSS default first
    amountEl.style.fontSize = '';
    const minFontPx = 10;
    let fontSize = parseFloat(getComputedStyle(amountEl).fontSize) || 16;
    const maxWidth = containerEl.getBoundingClientRect().width - 4; // padding safety

    // Reduce font size until it fits
    let guard = 0;
    while (guard < 30) {
      const w = amountEl.getBoundingClientRect().width;
      if (w <= maxWidth || fontSize <= minFontPx) break;
      fontSize -= 1;
      amountEl.style.fontSize = fontSize + 'px';
      guard += 1;
    }
  }

  function animateTotalWinChange(fromVal, toVal) {
    const duration = document.body.classList.contains('energized') ? 900 : 500;
    const start = performance.now();
    totalWinEl.classList.add('totalwin-pulse');
    totalWinEl.classList.add('tw-counting');
    isAnimatingTotalWin = true;

    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = t * (2 - t); // easeOutQuad
      const val = fromVal + (toVal - fromVal) * eased;
      totalWinEl.textContent = formatMoney(val);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        totalWinEl.textContent = formatMoney(toVal);
        totalWinEl.classList.remove('totalwin-pulse');
        totalWinEl.classList.remove('tw-counting');
        isAnimatingTotalWin = false;
        updateHUD();
      }
    }

    requestAnimationFrame(step);
  }

  function onCellClick(evt) {
    if (roundOver) { beginRound(); return; }
    const btn = evt.currentTarget;
    const idx = parseInt(btn.dataset.index, 10);
    if (revealed.has(idx) || btn.classList.contains('pending')) return;

    const shouldDelay = revealed.size >= 2 && Math.random() < 0.3;

    if (shouldDelay) {
      btn.classList.add('pending', 'wiggle');
      setTimeout(() => {
        btn.classList.remove('wiggle');
        btn.classList.remove('pending');
        if (!roundOver && !revealed.has(idx)) {
          performCellReveal(btn, idx);
        }
      }, 400);
    } else {
      performCellReveal(btn, idx);
    }
  }

  function performCellReveal(btn, idx) {
    if (roundOver) return;
    if (revealed.has(idx)) return;

    if (balance < betPerClick) {
      setMessage('Insufficient balance for this bet.', 'warn');
      updateHUD();
      return;
    }

    balance -= betPerClick;

    const type = grid[idx];
    revealed.add(idx);

    const prevTotal = totalWin;

    if (type === 'BOMB') {
      renderCell(btn, type, false);
      totalWin = 0.0;
      endRound('Boom! You hit a bomb and lost your total win.');
      return;
    }

    if (type === 'MUL_0_5') {
      const base = 0.5;
      const gain = betPerClick * base * globalStack;
      totalWin += gain;
      renderCell(btn, type, false, gain, CELL_LABEL[type]);
      setMessage(`+${formatMoney(gain)} added (${base}x × global ${globalStack}x).`);
    } else if (type === 'MUL_1_5') {
      const base = 1.5;
      const gain = betPerClick * base * globalStack;
      totalWin += gain;
      renderCell(btn, type, false, gain, CELL_LABEL[type]);
      setMessage(`+${formatMoney(gain)} added (${base}x × global ${globalStack}x).`);
    } else if (type === 'MUL_2') {
      const base = 2.0;
      const gain = betPerClick * base * globalStack;
      totalWin += gain;
      renderCell(btn, type, false, gain, CELL_LABEL[type]);
      setMessage(`+${formatMoney(gain)} added (${base}x × global ${globalStack}x).`);
    } else if (type === 'WIN_X2') {
      // Global multiplier stack increases for future additive gains only
      globalStack = Math.min(8, globalStack * 2);
      renderCell(btn, type, false);
      setMessage(`Global multiplier increased! Now ×${globalStack}.`);
      // Turn on energized UI when at least ×2
      if (globalStack >= 2 && !document.body.classList.contains('energized')) {
        document.body.classList.add('energized');
      }
    }

    if (totalWin !== prevTotal) {
      animateTotalWinChange(prevTotal, totalWin);
    }

    updateHUD();

    const safeCells = TOTAL_CELLS - COUNTS.BOMB; // 20 safe cells
    if (revealed.size >= safeCells) {
      collectAndEnd(true);
      return;
    }
  }

  // Allow clicking gaps in the grid to start a new round after round over
  gridEl.addEventListener('click', (e) => {
    if (!roundOver) return;
    if (e.target === gridEl) beginRound();
  });

  function collectAndEnd(auto = false) {
    if (totalWin > 0) {
      const collected = totalWin;
      balance += totalWin;
      setMessage(
        auto ? `All safe cells revealed. Collected ${formatMoney(collected)}!` : `Collected ${formatMoney(collected)}.`,
        'success'
      );
      totalWin = 0.0;
    } else {
      setMessage('Nothing to collect.');
    }
    endRound();
  }

  // Grid fit to viewport/main area
  function fitGridToMain() {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    const style = getComputedStyle(gridEl);
    const gap = parseInt(style.gap || '10', 10) || 10;
    const cols = GRID_SIZE;
    const rows = GRID_SIZE;
    const rect = mainEl.getBoundingClientRect();
    const maxWidth = rect.width;
    const maxHeight = rect.height;
    const cellByWidth = Math.floor((maxWidth - (cols - 1) * gap) / cols);
    const cellByHeight = Math.floor((maxHeight - (rows - 1) * gap) / rows);
    const cellSize = Math.max(0, Math.min(cellByWidth, cellByHeight));

    const gridWidth = cellSize * cols + (cols - 1) * gap;
    const gridHeight = cellSize * rows + (rows - 1) * gap;
    gridEl.style.width = `${gridWidth}px`;
    gridEl.style.height = `${gridHeight}px`;
    gridEl.style.setProperty('--cell-size', `${cellSize}px`);

    requestAnimationFrame(() => {
      document.querySelectorAll('.cell-amount').forEach((el) => {
        const amountEl = el;
        const containerEl = amountEl.closest('.cell-content');
        if (containerEl) fitAmountText(amountEl, containerEl);
      });
    });
  }

  window.addEventListener('resize', fitGridToMain);

  // Controls
  betPlusEl.addEventListener('click', () => {
    const step = parseFloat(betInputEl.step || '0.10');
    betPerClick = Math.min(999999, roundToTwo(betPerClick + step));
    updateHUD();
    fitGridToMain();
  });
  betMinusEl.addEventListener('click', () => {
    const step = parseFloat(betInputEl.step || '0.10');
    betPerClick = Math.max(minBet(), roundToTwo(betPerClick - step));
    updateHUD();
    fitGridToMain();
  });
  betInputEl.addEventListener('change', () => {
    const val = parseFloat(betInputEl.value);
    if (Number.isFinite(val) && val >= minBet()) {
      betPerClick = roundToTwo(val);
    }
    updateHUD();
    fitGridToMain();
  });

  function roundToTwo(n) { return Math.round(n * 100) / 100; }

  collectBtn.addEventListener('click', () => {
    if (roundOver) return;
    collectAndEnd(false);
  });

  newRoundBtn.addEventListener('click', () => { beginRound(); });

  // Initialize
  beginRound();
})();