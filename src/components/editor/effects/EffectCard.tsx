"use client";

import { useRef, RefObject } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Effect } from "@/lib/data/effects";
import { useDraggable } from "@/lib/hooks/useDragAndDrop";
import { useEffects } from "@/lib/context/EffectsContext";

interface EffectCardProps {
  effect: Effect;
}
export default function EffectCard({ effect }: EffectCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { setPreviewEffect, clearPreviewEffect } = useEffects();

  const { isDragging, dragHandlers } = useDraggable({
    type: "effect",
    item: effect,

    ref: cardRef as any,

  });

  return (
    <Card
      ref={cardRef}
      className={cn(
        "cursor-grab overflow-hidden transition-all hover:ring-2 hover:ring-primary/40 select-none",
        isDragging ? "opacity-50 ring-2 ring-primary scale-95" : "",
        effect.category === "transition" ? "bg-cyan-500/10" : "",
        effect.category === "filter" ? "bg-amber-500/10" : "",
        effect.category === "distort" ? "bg-violet-500/10" : ""
      )}
      {...dragHandlers}
      onMouseEnter={() => setPreviewEffect(effect)}
      onMouseLeave={clearPreviewEffect}
    >
      <CardContent className="p-4 flex flex-col items-center space-y-2">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-lg",
            effect.category === "transition" ? "bg-cyan-500/20" : "",
            effect.category === "filter" ? "bg-amber-500/20" : "",
            effect.category === "distort" ? "bg-violet-500/20" : ""
          )}
        >
          {effect.icon}
        </div>
        <div className="text-center">
          <p className="font-medium text-sm">{effect.name}</p>
          <p className="text-xs text-muted-foreground">{effect.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
