import { Clip } from "@/types/clip";

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const calculatePosition = (time: number, zoom: number): number => {
  return time * zoom;
};

export const calculateWidth = (duration: number, zoom: number): number => {
  return duration * zoom;
};

export const calculateTimeFromPosition = (position: number, zoom: number): number => {
  return position / zoom;
};

export const moveClip = (clips: Clip[], clipId: string, newStart: number, newTrack: number): Clip[] => {
  return clips.map(clip => {
    if (clip.id === clipId) {
      return {
        ...clip,
        start: Math.max(0, newStart), // Prevent negative start values
        track: newTrack
      };
    }
    return clip;
  });
};

// Check if two clips overlap in time
export const clipsOverlap = (clip1: Clip, clip2: Clip): boolean => {
  const clip1End = clip1.start + clip1.duration;
  const clip2End = clip2.start + clip2.duration;
  
  return !(clip1End <= clip2.start || clip2End <= clip1.start);
};

// Check if a clip would overlap with any existing clips on the same track
export const checkForOverlap = (
  clips: Clip[], 
  clipId: string, 
  newStart: number, 
  newTrack: number, 
  newDuration?: number
): { hasOverlap: boolean; overlappingClips: Clip[] } => {
  const clipToMove = clips.find(clip => clip.id === clipId);
  if (!clipToMove) return { hasOverlap: false, overlappingClips: [] };
  
  const duration = newDuration !== undefined ? newDuration : clipToMove.duration;
  const testClip: Clip = {
    ...clipToMove,
    id: clipId,
    start: newStart,
    track: newTrack,
    duration: duration
  };
  
  const overlappingClips: Clip[] = [];
  
  for (const existingClip of clips) {
    if (existingClip.id === clipId) continue; // Skip the clip being moved
    if (existingClip.track !== newTrack) continue; // Only check clips on the same track
    
    if (clipsOverlap(testClip, existingClip)) {
      overlappingClips.push(existingClip);
    }
  }
  
  return { 
    hasOverlap: overlappingClips.length > 0, 
    overlappingClips 
  };
};

// Find the nearest non-overlapping position for a clip
export const findNonOverlappingPosition = (
  clips: Clip[], 
  clipId: string, 
  desiredStart: number, 
  track: number, 
  duration?: number
): number => {
  const clipToMove = clips.find(clip => clip.id === clipId);
  if (!clipToMove) return desiredStart;
  
  const clipDuration = duration !== undefined ? duration : clipToMove.duration;
  
  // Get all clips on the same track, excluding the clip being moved
  const trackClips = clips
    .filter(clip => clip.id !== clipId && clip.track === track)
    .sort((a, b) => a.start - b.start);
  
  if (trackClips.length === 0) {
    return Math.max(0, desiredStart); // No other clips on track, just ensure non-negative
  }
  
  // Check if desired position works
  const { hasOverlap } = checkForOverlap(clips, clipId, desiredStart, track, duration);
  if (!hasOverlap) {
    return Math.max(0, desiredStart);
  }
  
  // Try to find a position before the first overlapping clip
  for (let i = 0; i < trackClips.length; i++) {
    const clip = trackClips[i];
    const potentialEnd = desiredStart + clipDuration;
    
    if (potentialEnd <= clip.start) {
      return Math.max(0, desiredStart);
    }
  }
  
  // Try to find a gap between clips
  for (let i = 0; i < trackClips.length - 1; i++) {
    const currentClip = trackClips[i];
    const nextClip = trackClips[i + 1];
    const gapStart = currentClip.start + currentClip.duration;
    const gapEnd = nextClip.start;
    const gapSize = gapEnd - gapStart;
    
    if (gapSize >= clipDuration) {
      const positionInGap = Math.max(gapStart, desiredStart);
      if (positionInGap + clipDuration <= gapEnd) {
        return positionInGap;
      }
    }
  }
  
  // Place at the end of the timeline
  const lastClip = trackClips[trackClips.length - 1];
  return lastClip.start + lastClip.duration;
};

export const generateClipStyle = (clip: Clip, zoom: number) => {
  const left = calculatePosition(clip.start, zoom);
  const width = calculateWidth(clip.duration, zoom);
  const color = clip.type === 'video' ? '#0b57ae' : clip.type === 'audio' ? '#401c63' : clip.type === 'text' ? '#683c9a' : '#3b8d0c';
  let image = "";
  if(clip.thumbnail) {

  }
  return {
    left: `${left}px`,
    width: `${width}px`,
    top: `${clip.track * 60}px`,
    backgroundColor: color,
  };
};

// Detect all gaps in the timeline across all tracks
export const findAllGaps = (clips: Clip[]): { trackIndex: number; start: number; end: number; duration: number }[] => {
  const gaps: { trackIndex: number; start: number; end: number; duration: number }[] = [];
  
  // Group clips by track
  const trackClips: { [trackIndex: number]: Clip[] } = {};
  clips.forEach(clip => {
    if (!trackClips[clip.track]) {
      trackClips[clip.track] = [];
    }
    trackClips[clip.track].push(clip);
  });
  
  // Find gaps on each track
  Object.keys(trackClips).forEach(trackIndexStr => {
    const trackIndex = parseInt(trackIndexStr);
    const clipsOnTrack = trackClips[trackIndex].sort((a, b) => a.start - b.start);
    
    // Check for gap at the start of track (if first clip doesn't start at 0)
    if (clipsOnTrack.length > 0 && clipsOnTrack[0].start > 0.1) {
      gaps.push({
        trackIndex,
        start: 0,
        end: clipsOnTrack[0].start,
        duration: clipsOnTrack[0].start
      });
    }
    
    // Check for gaps between consecutive clips (ignore gaps less than 0.1 seconds)
    for (let i = 0; i < clipsOnTrack.length - 1; i++) {
      const currentClip = clipsOnTrack[i];
      const nextClip = clipsOnTrack[i + 1];
      const gapStart = currentClip.start + currentClip.duration;
      const gapEnd = nextClip.start;
      const gapDuration = gapEnd - gapStart;
      
      if (gapDuration > 0.1) { // Only consider gaps larger than 0.1 seconds
        gaps.push({
          trackIndex,
          start: gapStart,
          end: gapEnd,
          duration: gapDuration
        });
      }
    }
  });
  
  return gaps;
};

// Remove a specific gap by moving all clips after it to the left
export const removeGap = (clips: Clip[], trackIndex: number, gapStart: number, gapEnd: number): Clip[] => {
  const gapDuration = gapEnd - gapStart;
  
  return clips.map(clip => {
    // For starting gaps (gapStart === 0), move all clips on the same track
    if (gapStart === 0 && clip.track === trackIndex) {
      return {
        ...clip,
        start: clip.start - gapDuration
      };
    }
    // For regular gaps, only move clips on the same track that start after the gap
    else if (clip.track === trackIndex && clip.start >= gapEnd) {
      return {
        ...clip,
        start: clip.start - gapDuration
      };
    }
    return clip;
  });
};

// Check if a position is within a gap area (with some tolerance for clicking)
export const isPositionInGap = (
  position: number, 
  trackIndex: number, 
  gaps: { trackIndex: number; start: number; end: number; duration: number }[]
): { trackIndex: number; start: number; end: number; duration: number } | null => {
  const gapOnTrack = gaps.find(gap => 
    gap.trackIndex === trackIndex && 
    position >= gap.start && 
    position <= gap.end
  );
  
  return gapOnTrack || null;
};

// Find all adjacent clips (clips that are touching with no gap between them)
export const findAdjacentClips = (clips: Clip[]): { 
  trackIndex: number; 
  leftClip: Clip; 
  rightClip: Clip; 
  transitionPoint: number;
  hasTransition?: boolean;
}[] => {
  const adjacentPairs: { 
    trackIndex: number; 
    leftClip: Clip; 
    rightClip: Clip; 
    transitionPoint: number;
    hasTransition?: boolean;
  }[] = [];
  
  // Group clips by track
  const trackClips: { [trackIndex: number]: Clip[] } = {};
  clips.forEach(clip => {
    if (!trackClips[clip.track]) {
      trackClips[clip.track] = [];
    }
    trackClips[clip.track].push(clip);
  });
  
  // Find adjacent clips on each track
  Object.keys(trackClips).forEach(trackIndexStr => {
    const trackIndex = parseInt(trackIndexStr);
    const clipsOnTrack = trackClips[trackIndex].sort((a, b) => a.start - b.start);
    
    // Check for adjacent clips (no gap between consecutive clips)
    for (let i = 0; i < clipsOnTrack.length - 1; i++) {
      const leftClip = clipsOnTrack[i];
      const rightClip = clipsOnTrack[i + 1];
      const leftClipEnd = leftClip.start + leftClip.duration;
      const gap = rightClip.start - leftClipEnd;
      
      // If clips are adjacent (gap is 0 or very small)
      if (Math.abs(gap) < 0.01) {
        adjacentPairs.push({
          trackIndex,
          leftClip,
          rightClip,
          transitionPoint: leftClipEnd,
          hasTransition: !!(leftClip.transition || rightClip.transition)
        });
      }
    }
  });
  
  return adjacentPairs;
};

// Generate style for transition button between clips
export const generateTransitionButtonStyle = (
  leftClip: Clip, 
  rightClip: Clip, 
  zoom: number,
  trackIndex: number
) => {
  const transitionPoint = leftClip.start + leftClip.duration;
  const left = calculatePosition(transitionPoint, zoom);
  
  return {
    left: `${left - 10}px`, // Center the 20px button on the transition point
    top: `${trackIndex * 60}px`, // Align with track top
    width: '20px',
    height: '60px',
    zIndex: 1000,
    backgroundColor: 'transparent', // Prevent black areas
    border: 'none',
    outline: 'none',
  };
};

// Check if clips are adjacent (no gap between them)
export const areClipsAdjacent = (leftClip: Clip, rightClip: Clip): boolean => {
  const leftClipEnd = leftClip.start + leftClip.duration;
  const gap = rightClip.start - leftClipEnd;
  return Math.abs(gap) < 0.01; // Consider clips adjacent if gap is less than 0.01 seconds
};

// Generate style for gap indicators
export const generateGapStyle = (gap: { start: number; end: number; trackIndex: number }, zoom: number) => {
  const left = calculatePosition(gap.start, zoom);
  const width = calculateWidth(gap.end - gap.start, zoom);
  
  return {
    left: `${left}px`,
    width: `${width}px`,
    top: `${gap.trackIndex * 60}px`,
    height: '60px',
  };
};

