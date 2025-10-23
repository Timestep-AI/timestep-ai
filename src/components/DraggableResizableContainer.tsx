import { useState, useRef, useEffect, ReactNode } from 'react';

interface DraggableResizableContainerProps {
  children: ReactNode;
  gridSize?: number;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
}

export const DraggableResizableContainer = ({
  children,
  gridSize = 20,
  initialWidth = 800,
  initialHeight = 600,
  initialX,
  initialY,
}: DraggableResizableContainerProps) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Center on mount if no initial position provided
  useEffect(() => {
    if (initialX === undefined || initialY === undefined) {
      const centerX = (window.innerWidth - initialWidth) / 2;
      const centerY = (window.innerHeight - initialHeight) / 2;
      setPosition({
        x: snapToGrid(centerX),
        y: snapToGrid(centerY),
      });
    } else {
      setPosition({ x: initialX, y: initialY });
    }
  }, []);

  const snapToGrid = (value: number) => {
    return Math.round(value / gridSize) * gridSize;
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize', direction?: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (type === 'drag') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    } else if (type === 'resize' && direction) {
      setIsResizing(true);
      setResizeDirection(direction);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        setPosition({
          x: snapToGrid(newX),
          y: snapToGrid(newY),
        });
      } else if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        setSize((prev) => {
          let newWidth = prev.width;
          let newHeight = prev.height;
          let newX = position.x;
          let newY = position.y;

          if (resizeDirection.includes('e')) {
            newWidth = Math.max(400, prev.width + deltaX);
          }
          if (resizeDirection.includes('s')) {
            newHeight = Math.max(300, prev.height + deltaY);
          }
          if (resizeDirection.includes('w')) {
            newWidth = Math.max(400, prev.width - deltaX);
            newX = position.x + deltaX;
          }
          if (resizeDirection.includes('n')) {
            newHeight = Math.max(300, prev.height - deltaY);
            newY = position.y + deltaY;
          }

          setPosition({ x: newX, y: newY });
          return {
            width: snapToGrid(newWidth),
            height: snapToGrid(newHeight),
          };
        });

        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, position, resizeDirection, gridSize]);

  const isActive = isDragging || isResizing;

  return (
    <>
      {/* Grid overlay - only shown when dragging/resizing */}
      {isActive && (
        <div 
          className="fixed inset-0 pointer-events-none z-40"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(var(--primary) / 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(var(--primary) / 0.1) 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
        />
      )}
      
      <div
        ref={containerRef}
        className={`absolute shadow-lg bg-background transition-all ${
          isActive ? 'border-2 border-primary' : 'border-0'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
      >
        {/* Drag handle */}
        <div
          className={`absolute top-0 left-0 right-0 h-8 cursor-move flex items-center justify-center transition-all ${
            isActive ? 'bg-primary/10 border-b border-primary/20' : 'bg-transparent'
          }`}
          onMouseDown={(e) => handleMouseDown(e, 'drag')}
        >
          <div className={`text-xs font-medium transition-opacity ${
            isActive ? 'text-primary opacity-100' : 'opacity-0'
          }`}>
            Drag to move • Resize from edges
          </div>
        </div>

      {/* Content */}
      <div className="absolute top-8 left-0 right-0 bottom-0 overflow-hidden">
        {children}
      </div>

        {/* Resize handles - only visible when active */}
        {isActive && (
          <>
            <div
              className="absolute top-0 right-0 w-4 h-4 bg-primary cursor-ne-resize"
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'ne')}
            />
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-primary cursor-se-resize"
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'se')}
            />
            <div
              className="absolute bottom-0 left-0 w-4 h-4 bg-primary cursor-sw-resize"
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'sw')}
            />
            <div
              className="absolute top-0 left-0 w-4 h-4 bg-primary cursor-nw-resize"
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'nw')}
            />
            
            {/* Edge handles */}
            <div
              className="absolute top-0 left-4 right-4 h-1 bg-primary/30 cursor-n-resize"
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'n')}
            />
            <div
              className="absolute bottom-0 left-4 right-4 h-1 bg-primary/30 cursor-s-resize"
              onMouseDown={(e) => handleMouseDown(e, 'resize', 's')}
            />
            <div
              className="absolute left-0 top-4 bottom-4 w-1 bg-primary/30 cursor-w-resize"
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'w')}
            />
            <div
              className="absolute right-0 top-4 bottom-4 w-1 bg-primary/30 cursor-e-resize"
              onMouseDown={(e) => handleMouseDown(e, 'resize', 'e')}
            />
          </>
        )}
      </div>
    </>
  );
};
