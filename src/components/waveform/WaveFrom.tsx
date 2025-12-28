import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface WaveformProps {
  url: string;
  height?: number;
}

const Waveform = ({ url, height = 40 }: WaveformProps) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!url || !waveformRef.current) {
      if (waveSurferRef.current) {
        try {
          waveSurferRef.current.destroy();
        } catch (e) { /* ignore */ }
        waveSurferRef.current = null;
      }
      return;
    }

    // If a WaveSurfer instance somehow still exists in the ref (e.g. from a previous render that didn't clean up fully due to an error, or StrictMode)
    // destroy it before creating a new one. This ensures we don't leak instances.
    if (waveSurferRef.current) {
      try {
        // console.warn('Destroying pre-existing WaveSurfer instance from ref before new creation for URL:', url);
        waveSurferRef.current.destroy();
      } catch (e) {
        // console.warn("Error destroying pre-existing wavesurfer from ref:", e);
      }
      waveSurferRef.current = null; // Ensure ref is clean before assigning new instance
    }

    const newWaveSurferInstance = WaveSurfer.create({
      container: waveformRef.current, // waveformRef.current should be valid here due to the check above
      waveColor: '#999',
      progressColor: '#4ade80',
      barWidth: 0.3,
      height: height,
      cursorWidth: 0,
      normalize: true,
    });

    waveSurferRef.current = newWaveSurferInstance; // Assign the new instance to the ref

    newWaveSurferInstance.load(url)
      .then(() => {
        // console.log('Waveform loaded for:', url);
      })
      .catch(err => {
        // Only log error if the instance that failed is still the current one in the ref.
        // This avoids logging errors for quickly replaced/destroyed instances.
        if (waveSurferRef.current === newWaveSurferInstance && err.name !== 'AbortError') {
          // console.error('Error loading waveform:', url, err);
        }
      });

    newWaveSurferInstance.on('error', (err) => {
      if (waveSurferRef.current === newWaveSurferInstance) { // Similar check for internal errors
        // console.error('WaveSurfer internal error:', url, err);
      }
    });

    return () => {
      // console.log('Cleanup: Attempting to destroy WaveSurfer for URL:', url, 'Ref:', waveSurferRef.current, 'Instance itself:', newWaveSurferInstance);
      // The instance to destroy is the one created in *this* effect execution (newWaveSurferInstance).
      // We also clear waveSurferRef.current if it happens to hold this specific instance.
      try {
        // console.log('Destroying WaveSurfer instance (from effect closure) for URL:', url);
        newWaveSurferInstance.destroy();
      } catch (destroyError) {
        // console.error('Error destroying newWaveSurferInstance:', url, destroyError);
      }

      // If the ref currently points to the instance we just destroyed, null out the ref.
      // This is important for StrictMode and quick changes.
      if (waveSurferRef.current === newWaveSurferInstance) {
        waveSurferRef.current = null;
      }
    };
  }, [url, height]);

  return <div ref={waveformRef} className="w-full" style={{ height: `${height}px` }} />;
};

export default Waveform;
