import { Clip } from '@/types/clip';
import { ClipEffect } from '@/types/editor';
import { Effect } from '@/lib/data/effects';

const MAX_EFFECT_DURATION = 5; // Maximum duration in seconds

interface AdaptiveEffect {
  id: string;
  settings: Effect['defaultSettings'] & {
    duration: number;
    isTransition?: boolean;
    transitionType?: string;
    prevClipId?: string;
    nextClipId?: string;
    prevClipEnd?: number;
    nextClipStart?: number;
    strength?: number;
    overlap?: number;
    smoothness?: number;
    intensity?: number;
    easing?: string;
    transitionStart?: number;
    prevClipPortion?: number;
    nextClipPortion?: number;
  };
}

export function createAutoAdaptiveEffect(
  effect: Effect,
  allClips: Clip[],
  currentTrack: number,
  dropTime: number
): AdaptiveEffect | null {
  // Sort clips by start time for easier processing
  const trackClips = allClips
    .filter(clip => clip.track === currentTrack)
    .sort((a, b) => a.start - b.start);

  console.log('[EffectUtils] Track clips for transition:', trackClips.map(c => ({
    id: c.id,
    start: c.start,
    end: c.start + c.duration,
    title: c.title
  })));

  // Find adjacent clips where the effect should be applied
  let prevClip: Clip | null = null;
  let nextClip: Clip | null = null;

  // Look for clips where the drop time is between them (allowing for some tolerance)
  for (let i = 0; i < trackClips.length - 1; i++) {
    const current = trackClips[i];
    const next = trackClips[i + 1];
    const currentEnd = current.start + current.duration;
    
    // Check if drop is between these clips (with increased tolerance for larger gaps)
    if (dropTime >= currentEnd - 10 && dropTime <= next.start + 10) {
      prevClip = current;
      nextClip = next;
      console.log('[EffectUtils] Found clips for overlapping transition:', {
        prevClip: current.id,
        nextClip: next.id,
        prevEnd: currentEnd,
        nextStart: next.start,
        dropTime,
        gapSize: (next.start - currentEnd).toFixed(2) + 's'
      });
      break;
    }
  }

  // If we don't have adjacent clips, return null
  if (!prevClip || !nextClip) {
    console.log('[EffectUtils] No adjacent clips found for transition at dropTime:', dropTime);
    return null;
  }

  // Calculate overlapping transition parameters
  const maxTransitionDuration = Math.min(5, effect.defaultSettings.duration || 5);
  
  // Calculate how much duration we can take from each clip
  const prevClipAvailable = prevClip.duration;
  const nextClipAvailable = nextClip.duration;
  
  console.log('[EffectUtils] Clip durations:', {
    prevClipDuration: prevClipAvailable,
    nextClipDuration: nextClipAvailable,
    maxTransitionDuration
  });

  // Calculate optimal distribution - always try for 2.5s from each clip
  let prevClipPortion: number;
  let nextClipPortion: number;
  let totalDuration: number;

  if (prevClipAvailable >= 2.5 && nextClipAvailable >= 2.5) {
    // Ideal case: 2.5s from each clip (total 5s)
    prevClipPortion = 2.5;
    nextClipPortion = 2.5;
    totalDuration = 5.0;
  } else {
    // Edge case: one or both clips are shorter than 2.5s
    const maxFromPrev = Math.min(prevClipAvailable, maxTransitionDuration / 2);
    const maxFromNext = Math.min(nextClipAvailable, maxTransitionDuration / 2);
    
    if (prevClipAvailable < 2.5) {
      // First clip is short, take what we can from it
      prevClipPortion = Math.min(prevClipAvailable, 2.5);
      nextClipPortion = Math.min(nextClipAvailable, maxTransitionDuration - prevClipPortion);
    } else if (nextClipAvailable < 2.5) {
      // Second clip is short, take what we can from it  
      nextClipPortion = Math.min(nextClipAvailable, 2.5);
      prevClipPortion = Math.min(prevClipAvailable, maxTransitionDuration - nextClipPortion);
    } else {
      // Both clips are adequate, split equally
      prevClipPortion = maxFromPrev;
      nextClipPortion = maxFromNext;
    }
    
    totalDuration = prevClipPortion + nextClipPortion;
  }

  // Ensure we don't exceed clip boundaries
  prevClipPortion = Math.min(prevClipPortion, prevClipAvailable);
  nextClipPortion = Math.min(nextClipPortion, nextClipAvailable);
  totalDuration = prevClipPortion + nextClipPortion;

  // The transition starts at the end of the first clip minus the overlap
  const transitionStart = prevClip.start + prevClip.duration - prevClipPortion;

  console.log('[EffectUtils] Overlapping transition calculated:', {
    prevClipPortion,
    nextClipPortion,
    totalDuration,
    transitionStart,
    prevClipEnd: prevClip.start + prevClip.duration,
    nextClipStart: nextClip.start,
    overlapModel: 'overlapping_clips'
  });

  // Create adapted settings for overlapping transition
  const adaptedSettings: AdaptiveEffect['settings'] = {
    ...effect.defaultSettings,
    duration: totalDuration,
    isTransition: true,
    transitionType: 'overlap',
    prevClipId: prevClip.id,
    nextClipId: nextClip.id,
    prevClipEnd: prevClip.start + prevClip.duration,
    nextClipStart: nextClip.start,
    transitionStart: transitionStart,
    prevClipPortion: prevClipPortion,
    nextClipPortion: nextClipPortion,
    strength: effect.defaultSettings.strength || 100,
    overlap: Math.min(prevClipPortion, nextClipPortion),
    smoothness: 1,
    intensity: 1,
    easing: 'ease-in-out'
  };

  // Special handling for different effect types
  switch (effect.type) {
    case 'blur':
      adaptedSettings.strength = Math.min(10, effect.defaultSettings.strength || 5);
      adaptedSettings.easing = 'ease-in-out';
      break;
      
    case 'fade-in':
    case 'fade-out':
      adaptedSettings.easing = 'linear';
      adaptedSettings.strength = effect.defaultSettings.strength || 100;
      break;
      
    case 'zoom':
      adaptedSettings.strength = Math.min(150, effect.defaultSettings.strength || 120);
      adaptedSettings.easing = 'ease-in-out';
      break;
      
    case 'sepia':
    case 'contrast':
    case 'brightness':
      adaptedSettings.strength = effect.defaultSettings.strength || 100;
      adaptedSettings.easing = 'ease-in-out';
      break;
      
    default:
      // For any other effect types
      adaptedSettings.strength = effect.defaultSettings.strength || 100;
      adaptedSettings.easing = 'ease-in-out';
      break;
  }

  console.log('[EffectUtils] Final overlapping transition settings:', adaptedSettings);

  return {
    id: effect.id,
    settings: adaptedSettings
  };
}

export function calculateEffectTiming(
  effect: ClipEffect,
  prevClip: Clip | null,
  nextClip: Clip | null
): { start: number; duration: number } {
  if (!prevClip || !nextClip) {
    return {
      start: 0,
      duration: Math.min(effect.settings.duration || MAX_EFFECT_DURATION, MAX_EFFECT_DURATION)
    };
  }

  const gapStart = prevClip.start + prevClip.duration;
  const gapDuration = nextClip.start - gapStart;
  
  // Always use the exact gap duration or max 5 seconds
  const effectDuration = Math.min(gapDuration, MAX_EFFECT_DURATION);

  return {
    start: gapStart,
    duration: effectDuration
  };
} 