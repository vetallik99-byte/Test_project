package game

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/binary"
	mrand "math/rand"
	"strconv"
	"time"
)

const GridSize = 25

// Engine holds per-session game state
// Not concurrency safe; wrap externally per connection.

type Engine struct {
	State     State
	DB        *sql.DB
	SessionID string
	// Provable fairness fields
	Commitment       []byte // sha256(salt || serializedLayout)
	SecretSalt       []byte // 16 bytes
	SerializedLayout []byte // 5 bytes per cell: type(1) amount(2) multScaled(2)
	RevealSent       bool
}

func NewEngine(startBalance int64, db *sql.DB, sessionID string) *Engine {
	e := &Engine{DB: db, SessionID: sessionID}
	e.State = State{
		Balance:       startBalance,
		BetPerClick:   10,
		Message:       "Click Start to begin!",
		Cells:         []Cell{},
		GlobalStack:   1.0,
		ActiveGlobals: []GlobalMultiplier{},
	}
	return e
}

// secureSeed returns a crypto random int64 seed for math/rand for performance
func secureSeed() int64 {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return time.Now().UnixNano()
	}
	return int64(binary.LittleEndian.Uint64(b[:]))
}

// buildGrid creates the exact grid distribution from JavaScript
func (e *Engine) buildGrid() []CellType {
	r := mrand.New(mrand.NewSource(secureSeed()))

	// Dynamic distribution per round (exactly like JS)
	bombs := e.State.BombCount // 4 or 5
	globals := uint8(4)        // always 4 WIN_X2
	mul05 := uint8(6)          // always 6 MUL_0_5
	mul15Base := uint8(9)      // base 9 MUL_1_5
	mul2 := uint8(1)           // always 1 MUL_2

	baseTotal := bombs + globals + mul05 + mul15Base + mul2
	remainder := GridSize - baseTotal
	mul15 := mul15Base + remainder // fill remainder with 1.5x tiles

	// Build items array
	items := make([]CellType, 0, GridSize)

	// Add each type
	for i := uint8(0); i < bombs; i++ {
		items = append(items, CellBomb)
	}
	for i := uint8(0); i < mul05; i++ {
		items = append(items, CellMul05)
	}
	for i := uint8(0); i < mul15; i++ {
		items = append(items, CellMul15)
	}
	for i := uint8(0); i < mul2; i++ {
		items = append(items, CellMul2)
	}
	for i := uint8(0); i < globals; i++ {
		items = append(items, CellWinX2)
	}

	// Shuffle using Fisher-Yates
	for i := len(items) - 1; i > 0; i-- {
		j := r.Intn(i + 1)
		items[i], items[j] = items[j], items[i]
	}

	return items
}

// rollGlobalTier matches JS probability distribution
func rollGlobalTier() uint8 {
	r := mrand.New(mrand.NewSource(secureSeed()))
	val := r.Float64() * 100
	if val < 88.0 {
		return 2
	} else if val < 98.0 {
		return 4 // 88-98 => 10%
	} else if val < 99.5 {
		return 6 // 98-99.5 => 1.5%
	}
	return 8 // 0.5%
}

func (e *Engine) initCells() []Cell {
	grid := e.buildGrid()
	cells := make([]Cell, GridSize)

	for i := 0; i < GridSize; i++ {
		cellType := grid[i]
		var multiplier float32
		var globalTier uint8

		switch cellType {
		case CellMul05:
			multiplier = 0.5
		case CellMul15:
			multiplier = 1.5
		case CellMul2:
			multiplier = 2.0
		case CellWinX2:
			globalTier = rollGlobalTier()
			multiplier = float32(globalTier)
		case CellBomb:
			multiplier = 0
		}

		cell := Cell{
			ID:         uint8(i),
			Type:       cellType,
			Multiplier: multiplier,
			GlobalTier: globalTier,
		}

		if cellType == CellWinX2 {
			cell.BonusTimer = 4
		}

		cells[i] = cell
	}

	return cells
}

// computeGlobalStack calculates current global multiplier
func (e *Engine) computeGlobalStack() float32 {
	if len(e.State.ActiveGlobals) == 0 {
		return 1.0
	}
	stack := float32(1.0)
	for _, g := range e.State.ActiveGlobals {
		stack *= float32(g.Tier)
	}
	return stack
}

// tickGlobalsAfterClick decrements the first global's timer
func (e *Engine) tickGlobalsAfterClick(skipBecauseClickedGlobal bool) {
	if skipBecauseClickedGlobal || len(e.State.ActiveGlobals) == 0 {
		return
	}

	// Tick down the first global
	if e.State.ActiveGlobals[0].Remaining > 0 {
		e.State.ActiveGlobals[0].Remaining--
	}

	// Remove expired globals
	if e.State.ActiveGlobals[0].Remaining == 0 {
		// Mark cell as exhausted
		cellIdx := e.State.ActiveGlobals[0].CellIndex
		if int(cellIdx) < len(e.State.Cells) {
			e.State.Cells[cellIdx].BonusExhausted = true
		}
		// Remove from active list
		e.State.ActiveGlobals = e.State.ActiveGlobals[1:]
	}
}

func (e *Engine) buildCommitment(cells []Cell) {
	salt := make([]byte, 16)
	_, _ = rand.Read(salt)
	layout := make([]byte, len(cells)*5)
	for i, c := range cells {
		off := i * 5
		layout[off] = byte(c.Type)
		binary.LittleEndian.PutUint16(layout[off+1:off+3], uint16(c.Multiplier*100))
		binary.LittleEndian.PutUint16(layout[off+3:off+5], uint16(c.GlobalTier))
	}
	h := sha256.Sum256(append(salt, layout...))
	e.SecretSalt = salt
	e.SerializedLayout = layout
	e.Commitment = h[:]
	e.RevealSent = false
}

func (e *Engine) logEvent(eventType int, details string, amountDelta int64, balance int64) {
	if e.DB == nil {
		return
	}
	_, _ = e.DB.Exec(`INSERT INTO game_events(session_id, event_type, details, amount_delta, balance_after, created_at) VALUES ($1,$2,$3,$4,$5,NOW())`, e.SessionID, eventType, details, amountDelta, balance)
}

func (e *Engine) StartGame() bool {
	if e.State.IsGameActive {
		return false
	}

	// Check if balance is sufficient for safe path (like JS)
	e.State.BombCount = 4
	if mrand.Float64() < 0.5 {
		e.State.BombCount = 5
	}
	safeCells := GridSize - e.State.BombCount
	minRequired := e.State.BetPerClick * int64(safeCells)

	if e.State.Balance < minRequired {
		e.State.Message = "Low Balance, change Bet Amount"
		return false
	}

	// Initialize round
	e.State.TotalWin = 0
	e.State.TotalBet = 0
	e.State.NetWin = 0
	e.State.IsGameActive = true
	e.State.IsBetLocked = true
	e.State.IsEnergized = false
	e.State.RevealedCount = 0
	e.State.ActiveGlobals = []GlobalMultiplier{}
	e.State.GlobalStack = 1.0
	e.State.Message = "Click cells to reveal..."
	e.State.Cells = e.initCells()
	e.buildCommitment(e.State.Cells)
	e.logEvent(EventStart, "start game", 0, e.State.Balance)
	return true
}

func (e *Engine) OpenCell(id uint8) {
	if !e.State.IsGameActive || int(id) >= len(e.State.Cells) {
		return
	}

	cell := &e.State.Cells[id]
	if cell.IsOpen || cell.IsDisabled {
		return
	}

	// Check balance for this click
	if e.State.Balance < e.State.BetPerClick {
		e.State.Message = "Insufficient balance for this bet."
		return
	}

	// Deduct bet per click
	e.State.Balance -= e.State.BetPerClick
	e.State.TotalBet += e.State.BetPerClick
	e.State.NetWin = e.State.TotalWin - e.State.TotalBet

	cell.IsOpen = true
	e.State.RevealedCount++

	// Capture pre-click global stack
	preClickStack := e.State.GlobalStack
	newlyAddedGlobal := false

	if cell.Type == CellBomb {
		// Reveal all cells and end game
		for i := range e.State.Cells {
			e.State.Cells[i].IsOpen = true
		}
		e.State.IsGameActive = false
		e.State.TotalWin = 0 // Lose everything on bomb
		e.State.NetWin = -e.State.TotalBet
		e.State.Message = "Boom! You hit a bomb and lost your total win."
		e.State.ActiveGlobals = []GlobalMultiplier{}
		e.State.GlobalStack = 1.0
		e.State.IsEnergized = false
		e.logEvent(EventBombGameover, "bomb at cell", 0, e.State.Balance)
		return
	}

	// Handle non-bomb cells
	if cell.Type == CellWinX2 {
		// Add new global multiplier
		global := GlobalMultiplier{
			Tier:      cell.GlobalTier,
			Remaining: 4,
			CellIndex: id,
		}
		e.State.ActiveGlobals = append(e.State.ActiveGlobals, global)
		e.State.GlobalStack = e.computeGlobalStack()
		newlyAddedGlobal = true

		if e.State.GlobalStack >= 2 {
			e.State.IsEnergized = true
		}

		e.State.Message = "Global multiplier increased! Found ×" + strconv.Itoa(int(cell.GlobalTier)) + ". Now ×" + formatFloat(e.State.GlobalStack) + "."
	} else {
		// Calculate win with pre-click global stack
		baseMultiplier := cell.Multiplier
		effectiveMultiplier := baseMultiplier * preClickStack
		win := int64(float64(e.State.BetPerClick) * float64(effectiveMultiplier))

		e.State.TotalWin += win
		e.State.NetWin = e.State.TotalWin - e.State.TotalBet

		// Store the win amount in the cell
		cell.WinAmount = win

		if preClickStack > 1 {
			cell.IsStrike = true // Visual effect for global multiplier
		}

		e.State.Message = "+$" + formatMoney(win) + " added (" + formatFloat(baseMultiplier) + "x × global " + formatFloat(preClickStack) + "x)."
	}

	// Tick down globals (except newly added one)
	e.tickGlobalsAfterClick(newlyAddedGlobal)
	e.State.GlobalStack = e.computeGlobalStack()

	if e.State.GlobalStack < 2 {
		e.State.IsEnergized = false
	}

	e.logEvent(EventOpenCell, "open cell", 0, e.State.Balance)

	// Check for auto-collect (all safe cells revealed)
	safeCells := GridSize - e.State.BombCount
	if e.State.RevealedCount >= safeCells {
		e.collectAndEnd(true)
	}
}

func (e *Engine) collectAndEnd(auto bool) {
	if e.State.TotalWin > 0 {
		e.State.Balance += e.State.TotalWin
		if auto {
			e.State.Message = "All safe cells revealed. Collected $" + formatMoney(e.State.TotalWin) + "!"
		} else {
			e.State.Message = "Collected $" + formatMoney(e.State.TotalWin) + "."
		}
		e.logEvent(EventCashOut, "cash out", e.State.TotalWin, e.State.Balance)
	} else {
		e.State.Message = "Nothing to collect."
	}

	e.State.IsGameActive = false
	e.State.IsBetLocked = false
	e.State.IsEnergized = false
	e.State.ActiveGlobals = []GlobalMultiplier{}
	e.State.GlobalStack = 1.0
}

func (e *Engine) CashOut() bool {
	if !e.State.IsGameActive {
		return false
	}
	e.collectAndEnd(false)
	return true
}

func (e *Engine) AdjustBet(delta int64) {
	if e.State.IsBetLocked {
		return
	}
	bet := e.State.BetPerClick + delta
	if bet < 1 {
		bet = 1
	}
	if bet > e.State.Balance {
		bet = e.State.Balance
	}
	e.State.BetPerClick = bet
	e.logEvent(EventAdjustBet, "adjust bet", 0, e.State.Balance)
}

func formatMoney(v int64) string {
	return strconv.FormatInt(v, 10)
}

func formatFloat(v float32) string {
	return strconv.FormatFloat(float64(v), 'f', -1, 32)
}
