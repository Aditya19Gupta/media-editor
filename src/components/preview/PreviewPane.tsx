"use client";

import { useRef, useEffect } from 'react';
import useEditorStore from '@/store/editorStore';
import { useTimeline } from '@/contexts/TimelineContext';
import TextOverlayPreview from './TextOverlayPreview';

export default function PreviewPane() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { 
    videoClips, 
    playing, 
    setPlaying 
  } = useEditorStore();

  // Use Timeline's currentTime for better sync
  const { currentTime, setTimelineState } = useTimeline();

  const currentVideo = videoClips[0]; // For now we just use the first video

  // Handle video click to toggle playback
  const handleVideoClick = () => {
    const newPlayingState = !playing;
    setPlaying(newPlayingState);
    // Also update Timeline state
    setTimelineState(prev => ({ ...prev, playing: newPlayingState }));
  };

  // Sync video with player state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video) {
        setTimelineState(prev => ({ ...prev, currentTime: video.currentTime }));
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [setTimelineState]);

  // Control video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.play().catch((err) => {
        console.error("Error playing video:", err);
        setPlaying(false);
      });
    } else {
      video.pause();
    }
  }, [playing, setPlaying]);

  // Seek video when currentTime changes externally
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Only update if the difference is significant to avoid feedback loops
    if (Math.abs(video.currentTime - currentTime) > 0.5) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black rounded-md overflow-hidden">
      <video
        ref={videoRef}
        src={currentVideo?.src}
        className="max-w-full max-h-full"
        onClick={handleVideoClick}
      />
      
      <TextOverlayPreview />
      
    </div>
  );
}
