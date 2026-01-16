import React from "react";
import { GameState } from "../types";
import Button from "./Button/Button";

interface HUDProps {
  gameState: GameState;
  onAdjustBet: (amount: number) => void;
  onStart: () => void;
  onCashOut: () => void;
}

const HUD: React.FC<HUDProps> = ({
  gameState,
  onAdjustBet,
  onStart,
  onCashOut,
}) => {
  return (
    <div className="hud">
      <div className="hud-group">
        <div className="hud-item">
          <label>Balance</label>
          <div className="value">${gameState.balance.toFixed(2)}</div>
        </div>

        <div className="hud-item">
          <label>Total Win</label>
          <div
            className={`value ${gameState.totalWin > 0 ? "win-positive" : ""}`}
          >
            ${gameState.totalWin.toFixed(2)}
          </div>
        </div>

        <div className="hud-item">
          <label>Total Bet</label>
          <div className="value">${gameState.totalBet.toFixed(2)}</div>
        </div>

        <div className="hud-item totalwin">
          <label>Net Win</label>
          <div
            className={`value ${gameState.netWin > 0 ? "win-positive" : ""}`}
          >
            ${gameState.netWin.toFixed(2)}
          </div>
        </div>

        <div className="hud-item">
          <label>Bet per Click</label>
          <div
            className={`bet-input ${gameState.isBetLocked ? "bet-locked" : ""}`}
          >
            <button
              onClick={() => onAdjustBet(-1)}
              disabled={gameState.isBetLocked}
            >
              -
            </button>
            <input
              type="number"
              value={gameState.betPerClick}
              disabled={gameState.isBetLocked}
              readOnly
            />
            <button
              onClick={() => onAdjustBet(1)}
              disabled={gameState.isBetLocked}
            >
              +
            </button>
          </div>
        </div>

        {/* Global Multiplier Display */}
        {gameState.globalStack > 1 && (
          <div className="hud-item global-multiplier">
            <label>Global Multiplier</label>
            <div
              className={`value ${gameState.isEnergized ? "energized" : ""}`}
            >
              ×{gameState.globalStack.toFixed(1)}
            </div>
            {gameState.activeGlobals.length > 0 && (
              <div className="active-globals">
                {gameState.activeGlobals.map((global, index) => (
                  <div key={index} className="global-item">
                    ×{global.tier} ({global.remaining} left)
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="hud-item">
          <label>Actions</label>
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
              <Button onClick={onCashOut}>
                Cash Out (${gameState.totalWin.toFixed(2)})
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="message">{gameState.message}</div>
    </div>
  );
};

export default HUD;
