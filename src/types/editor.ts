import { Effect, EffectCategory } from "@/lib/data/effects";

export interface ClipEffect extends Effect {
  id: string;
  settings: {
    duration: number;
    strength?: number;
    delay?: number;
    [key: string]: any;
  };
}

export interface Clip {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  thumbUrl: string;
  effects: ClipEffect[];
}