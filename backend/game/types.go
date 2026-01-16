package game

type CellType uint8

const (
	CellBomb  CellType = iota
	CellMul05          // 0.5x multiplier (neutral)
	CellMul15          // 1.5x multiplier (gold)
	CellMul2           // 2.0x multiplier (gold)
	CellWinX2          // Global multiplier (bonus)
)

type GlobalMultiplier struct {
	Tier      uint8 `json:"tier"`      // 2, 4, 6, or 8
	Remaining uint8 `json:"remaining"` // clicks remaining (0-4)
	CellIndex uint8 `json:"cellIndex"` // which cell this came from
}

type Cell struct {
	ID             uint8    `json:"id"`
	Type           CellType `json:"type"`
	Multiplier     float32  `json:"multiplier"` // 0.5, 1.5, 2.0, or global tier
	WinAmount      int64    `json:"winAmount"`  // actual win amount for this cell
	IsOpen         bool     `json:"isOpen"`
	IsStrike       bool     `json:"isStrike"`
	IsDisabled     bool     `json:"isDisabled"`
	IsWiggling     bool     `json:"isWiggling"`
	BonusTimer     uint8    `json:"bonusTimer,omitempty"` // for WIN_X2 cells (0-4)
	BonusExhausted bool     `json:"isBonusExhausted,omitempty"`
	GlobalTier     uint8    `json:"globalTier,omitempty"` // pre-assigned tier for WIN_X2
}

type State struct {
	Balance       int64              `json:"balance"`
	NetWin        int64              `json:"netWin"`
	BetPerClick   int64              `json:"betPerClick"` // renamed from BetAmount
	TotalWin      int64              `json:"totalWin"`
	TotalBet      int64              `json:"totalBet"` // total spent this round
	IsGameActive  bool               `json:"isGameActive"`
	IsEnergized   bool               `json:"isEnergized"` // when globalStack >= 2
	IsBetLocked   bool               `json:"isBetLocked"`
	Message       string             `json:"message"`
	Cells         []Cell             `json:"cells"`
	ActiveGlobals []GlobalMultiplier `json:"activeGlobals"` // currently active global multipliers
	GlobalStack   float32            `json:"globalStack"`   // computed from activeGlobals
	BombCount     uint8              `json:"bombCount"`     // 4 or 5 bombs this round
	RevealedCount uint8              `json:"revealedCount"` // number of cells opened
}

const (
	EventStart        = 1
	EventOpenCell     = 2
	EventBombGameover = 3
	EventCashOut      = 4
	EventAdjustBet    = 5
)
