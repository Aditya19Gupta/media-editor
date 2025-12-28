"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Clip, TimelineState } from '@/types/clip';

interface TimelineContextType {
  state: TimelineState;
  setClips: (clips: Clip[]) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  addClip: (clip: Clip) => void;
  removeClip: (clipId: string) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

/**
 * Provides timeline state management to child components
 * Wrap your entire timeline editor with this provider
 */
export const TimelineProvider: React.FC<{
  children: React.ReactNode;
  initialClips?: Clip[];
}> = ({ children, initialClips = [] }) => {
  const [state, setState] = useState<TimelineState>({
    clips: initialClips,
    transitions: [],
    zoom: 50,
    currentTime: 0,
    duration: Math.max(...initialClips.map(c => c.start + c.duration), 10),
    playing: false
  });

  // Calculate duration whenever clips change
  const calculateDuration = useCallback((clips: Clip[]) => {
    return Math.max(...clips.map(c => c.start + c.duration), 10);
  }, []);

  const setClips = useCallback((clips: Clip[]) => {
    setState(prev => ({
      ...prev,
      clips,
      duration: calculateDuration(clips)
    }));
  }, [calculateDuration]);

  const addClip = useCallback((clip: Clip) => {
    setState(prev => {
      const newClips = [...prev.clips, clip];
      return {
        ...prev,
        clips: newClips,
        duration: calculateDuration(newClips)
      };
    });
  }, [calculateDuration]);

  const removeClip = useCallback((clipId: string) => {
    setState(prev => {
      const newClips = prev.clips.filter(c => c.id !== clipId);
      return {
        ...prev,
        clips: newClips,
        duration: calculateDuration(newClips)
      };
    });
  }, [calculateDuration]);

  const updateClip = useCallback((clipId: string, updates: Partial<Clip>) => {
    setState(prev => {
      const newClips = prev.clips.map(c => 
        c.id === clipId ? { ...c, ...updates } : c
      );
      return {
        ...prev,
        clips: newClips,
        duration: calculateDuration(newClips)
      };
    });
  }, [calculateDuration]);

  // Playback animation effect
  useEffect(() => {
    let animationId: number;
    let lastTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      
      if (deltaTime >= 16) { // ~60fps
        setState(prev => {
          if (!prev.playing) return prev;
          
          const newTime = prev.currentTime + (deltaTime / 1000);
          
          if (newTime >= prev.duration) {
            return { ...prev, currentTime: prev.duration, playing: false };
          }

          return { ...prev, currentTime: newTime };
        });
        lastTime = timestamp;
      }
      
      animationId = requestAnimationFrame(animate);
    };

    if (state.playing) {
      animationId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [state.playing, state.duration]);

  const contextValue = {
    state,
    setClips,
    setCurrentTime: (time: number) => setState(prev => ({ ...prev, currentTime: time })),
    setPlaying: (playing: boolean) => setState(prev => ({ ...prev, playing })),
    setZoom: (zoom: number) => setState(prev => ({ ...prev, zoom })),
    addClip,
    removeClip,
    updateClip
  };

  return (
    <TimelineContext.Provider value={contextValue}>
      {children}
    </TimelineContext.Provider>
  );
};

/**
 * Hook to access timeline context
 * Must be used within a TimelineProvider
 */
export const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error('useTimeline must be used within a TimelineProvider');
  }
  return context;
};