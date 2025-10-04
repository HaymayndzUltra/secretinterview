/// <reference path="../renderer.d.ts" />

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
  }
}

import React, { useState, useEffect, useCallback, useRef } from "react";
import Timer from "../components/Timer";
import { useKnowledgeBase } from "../contexts/KnowledgeBaseContext";
import ErrorDisplay from "../components/ErrorDisplay";
import { useError } from "../contexts/ErrorContext";
import { useInterview } from "../contexts/InterviewContext";
import ReactMarkdown from 'react-markdown';

const InterviewPage: React.FC = () => {
  const { knowledgeBase, conversations, addConversation } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const {
    currentText,
    setCurrentText,
    displayedAiResult,
    setDisplayedAiResult,
    lastProcessedIndex,
    setLastProcessedIndex
  } = useInterview();

  const [isRecording, setIsRecording] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoGPTEnabled, setIsAutoGPTEnabled] = useState(false);
  const [userMedia, setUserMedia] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [processor, setProcessor] = useState<ScriptProcessorNode | null>(null);
  const [autoSubmitTimer, setAutoSubmitTimer] = useState<NodeJS.Timeout | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);

  const aiResponseRef = useRef<HTMLDivElement>(null);
  const pendingPartialRef = useRef<string>("");
  const lastTranscriptTimeRef = useRef(Date.now());
  const lastProcessedIndexRef = useRef(lastProcessedIndex);
  const configRef = useRef<any>(null);

  const SAMPLE_RATE = 16000;

  const markdownStyles = `
    .markdown-body {
      font-size: 16px;
      line-height: 1.5;
    }
  `;

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    lastProcessedIndexRef.current = lastProcessedIndex;
  }, [lastProcessedIndex]);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      configRef.current = config ?? {};
      if (config && config.openai_key) {
        setIsConfigured(true);
      } else {
        setIsConfigured(true);
        setError("OpenAI API key not configured. GPT responses will be unavailable until configured.");
      }
    } catch (err) {
      setIsConfigured(false);
      setError("Failed to load configuration. Please check settings.");
    }
  };

  /** Error handling for audio devices */
  const buildMediaError = useCallback((err: unknown, source: "system" | "microphone" = "microphone"): Error => {
    const noun = source === "system" ? "system audio" : "microphone";
    if (err instanceof DOMException) {
      switch (err.name) {
        case "NotFoundError":
        case "DevicesNotFoundError":
          return new Error(`No ${noun} detected. Connect a device or check permissions.`);
        case "NotAllowedError":
        case "SecurityError":
          return new Error(`${noun} access was denied. Allow permission and retry.`);
        case "NotReadableError":
        case "AbortError":
          return new Error(`${noun} is currently unavailable. Close other apps using it and retry.`);
        case "OverconstrainedError":
          return new Error(`Invalid ${noun} configuration. Adjust settings and retry.`);
        default:
          return new Error(err.message || `Failed to access ${noun}.`);
      }
    }
    return new Error(`Failed to access ${noun}.`);
  }, []);

  /** Request system or mic audio stream depending on config */
  const requestAudioStream = useCallback(async (): Promise<MediaStream> => {
    const config = configRef.current;
    const useSystemAudio = config?.useSystemAudio ?? false;

    if (useSystemAudio && navigator.mediaDevices.getDisplayMedia) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          audio: { sampleRate: SAMPLE_RATE, channelCount: 2 },
          video: { frameRate: 1 }
        });
        displayStream.getVideoTracks().forEach(track => (track.enabled = false));
        if (!displayStream.getAudioTracks().length) throw new Error("No system audio track detected.");
        return displayStream;
      } catch (err) {
        throw buildMediaError(err, "system");
      }
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false
      });
    } catch (err) {
      throw buildMediaError(err, "microphone");
    }
  }, [SAMPLE_RATE, buildMediaError]);

  /** Stop recording cleanly */
  const stopRecording = useCallback(async () => {
    if (userMedia) userMedia.getTracks().forEach(track => track.stop());
    if (audioContext) await audioContext.close().catch(() => {});
    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
    }
    if (autoSubmitTimer) clearTimeout(autoSubmitTimer);

    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
    setIsRecording(false);
    setIsModelLoading(false);
    pendingPartialRef.current = "";

    try {
      await window.electronAPI.stopWhisperStream();
    } catch {
      console.warn("Failed to stop Whisper stream");
    }
  }, [audioContext, autoSubmitTimer, processor, userMedia]);

  /** Start Whisper + audio streaming */
  const startRecording = useCallback(async () => {
    if (isRecording || isModelLoading) return;

    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let processorNode: ScriptProcessorNode | null = null;

    try {
      const config = configRef.current ?? (await window.electronAPI.getConfig()) ?? {};
      configRef.current = config;
      setIsModelLoading(true);
      const whisperOptions = {
        language: config?.primaryLanguage,
        modelPath: config?.whisperModelPath,
        binaryPath: config?.whisperBinaryPath,
        sampleRate: SAMPLE_RATE
      };

      stream = await requestAudioStream();
      setUserMedia(stream);

      context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      setAudioContext(context);

      const source = context.createMediaStreamSource(stream);
      processorNode = context.createScriptProcessor(4096, 1, 1);
      setProcessor(processorNode);

      source.connect(processorNode);
      processorNode.connect(context.destination);

      processorNode.onaudioprocess = e => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        window.electronAPI.sendWhisperAudioChunk(pcm.buffer);
      };

      await window.electronAPI.startWhisperStream(whisperOptions);
      setIsRecording(true);
      setIsModelLoading(false);
    } catch (err) {
      const formatted = buildMediaError(err);
      setError(formatted.message);
      await stopRecording();
    }
  }, [buildMediaError, isModelLoading, isRecording, requestAudioStream, setError, stopRecording]);

  useEffect(() => () => stopRecording(), [stopRecording]);

  /** Simple debounce */
  const debounce = (fn: Function, delay: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2.5rem)] p-2 space-y-2">
      <style>{markdownStyles}</style>
      <ErrorDisplay error={error} onClose={clearError} />

      <div className="flex justify-center items-center space-x-2">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isConfigured || (isModelLoading && !isRecording)}
          className={`btn ${isRecording ? "btn-secondary" : "btn-primary"}`}
        >
          {isModelLoading && !isRecording ? "Loading Whisper..." : isRecording ? "Stop Recording" : "Start Recording"}
        </button>
        <Timer isRunning={isRecording} />
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={isAutoGPTEnabled}
            onChange={e => setIsAutoGPTEnabled(e.target.checked)}
            className="checkbox mr-1"
          />
          <span>Auto GPT</span>
        </label>
      </div>

      <div className="flex flex-1 space-x-2 overflow-hidden">
        <div className="flex-1 flex flex-col bg-base-200 p-2 rounded-lg">
          <textarea
            value={currentText}
            onChange={e => setCurrentText(e.target.value)}
            className="textarea textarea-bordered flex-1 mb-1 bg-base-100 min-h-[80px] whitespace-pre-wrap"
            placeholder="Transcribed text will appear here..."
          />
          <button onClick={() => setCurrentText("")} className="btn btn-ghost mt-1">
            Clear Content
          </button>
        </div>

        <div className="flex-1 flex flex-col bg-base-200 p-2 rounded-lg">
          <div ref={aiResponseRef} className="flex-1 overflow-auto bg-base-100 p-2 rounded mb-1 min-h-[80px]">
            <h2 className="text-lg font-bold mb-1">AI Response:</h2>
            <ReactMarkdown className="markdown-body whitespace-pre-wrap">
              {displayedAiResult}
            </ReactMarkdown>
          </div>
          <div className="flex justify-between mt-1">
            <button
              onClick={debounce(() => console.log("Ask GPT Triggered"), 300)}
              disabled={!currentText || isLoading}
              className="btn btn-primary"
            >
              {isLoading ? "Loading..." : "Ask GPT"}
            </button>
            <button onClick={() => setDisplayedAiResult("")} className="btn btn-ghost">
              Clear AI Result
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;
