"use client";

import { ReactNode, createContext, useRef, useState } from "react";

interface DragItem {
  type: string;
  [key: string]: any;
}

interface DndContextType {
  draggedItem: DragItem | null;
  setDraggedItem: (item: DragItem | null) => void;
}

export const DndContext = createContext<DndContextType>({
  draggedItem: null,
  setDraggedItem: () => {},
});

export function DndProvider({ children }: { children: ReactNode }) {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  
  return (
    <DndContext.Provider value={{ draggedItem, setDraggedItem }}>
      {children}
      
      {/* Drag Preview (optional) */}
      {draggedItem && (
        <div 
          className="fixed pointer-events-none z-50 bg-white shadow-md rounded-md p-2 opacity-80"
          style={{ 
            left: 0,
            top: 0,
            transform: `translate(${0}px, ${0}px)`,
            width: '150px',
            height: '80px'
          }}
        >
          <div className="text-sm font-medium">
            {draggedItem.name || 'Item'}
          </div>
        </div>
      )}
    </DndContext.Provider>
  );
}