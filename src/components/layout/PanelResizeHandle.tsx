import { useRef, useCallback } from "react";

interface PanelResizeHandleProps {
  side: "left" | "right";
  onResize: (newWidth: number) => void;
  currentWidth: number;
}

export function PanelResizeHandle({ side, onResize, currentWidth }: PanelResizeHandleProps) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = currentWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startXRef.current;
        const multiplier = side === "left" ? 1 : -1;
        onResize(startWidthRef.current + delta * multiplier);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [side, onResize, currentWidth],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-[3px] cursor-col-resize hover:bg-sky-500/50 active:bg-sky-400 transition-colors flex-shrink-0"
    />
  );
}
