"use client";
import { TimelineProvider } from '@/providers/TimelineProvider';
import Timeline from './Timeline';
import { Clip } from '@/types/clip';

interface TimelineWrapperProps {
  initialClips?: Clip[];
  tracksCount?: number;
}

/**
 * Client component wrapper for Timeline
 * Provides the TimelineProvider context
 */
export default function TimelineWrapper({
  initialClips = [],
  tracksCount = 3
}: TimelineWrapperProps) {
  return (
    <TimelineProvider initialClips={initialClips}>
      <Timeline />
    </TimelineProvider>
  );
}