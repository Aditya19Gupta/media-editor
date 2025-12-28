import React, { useState, useRef, useEffect } from 'react';

interface PlayHeadProps {
  position: number;
  timelineHeight: number;
  onPositionChange: (newPosition: number) => void;
  maxPosition?: number;
  minPosition?: number;
}

const PlayHead: React.FC<PlayHeadProps> = ({
  position,
  timelineHeight,
  onPositionChange,
  maxPosition = Infinity,
  minPosition = 0,
}) => {
  const playHeadRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartPos = useRef(position);
  const isDragging = useRef(false);
  const animationFrame = useRef<number | null>(null);
  const lastRenderTime = useRef(0);
  const targetPosition = useRef(position);

  // Use CSS transforms for smoother movement
  const applyTransform = (pos: number) => {
    if (playHeadRef.current) {
      playHeadRef.current.style.transform = `translateX(${pos}px)`;
    }
  };

  // Animation loop for smooth movement
  const animate = (timestamp: number) => {
    if (!lastRenderTime.current) lastRenderTime.current = timestamp;
    const deltaTime = timestamp - lastRenderTime.current;
    lastRenderTime.current = timestamp;

    if (!isDragging.current) {
      // Smooth interpolation when not dragging
      const currentPos = parseFloat(playHeadRef.current?.style.transform.replace('translateX(', '').replace('px)', '') || '0');
      const diff = targetPosition.current - currentPos;
      
      if (Math.abs(diff) > 0.5) {
        // Use easing for smooth follow
        const easingFactor = Math.min(0, deltaTime / 16); // Normalize to 60fps
        applyTransform(currentPos + diff * easingFactor * 0.3);
      } else {
        applyTransform(targetPosition.current);
      }
    }

    animationFrame.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    animationFrame.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  useEffect(() => {
    if (!isDragging.current) {
      targetPosition.current = position;
    }
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartPos.current = position;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    
    // Force hardware acceleration
    if (playHeadRef.current) {
      playHeadRef.current.style.willChange = 'transform';
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    
    const dx = e.clientX - dragStartX.current;
    let newPosition = dragStartPos.current + dx;
    
    // Apply boundaries
    newPosition = Math.max(minPosition, Math.min(maxPosition, newPosition));
    
    // Update target position and apply immediately during drag
    targetPosition.current = newPosition;
    applyTransform(newPosition);
    onPositionChange(newPosition);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    if (playHeadRef.current) {
      playHeadRef.current.style.willChange = '';
    }
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  return (
    <div
      ref={playHeadRef}
      className="absolute top-0 h-full z-10 cursor-grab select-none will-change-transform"
      style={{
        left: '0', // We use transform for positioning
        height: `${timelineHeight}px`,
        transform: `translateX(${position}px)`,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="w-[12px] z-50 h-[12px] bg-orange-600 absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg transition-transform duration-100 ease-out hover:scale-125">
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[12px] border-t-orange-600 absolute top-full left-1/2 -translate-x-1/2"></div>
      </div>
      <div className="w-[2px] h-full bg-orange-600 absolute -translate-x-1/2"></div>
    </div>
  );
};

export default PlayHead;