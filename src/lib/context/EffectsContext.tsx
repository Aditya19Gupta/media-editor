"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ClipEffect } from "@/types/editor"
import { Effect } from "@/lib/data/effects";
import EffectConfigPanel from "@/components/editor/configuration/EffectConfigPanel";

interface ActiveEffectState {
  clipId: string;
  effect: ClipEffect;
  onUpdate: (settings: any) => void;
  onRemove: () => void;
}

interface EffectsContextType {
  previewEffect: Effect | ClipEffect | null;
  setPreviewEffect: (effect: Effect | ClipEffect) => void;
  clearPreviewEffect: () => void;
  activeEffect: ActiveEffectState | null;
  setActiveEffect: (effect: ActiveEffectState) => void;
  clearActiveEffect: () => void;
}

const EffectsContext = createContext<EffectsContextType | undefined>(undefined);

export function EffectsProvider({ children }: { children: ReactNode }) {
  const [previewEffect, setPreviewEffect] = useState<Effect | ClipEffect | null>(null);
  const [activeEffect, setActiveEffect] = useState<ActiveEffectState | null>(null);
  
  const clearPreviewEffect = () => setPreviewEffect(null);
  const clearActiveEffect = () => setActiveEffect(null);
  
  return (
    <EffectsContext.Provider
      value={{
        previewEffect,
        setPreviewEffect,
        clearPreviewEffect,
        activeEffect,
        setActiveEffect,
        clearActiveEffect
      }}
    >
      {children}
      <EffectConfigPanel />
    </EffectsContext.Provider>
  );
}

export function useEffects() {
  const context = useContext(EffectsContext);
  if (context === undefined) {
    throw new Error("useEffects must be used within an EffectsProvider");
  }
  return context;
}