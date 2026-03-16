import type { MouseEvent } from 'react';
import type { Cell } from '../types';

interface GameCellProps {
  cell: Cell;
  onClick: () => void;
  onShowTooltip: (x: number, y: number, content: string) => void;
  onHideTooltip: () => void;
}

const GameCell = ({
  cell,
  onClick,
  onShowTooltip,
  onHideTooltip
}: GameCellProps) => {
  const typeClass = () => {
    switch (cell.type) {
      case 0: return 'bomb';
      case 2: return 'gold';
      case 3: return 'bonus';
      default: return 'neutral';
    }
  };
  const getCellClasses = () => {
    let classes = 'cell';
    if (cell.isOpen) {
      classes += ' open ' + typeClass();
    }
    if (cell.isStrike) classes += ' strike';
    if (cell.isDisabled) classes += ' disabled';
    if (cell.isWiggling) classes += ' wiggle';
    if (cell.type === 3 && cell.isBonusExhausted) classes += ' bonus-exhausted';
    return classes;
  };

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Hide tooltip immediately on click
    onHideTooltip();
    onClick();
  };

  const handleMouseEnter = (e: MouseEvent) => {
    // Only show tooltip for closed cells and add a small delay
    if (!cell.isOpen) {
      setTimeout(() => {
        if (!cell.isOpen) {
          onShowTooltip(
            e.clientX,
            e.clientY - 40,
            'Click to reveal'
          );
        }
      }, 100);
    }
  };

  const handleMouseLeave = () => {
    onHideTooltip();
  };

  const renderCellContent = () => {
    if (!cell.isOpen) {
      return (
        <div className="closed-overlay">
          <span className="line">?</span>
        </div>
      );
    }
    if (cell.type === 0) {
      return (
        <div className="cell-content">
          <div className="cell-amount">💣</div>
        </div>
      );
    }
    return (
      <div className="cell-content">
        <div className="cell-amount">${cell.amount}</div>
        <div className={`cell-mult ${cell.isStrike ? 'effective' : ''}`}>
          {cell.multiplier.toFixed(2)}x
        </div>
      </div>
    );
  };
  const renderBonusTimer = () => {
    if (cell.type !== 3 || !cell.bonusTimer || !cell.isOpen) return null;
    return (
      <div className="bonus-timer">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={`bolt ${i < cell.bonusTimer! ? 'active' : ''}`}>⚡</span>
        ))}
      </div>
    );
  };
  return (
    <div
      className={getCellClasses()}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {renderCellContent()}
      {renderBonusTimer()}
    </div>
  );
};

export default GameCell;
