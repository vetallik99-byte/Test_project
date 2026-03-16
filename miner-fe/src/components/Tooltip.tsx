interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

const Tooltip = ({ visible, x, y, content }: TooltipProps) => {
  if (!visible) return null;

  return (
    <div
      className={`tooltip ${visible ? "visible" : ""}`}
      style={{
        left: x,
        top: y,
      }}
    >
      {content}
    </div>
  );
};

export default Tooltip;
