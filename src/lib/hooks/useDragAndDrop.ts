"use client";

import { useContext, useEffect, useState, RefObject } from "react";
import { DndContext } from "@/lib/context/DndProvider";

type DragOptions = {
  type: string;
  item: any;
  ref: RefObject<HTMLElement>;
};

type DropOptions = {
  accept: string[];
  onDrop: (item: any) => void;
};

export function useDraggable({ type, item, ref }: DragOptions) {
  const { setDraggedItem } = useContext(DndContext);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ ...item, type }));
    e.dataTransfer.effectAllowed = "copy";
    setDraggedItem({ ...item, type });
    setIsDragging(true);
  };
  
  const handleDragEnd = () => {
    setDraggedItem(null);
    setIsDragging(false);
  };
  
  return {
    isDragging,
    dragHandlers: {
      draggable: true,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
    },
  };
}

export function useDroppable({ accept, onDrop }: DropOptions) {
  const { draggedItem } = useContext(DndContext);
  const [isOver, setIsOver] = useState(false);
  
  const isAcceptable = (type: string) => {
    return accept.includes(type);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    if (!draggedItem || !isAcceptable(draggedItem.type)) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isOver) setIsOver(true);
  };
  
  const handleDragLeave = () => {
    setIsOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    
    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;
      
      const item = JSON.parse(data);
      if (!isAcceptable(item.type)) return;
      
      onDrop(item);
    } catch (error) {
      console.error("Error handling drop", error);
    }
  };
  
  return {
    isOver,
    dropRef: (element: HTMLElement | null) => {
      if (!element) return;
      
      element.addEventListener("dragover", handleDragOver as any);
      element.addEventListener("dragleave", handleDragLeave as any);
      element.addEventListener("drop", handleDrop as any);
      
      return () => {
        element.removeEventListener("dragover", handleDragOver as any);
        element.removeEventListener("dragleave", handleDragLeave as any);
        element.removeEventListener("drop", handleDrop as any);
      };
    },
  };
}