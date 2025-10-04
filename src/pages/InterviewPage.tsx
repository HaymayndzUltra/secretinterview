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

  const handleStreamingTranscript = useCallback((payload: { text: string; isFinal: boolean }) => {
    if (!payload) {
      return;
    }

    const trimmed = (payload.text || "").trim();
    let finalSnapshot: string | null = null;

    setCurrentText((prev: string) => {
      let base = prev;
      const activePartial = pendingPartialRef.current;
      if (activePartial && prev.endsWith(activePartial)) {
        base = prev.slice(0, -activePartial.length);
      }

      if (!trimmed) {
        if (payload.isFinal) {
          pendingPartialRef.current = "";
          finalSnapshot = base;
        } else {
          pendingPartialRef.current = "";
        }
        return base;
      }

      let next = base + trimmed;
      if (payload.isFinal) {
        pendingPartialRef.current = "";
        if (!next.endsWith("\n")) {
          next += "\n";
        }
        finalSnapshot = next;
      } else {
        pendingPartialRef.current = trimmed;
      }

      return next;
    });

    if (trimmed) {
      lastTranscriptTimeRef.current = Date.now();
    }

    if (payload.isFinal) {
      const snapshot = (finalSnapshot ?? "").trimEnd();
      if (!snapshot) {
        return;
      }

      if (isAutoGPTEnabled) {
        if (autoSubmitTimer) {
          clearTimeout(autoSubmitTimer);
        }
        const newTimer = setTimeout(() => {
          const newContent = snapshot.slice(lastProcessedIndexRef.current);
          if (newContent.trim()) {
            handleAskGPTStable(newContent);
          }
        }, 2000);
        setAutoSubmitTimer(newTimer);
      }
    }
  }, [autoSubmitTimer, handleAskGPTStable, isAutoGPTEnabled, setCurrentText]);

  useEffect(() => {
    const unsubscribeTranscript = window.electronAPI.onWhisperTranscript((payload) => {
      handleStreamingTranscript(payload);
    });

    const unsubscribeStatus = window.electronAPI.onWhisperStatus((status) => {
      if (status.state === "loading") {
        setIsModelLoading(true);
      } else if (status.state === "ready") {
        setIsModelLoading(false);
      } else if (status.state === "stopped" || status.state === "idle") {
        setIsModelLoading(false);
      } else if (status.state === "error") {
        setIsModelLoading(false);
        if (status.message) {
          setError(status.message);
        }
      }
    });

    return () => {
      unsubscribeTranscript?.();
      unsubscribeStatus?.();
    };
  }, [handleStreamingTranscript, setError]);

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
      configRef.current = config;
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
    if (isRecording || isModelLoading) {
      return;
    }

    try {
      const existingConfig = configRef.current || await window.electronAPI.getConfig();
      configRef.current = existingConfig;

      setIsModelLoading(true);

      const whisperOptions = {
        language: existingConfig?.primaryLanguage,
        modelPath: existingConfig?.whisperModelPath,
        binaryPath: existingConfig?.whisperBinaryPath,
        sampleRate: SAMPLE_RATE,
      };

      const status = await window.electronAPI.startWhisperStream(whisperOptions);
      if (status?.state === "error") {
        setIsModelLoading(false);
        setError(status.message || "Failed to start Whisper engine. Please verify your configuration.");
        return;
      }

      if (status?.state === "ready") {
        setIsModelLoading(false);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: SAMPLE_RATE,
        },
        video: false,
      });
      setUserMedia(stream);

      pendingPartialRef.current = "";
      lastTranscriptTimeRef.current = Date.now();

      const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      setAudioContext(context);
      const source = context.createMediaStreamSource(stream);
      const processorNode = context.createScriptProcessor(4096, 1, 1);
      setProcessor(processorNode);

      source.connect(processorNode);
      processorNode.connect(context.destination);

      processorNode.onaudioprocess = (e: { inputBuffer: { getChannelData: (index: number) => Float32Array } }) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);

        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          audioData[i] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7FFF);
        }

        window.electronAPI.sendWhisperAudioChunk(audioData.buffer);
      };

      setIsRecording(true);
    } catch (err: any) {
      console.error("Failed to start recording", err);
      setError("Failed to start recording. Please check microphone permissions or try again.");
      setIsModelLoading(false);
      await window.electronAPI.stopWhisperStream();
    }
  };

  const stopRecording = useCallback(async () => {
    if (userMedia) {
      userMedia.getTracks().forEach((track) => track.stop());
    }
    if (audioContext) {
      try {
        await audioContext.close();
      } catch (err) {
        console.warn("Failed to close audio context", err);
      }
    }
    if (processor) {
      processor.disconnect();
      processor.onaudioprocess = null;
    }
    if (autoSubmitTimer) {
      clearTimeout(autoSubmitTimer);
      setAutoSubmitTimer(null);
    }

    pendingPartialRef.current = "";
    lastTranscriptTimeRef.current = Date.now();
    setIsRecording(false);
    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
    setIsModelLoading(false);

    try {
      await window.electronAPI.stopWhisperStream();
    } catch (err) {
      console.warn("Failed to stop Whisper stream", err);
    }
  }, [audioContext, autoSubmitTimer, processor, userMedia]);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

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
            disabled={!isConfigured || (isModelLoading && !isRecording)}
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
