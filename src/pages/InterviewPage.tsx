/// <reference path="../renderer.d.ts" />

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
  }
}

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  const [liveTranscript, setLiveTranscript] = useState("");
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const currentTextRef = useRef(currentText);
  const partialTranscriptRef = useRef("");
  const lastFinalTranscriptRef = useRef("");
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    currentTextRef.current = currentText;
    const trailingPartial = partialTranscriptRef.current;
    setLiveTranscript(
      trailingPartial
        ? `${currentText}${currentText ? "\n" : ""}${trailingPartial}`
        : currentText
    );
  }, [currentText]);

  const handleAskGPT = async (newContent?: string, finalTextLength?: number) => {
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
      setAiResult(formattedResponse);
      if (typeof finalTextLength === "number") {
        setLastProcessedIndex(finalTextLength);
      } else {
        setLastProcessedIndex(currentTextRef.current.length);
      }
    } catch (error) {
      setError('Failed to get response from GPT. Please try again.');
    } finally {
      setIsLoading(false);
      if (aiResponseRef.current) {
        aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
      }
    }
  };

  const handleAskGPTStable = useCallback(async (newContent: string, finalLength?: number) => {
    handleAskGPT(newContent, finalLength);
  }, [handleAskGPT]);

  useEffect(() => {
    let lastTranscriptTime = Date.now();
    let checkTimer: NodeJS.Timeout | null = null;

    const handleDeepgramTranscript = (_event: any, data: any) => {
      if (!data || !data.transcript) {
        return;
      }

      const newTranscript = String(data.transcript).trim();
      if (!newTranscript) {
        return;
      }

      if (data.is_final) {
        lastTranscriptTime = Date.now();
        partialTranscriptRef.current = "";
        setCurrentText((prev: string) => {
          if (lastFinalTranscriptRef.current === newTranscript) {
            setLiveTranscript(prev);
            currentTextRef.current = prev;
            return prev;
          }
          lastFinalTranscriptRef.current = newTranscript;
          const updatedText = prev ? `${prev}\n${newTranscript}` : newTranscript;
          setLiveTranscript(updatedText);

          if (isAutoGPTEnabled) {
            if (autoSubmitTimerRef.current) {
              clearTimeout(autoSubmitTimerRef.current);
            }
            autoSubmitTimerRef.current = setTimeout(() => {
              handleAskGPTStable(newTranscript, updatedText.length);
            }, 400);
          }

          currentTextRef.current = updatedText;
          return updatedText;
        });
      } else {
        partialTranscriptRef.current = newTranscript;
        const base = currentTextRef.current;
        const combined = base ? `${base}\n${newTranscript}` : newTranscript;
        setLiveTranscript(combined);
      }
    };

    const checkAndSubmit = () => {
      if (isAutoGPTEnabled && Date.now() - lastTranscriptTime >= 2000) {
        const newContent = currentText.slice(lastProcessedIndex);
        if (newContent.trim()) {
          handleAskGPTStable(newContent, currentText.length);
        }
      }
      checkTimer = setTimeout(checkAndSubmit, 1000);
    };

    window.electronAPI.ipcRenderer.on('deepgram-transcript', handleDeepgramTranscript);
    checkTimer = setTimeout(checkAndSubmit, 1000);

    return () => {
      window.electronAPI.ipcRenderer.removeListener('deepgram-transcript', handleDeepgramTranscript);
      if (checkTimer) {
        clearTimeout(checkTimer);
      }
    };
  }, [
    isAutoGPTEnabled,
    lastProcessedIndex,
    currentText,
    handleAskGPTStable,
    setCurrentText,
    setLastProcessedIndex,
  ]);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      if (config && config.openai_key && config.deepgram_api_key) {
        setIsConfigured(true);
      } else {
        setError("OpenAI API key or Deepgram API key not configured. Please check settings.");
      }
    } catch (err) {
      setError("Failed to load configuration. Please check settings.");
    }
  };

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
        video: false,
      });
      setUserMedia(stream);

      const config = await window.electronAPI.getConfig();
      const result = await window.electronAPI.ipcRenderer.invoke('start-deepgram', {
        deepgram_key: config.deepgram_api_key
      });
      if (!result.success) {
        stream.getTracks().forEach((track) => track.stop());
        setUserMedia(null);
        throw new Error(result.error);
      }

      const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      if (context.state === "suspended") {
        await context.resume();
      }
      setAudioContext(context);
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      setProcessor(processor);

      source.connect(processor);
      processor.connect(context.destination);

      processor.onaudioprocess = (e: { inputBuffer: { getChannelData: (arg0: number) => any; }; }) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        window.electronAPI.ipcRenderer.invoke('send-audio-to-deepgram', audioData.buffer);
      };

      setIsRecording(true);
    } catch (err: any) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setUserMedia(null);
      if (audioContext) {
        audioContext.close();
        setAudioContext(null);
      }
      if (processor) {
        processor.disconnect();
        setProcessor(null);
      }
      setIsRecording(false);
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
    }
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    window.electronAPI.ipcRenderer.invoke('stop-deepgram');
    setIsRecording(false);
    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
    partialTranscriptRef.current = "";
    lastFinalTranscriptRef.current = "";
    setLiveTranscript(currentTextRef.current);
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

  const suggestionBlocks = useMemo(() => {
    return displayedAiResult
      ? displayedAiResult
          .split(/\n{2,}/)
          .map((block) => block.trim())
          .filter(Boolean)
      : [];
  }, [displayedAiResult]);

  return (
    <div className="flex flex-col h-[calc(100vh-2.5rem)] p-2 space-y-2">
      <style>{markdownStyles}</style>
      <ErrorDisplay error={error} onClose={clearError} />
      <div className="flex justify-center items-center space-x-2">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isConfigured}
          className={`btn ${isRecording ? "btn-secondary" : "btn-primary"}`}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
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
            value={liveTranscript}
            onChange={(e) => {
              partialTranscriptRef.current = "";
              currentTextRef.current = e.target.value;
              setLiveTranscript(e.target.value);
              setCurrentText(e.target.value);
              lastFinalTranscriptRef.current = "";
            }}
            className="textarea textarea-bordered flex-1 mb-1 bg-base-100 min-h-[80px] whitespace-pre-wrap"
            placeholder="Transcribed text will appear here..."
          />
          <button
            onClick={() => {
              partialTranscriptRef.current = "";
              currentTextRef.current = "";
              setLiveTranscript("");
              setCurrentText("");
              setLastProcessedIndex(0);
              lastFinalTranscriptRef.current = "";
            }}
            className="btn btn-ghost mt-1"
          >
            Clear Content
          </button>
        </div>
        <div className="flex-1 flex flex-col bg-base-200 p-2 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">AI Suggestions</h2>
            {isLoading && <span className="text-sm text-info">Generating...</span>}
          </div>
          <div
            ref={aiResponseRef}
            className="flex-1 overflow-auto bg-base-100 p-2 rounded mb-1 min-h-[80px] space-y-2"
          >
            {suggestionBlocks.length === 0 ? (
              <p className="text-sm text-base-content/60">
                Contextual interview prompts will appear here while you speak.
              </p>
            ) : (
              suggestionBlocks.map((block, index) => (
                <div
                  key={`${index}-${block.slice(0, 16)}`}
                  className="p-2 rounded border border-base-200 bg-base-100 shadow-sm"
                >
                  <div className="text-xs uppercase tracking-wide text-base-content/60 mb-1">
                    Suggestion {index + 1}
                  </div>
                  <ReactMarkdown className="whitespace-pre-wrap markdown-body" components={{
                    p: ({ node, ...props }) => <p style={{ whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }} {...props} />
                  }}>
                    {block}
                  </ReactMarkdown>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-between mt-1">
            <button
              onClick={debounce(() => handleAskGPT(undefined, currentTextRef.current.length), 300)}
              disabled={!currentText || isLoading}
              className="btn btn-primary"
            >
              {isLoading ? "Loading..." : "Ask GPT"}
            </button>
            <button onClick={() => {
              setDisplayedAiResult("");
              setAiResult("");
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
