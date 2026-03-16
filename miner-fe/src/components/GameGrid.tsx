import type { Cell } from "../types";
import GameCell from "./GameCell";

interface GameGridProps {
  cells: Cell[];
  onCellClick: (cellId: number) => void;
  onShowTooltip: (x: number, y: number, content: string) => void;
  onHideTooltip: () => void;
}

const GameGrid = ({ cells, onCellClick, onShowTooltip, onHideTooltip }: GameGridProps) => {
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
