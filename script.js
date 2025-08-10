const rows = 5;
const cols = 5;
const mineCount = 5;

const gameContainer = document.getElementById('game');
let cells = [];
let mines = [];

function createBoard() {
    gameContainer.innerHTML = '';
    cells = [];
    mines = [];

    // Расставляем мины
    while (mines.length < mineCount) {
        let pos = Math.floor(Math.random() * rows * cols);
        if (!mines.includes(pos)) {
            mines.push(pos);
        }
    }

    // Создаём клетки
    for (let i = 0; i < rows * cols; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;

        cell.addEventListener('click', () => revealCell(i));

        gameContainer.appendChild(cell);
        cells.push(cell);
    }
}

function revealCell(index) {
    const cell = cells[index];
    if (cell.classList.contains('revealed')) return;

    cell.classList.add('revealed');

    if (mines.includes(index)) {
        cell.classList.add('mine');
        alert('💥 You hit a mine! Game over.');
        createBoard();
    } else {
        cell.textContent = '💎';
    }
}

createBoard();
