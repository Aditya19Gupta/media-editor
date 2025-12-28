"use client";

import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffects } from "@/lib/context/EffectsContext";
import { cn } from "@/lib/utils";

export default function EffectConfigPanel() {
  const { activeEffect, clearActiveEffect } = useEffects();

  useEffect(() => {
    if (activeEffect) {
      // One-time setup if needed
    }
  }, [activeEffect?.effect.id]);

  if (!activeEffect) return null;

  const { effect, onUpdate, onRemove } = activeEffect;

  const handleSettingChange = (key: string, value: any) => {
    onUpdate({ [key]: value });
  };

  const getEffectColor = () => {
    switch (effect.category) {
      case "transition":
        return "text-cyan-600 dark:text-cyan-400";
      case "filter":
        return "text-amber-600 dark:text-amber-400";
      default:
        return "text-primary";
    }
  };

  return (
    <Dialog open={!!activeEffect} onOpenChange={(open) => !open && clearActiveEffect()}>
      <DialogContent className="sm:max-w-[500px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", getEffectColor())}>
            <span>{effect.icon}</span>
            <span>{effect.name} Settings</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Duration */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="duration" className="text-right">
              Duration
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Slider
                id="duration"
                min={0.1}
                max={5}
                step={0.1}
                value={[effect.settings.duration]}
                onValueChange={(values) => handleSettingChange("duration", values[0])}
                className="flex-1"
              />
              <Input
                type="number"
                value={effect.settings.duration}
                onChange={(e) => handleSettingChange("duration", parseFloat(e.target.value))}
                className="w-16"
              />
              <span className="text-sm text-muted-foreground">sec</span>
            </div>
          </div>

          {/* Strength */}
          {(effect.type === "blur" || effect.type === "zoom") && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="strength" className="text-right">
                Strength
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Slider
                  id="strength"
                  min={1}
                  max={100}
                  value={[effect.settings.strength || 50]}
                  onValueChange={(values) => handleSettingChange("strength", values[0])}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={effect.settings.strength || 50}
                  onChange={(e) => handleSettingChange("strength", parseInt(e.target.value))}
                  className="w-16"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          )}

          {/* Delay */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="delay" className="text-right">
              Delay
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Slider
                id="delay"
                min={0}
                max={5}
                step={0.1}
                value={[effect.settings.delay || 0]}
                onValueChange={(values) => handleSettingChange("delay", values[0])}
                className="flex-1"
              />
              <Input
                type="number"
                value={effect.settings.delay || 0}
                onChange={(e) => handleSettingChange("delay", parseFloat(e.target.value))}
                className="w-16"
              />
              <span className="text-sm text-muted-foreground">sec</span>
            </div>
          </div>

          {/* Fade In Easing */}
          {effect.type === "fade-in" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="easing" className="text-right">
                Easing
              </Label>
              <div className="col-span-3">
                <select
                  id="easing"
                  value={effect.settings.easing || "ease-in-out"}
                  onChange={(e) => handleSettingChange("easing", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="ease-in">Ease In</option>
                  <option value="ease-out">Ease Out</option>
                  <option value="ease-in-out">Ease In Out</option>
                  <option value="linear">Linear</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            onClick={() => {
              onRemove();
              clearActiveEffect();
            }}
            size="sm"
          >
            Remove Effect
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={clearActiveEffect}>
              Cancel
            </Button>
            <Button onClick={clearActiveEffect}>Apply</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
