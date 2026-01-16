import React from 'react';
import { Cell } from '../types';
import GameCell from './GameCell';

interface GameGridProps {
  cells: Cell[];
  onCellClick: (cellId: number) => void;
  onShowTooltip: (x: number, y: number, content: string) => void;
  onHideTooltip: () => void;
}

const GameGrid: React.FC<GameGridProps> = ({
  cells,
  onCellClick,
  onShowTooltip,
  onHideTooltip
}) => {
  return (
    <div className="grid">
      {cells.map((cell) => (
        <GameCell
          key={cell.id}
          cell={cell}
          onClick={() => onCellClick(cell.id)}
          onShowTooltip={onShowTooltip}
          onHideTooltip={onHideTooltip}
        />
      ))}
    </div>
  );
};

export default GameGrid;
