import { Clip } from '@/types/clip';

export class AudioProcessor {
  private audioContext: AudioContext;
  private sampleRate: number;

  constructor(sampleRate: number = 44100) {
    this.audioContext = new AudioContext({ sampleRate });
    this.sampleRate = sampleRate;
  }

  async processAudioTracks(clips: Clip[], duration: number): Promise<AudioBuffer> {
    const audioClips = clips.filter(clip => clip.type === 'audio' && clip.audioUrl);
    
    if (audioClips.length === 0) {
      // Return silent audio buffer
      return this.createSilentBuffer(duration);
    }

    // Load all audio clips
    const audioBuffers = await Promise.all(
      audioClips.map(clip => this.loadAudioBuffer(clip.audioUrl!))
    );

    // Create master buffer
    const masterBuffer = this.audioContext.createBuffer(
      2, // stereo
      Math.ceil(duration * this.sampleRate),
      this.sampleRate
    );

    // Mix all audio clips
    audioClips.forEach((clip, index) => {
      const buffer = audioBuffers[index];
      if (buffer) {
        this.mixAudioClip(masterBuffer, buffer, clip, duration);
      }
    });

    return masterBuffer;
  }

  private async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.warn(`Failed to load audio: ${url}`, error);
      return null;
    }
  }

  private createSilentBuffer(duration: number): AudioBuffer {
    return this.audioContext.createBuffer(
      2, // stereo
      Math.ceil(duration * this.sampleRate),
      this.sampleRate
    );
  }

  private mixAudioClip(
    masterBuffer: AudioBuffer,
    clipBuffer: AudioBuffer,
    clip: Clip,
    totalDuration: number
  ): void {
    const startSample = Math.floor(clip.start * this.sampleRate);
    const clipDurationSamples = Math.floor(clip.duration * this.sampleRate);
    const endSample = Math.min(startSample + clipDurationSamples, masterBuffer.length);

    for (let channel = 0; channel < Math.min(masterBuffer.numberOfChannels, clipBuffer.numberOfChannels); channel++) {
      const masterData = masterBuffer.getChannelData(channel);
      const clipData = clipBuffer.getChannelData(channel);

      for (let i = startSample; i < endSample; i++) {
        const clipIndex = i - startSample;
        if (clipIndex < clipData.length) {
          masterData[i] += clipData[clipIndex] * 0.5; // Mix at 50% volume to prevent clipping
        }
      }
    }
  }

  dispose(): void {
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
} 