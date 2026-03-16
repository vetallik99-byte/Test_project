import type { GameState } from "../types";
import Button from "./Button/Button";

interface HUDProps {
  gameState: GameState;
  onAdjustBet: (amount: number) => void;
  onStart: () => void;
  onCashOut: () => void;
}

const HUD = ({ gameState, onAdjustBet, onStart, onCashOut }: HUDProps) => {
  return (
    <div className="hud">
      <div className="hud-group">
        <div className="hud-item">
          <div className="hud-label">Balance</div>
          <div className="value">${gameState.balance.toFixed(2)}</div>
        </div>

        <div className="hud-item">
          <div className="hud-label">Total Win</div>
          <div className={`value ${gameState.totalWin > 0 ? "win-positive" : ""}`}>
            ${gameState.totalWin.toFixed(2)}
          </div>
        </div>

        <div className="hud-item">
          <div className="hud-label">Total Bet</div>
          <div className="value">${gameState.totalBet.toFixed(2)}</div>
        </div>

        <div className="hud-item totalwin">
          <div className="hud-label">Net Win</div>
          <div className={`value ${gameState.netWin > 0 ? "win-positive" : ""}`}>
            ${gameState.netWin.toFixed(2)}
          </div>
        </div>

        <div className="hud-item">
          <div className="hud-label">Bet per Click</div>
          <div className={`bet-input ${gameState.isBetLocked ? "bet-locked" : ""}`}>
            <button type="button" onClick={() => onAdjustBet(-1)} disabled={gameState.isBetLocked}>
              -
            </button>
            <input
              type="number"
              value={gameState.betPerClick}
              disabled={gameState.isBetLocked}
              readOnly
            />
            <button type="button" onClick={() => onAdjustBet(1)} disabled={gameState.isBetLocked}>
              +
            </button>
          </div>
        </div>

        {/* Global Multiplier Display */}
        {gameState.globalStack > 1 && (
          <div className="hud-item global-multiplier">
            <div className="hud-label">Global Multiplier</div>
            <div className={`value ${gameState.isEnergized ? "energized" : ""}`}>
              ×{gameState.globalStack.toFixed(1)}
            </div>
            {gameState.activeGlobals.length > 0 && (
              <div className="active-globals">
                {gameState.activeGlobals.map((global) => (
                  <div
                    key={`${global.cellIndex}-${global.tier}-${global.remaining}`}
                    className="global-item"
                  >
                    ×{global.tier} ({global.remaining} left)
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="hud-item">
          <div className="hud-label">Actions</div>
          <div className="actions">
            {!gameState.isGameActive ? (
              <Button
                fullWidth={true}
                onClick={onStart}
                disabled={gameState.balance < gameState.betPerClick}
              >
                Start
              </Button>
            ) : (
              <Button onClick={onCashOut}>Cash Out (${gameState.totalWin.toFixed(2)})</Button>
            )}
          </div>
        </div>
      </div>

      <div className="message">{gameState.message}</div>
    </div>
  );
};

export default HUD;
