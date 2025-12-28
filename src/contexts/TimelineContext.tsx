"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Clip, TimelineState } from '@/types/clip';

interface TimelineContextType {
  timelineState: TimelineState;
  setTimelineState: React.Dispatch<React.SetStateAction<TimelineState>>;
  clips: Clip[];
  duration: number;
  currentTime: number;
  playing: boolean;
  zoom: number;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export const TimelineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [timelineState, setTimelineState] = useState<TimelineState>({
    clips: [],
    transitions: [],
    zoom: 50,
    currentTime: 0,
    duration: 60,
    playing: false
  });

  const contextValue: TimelineContextType = {
    timelineState,
    setTimelineState,
    clips: timelineState.clips,
    duration: timelineState.duration,
    currentTime: timelineState.currentTime,
    playing: timelineState.playing,
    zoom: timelineState.zoom,
  };

  return (
    <TimelineContext.Provider value={contextValue}>
      {children}
    </TimelineContext.Provider>
  );
};

export const useTimeline = (): TimelineContextType => {
  const context = useContext(TimelineContext);
  if (context === undefined) {
    throw new Error('useTimeline must be used within a TimelineProvider');
  }
  return context;
}; 