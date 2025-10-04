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
  const { knowledgeBase, conversations, addConversation, clearConversations } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const {
    currentText,
    setCurrentText,
    aiResult,
    setAiResult,
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
  const [isModelLoading, setIsModelLoading] = useState(true);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const whisperPipelineRef = useRef<any>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const queueSampleCountRef = useRef(0);
  const isProcessingRef = useRef(false);
  const lastTranscriptTimeRef = useRef(Date.now());
  const lastProcessedIndexRef = useRef(lastProcessedIndex);

  const MIN_SAMPLES_PER_TRANSCRIPT = 16000 * 2;

  const markdownStyles = `
    .markdown-body {
      font-size: 16px;
      line-height: 1.5;
    }
    .markdown-body p {
      margin-bottom: 16px;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    .markdown-body code {
      padding: 0.2em 0.4em;
      margin: 0;
      font-size: 85%;
      background-color: rgba(27,31,35,0.05);
      border-radius: 3px;
    }
    .markdown-body pre {
      word-wrap: normal;
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      background-color: #f6f8fa;
      border-radius: 3px;
    }
  `;

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    lastProcessedIndexRef.current = lastProcessedIndex;
  }, [lastProcessedIndex]);

  useEffect(() => {
    let isMounted = true;

    const loadWhisperModel = async () => {
      try {
        const { pipeline, env } = await import("@xenova/transformers");
        env.allowLocalModels = true;
        env.useBrowserCache = true;
        const transcriber = await pipeline(
          "automatic-speech-recognition",
          "Xenova/whisper-small.en",
          {
            quantized: true,
          }
        );
        if (isMounted) {
          whisperPipelineRef.current = transcriber;
          setIsModelLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to load Whisper model", err);
        if (isMounted) {
          setIsModelLoading(false);
          setError(
            "Failed to load Whisper model. Please check your internet connection for the initial download and restart the app."
          );
        }
      }
    };

    loadWhisperModel();

    return () => {
      isMounted = false;
    };
  }, [setError]);

  const handleAskGPT = async (newContent?: string) => {
    const contentToProcess = newContent || currentText.slice(lastProcessedIndex).trim();
    if (!contentToProcess) return;

    setIsLoading(true);
    try {
      const config = await window.electronAPI.getConfig();
      const messages = [
        ...knowledgeBase.map(item => ({ role: "user", content: item })),
        ...conversations,
        { role: "user", content: contentToProcess }
      ];

      const response = await window.electronAPI.callOpenAI({
        config: config,
        messages: messages
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      const formattedResponse = response.content.trim();
      addConversation({ role: "user", content: contentToProcess });
      addConversation({ role: "assistant", content: formattedResponse });
      setDisplayedAiResult(prev => prev + (prev ? '\n\n' : '') + formattedResponse);
      setLastProcessedIndex(currentText.length);
    } catch (error) {
      setError('Failed to get response from GPT. Please try again.');
    } finally {
      setIsLoading(false);
      if (aiResponseRef.current) {
        aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
      }
    }
  };

  const handleAskGPTStable = useCallback(async (newContent: string) => {
    handleAskGPT(newContent);
  }, [handleAskGPT]);

  const handleTranscript = useCallback((transcript: string) => {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) {
      return;
    }

    lastTranscriptTimeRef.current = Date.now();

    setCurrentText((prev: string) => {
      if (!prev.endsWith(trimmedTranscript)) {
        const updatedText = prev + (prev ? '\n' : '') + trimmedTranscript;

        if (isAutoGPTEnabled) {
          if (autoSubmitTimer) {
            clearTimeout(autoSubmitTimer);
          }
          const newTimer = setTimeout(() => {
            const newContent = updatedText.slice(lastProcessedIndexRef.current);
            if (newContent.trim()) {
              handleAskGPTStable(newContent);
            }
          }, 2000);
          setAutoSubmitTimer(newTimer);
        }

        return updatedText;
      }
      return prev;
    });
  }, [autoSubmitTimer, handleAskGPTStable, isAutoGPTEnabled, setCurrentText]);

  const processAudioQueue = useCallback(async () => {
    if (isProcessingRef.current || !whisperPipelineRef.current) {
      return;
    }

    if (queueSampleCountRef.current < MIN_SAMPLES_PER_TRANSCRIPT) {
      return;
    }

    isProcessingRef.current = true;

    const samplesToProcess = Math.min(queueSampleCountRef.current, MIN_SAMPLES_PER_TRANSCRIPT);
    const combined = new Float32Array(samplesToProcess);
    let processedSamples = 0;
    const newQueue: Float32Array[] = [];

    for (const chunk of audioQueueRef.current) {
      if (processedSamples >= samplesToProcess) {
        newQueue.push(chunk);
        continue;
      }

      const remaining = samplesToProcess - processedSamples;
      const takeCount = Math.min(chunk.length, remaining);
      combined.set(chunk.subarray(0, takeCount), processedSamples);
      processedSamples += takeCount;

      if (takeCount < chunk.length) {
        newQueue.push(chunk.subarray(takeCount));
      }
    }

    audioQueueRef.current = newQueue;
    queueSampleCountRef.current = newQueue.reduce((sum, chunk) => sum + chunk.length, 0);

    try {
      const result = await whisperPipelineRef.current({
        array: combined,
        sampling_rate: 16000,
      });

      if (result?.text) {
        handleTranscript(result.text);
      }
    } catch (err) {
      console.error("Failed to transcribe audio chunk", err);
      setError("Failed to process audio locally. Please try again.");
    } finally {
      isProcessingRef.current = false;
      if (queueSampleCountRef.current >= MIN_SAMPLES_PER_TRANSCRIPT) {
        setTimeout(() => {
          processAudioQueue();
        }, 0);
      }
    }
  }, [handleTranscript, setError]);

  const enqueueAudioChunk = useCallback((chunk: Float32Array) => {
    audioQueueRef.current.push(chunk);
    queueSampleCountRef.current += chunk.length;
    processAudioQueue();
  }, [processAudioQueue]);

  useEffect(() => {
    let checkTimer: NodeJS.Timeout | null = null;

    const checkAndSubmit = () => {
      if (isAutoGPTEnabled && Date.now() - lastTranscriptTimeRef.current >= 2000) {
        const newContent = currentText.slice(lastProcessedIndex);
        if (newContent.trim()) {
          handleAskGPTStable(newContent);
        }
      }
      checkTimer = setTimeout(checkAndSubmit, 1000);
    };

    checkTimer = setTimeout(checkAndSubmit, 1000);

    return () => {
      if (checkTimer) {
        clearTimeout(checkTimer);
      }
    };
  }, [currentText, handleAskGPTStable, isAutoGPTEnabled, lastProcessedIndex]);

  useEffect(() => {
    if (!isAutoGPTEnabled && autoSubmitTimer) {
      clearTimeout(autoSubmitTimer);
      setAutoSubmitTimer(null);
    }
  }, [autoSubmitTimer, isAutoGPTEnabled]);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
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

  const startRecording = async () => {
    if (!whisperPipelineRef.current) {
      setError("Whisper model is still loading. Please wait a moment and try again.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      setUserMedia(stream);

      audioQueueRef.current = [];
      queueSampleCountRef.current = 0;
      isProcessingRef.current = false;
      lastTranscriptTimeRef.current = Date.now();

      const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      setAudioContext(context);
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      setProcessor(processor);

      source.connect(processor);
      processor.connect(context.destination);

      processor.onaudioprocess = (e: { inputBuffer: { getChannelData: (arg0: number) => Float32Array; }; }) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        const floatChunk = new Float32Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          const intSample = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7FFF);
          audioData[i] = intSample;
          floatChunk[i] = intSample / 0x8000;
        }

        enqueueAudioChunk(floatChunk);
      };

      setIsRecording(true);
    } catch (err: any) {
      console.error("Failed to start recording", err);
      setError("Failed to start recording. Please check permissions or try again.");
    }
  };

  const stopRecording = () => {
    if (userMedia) {
      userMedia.getTracks().forEach((track) => track.stop());
    }
    if (audioContext) {
      audioContext.close();
    }
    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
    }
    if (autoSubmitTimer) {
      clearTimeout(autoSubmitTimer);
      setAutoSubmitTimer(null);
    }
    audioQueueRef.current = [];
    queueSampleCountRef.current = 0;
    isProcessingRef.current = false;
    lastTranscriptTimeRef.current = Date.now();
    setIsRecording(false);
    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
  };

  useEffect(() => {
    loadConfig();
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  useEffect(() => {
    if (aiResponseRef.current) {
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
    }
  }, [displayedAiResult]);

  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2.5rem)] p-2 space-y-2">
      <style>{markdownStyles}</style>
      <ErrorDisplay error={error} onClose={clearError} />
      <div className="flex justify-center items-center space-x-2">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!isConfigured || isModelLoading}
            className={`btn ${isRecording ? "btn-secondary" : "btn-primary"}`}
          >
            {isModelLoading && !isRecording
              ? "Loading Whisper..."
              : isRecording
                ? "Stop Recording"
                : "Start Recording"}
          </button>
        <Timer isRunning={isRecording} />
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={isAutoGPTEnabled}
            onChange={(e) => setIsAutoGPTEnabled(e.target.checked)}
            className="checkbox mr-1"
          />
          <span>Auto GPT</span>
        </label>
      </div>
      <div className="flex flex-1 space-x-2 overflow-hidden">
        <div className="flex-1 flex flex-col bg-base-200 p-2 rounded-lg">
          <textarea
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            className="textarea textarea-bordered flex-1 mb-1 bg-base-100 min-h-[80px] whitespace-pre-wrap"
            placeholder="Transcribed text will appear here..."
          />
          <button
            onClick={() => setCurrentText("")}
            className="btn btn-ghost mt-1"
          >
            Clear Content
          </button>
        </div>
        <div className="flex-1 flex flex-col bg-base-200 p-2 rounded-lg">
          <div 
            ref={aiResponseRef}
            className="flex-1 overflow-auto bg-base-100 p-2 rounded mb-1 min-h-[80px]"
          >
            <h2 className="text-lg font-bold mb-1">AI Response:</h2>
            <ReactMarkdown className="whitespace-pre-wrap markdown-body" components={{
              p: ({node, ...props}) => <p style={{whiteSpace: 'pre-wrap'}} {...props} />
            }}>
              {displayedAiResult}
            </ReactMarkdown>
          </div>
          <div className="flex justify-between mt-1">
            <button
              onClick={debounce(() => handleAskGPT(), 300)}
              disabled={!currentText || isLoading}
              className="btn btn-primary"
            >
              {isLoading ? "Loading..." : "Ask GPT"}
            </button>
            <button onClick={() => {
              setDisplayedAiResult("");
            }} className="btn btn-ghost">
              Clear AI Result
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;
