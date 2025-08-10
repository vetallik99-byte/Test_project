(function () {
  const GRID_SIZE = 5;
  const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 25

  // Distribution counts per spec
  const COUNTS = {
    BOMB: 4,
    MUL_0_5: 5, // adds bet * 0.5 to total win
    MUL_1_5: 7, // adds bet * 1.5 to total win
    MUL_2: 5,   // assumption: adds bet * 2 to total win
    WIN_X2: 3,  // multiplies total win by 2
    WIN_X4: 1,  // multiplies total win by 4
  };

  const CELL_LABEL = {
    BOMB: '💣',
    MUL_0_5: '0.5x',
    MUL_1_5: '1.5x',
    MUL_2: '2x',
    WIN_X2: '×2',
    WIN_X4: '×4',
  };

  const CELL_CLASS = {
    BOMB: 'bomb',
    MUL_0_5: 'mult',
    MUL_1_5: 'mult',
    MUL_2: 'mult',
    WIN_X2: 'winmult',
    WIN_X4: 'winmult',
  };

  // State
  let balance = 1000.0;
  let betPerClick = 10.0;
  let totalWin = 0.0;
  let roundOver = false;
  let revealed = new Set();
  let grid = [];

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
  function formatMoney(val) {
    return `$${val.toFixed(2)}`;
  }
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
    items.push(...Array(COUNTS.WIN_X4).fill('WIN_X4'));
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
  }

  function updateHUD() {
    balanceEl.textContent = formatMoney(balance);
    totalWinEl.textContent = formatMoney(totalWin);
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
    roundOver = false;
    setMessage('Good luck!');
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

  function renderCell(btn, type, alreadyRevealed) {
    btn.classList.add('open');
    btn.classList.add(CELL_CLASS[type]);
    const inner = btn.querySelector('.inner');
    inner.textContent = CELL_LABEL[type];
    if (!alreadyRevealed) {
      btn.animate(
        [
          { transform: 'scale(0.95)', filter: 'brightness(0.9)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 140, easing: 'ease-out' }
      );
    }
  }

  function onCellClick(evt) {
    if (roundOver) return;
    const btn = evt.currentTarget;
    const idx = parseInt(btn.dataset.index, 10);
    if (revealed.has(idx)) return;

    // Check balance before charging
    if (balance < betPerClick) {
      setMessage('Insufficient balance for this bet.', 'warn');
      updateHUD();
      return;
    }

    // Deduct bet
    balance -= betPerClick;

    const type = grid[idx];
    revealed.add(idx);
    renderCell(btn, type, false);

    // Resolve outcome
    if (type === 'BOMB') {
      totalWin = 0.0;
      endRound('Boom! You hit a bomb and lost your total win.');
      return;
    }

    if (type === 'MUL_0_5') {
      totalWin += betPerClick * 0.5;
      setMessage('Added 0.5x of your bet to total win.');
    } else if (type === 'MUL_1_5') {
      totalWin += betPerClick * 1.5;
      setMessage('Added 1.5x of your bet to total win.');
    } else if (type === 'MUL_2') {
      totalWin += betPerClick * 2.0;
      setMessage('Added 2x of your bet to total win.');
    } else if (type === 'WIN_X2') {
      totalWin *= 2.0;
      setMessage('Total win doubled!');
    } else if (type === 'WIN_X4') {
      totalWin *= 4.0;
      setMessage('Total win x4!');
    }

    updateHUD();

    // Auto-collect if all safe cells revealed
    const safeCells = TOTAL_CELLS - COUNTS.BOMB; // 21
    if (revealed.size >= safeCells) {
      // But if somehow a bomb was clicked earlier we'd be out
      collectAndEnd(true);
      return;
    }
  }

  function collectAndEnd(auto = false) {
    if (totalWin > 0) {
      balance += totalWin;
      setMessage(auto ? `All safe cells revealed. Collected ${formatMoney(totalWin)}!` : `Collected ${formatMoney(totalWin)}.` , 'success');
      totalWin = 0.0;
    } else {
      setMessage('Nothing to collect.');
    }
    endRound();
  }

  // Controls
  betPlusEl.addEventListener('click', () => {
    const step = parseFloat(betInputEl.step || '0.10');
    betPerClick = Math.min(999999, roundToTwo(betPerClick + step));
    updateHUD();
  });
  betMinusEl.addEventListener('click', () => {
    const step = parseFloat(betInputEl.step || '0.10');
    betPerClick = Math.max(minBet(), roundToTwo(betPerClick - step));
    updateHUD();
  });
  betInputEl.addEventListener('change', () => {
    const val = parseFloat(betInputEl.value);
    if (Number.isFinite(val) && val >= minBet()) {
      betPerClick = roundToTwo(val);
    }
    updateHUD();
  });

  function roundToTwo(n) { return Math.round(n * 100) / 100; }

  collectBtn.addEventListener('click', () => {
    if (roundOver) return;
    collectAndEnd(false);
  });

  newRoundBtn.addEventListener('click', () => {
    beginRound();
  });

  // Initialize
  beginRound();
})();
