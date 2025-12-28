"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { effects, EffectCategory } from "@/lib/data/effects";
import EffectCard from "./EffectCard";

interface EffectsPanelProps {
  isCollapsed?: boolean;
}

export default function EffectsPanel({ isCollapsed = false }: EffectsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<EffectCategory | "all">("all");

  const filteredEffects = effects.filter((effect) => {
    const matchesSearch = effect.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = category === "all" || effect.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleDragStart = (effect: typeof effects[number], e: React.DragEvent) => {
    const dragData = {
      id: effect.id,
      name: effect.name,
      icon: effect.icon,
      category: effect.category,
      type: "effect" as const, // Explicitly typing `type` for safety
    };
    e.dataTransfer.setData("application/json", JSON.stringify(dragData));
  };

  // Collapsed (icon-only) mode
  if (isCollapsed) {
    return (
      <div className="p-2 flex flex-col items-center space-y-4 overflow-y-auto h-full">
        {effects.slice(0, 6).map((effect) => (
          <div
            key={effect.id}
            className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-xs cursor-pointer hover:bg-primary/10 transition-colors"
            title={effect.name}
            draggable
            onDragStart={(e) => handleDragStart(effect, e)}
          >
            {effect.icon}
          </div>
        ))}
      </div>
    );
  }

  // Full panel mode
  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b">
        <Input
          placeholder="Search effects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Category Tabs */}
      <Tabs
        defaultValue="all"
        onValueChange={(value) => setCategory(value as EffectCategory | "all")}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="border-b px-1">
          <TabsList className="w-full h-10 bg-transparent border-b-0">
            {["all", "transition", "filter"].map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className="flex-1 data-[state=active]:bg-accent/50 rounded-t-md rounded-b-none h-9 capitalize"
              >
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Effects List */}
        <TabsContent value={category} className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-2">
            <div className="grid grid-cols-2 gap-3 p-3 pb-6">
              {filteredEffects.map((effect) => (
                <EffectCard
                  key={effect.id}
                  effect={effect}
                />
              ))}
              {filteredEffects.length === 0 && (
                <div className="col-span-2 flex items-center justify-center h-40 text-muted-foreground">
                  No effects match your search.
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
