import { Clip, TransitionEffect } from '@/types/clip';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, RotateCw, Move, ZoomIn, ZoomOut, FlipHorizontal, FlipVertical } from 'lucide-react';
import { effects } from '@/lib/data/effects';
import useEditorStore from '@/store/editorStore';

interface TimelinePreviewProps {
  clips: Clip[];
  transitions?: TransitionEffect[];
  currentTime: number;
  width?: number;
  height?: number;
  playing?: boolean;
  onPlayToggle: () => void;
  onClipUpdate?: (clipId: string, updates: Partial<Clip>) => void;
}

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const TimelinePreview: React.FC<TimelinePreviewProps> = ({
  clips,
  transitions = [],
  currentTime,
  width = 320,
  height = 180,
  playing = false,
  onPlayToggle,
  onClipUpdate,
}) => {
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});
  const [selectedImageClipId, setSelectedImageClipId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null); // 'nw', 'ne', 'sw', 'se', or null
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dragAnimationRef = useRef<number | null>(null);
  
  const { visualClips, audioClips, activeTransitions } = useMemo(() => {
    const result = {
      visualClips: [] as Clip[],
      audioClips: [] as Clip[],
      activeTransitions: [] as TransitionEffect[],
    };
    
    // Find active transitions
    if (transitions && Array.isArray(transitions)) {
      transitions.forEach((transition) => {
        const transitionEnd = transition.startTime + transition.duration;
        if (currentTime >= transition.startTime && currentTime <= transitionEnd) {
          result.activeTransitions.push(transition);
        }
      });
    }
    
    // Ensure clips prop is available before iterating
    if (clips && Array.isArray(clips)) {
      clips.forEach((clip) => {
        // Check if clip is active (either normally or extended by transition)
        let isActive = currentTime >= clip.start && currentTime <= clip.start + clip.duration;
        
        // Check if clip is part of an active transition (extend visibility for overlapping)
        const relevantTransitions = result.activeTransitions.filter(transition => 
          transition.fromClipId === clip.id || transition.toClipId === clip.id
        );
        
        if (relevantTransitions.length > 0) {
          const transition = relevantTransitions[0];
          const overlapPerSide = transition.settings?.overlapPerSide || (transition.duration / 2);
          
          if (transition.fromClipId === clip.id) {
            // First clip: extend visibility during transition (show last 2.5s)
            const extendedEnd = clip.start + clip.duration + overlapPerSide;
            isActive = currentTime >= clip.start && currentTime <= extendedEnd;
          } else if (transition.toClipId === clip.id) {
            // Second clip: start visibility early during transition (show first 2.5s early)
            const extendedStart = clip.start - overlapPerSide;
            isActive = currentTime >= extendedStart && currentTime <= clip.start + clip.duration;
          }
        }
        
        if (isActive) {
          if (clip.type === 'audio') {
            result.audioClips.push(clip);
          } else {
            result.visualClips.push(clip);
          }
        }
      });
    }
    return result;
  }, [clips, transitions, currentTime]);

  // Get text overlays from store
  const { textOverlays, selectedOverlayId, selectOverlay, updateTextOverlay } = useEditorStore();

  // Convert effect IDs to CSS filter string (memoized for performance)
  const getEffectStyles = useCallback((effectIds: string[] = [], clip?: Clip) => {
    let allEffects = [...(effectIds || [])];
    
    // Add transition effects if this clip is in an active transition
    if (clip) {
      const relevantTransitions = activeTransitions.filter(transition => 
        transition.fromClipId === clip.id || transition.toClipId === clip.id
      );
      
      relevantTransitions.forEach(transition => {
        if (transition.settings?.effectType) {
          allEffects.push(transition.settings.effectType);
        }
      });
    }
    
    if (!allEffects || allEffects.length === 0) return {};

    const filters: string[] = [];
    const transforms: string[] = [];
    let opacity = 1;

    // Calculate clip progress for time-based effects
    const clipProgress = clip ? Math.max(0, Math.min(1, (currentTime - clip.start) / clip.duration)) : 0;

    // Check if this clip has a transition and if we're in the transition period
    const isInTransition = clip?.transition && 
      currentTime >= (clip.start + clip.duration - 2.5) && 
      currentTime <= (clip.start + clip.duration + 2.5);

    allEffects.forEach(effectId => {
      const effect = effects.find(e => e.id === effectId);
      if (!effect) return;

      // Handle transition effects specially
      if (clip?.transition && effectId === clip.transition.type && isInTransition) {
        const transitionPoint = clip.start + clip.duration;
        const transitionProgress = Math.max(0, Math.min(1, (currentTime - (transitionPoint - 1.25)) / 2.5));

        switch (effect.type) {
          case 'blur':
            const blurAmount = transitionProgress * (effect.defaultSettings?.strength || 10);
            filters.push(`blur(${blurAmount}px)`);
            break;
          case 'sepia':
            const sepiaAmount = transitionProgress * (effect.defaultSettings?.strength || 100);
            filters.push(`sepia(${sepiaAmount}%)`);
            break;
          case 'brightness':
            const brightnessAmount = 100 + (transitionProgress * ((effect.defaultSettings?.strength || 150) - 100));
            filters.push(`brightness(${brightnessAmount}%)`);
            break;
          case 'contrast':
            const contrastAmount = 100 + (transitionProgress * ((effect.defaultSettings?.strength || 150) - 100));
            filters.push(`contrast(${contrastAmount}%)`);
            break;
          case 'fade-in':
          case 'fade-out':
            opacity = Math.max(0, Math.min(1, 1 - (transitionProgress * 0.8)));
            break;
          case 'zoom':
            const zoomScale = 1 + (transitionProgress * 0.3);
            transforms.push(`scale(${zoomScale})`);
            break;
        }
        return; // Skip normal effect processing for transition effects
      }

      // Normal effect processing (non-transition)
      switch (effect.type) {
        case 'blur':
          filters.push(`blur(${effect.defaultSettings?.strength || 5}px)`);
          break;
        case 'sepia':
          filters.push(`sepia(${effect.defaultSettings?.strength || 75}%)`);
          break;
        case 'brightness':
          filters.push(`brightness(${effect.defaultSettings?.strength || 120}%)`);
          break;
        case 'contrast':
          filters.push(`contrast(${effect.defaultSettings?.strength || 120}%)`);
          break;
        case 'fade-in':
          // Fade in over the first part of the clip
          const fadeInDuration = Math.min(effect.defaultSettings?.duration || 1.5, clip?.duration || 1.5);
          const fadeInProgress = Math.min(1, (currentTime - (clip?.start || 0)) / fadeInDuration);
          opacity = Math.max(0, Math.min(1, fadeInProgress));
          console.log(`🌅 Fade-in opacity: ${opacity.toFixed(2)}`);
          break;
        case 'fade-out':
          // Fade out over the last part of the clip
          const fadeOutDuration = Math.min(effect.defaultSettings?.duration || 1.5, clip?.duration || 1.5);
          const timeFromEnd = (clip?.start || 0) + (clip?.duration || 0) - currentTime;
          const fadeOutProgress = Math.min(1, timeFromEnd / fadeOutDuration);
          opacity = Math.max(0, Math.min(1, fadeOutProgress));
          console.log(`🌆 Fade-out opacity: ${opacity.toFixed(2)}`);
          break;
        case 'zoom':
          const zoomScale = effect.id === 'zoom-in' ? 1.1 : 0.9;
          transforms.push(`scale(${zoomScale})`);
          break;
      }
    });

    const style: React.CSSProperties = {};
    
    if (filters.length > 0) {
      style.filter = filters.join(' ');
      console.log(`🎭 CSS Filter: ${style.filter}`);
    }
    
    if (transforms.length > 0) {
      style.transform = transforms.join(' ');
      console.log(`🔄 CSS Transform: ${style.transform}`);
    }
    
    if (opacity !== 1) {
      style.opacity = opacity;
      console.log(`👻 CSS Opacity: ${opacity}`);
    }

    return style;
  }, [activeTransitions, currentTime]);

  // Get transition effect styles for clips involved in overlapping transitions
  const getTransitionStyles = useCallback((clip: Clip) => {
    const relevantTransitions = activeTransitions.filter(transition => 
      transition.fromClipId === clip.id || transition.toClipId === clip.id
    );
    
    if (relevantTransitions.length === 0) return {};
    
    let transitionStyle: React.CSSProperties = {};
    
    relevantTransitions.forEach(transition => {
      const transitionProgress = Math.max(0, Math.min(1, 
        (currentTime - transition.startTime) / transition.duration
      ));
      
      const overlapPerSide = transition.settings?.overlapPerSide || (transition.duration / 2);
      const midPoint = transition.startTime + overlapPerSide;
      

      
      if (transition.type === 'crossfade') {
        if (transition.fromClipId === clip.id) {
          // First clip: full opacity until midpoint, then fade out
          if (currentTime <= midPoint) {
            transitionStyle.opacity = 1; // Full opacity during first half
          } else {
            // Fade out during second half
            const fadeProgress = (currentTime - midPoint) / overlapPerSide;
            transitionStyle.opacity = Math.max(0, 1 - fadeProgress);
          }

        } else if (transition.toClipId === clip.id) {
          // Second clip: fade in from midpoint onwards
          if (currentTime < midPoint) {
            // Fade in during first half
            const fadeProgress = (currentTime - transition.startTime) / overlapPerSide;
            transitionStyle.opacity = Math.max(0, fadeProgress);
          } else {
            transitionStyle.opacity = 1; // Full opacity during second half
          }

        }
      }
    });
    
    return transitionStyle;
  }, [activeTransitions, currentTime]);

  // Handle text overlay selection
  const handleOverlaySelect = useCallback((overlayId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent timeline click-to-seek
    selectOverlay(overlayId);
  }, [selectOverlay]);

  // Handle text overlay dragging
  const dragStartData = useRef<{ overlayId: string; startX: number; startY: number; initialMouseX: number; initialMouseY: number } | null>(null);

  const handleOverlayMouseDown = useCallback((overlayId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    selectOverlay(overlayId);
    const overlay = textOverlays.find(o => o.id === overlayId);
    if (!overlay) return;

    // Get the preview container's bounding rect to calculate relative positions
    const previewRect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!previewRect) return;

    dragStartData.current = {
      overlayId,
      startX: overlay.position.x,
      startY: overlay.position.y,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }, [textOverlays, selectOverlay]);

  const handleDocumentMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStartData.current) return;
    e.preventDefault();

    const { overlayId, startX, startY, initialMouseX, initialMouseY } = dragStartData.current;
    
    const previewElement = document.querySelector('.timeline-preview-display'); // Needs a class on the preview div
    if (!previewElement) return;
    const previewRect = previewElement.getBoundingClientRect();

    const deltaX = e.clientX - initialMouseX;
    const deltaY = e.clientY - initialMouseY;

    // Convert pixel delta to percentage delta based on preview size
    const percentageDeltaX = (deltaX / previewRect.width) * 100;
    const percentageDeltaY = (deltaY / previewRect.height) * 100;

    let newX = startX + percentageDeltaX;
    let newY = startY + percentageDeltaY;

    // Clamp position to be within 0-100% (approximately, consider overlay size later if needed)
    newX = Math.max(0, Math.min(100, newX));
    newY = Math.max(0, Math.min(100, newY));

    updateTextOverlay(overlayId, { position: { x: newX, y: newY } });
  }, [updateTextOverlay]);

  const handleDocumentMouseUp = useCallback(() => {
    if (dragStartData.current && (dragStartData.current.initialMouseX !== dragStartData.current.startX || dragStartData.current.initialMouseY !== dragStartData.current.startY)) {
      // If it was a drag, ensure focus is removed to commit any text changes if contentEditable was active
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && typeof activeElement.blur === 'function') {
        activeElement.blur();
      }
    }
    dragStartData.current = null;
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);
  }, [handleDocumentMouseMove]);

  // Cleanup event listeners when component unmounts
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [handleDocumentMouseMove, handleDocumentMouseUp]);

  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // If the click is directly on the preview background (not an overlay or other control)
    // and an overlay is currently selected, deselect it.
    if (e.target === e.currentTarget && selectedOverlayId) {
      selectOverlay(null);
      // Also blur any active element to ensure text changes are committed
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && typeof activeElement.blur === 'function') {
        activeElement.blur();
      }
    }
  }, [selectedOverlayId, selectOverlay]);

  // Handle video playback and synchronization with transition support
  useEffect(() => {
    visualClips.forEach((clip) => {
      const video = videoRefs.current[clip.id];
      if (clip.type === 'video' && video && clip.videoUrl) {
        try {
          // Check if this clip is in a transition and calculate proper seek time
          const relevantTransitions = activeTransitions.filter(transition => 
            transition.fromClipId === clip.id || transition.toClipId === clip.id
          );
          
          // Calculate the position in the original media file accounting for trimming
          const trimStart = clip.trimStart || 0;
          let clipProgress = Math.max(0, currentTime - clip.start);
          
          if (relevantTransitions.length > 0) {
            const transition = relevantTransitions[0];
            const overlapPerSide = transition.settings?.overlapPerSide || (transition.duration / 2);
            
            if (transition.fromClipId === clip.id) {
              // First clip: during transition, continue playing normally until end, then hold
              if (currentTime > clip.start + clip.duration) {
                // During extension, hold at the last frame
                clipProgress = Math.max(0, clip.duration - 0.01); // Hold at end
              } else {
                clipProgress = Math.max(0, currentTime - clip.start);
              }
              
//<<<<<<< editor/bugs-fixes

//=======
//               console.log(`🎬 First clip "${clip.title}" seek time:`, {
//                 currentTime: currentTime.toFixed(2),
//                 clipStart: clip.start.toFixed(2),
//                 clipEnd: (clip.start + clip.duration).toFixed(2),
//                 seekTo: (trimStart + clipProgress).toFixed(2),
//                 trimStart: trimStart.toFixed(2)
//               });
//>>>>>>> dev
              
            } else if (transition.toClipId === clip.id) {
              // Second clip: during early visibility, show from the beginning
              const extendedStart = clip.start - overlapPerSide;
              if (currentTime < clip.start) {
                // During early visibility, show from beginning
                clipProgress = Math.max(0, currentTime - extendedStart);
              } else {
                clipProgress = Math.max(0, currentTime - clip.start);
              }
              
              console.log(`🎬 Second clip "${clip.title}" seek time:`, {
                currentTime: currentTime.toFixed(2),
                clipStart: clip.start.toFixed(2),
                extendedStart: extendedStart.toFixed(2),
                seekTo: (trimStart + clipProgress).toFixed(2),
                trimStart: trimStart.toFixed(2)
              });
            }
          }
          
          // Add the trim offset to get the correct position in the original video
          clipProgress = trimStart + clipProgress;
          
          // Only seek if we're significantly off
          if (Math.abs(video.currentTime - clipProgress) > 0.5) {
            video.currentTime = clipProgress;
          }

          // Check if there is a linked audio clip that is currently active
          const linkedAudioClipId = `${clip.id}-audio`;
          const isLinkedAudioActive = audioClips.some(ac => ac.id === linkedAudioClipId);

          // Only allow video's internal audio if there's no separate audio clip
          video.muted = isLinkedAudioActive;

          // Play or pause based on the playing state
          if (playing) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                // Ignore AbortError which can happen if playback is interrupted quickly
                if (error.name !== 'AbortError') {
                  console.error("Video playback error:", clip.title, error);
                }
              });
            }
          } else {
            video.pause();
          }
        } catch (err) {
          console.error('Error handling video playback for:', clip.title, err);
        }
      }
    });
  }, [visualClips, audioClips, activeTransitions, currentTime, playing]);

  // Handle audio clip playback with transition support
  useEffect(() => {
    // First, determine which clips should be actively playing to prevent overlaps
    const activeAudioClips = new Set<string>();
    const allPotentialClips: Array<{clip: Clip, priority: number}> = [];
    
    // Step 1: Collect all potentially active clips with priorities
    audioClips.forEach((clip) => {
      const audio = audioRefs.current[clip.id];
      if (clip.type === 'audio' && audio && clip.audioUrl) {
        try {
          // Check if this clip should be playing based on its normal timeline position
          const isInNormalRange = currentTime >= clip.start && currentTime <= clip.start + clip.duration;
          
          // Check if this clip is in a transition (including linked video clips)
          const relevantTransitions = activeTransitions.filter(transition => {
            // Direct match
            if (transition.fromClipId === clip.id || transition.toClipId === clip.id) {
              return true;
            }
            // Check for linked video clip if this is an audio clip
            if (clip.id.endsWith('-audio')) {
              const videoClipId = clip.id.replace('-audio', '');
              return transition.fromClipId === videoClipId || transition.toClipId === videoClipId;
            }
            return false;
          });
          
          let shouldMute = false;
          let audioVolume = 1.0;
          let shouldPlay = isInNormalRange; // Only play if in normal range by default
          let priority = 0; // Lower number = higher priority
          
          // Handle audio during transitions - STRICT no-overlap policy
          if (relevantTransitions.length > 0) {
            const transition = relevantTransitions[0];
            const overlapPerSide = transition.settings?.overlapPerSide || (transition.duration / 2);
            const midPoint = transition.startTime + overlapPerSide;
            
            if (transition.fromClipId === clip.id) {
              // First clip: play until midpoint, then STOP completely (no overlap)
              shouldPlay = currentTime >= clip.start && currentTime < midPoint;
              audioVolume = shouldPlay ? 1.0 : 0.0;
              priority = 1; // Transition clips have higher priority
            } else if (transition.toClipId === clip.id) {
              // Second clip: start playing ONLY at midpoint (no overlap)
              shouldPlay = currentTime >= midPoint && currentTime <= clip.start + clip.duration;
              audioVolume = shouldPlay ? 1.0 : 0.0;
              priority = 1; // Transition clips have higher priority
            }
            
            console.log(`🔊 Audio transition for "${clip.title}": shouldPlay=${shouldPlay}, volume=${audioVolume.toFixed(2)}, currentTime=${currentTime.toFixed(2)}, midPoint=${midPoint.toFixed(2)}, clipType=${clip.type}`);
          } else {
            // Normal playback - lower priority than transitions
            priority = 2;
          }
          
          // Add to potential clips if it should play
          if (shouldPlay) {
            allPotentialClips.push({ clip, priority });
          }
        } catch (err) {
          console.error('Error analyzing audio playback for:', clip.title, err);
        }
      }
    });
    
    // Step 2: Check if current visual content is an image - if so, MUTE ALL AUDIO
    // During transitions, we need to check which clip is visually dominant
    const activeVisualClips = visualClips.filter(clip => 
      currentTime >= clip.start && currentTime <= clip.start + clip.duration
    );
    
    let dominantVisualClip = null;
    
    if (activeVisualClips.length === 1) {
      // Simple case: only one active clip
      dominantVisualClip = activeVisualClips[0];
    } else if (activeVisualClips.length > 1) {
      // Multiple clips active (transition) - check which one is visually dominant
      const relevantVisualTransitions = activeTransitions.filter(transition => {
        return activeVisualClips.some(clip => 
          transition.fromClipId === clip.id || transition.toClipId === clip.id
        );
      });
      
      if (relevantVisualTransitions.length > 0) {
        const transition = relevantVisualTransitions[0];
        const overlapPerSide = transition.settings?.overlapPerSide || (transition.duration / 2);
        const midPoint = transition.startTime + overlapPerSide;
        
        // Before midpoint: first clip is dominant
        // After midpoint: second clip is dominant
        if (currentTime < midPoint) {
          dominantVisualClip = activeVisualClips.find(clip => clip.id === transition.fromClipId);
        } else {
          dominantVisualClip = activeVisualClips.find(clip => clip.id === transition.toClipId);
        }
      } else {
        // No transition found, use the most recent clip
        dominantVisualClip = activeVisualClips.reduce((latest, current) => 
          current.start > latest.start ? current : latest
        );
      }
    }
    
    // Debug logging for visual clip detection
    console.log(`🔍 Visual clip detection at ${currentTime.toFixed(2)}s:`, {
      activeVisualClips: activeVisualClips.map(c => ({
        title: c.title,
        type: c.type,
        start: c.start,
        end: c.start + c.duration
      })),
      dominantVisualClip: dominantVisualClip ? {
        title: dominantVisualClip.title,
        type: dominantVisualClip.type,
        videoUrl: dominantVisualClip.videoUrl
      } : null,
      transitionsActive: activeTransitions.length
    });
    
    const isImageCurrentlyShowing = dominantVisualClip && (
      dominantVisualClip.type === 'image'
      // Remove URL pattern check as it can incorrectly identify videos as images
      // The clip.type should be the definitive source of truth
    );
    
    if (isImageCurrentlyShowing && dominantVisualClip) {
      console.log(`📸 Image "${dominantVisualClip.title}" is VISUALLY DOMINANT - MUTING ALL AUDIO`);
      // Clear all potential audio clips when image is showing
      allPotentialClips.length = 0;
    } else if (dominantVisualClip) {
      console.log(`🎬 Video "${dominantVisualClip.title}" is VISUALLY DOMINANT - AUDIO ALLOWED`);
    } else {
      console.log(`⚫ No visual clip is currently showing at ${currentTime.toFixed(2)}s`);
    }
    
    // Step 3: Select only the highest priority clips (prevent all overlaps)
    if (allPotentialClips.length > 0) {
      // Sort by priority (lower number = higher priority)
      allPotentialClips.sort((a, b) => a.priority - b.priority);
      const highestPriority = allPotentialClips[0].priority;
      
      // Only allow clips with the highest priority
      const selectedClips = allPotentialClips.filter(item => item.priority === highestPriority);
      
      // If multiple clips have the same priority, only allow the one that started most recently
      if (selectedClips.length > 1) {
        const mostRecent = selectedClips.reduce((latest, current) => 
          current.clip.start > latest.clip.start ? current : latest
        );
        activeAudioClips.add(mostRecent.clip.id);
        console.log(`🎯 Multiple clips with priority ${highestPriority}, selected most recent: ${mostRecent.clip.title}`);
      } else {
        activeAudioClips.add(selectedClips[0].clip.id);
      }
    }
    
    // Step 4: Apply playback settings to all clips
    audioClips.forEach((clip) => {
      const audio = audioRefs.current[clip.id];
      if (clip.type === 'audio' && audio && clip.audioUrl) {
                 try {
           const isSelected = activeAudioClips.has(clip.id);
           
           // Calculate proper seek time accounting for trimming
           const trimStart = clip.trimStart || 0;
           let clipProgress = Math.max(0, currentTime - clip.start);
           
           // Check for relevant transitions for this specific clip
           const clipTransitions = activeTransitions.filter(transition => {
             // Direct match
             if (transition.fromClipId === clip.id || transition.toClipId === clip.id) {
               return true;
             }
             // Check for linked video clip if this is an audio clip
             if (clip.id.endsWith('-audio')) {
               const videoClipId = clip.id.replace('-audio', '');
               return transition.fromClipId === videoClipId || transition.toClipId === videoClipId;
             }
             return false;
           });
           
           if (clipTransitions.length > 0) {
             const transition = clipTransitions[0];
             const overlapPerSide = transition.settings?.overlapPerSide || (transition.duration / 2);
             
             if (transition.fromClipId === clip.id) {
               // First clip: during extension, keep playing from current position
               if (currentTime > clip.start + clip.duration) {
                 clipProgress = clip.duration - 0.1; // Keep at end
               } else {
                 clipProgress = Math.max(0, currentTime - clip.start);
               }
             } else if (transition.toClipId === clip.id) {
               // Second clip: start from beginning when it begins at midpoint
               const transitionMidPoint = transition.startTime + overlapPerSide;
               if (currentTime < transitionMidPoint) {
                 clipProgress = 0; // Don't play before midpoint
               } else {
                 // Play from beginning of clip when starting at midpoint
                 clipProgress = Math.max(0, currentTime - clip.start);
               }
             }
           }
           
           // Add the trim offset to get the correct position in the original audio
           clipProgress = trimStart + clipProgress;
          
          // Only seek if we're significantly off
          if (Math.abs(audio.currentTime - clipProgress) > 0.5) {
             try {
            audio.currentTime = clipProgress;
             } catch (error) {
               console.warn(`Audio seek error for ${clip.title}:`, error);
             }
           }

           // Set volume based on selection
           audio.volume = isSelected ? 1.0 : 0.01;

           // Play or pause based on the playing state AND selection
           if (playing && isSelected) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                if (error.name !== 'AbortError') {
                  console.error("Audio playback error:", clip.title, error);
                }
              });
            }
          } else {
            audio.pause();
          }
        } catch (err) {
          console.error('Error handling audio playback for:', clip.title, err);
        }
      }
    });
    
    // Debug: Show which audio clips are currently active
    if (activeAudioClips.size > 0) {
      console.log(`🎵 Active audio clips at ${currentTime.toFixed(2)}s:`, Array.from(activeAudioClips));
    }
  }, [audioClips, activeTransitions, currentTime, playing]);

  // Handle image click to select for editing
  const handleImageClick = useCallback((clipId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelectedId = selectedImageClipId === clipId ? null : clipId;
    setSelectedImageClipId(newSelectedId);
    console.log(`Image clicked: ${clipId}, selected: ${newSelectedId}`);
  }, [selectedImageClipId]);

  // Handle image transformation updates
  const updateImageTransform = useCallback((clipId: string, transform: Partial<import('@/types/clip').ImageTransform>) => {
    if (onClipUpdate) {
      const clip = clips.find(c => c.id === clipId);
      if (clip) {
        const currentTransform = clip.imageTransform || {};
        onClipUpdate(clipId, {
          imageTransform: { ...currentTransform, ...transform }
        });
      }
    }
  }, [clips, onClipUpdate]);

  // Smooth dragging with requestAnimationFrame
  const performDragUpdate = useCallback((deltaX: number, deltaY: number) => {
    if (!selectedImageClipId) return;
    
    // Convert pixel movement to percentage
    const offsetX = (deltaX / width) * 100;
    const offsetY = (deltaY / height) * 100;
    
    const clip = clips.find(c => c.id === selectedImageClipId);
    if (clip) {
      const currentTransform = clip.imageTransform || {};
      updateImageTransform(selectedImageClipId, {
        offsetX: (currentTransform.offsetX || 0) + offsetX * 0.3, // Smoother movement
        offsetY: (currentTransform.offsetY || 0) + offsetY * 0.3,
      });
    }
  }, [selectedImageClipId, width, height, clips, updateImageTransform]);

  // Mouse handlers for smooth image dragging
  const handleImageMouseDown = useCallback((clipId: string, e: React.MouseEvent) => {
    if (selectedImageClipId !== clipId) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
    e.stopPropagation();
  }, [selectedImageClipId]);

  // Handle resize corner mouse down
  const handleResizeMouseDown = useCallback((clipId: string, corner: string, e: React.MouseEvent) => {
    if (selectedImageClipId !== clipId) return;
    
    setIsResizing(corner);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
    e.stopPropagation();
  }, [selectedImageClipId]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!selectedImageClipId) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    if (isDragging) {
      // Cancel any pending animation frame
      if (dragAnimationRef.current) {
        cancelAnimationFrame(dragAnimationRef.current);
      }
      
      // Use requestAnimationFrame for smooth updates
      dragAnimationRef.current = requestAnimationFrame(() => {
        performDragUpdate(deltaX, deltaY);
        setDragStart({ x: e.clientX, y: e.clientY });
      });
    } else if (isResizing) {
      // Handle resizing
      const clip = clips.find(c => c.id === selectedImageClipId);
      if (clip) {
        const currentTransform = clip.imageTransform || {};
        const currentScaleX = currentTransform.scaleX || currentTransform.scale || 1;
        const currentScaleY = currentTransform.scaleY || currentTransform.scale || 1;
        
        // Calculate scale changes based on corner being dragged
        let scaleXDelta = 0;
        let scaleYDelta = 0;
        
        const sensitivity = 0.005; // Adjust for resize sensitivity
        
        switch (isResizing) {
          case 'nw': // Northwest corner
            scaleXDelta = -deltaX * sensitivity;
            scaleYDelta = -deltaY * sensitivity;
            break;
          case 'ne': // Northeast corner
            scaleXDelta = deltaX * sensitivity;
            scaleYDelta = -deltaY * sensitivity;
            break;
          case 'sw': // Southwest corner
            scaleXDelta = -deltaX * sensitivity;
            scaleYDelta = deltaY * sensitivity;
            break;
          case 'se': // Southeast corner
            scaleXDelta = deltaX * sensitivity;
            scaleYDelta = deltaY * sensitivity;
            break;
          case 'n': // North edge (top)
            scaleYDelta = -deltaY * sensitivity;
            break;
          case 's': // South edge (bottom)
            scaleYDelta = deltaY * sensitivity;
            break;
          case 'w': // West edge (left)
            scaleXDelta = -deltaX * sensitivity;
            break;
          case 'e': // East edge (right)
            scaleXDelta = deltaX * sensitivity;
            break;
        }
        
        const newScaleX = Math.max(0.1, Math.min(5, currentScaleX + scaleXDelta));
        const newScaleY = Math.max(0.1, Math.min(5, currentScaleY + scaleYDelta));
        
        updateImageTransform(selectedImageClipId, {
          scaleX: newScaleX,
          scaleY: newScaleY,
          scale: undefined // Clear uniform scale when using custom scales
        });
        
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  }, [isDragging, isResizing, selectedImageClipId, dragStart, width, height, clips, updateImageTransform, performDragUpdate]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
    
    // Cancel any pending animation frame
    if (dragAnimationRef.current) {
      cancelAnimationFrame(dragAnimationRef.current);
      dragAnimationRef.current = null;
    }
  }, []);

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Clean up animation frame
        if (dragAnimationRef.current) {
          cancelAnimationFrame(dragAnimationRef.current);
          dragAnimationRef.current = null;
        }
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Enhanced image transformation controls with custom resize
  const ImageControls: React.FC<{ clipId: string }> = ({ clipId }) => {
    const clip = clips.find(c => c.id === clipId);
    const transform = clip?.imageTransform || {};

    return (
      <div className="absolute top-2 right-2 flex flex-col gap-1 bg-black bg-opacity-70 rounded p-2 z-20">
        <button
          onClick={() => updateImageTransform(clipId, { 
            rotation: (transform.rotation || 0) + 15 
          })}
          className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
          title="Rotate"
        >
          <RotateCw className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={() => {
            const currentScale = transform.scale || 1;
            const currentScaleX = transform.scaleX || currentScale;
            const currentScaleY = transform.scaleY || currentScale;
            updateImageTransform(clipId, { 
              scaleX: Math.min(5, currentScaleX + 0.1),
              scaleY: Math.min(5, currentScaleY + 0.1),
              scale: undefined
            });
          }}
          className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={() => {
            const currentScale = transform.scale || 1;
            const currentScaleX = transform.scaleX || currentScale;
            const currentScaleY = transform.scaleY || currentScale;
            updateImageTransform(clipId, { 
              scaleX: Math.max(0.1, currentScaleX - 0.1),
              scaleY: Math.max(0.1, currentScaleY - 0.1),
              scale: undefined
            });
          }}
          className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={() => updateImageTransform(clipId, { 
            flipHorizontal: !transform.flipHorizontal 
          })}
          className={`p-1 hover:bg-white hover:bg-opacity-20 rounded ${
            transform.flipHorizontal ? 'bg-blue-500' : ''
          }`}
          title="Flip Horizontal"
        >
          <FlipHorizontal className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={() => updateImageTransform(clipId, { 
            flipVertical: !transform.flipVertical 
          })}
          className={`p-1 hover:bg-white hover:bg-opacity-20 rounded ${
            transform.flipVertical ? 'bg-blue-500' : ''
          }`}
          title="Flip Vertical"
        >
          <FlipVertical className="w-4 h-4 text-white" />
        </button>
        <button
          onClick={() => updateImageTransform(clipId, { 
            offsetX: 0, 
            offsetY: 0, 
            scale: 1,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            flipHorizontal: false,
            flipVertical: false,
            opacity: 1
          })}
          className="p-1 hover:bg-white hover:bg-opacity-20 rounded text-xs text-white"
          title="Reset All"
        >
          Reset
        </button>
      </div>
    );
  };

  // Enhanced resize handles component with better visibility
  const ResizeHandles: React.FC<{ clipId: string }> = ({ clipId }) => {
    const handleStyle = "absolute w-4 h-4 bg-blue-600 border-2 border-white rounded-full cursor-pointer hover:bg-blue-700 shadow-lg z-50";
    
    console.log(`Rendering resize handles for clip: ${clipId}`);
    
    return (
      <>
        {/* Corner handles - made larger and more visible */}
        <div
          className={`${handleStyle} cursor-nw-resize`}
          style={{ top: '-8px', left: '-8px' }}
          onMouseDown={(e) => handleResizeMouseDown(clipId, 'nw', e)}
          title="Resize width and height"
        />
        <div
          className={`${handleStyle} cursor-ne-resize`}
          style={{ top: '-8px', right: '-8px' }}
          onMouseDown={(e) => handleResizeMouseDown(clipId, 'ne', e)}
          title="Resize width and height"
        />
        <div
          className={`${handleStyle} cursor-sw-resize`}
          style={{ bottom: '-8px', left: '-8px' }}
          onMouseDown={(e) => handleResizeMouseDown(clipId, 'sw', e)}
          title="Resize width and height"
        />
        <div
          className={`${handleStyle} cursor-se-resize`}
          style={{ bottom: '-8px', right: '-8px' }}
          onMouseDown={(e) => handleResizeMouseDown(clipId, 'se', e)}
          title="Resize width and height"
        />
        
        {/* Add edge handles for width/height only adjustments */}
        <div
          className={`${handleStyle} cursor-n-resize`}
          style={{ top: '-8px', left: '50%', transform: 'translateX(-50%)' }}
          onMouseDown={(e) => handleResizeMouseDown(clipId, 'n', e)}
          title="Resize height only"
        />
        <div
          className={`${handleStyle} cursor-s-resize`}
          style={{ bottom: '-8px', left: '50%', transform: 'translateX(-50%)' }}
          onMouseDown={(e) => handleResizeMouseDown(clipId, 's', e)}
          title="Resize height only"
        />
        <div
          className={`${handleStyle} cursor-w-resize`}
          style={{ left: '-8px', top: '50%', transform: 'translateY(-50%)' }}
          onMouseDown={(e) => handleResizeMouseDown(clipId, 'w', e)}
          title="Resize width only"
        />
        <div
          className={`${handleStyle} cursor-e-resize`}
          style={{ right: '-8px', top: '50%', transform: 'translateY(-50%)' }}
          onMouseDown={(e) => handleResizeMouseDown(clipId, 'e', e)}
          title="Resize width only"
        />
      </>
    );
  };

  // Generate transform style for image with enhanced scaling
  const getImageTransformStyle = useCallback((transform: import('@/types/clip').ImageTransform = {}) => {
    const transformParts = [];
    
    if (transform.offsetX || transform.offsetY) {
      transformParts.push(`translate(${transform.offsetX || 0}%, ${transform.offsetY || 0}%)`);
    }
    
    // Use scaleX/scaleY if available, otherwise fall back to uniform scale
    const scaleX = transform.scaleX || transform.scale || 1;
    const scaleY = transform.scaleY || transform.scale || 1;
    
    if (scaleX !== 1 || scaleY !== 1) {
      transformParts.push(`scale(${scaleX}, ${scaleY})`);
    }
    
    if (transform.rotation && transform.rotation !== 0) {
      transformParts.push(`rotate(${transform.rotation}deg)`);
    }
    
    if (transform.flipHorizontal || transform.flipVertical) {
      const flipScaleX = transform.flipHorizontal ? -1 : 1;
      const flipScaleY = transform.flipVertical ? -1 : 1;
      transformParts.push(`scale(${flipScaleX}, ${flipScaleY})`);
    }

    return {
      transform: transformParts.length > 0 ? transformParts.join(' ') : undefined,
      opacity: transform.opacity !== undefined ? transform.opacity : 1,
    };
  }, []);

  // Debug selected image state
  useEffect(() => {
    console.log(`Selected image clip ID changed: ${selectedImageClipId}`);
    if (selectedImageClipId) {
      console.log(`Rendering controls for selected image: ${selectedImageClipId}`);
    }
  }, [selectedImageClipId]);

  return (
    <div
      className="relative rounded-lg overflow-hidden w-full bg-gray-100 dark:bg-gray-800 transition-colors duration-300 timeline-preview-display"
      style={{ height: `${height}px` }}
      onClick={handlePreviewClick}
    >
      {visualClips.map((clip) => {
        // Calculate z-index so higher tracks in UI appear on top in preview
        // Visual 1 (track 0) should appear above Visual 2 (track 1)
        // So we use a base value and subtract track index
        const maxVisualTracks = 10; // Reasonable maximum for visual tracks
        const zIndex = maxVisualTracks - clip.track;
        
        return (
          <div 
            key={clip.id} 
            className="absolute inset-0"
            style={{ zIndex }}
          >
            {clip.type === 'video' && (
              <video
                ref={(el) => {
                  videoRefs.current[clip.id] = el;
                }}
                src={clip.videoUrl}
                playsInline
                preload="metadata"
                className="w-full h-full object-contain transition-all duration-300"
                style={{
                  ...getEffectStyles(clip.effects, clip),
                  ...getTransitionStyles(clip)
                }}
                onLoadedData={() => console.log(`Video ${clip.id} loaded`)}
                onError={(e) => console.error(`Video ${clip.id} error:`, e)}
              />
            )}
            {clip.type === 'image' && (
              <div className="relative w-full h-full">
                <img
                  src={clip.videoUrl}
                  alt={clip.title}
                  className={`w-full h-full object-contain transition-all duration-300 ${
                    selectedImageClipId === clip.id ? 'cursor-move ring-2 ring-blue-500' : 'cursor-pointer'
                  }`}
                  style={{
                    ...getEffectStyles(clip.effects, clip),
                    ...getImageTransformStyle(clip.imageTransform),
                    ...getTransitionStyles(clip)
                  }}
                  onClick={(e) => handleImageClick(clip.id, e)}
                  onMouseDown={(e) => handleImageMouseDown(clip.id, e)}
                />
                {selectedImageClipId === clip.id && (
                  <>
                    <ImageControls clipId={clip.id} />
                    <ResizeHandles clipId={clip.id} />
                    <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none rounded" />
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded z-40">
                      <Move className="w-3 h-3 inline mr-1" />
                      Drag to move • Use handles to resize
                    </div>
                    
                    {/* Debug info */}
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded z-40">
                      Selected: {clip.id}
                    </div>
                  </>
                )}
              </div>
            )}
            {clip.type === 'text' && clip.textContent && clip.visible !== false && (
              <div
                className="absolute text-center pointer-events-none"
                style={{
                  left: `${clip.textPosition?.x || 50}%`,
                  top: `${clip.textPosition?.y || 50}%`,
                  transform: 'translate(-50%, -50%)',
                  fontFamily: clip.textStyle?.fontFamily || 'Inter, sans-serif',
                  fontSize: `${Math.max(12, (clip.textStyle?.fontSize || 24) * (height / 360))}px`,
                  color: clip.textStyle?.color || '#FFFFFF',
                  backgroundColor: clip.textStyle?.backgroundColor || 'transparent',
                  textAlign: clip.textStyle?.textAlign || 'center',
                  fontWeight: clip.textStyle?.fontWeight || 'bold',
                  fontStyle: clip.textStyle?.fontStyle || 'normal',
                  textShadow: clip.textStyle?.textShadow || '2px 2px 4px rgba(0, 0, 0, 0.8)',
                  padding: '8px 16px',
                  maxWidth: '80%',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  zIndex: 15,
                  ...getEffectStyles(clip.effects, clip),
                  ...getTransitionStyles(clip)
                }}
              >
                {clip.textContent}
              </div>
            )}
          </div>
        );
      })}

      {/* Hidden audio elements for audio-only clips */}
      {audioClips.map((clip) => (
        <audio
          key={clip.id}
          ref={(el) => {
            audioRefs.current[clip.id] = el;
          }}
          src={clip.audioUrl}
          preload="metadata"
          onLoadedData={() => console.log(`Audio ${clip.id} loaded`)}
          onError={(e) => console.error(`Audio ${clip.id} error:`, e)}
        />
      ))}

      {visualClips.length === 0 && audioClips.length === 0 && (
        <div className="flex items-center justify-center h-full w-full text-black dark:text-white text-sm">
          No active clips
        </div>
      )}

      {/* Audio indicator when audio is playing but no visuals */}
      {visualClips.length === 0 && audioClips.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center ${playing ? 'animate-pulse' : ''}`}>
            <Volume2 className="text-white h-8 w-8" />
          </div>
        </div>
      )}

      {/* Text overlays - enabled for live editing */}
      {textOverlays.filter(overlay => {
        // Only show overlays that have been dropped into the timeline,
        // are within their time range, and are visible
        return overlay.visible &&
               overlay.droppedInTimeline &&
               overlay.startTime <= currentTime &&
               overlay.endTime >= currentTime;
      }).map((overlay) => (
        <div
          key={overlay.id}
          className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab text-overlay timeline-text ${selectedOverlayId === overlay.id ? 'border-2 border-blue-500 z-20 outline-none' : 'z-10'}`}
          data-text-overlay="true"
          data-overlay-id={overlay.id}
          style={{
            left: `${overlay.position.x}%`,
            top: `${overlay.position.y}%`,
            fontFamily: overlay.style.fontFamily,
            fontSize: `${Math.max(12, overlay.style.fontSize * (height / 360))}px`, // Scale font size
            color: overlay.style.color,
            backgroundColor: overlay.style.backgroundColor || 'transparent',
            textAlign: overlay.style.textAlign,
            fontWeight: overlay.style.fontWeight,
            fontStyle: overlay.style.fontStyle,
            textShadow: overlay.style.textShadow || '2px 2px 4px rgba(0, 0, 0, 0.8)',
            padding: '4px 8px',
            maxWidth: '80%',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            zIndex: selectedOverlayId === overlay.id ? 20 : 10
          }}
          onMouseDown={(e) => handleOverlayMouseDown(overlay.id, e)}
          contentEditable={selectedOverlayId === overlay.id}
          suppressContentEditableWarning={true}
          onBlur={(e) => {
            // Only update content on blur if this overlay was the selected one
            if (useEditorStore.getState().selectedOverlayId === overlay.id) { 
              updateTextOverlay(overlay.id, { content: e.currentTarget.innerText });
            }
          }}
          onKeyDown={(e) => {
            // Prevent new line in contentEditable, use Shift+Enter if needed or handle elsewhere
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur(); // Commit changes on Enter
            }
          }}
        >
          {overlay.content}
        </div>
      ))}

      {/* Play/Pause Button */}
      <button
        onClick={onPlayToggle}
        className="absolute bottom-2 left-2 z-10 bg-white dark:bg-black bg-opacity-70 p-1 rounded-full hover:bg-opacity-90 transition"
      >
        {playing ? (
          <Pause className="w-4 h-4 text-black dark:text-white" />
        ) : (
          <Play className="w-4 h-4 text-black dark:text-white" />
        )}
      </button>

      <div className="absolute bottom-2 right-2 bg-white dark:bg-black bg-opacity-70 text-black dark:text-white text-xs px-2 py-1 rounded">
        {formatTime(currentTime)} / {formatTime(audioClips[0]?.duration || visualClips[0]?.duration || 0)}
      </div>
    </div>
  );
};

export default TimelinePreview;
