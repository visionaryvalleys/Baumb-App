export interface SpeechCapture {
  /** Ends the take. The recording resolves with the samples gathered so far. */
  stop: () => void;
  /** Mono samples at the device sample rate. */
  audio: Promise<{ samples: Float32Array; sampleRate: number }>;
}

/**
 * Starts the microphone immediately. Stops when speech falls quiet, after 20 seconds,
 * or when `stop` is called. Samples stay on this device.
 */
export function captureSpeech(onLevel?: (level: number) => void): SpeechCapture {
  const ctx = new AudioContext();
  void ctx.resume();
  const streamPromise = navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  let cancelled = false;
  let stopLive = () => {
    cancelled = true;
  };
  const audio = (async () => {
    const stream = await streamPromise;
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    const chunks: Float32Array[] = [];
    let speechMs = 0;
    let silenceMs = 0;
    let stopped = false;

    const end = (): { samples: Float32Array; sampleRate: number } => {
      if (stopped) return { samples: new Float32Array(), sampleRate: ctx.sampleRate };
      stopped = true;
      processor.onaudioprocess = null;
      processor.disconnect();
      source.disconnect();
      mute.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      const total = chunks.reduce((n, chunk) => n + chunk.length, 0);
      const samples = new Float32Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }
      void ctx.close();
      return { samples, sampleRate: ctx.sampleRate };
    };

    processor.onaudioprocess = (event) => {
      if (stopped) return;
      const data = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      onLevel?.(Math.min(1, rms * 8));
      const frameMs = (data.length / ctx.sampleRate) * 1000;
      if (rms > 0.008) {
        speechMs += frameMs;
        silenceMs = 0;
      } else if (speechMs > 280) {
        silenceMs += frameMs;
        if (silenceMs > 1100) stopLive();
      }
      const elapsed = chunks.reduce((n, chunk) => n + chunk.length, 0) / ctx.sampleRate;
      if (elapsed > 20) stopLive();
    };

    source.connect(processor);
    processor.connect(mute);
    mute.connect(ctx.destination);
    const done = new Promise<{ samples: Float32Array; sampleRate: number }>((resolve) => {
      stopLive = () => resolve(end());
      if (cancelled) stopLive();
    });
    return done;
  })();

  return {
    stop: () => stopLive(),
    audio,
  };
}
