(function () {
  const GRID_SIZE = 5;
  const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 25

  // Dynamic distribution per round (target 25 total)
  const BASE_COUNTS = {
    MUL_0_5: 6,
    MUL_1_5_BASE: 9, // may be increased to fill to 25
    MUL_2: 1,
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
  let globalStack = 1.0; // effective stack from active globals (min(cap, 2^active))
  let activeGlobals = []; // { btn, remaining, timerEl, tier }
  let bombCountThisRound = 5;
  let totalGlobalsInGrid = 4;

  let globalTierByIndex = []; // preassigned tier for each WIN_X2 tile by index
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
  const betGroupEl = document.querySelector('.bet-input');

  // Tooltip
  let tooltipTimeoutId = null;
  function showTooltip(anchorEl, text) {
    if (!anchorEl) return;
    const existing = document.querySelector('.tooltip');
    if (existing) existing.remove();
    const tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.textContent = text;
    document.body.appendChild(tip);
    const rect = anchorEl.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    let top = rect.top - tipRect.height - 8;
    if (top < 8) top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    requestAnimationFrame(() => { tip.classList.add('visible'); });
    if (tooltipTimeoutId) clearTimeout(tooltipTimeoutId);
    tooltipTimeoutId = setTimeout(() => { tip.remove(); }, 1800);
  }

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
    const bombs = bombCountThisRound;
    const globals = totalGlobalsInGrid;
    const base05 = BASE_COUNTS.MUL_0_5;
    const base15 = BASE_COUNTS.MUL_1_5_BASE;
    const base20 = BASE_COUNTS.MUL_2;
    const baseTotal = bombs + globals + base05 + base15 + base20;
    const remainder = Math.max(0, TOTAL_CELLS - baseTotal);

    const mul15 = base15 + remainder; // fill remainder with 1.5x tiles to reach 25

    items.push(...Array(bombs).fill('BOMB'));
    items.push(...Array(base05).fill('MUL_0_5'));
    items.push(...Array(mul15).fill('MUL_1_5'));
    items.push(...Array(base20).fill('MUL_2'));
    items.push(...Array(globals).fill('WIN_X2'));

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

      // Closed state overlay with current bet value
      const closed = document.createElement('div');
      closed.className = 'closed-overlay';
      btn.appendChild(closed);

      btn.addEventListener('click', onCellClick);
      gridEl.appendChild(btn);
    }
    fitGridToMain();
    updateClosedBetOverlays();
  }

  function updateHUD() {
    balanceEl.textContent = formatMoney(balance);
    if (!isAnimatingTotalWin) totalWinEl.textContent = formatMoney(totalWin);
    betInputEl.value = betPerClick.toFixed(2);
    updateClosedBetOverlays();

    const canPlay = !roundOver && balance >= minBet();
    Array.from(gridEl.children).forEach((c) => {
      const btn = c;
      btn.classList.toggle('disabled', !canPlay);
    });

    collectBtn.disabled = totalWin <= 0 || roundOver;

    // Lock bet controls after first reveal in a round
    const betLocked = !roundOver && revealed.size > 0;
    if (betGroupEl) betGroupEl.classList.toggle('bet-locked', betLocked);
    betInputEl.disabled = !!betLocked;
  }

  function updateClosedBetOverlays() {
    const valueStr = betPerClick.toFixed(2);
    const fontSizePx = Math.max(8, Math.min(64, betPerClick));
    Array.from(gridEl.children).forEach((c) => {
      const btn = c;
      const overlay = btn.querySelector('.closed-overlay');
      if (!overlay) return;
      overlay.innerHTML = `<div class="line">Bet</div><div class="line">${valueStr}</div>`;
      overlay.style.fontSize = `${fontSizePx}px`;
    });
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
    // Randomize bombs (4 or 5) and globals (3 or 4)
    bombCountThisRound = Math.random() < 0.5 ? 4 : 5;
    totalGlobalsInGrid = 4;

    activeGlobals = [];
    grid = buildGrid();
    globalTierByIndex = new Array(TOTAL_CELLS).fill(null);
    // Pre-assign tiers for all globals on the grid
    for (let i = 0; i < TOTAL_CELLS; i += 1) {
      if (grid[i] === 'WIN_X2') {
        globalTierByIndex[i] = rollGlobalTier();
      }
    }
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
    // Reset globals immediately
    activeGlobals = [];
    globalStack = 1.0;
    document.body.classList.remove('energized');
    updateHUD();
  }

  function revealAll() {
    Array.from(gridEl.children).forEach((c, idx) => {
      const btn = c;
      const type = grid[idx];
      const label = type === 'WIN_X2' ? `×${globalTierByIndex[idx] || 2}` : undefined;
      renderCell(btn, type, revealed.has(idx), undefined, label);
    });
  }

  function renderCell(btn, type, alreadyRevealed, amountValue, multLabel, isEffectiveMult) {
    btn.classList.add('open');
    btn.classList.add(CELL_CLASS[type]);
    const inner = btn.querySelector('.inner');

    if (type === 'BOMB') {
      inner.textContent = CELL_LABEL[type];
    } else if (type === 'WIN_X2') {
      inner.textContent = multLabel || CELL_LABEL[type];
      // Add timer bolts UI (4 bolts)
      const timer = document.createElement('div');
      timer.className = 'bonus-timer';
      for (let i = 0; i < 4; i += 1) {
        const b = document.createElement('span');
        b.className = 'bolt active';
        b.textContent = '⚡';
        timer.appendChild(b);
      }
      inner.appendChild(timer);
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
      if (isEffectiveMult) {
        bottom.classList.add('effective');
      }

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

    // If attempting to open the very first cell, ensure sufficient balance for the whole safe path
    if (revealed.size === 0) {
      const safeCells = TOTAL_CELLS - bombCountThisRound;
      const minRequired = betPerClick * safeCells;
      if (balance < minRequired) {
        showTooltip(btn, 'Low Balance, change Bet Amount');
        return;
      }
    }

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
    const preClickStack = computeGlobalStack();
    globalStack = preClickStack;
    let newlyAddedGlobal = null;

    if (type === 'BOMB') {
      renderCell(btn, type, false);
      totalWin = 0.0;
      endRound('Boom! You hit a bomb and lost your total win.');
      return;
    }

    if (type === 'MUL_0_5') {
      const base = 0.5;
      const gain = betPerClick * base * preClickStack;
      const effMult = base * preClickStack;
      const effLabel = formatMultiplier(effMult);
      totalWin += gain;
      renderCell(btn, type, false, gain, effLabel, preClickStack > 1);
      setMessage(`+${formatMoney(gain)} added (${base}x × global ${globalStack}x).`);
    } else if (type === 'MUL_1_5') {
      const base = 1.5;
      const gain = betPerClick * base * preClickStack;
      const effMult = base * preClickStack;
      const effLabel = formatMultiplier(effMult);
      totalWin += gain;
      renderCell(btn, type, false, gain, effLabel, preClickStack > 1);
      setMessage(`+${formatMoney(gain)} added (${base}x × global ${globalStack}x).`);
    } else if (type === 'MUL_2') {
      const base = 2.0;
      const gain = betPerClick * base * preClickStack;
      const effMult = base * preClickStack;
      const effLabel = formatMultiplier(effMult);
      totalWin += gain;
      renderCell(btn, type, false, gain, effLabel, preClickStack > 1);
      setMessage(`+${formatMoney(gain)} added (${base}x × global ${globalStack}x).`);
    } else if (type === 'WIN_X2') {
      // Add a new active global with 4-click timer
      const tier = globalTierByIndex[idx] || 2;
      renderCell(btn, type, false, undefined, `×${tier}`);
      const timerEl = btn.querySelector('.bonus-timer');
      newlyAddedGlobal = { btn, remaining: 4, timerEl, tier };
      activeGlobals.push(newlyAddedGlobal);
      globalStack = computeGlobalStack();
      setMessage(`Global multiplier increased! Found ×${tier}. Now ×${globalStack}.`);
      if (globalStack >= 2 && !document.body.classList.contains('energized')) {
        document.body.classList.add('energized');
      }
    }

    if (totalWin !== prevTotal) {
      animateTotalWinChange(prevTotal, totalWin);
    }

    // Tick down globals after this click (do not tick the one found this click)
    tickGlobalsAfterClick(newlyAddedGlobal);
    globalStack = computeGlobalStack();
    if (globalStack < 2) {
      document.body.classList.remove('energized');
    }

    updateHUD();

    const safeCells = TOTAL_CELLS - bombCountThisRound;
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
    if (!roundOver && revealed.size > 0) {
      showTooltip(betGroupEl || betInputEl, 'Start new round to change the bet');
      return;
    }
    const step = parseFloat(betInputEl.step || '0.10');
    betPerClick = Math.min(999999, roundToTwo(betPerClick + step));
    updateHUD();
    fitGridToMain();
  });
  betMinusEl.addEventListener('click', () => {
    if (!roundOver && revealed.size > 0) {
      showTooltip(betGroupEl || betInputEl, 'Start new round to change the bet');
      return;
    }
    const step = parseFloat(betInputEl.step || '0.10');
    betPerClick = Math.max(minBet(), roundToTwo(betPerClick - step));
    updateHUD();
    fitGridToMain();
  });
  betInputEl.addEventListener('focus', () => {
    if (!roundOver && revealed.size > 0) {
      showTooltip(betGroupEl || betInputEl, 'Start new round to change the bet');
      betInputEl.blur();
    }
  });
  betInputEl.addEventListener('input', (e) => {
    if (!roundOver && revealed.size > 0) {
      showTooltip(betGroupEl || betInputEl, 'Start new round to change the bet');
      betInputEl.value = betPerClick.toFixed(2);
      e.preventDefault();
      return;
    }
  });
  betInputEl.addEventListener('change', () => {
    if (!roundOver && revealed.size > 0) {
      showTooltip(betGroupEl || betInputEl, 'Start new round to change the bet');
      betInputEl.value = betPerClick.toFixed(2);
      return;
    }
    const val = parseFloat(betInputEl.value);
    if (Number.isFinite(val) && val >= minBet()) {
      betPerClick = roundToTwo(val);
    }
    updateHUD();
    fitGridToMain();
  });

  function roundToTwo(n) { return Math.round(n * 100) / 100; }

  function formatMultiplier(mult) {
    // 1 -> '1x', 0.5 -> '0.5x', 3 -> '3x'
    const rounded = Math.round(mult * 100) / 100;
    return `${rounded}x`;
  }

  function computeGlobalStack() {
    if (activeGlobals.length === 0) return 1;
    return activeGlobals.reduce((acc, g) => acc * (g.tier || 2), 1);
  }

  function tickGlobalsAfterClick(skipBecauseClickedGlobal) {
    if (skipBecauseClickedGlobal) return; // clicking a global does not consume a move
    if (activeGlobals.length === 0) return;
    const first = activeGlobals[0];
    first.remaining = Math.max(0, first.remaining - 1);
    updateBonusTimerVisual(first);
    if (first.remaining <= 0) {
      first.remaining = 0;
      updateBonusTimerVisual(first);
      activeGlobals.shift();
    }
  }

  function updateBonusTimerVisual(g) {
    if (!g || !g.btn) return;
    const btn = g.btn;
    const timer = g.timerEl || btn.querySelector('.bonus-timer');
    if (timer) {
      const bolts = Array.from(timer.querySelectorAll('.bolt'));
      bolts.forEach((b, idx) => {
        b.classList.toggle('active', idx < g.remaining);
      });
    }
    if (g.remaining <= 0) {
      btn.classList.add('bonus-exhausted');
    } else {
      btn.classList.remove('bonus-exhausted');
    }
  }

  function rollGlobalTier() {
    const r = Math.random() * 100;
    if (r < 88.0) return 2;
    if (r < 98.0) return 4; // 88-98 => 10%
    if (r < 99.5) return 6; // 98-99.5 => 1.5%
    return 8; // 0.5%
  }

  collectBtn.addEventListener('click', () => {
    if (roundOver) return;
    collectAndEnd(false);
  });

  newRoundBtn.addEventListener('click', () => { beginRound(); });

  // Initialize
  beginRound();
})();