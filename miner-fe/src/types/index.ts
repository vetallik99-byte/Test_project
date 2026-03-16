export interface GlobalMultiplier {
  tier: number; // 2, 4, 6, or 8
  remaining: number; // clicks remaining (0-4)
  cellIndex: number; // which cell this came from
}

export interface Cell {
  id: number;
  type: number; // 0=bomb, 1=mul05, 2=mul15, 3=mul2, 4=winx2
  amount: number;
  multiplier: number;
  isOpen: boolean;
  isStrike?: boolean;
  isDisabled?: boolean;
  isWiggling?: boolean;
  bonusTimer?: number;
  isBonusExhausted?: boolean;
  globalTier?: number; // pre-assigned tier for WIN_X2 cells
}

export interface GameState {
  balance: number;
  netWin: number;
  betPerClick: number; // renamed from betAmount
  totalWin: number;
  totalBet: number; // new field
  isGameActive: boolean;
  isEnergized: boolean;
  isBetLocked: boolean;
  message: string;
  cells: Cell[];
  activeGlobals: GlobalMultiplier[]; // new field
  globalStack: number; // new field
  bombCount: number; // new field
  revealedCount: number; // new field
}

export interface HudItem {
  label: string;
  value: string | number;
  className?: string;
}
