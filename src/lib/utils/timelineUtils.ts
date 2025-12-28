import { Clip } from '@/types/clip';

export const calculateTimeFromPosition = (position: number, zoom: number): number => {
  return position / zoom;
};

export const calculatePosition = (time: number, zoom: number): number => {
  return time * zoom;
};

export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const generateClipStyle = (clip: Clip, zoom: number) => {
  const width = clip.duration * zoom;
  const left = clip.start * zoom;
  const top = clip.track * 60;

  return {
    width: `${width}px`,
    left: `${left}px`,
    top: `${top}px`,
    height: '60px',
  };
};

export const findGapAfterClip = (clips: Clip[], clipId: string): { gapDuration: number; nextClip: Clip | null } => {
  // Find the current clip
  const currentClip = clips.find(c => c.id === clipId);
  if (!currentClip) return { gapDuration: 0, nextClip: null };

  // Find all clips on the same track
  const trackClips = clips.filter(c => c.track === currentClip.track)
    .sort((a, b) => a.start - b.start);

  // Find the next clip on this track
  const currentIndex = trackClips.findIndex(c => c.id === clipId);
  const nextClip = trackClips[currentIndex + 1];

  if (!nextClip) return { gapDuration: 0, nextClip: null };

  // Calculate the gap
  const currentClipEnd = currentClip.start + currentClip.duration;
  const gapDuration = nextClip.start - currentClipEnd;

  console.log('Gap detection:', {
    clipId,
    track: currentClip.track,
    currentClipEnd,
    nextClipStart: nextClip.start,
    gapDuration
  });

  return { 
    gapDuration: Math.max(0, gapDuration), 
    nextClip: gapDuration > 0 ? nextClip : null 
  };
};

export const deleteGapAfterClip = (clips: Clip[], clipId: string): Clip[] => {
  const { gapDuration, nextClip } = findGapAfterClip(clips, clipId);
  if (!nextClip || gapDuration <= 0) return clips;

  const currentClip = clips.find(c => c.id === clipId);
  if (!currentClip) return clips;

  // Move all clips after the gap on the same track
  return clips.map(clip => {
    if (clip.track === currentClip.track && clip.start >= nextClip.start) {
      return {
        ...clip,
        start: clip.start - gapDuration
      };
    }
    return clip;
  });
}; 