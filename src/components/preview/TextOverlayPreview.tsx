"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
import useEditorStore from '@/store/editorStore';
import { useTimeline } from '@/contexts/TimelineContext';
import { TextOverlay } from '@/types';

export default function TextOverlayPreview() {
  const {
    textOverlays,
    selectedOverlayId,
    updateTextOverlay
  } = useEditorStore();

  const { currentTime } = useTimeline();

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [initialSize, setInitialSize] = useState(0);
  const [initialRotation, setInitialRotation] = useState(0);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);

  // Use useMemo to ensure the filtered overlays update immediately when textOverlays change
  const activeOverlays = useMemo(() => {
    return textOverlays.filter(
      overlay => {
        // Only show overlays that have been dropped into the timeline,
        // are within their time range, and are visible
        return overlay.visible &&
               overlay.droppedInTimeline &&
               overlay.startTime <= currentTime &&
               overlay.endTime >= currentTime;
      }
    );
  }, [textOverlays, currentTime]);

  const getMouseAngle = (e: React.MouseEvent, centerX: number, centerY: number) => {
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    overlay: TextOverlay,
    handle?: string
  ) => {
    if (!containerRef.current) return;
    e.stopPropagation();

    const container = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - container.left) / container.width * 100;
    const y = (e.clientY - container.top) / container.height * 100;

    setDragStartPos({ x, y });
    setIsDragging(true);

    if (handle === 'rotate') {
      setResizeHandle('rotate');
      setInitialRotation(overlay.style.rotate || 0);
      const centerX = container.left + (overlay.position.x / 100) * container.width;
      const centerY = container.top + (overlay.position.y / 100) * container.height;
      setRotationStartAngle(getMouseAngle(e, centerX, centerY));
    } else if (handle) {
      setResizeHandle(handle);
      setInitialSize(overlay.style.fontSize);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current || !selectedOverlayId) return;

    const container = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - container.left) / container.width * 100;
    const y = (e.clientY - container.top) / container.height * 100;

    const deltaX = x - dragStartPos.x;
    const deltaY = y - dragStartPos.y;

    const selectedOverlay = textOverlays.find(o => o.id === selectedOverlayId);
    if (!selectedOverlay) return;

    if (resizeHandle === 'rotate') {
      const centerX = container.left + (selectedOverlay.position.x / 100) * container.width;
      const centerY = container.top + (selectedOverlay.position.y / 100) * container.height;
      const currentAngle = getMouseAngle(e, centerX, centerY);
      const newRotation = initialRotation + (currentAngle - rotationStartAngle);

      updateTextOverlay(selectedOverlayId, {
        style: { ...selectedOverlay.style, rotate: newRotation }
      });
    } else if (resizeHandle) {
      const scaleFactor = 0.5;
      const newSize = Math.max(10, initialSize + deltaY * scaleFactor);
      updateTextOverlay(selectedOverlayId, {
        style: { ...selectedOverlay.style, fontSize: newSize }
      });
    } else {
      const newX = Math.max(0, Math.min(100, selectedOverlay.position.x + deltaX));
      const newY = Math.max(0, Math.min(100, selectedOverlay.position.y + deltaY));

      updateTextOverlay(selectedOverlayId, {
        position: { x: newX, y: newY }
      });
      setDragStartPos({ x, y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setResizeHandle(null);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {activeOverlays.map((overlay) => {
        const isSelected = overlay.id === selectedOverlayId;
        const rotation = overlay.style.rotate || 0;

        return (
          <div
            key={overlay.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
              isSelected ? 'pointer-events-auto cursor-move' : ''
            }`}
            style={{
              left: `${overlay.position.x}%`,
              top: `${overlay.position.y}%`,
              fontFamily: overlay.style.fontFamily,
              fontSize: `${overlay.style.fontSize}px`,
              color: overlay.style.color,
              backgroundColor: overlay.style.backgroundColor || 'transparent',
              textAlign: overlay.style.textAlign,
              fontWeight: overlay.style.fontWeight,
              fontStyle: overlay.style.fontStyle,
              textShadow: overlay.style.textShadow,
              padding: '4px 8px',
              maxWidth: '80%',
              wordBreak: 'break-word',
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              whiteSpace: 'pre-wrap'
            }}
            onMouseDown={(e) => handleMouseDown(e, overlay)}
          >
            {isSelected && (
              <>
                {/* Font Resize Handles */}
                <div
                  className="absolute -top-4 left-1/2 w-4 h-4 bg-white border border-blue-500 rounded-full cursor-ns-resize transform -translate-x-1/2"
                  onMouseDown={(e) => handleMouseDown(e, overlay, 'top')}
                />
                <div
                  className="absolute -bottom-4 left-1/2 w-4 h-4 bg-white border border-blue-500 rounded-full cursor-ns-resize transform -translate-x-1/2"
                  onMouseDown={(e) => handleMouseDown(e, overlay, 'bottom')}
                />

                {/* Rotation Handle */}
                <div
                  className="absolute -top-8 left-1/2 w-4 h-4 bg-yellow-400 border border-black rounded-full cursor-crosshair transform -translate-x-1/2"
                  onMouseDown={(e) => handleMouseDown(e, overlay, 'rotate')}
                  title="Rotate"
                />

                {/* Selection Border */}
                <div className="absolute -inset-1 border-2 border-blue-500 rounded pointer-events-none" />
              </>
            )}
            {overlay.content}
          </div>
        );
      })}
    </div>
  );
}
