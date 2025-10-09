import { useEffect, useState } from 'react';

interface LoopbackState {
  status: 'idle' | 'starting' | 'streaming' | 'error';
  error?: string;
  sourceLabel?: string;
}

const TARGET_SAMPLE_RATE = 16000;

export function useLoopbackAudio(): LoopbackState {
  const [state, setState] = useState<LoopbackState>({ status: 'idle' });

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let workletNode: AudioWorkletNode | null = null;

    async function start() {
      try {
        setState({ status: 'starting' });
        const stream = await (navigator.mediaDevices as any).getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: 'loopback'
            }
          }
        });
        audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
        await audioContext.audioWorklet.addModule('worklets/loopback-processor.js');
        const source = audioContext.createMediaStreamSource(stream);
        const gain = audioContext.createGain();
        gain.gain.value = 0;
        workletNode = new AudioWorkletNode(audioContext, 'loopback-processor', {
          processorOptions: {
            targetSampleRate: TARGET_SAMPLE_RATE,
            chunkDurationMs: 512
          }
        });
        workletNode.port.onmessage = (event: MessageEvent) => {
          const arrayBuffer = event.data.buffer as ArrayBuffer;
          window.interview.sendAudioChunk(arrayBuffer);
        };
        source.connect(workletNode);
        workletNode.connect(gain);
        gain.connect(audioContext.destination);
        const audioTrack = stream.getAudioTracks()[0];
        setState({ status: 'streaming', sourceLabel: audioTrack.label || 'Client Loopback' });
      } catch (error) {
        console.error(error);
        setState({ status: 'error', error: (error as Error).message });
      }
    }

    start();

    return () => {
      workletNode?.disconnect();
      audioContext?.close().catch(() => undefined);
    };
  }, []);

  return state;
}
