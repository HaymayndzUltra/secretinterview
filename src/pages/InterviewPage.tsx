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

const RECORDER_WORKLET_NAME = 'interview-recorder';

type RecorderWorkletMessage =
  | { type: 'audio'; payload: ArrayBuffer }
  | { type: 'flush-complete' };

/**
 * Generates an inline AudioWorklet module that mirrors the previous ScriptProcessor
 * behaviour by batching samples into 4096 frame chunks before streaming them back
 * to the main thread as 16-bit PCM. Keeping the worklet definition inline allows
 * us to avoid touching the build pipeline while modernising the audio stack.
 */
const createRecorderWorkletModuleUrl = () => {
  const workletCode = `
    class InterviewRecorderProcessor extends AudioWorkletProcessor {
      constructor(options) {
        super();
        const processorOptions = (options && options.processorOptions) || {};
        const size = Number.isFinite(processorOptions.bufferSize) && processorOptions.bufferSize > 0
          ? processorOptions.bufferSize
          : 4096;
        this._bufferSize = size;
        this._buffer = new Int16Array(this._bufferSize);
        this._writeIndex = 0;

        this.port.onmessage = (event) => {
          if (event && event.data && event.data.command === 'flush') {
            this._flushPending();
            this.port.postMessage({ type: 'flush-complete' });
          }
        };
      }

      _flushPending() {
        if (!this._writeIndex) {
          return;
        }

        const output = this._buffer.slice(0, this._writeIndex);
        this._writeIndex = 0;
        this.port.postMessage({ type: 'audio', payload: output.buffer }, [output.buffer]);
      }

      process(inputs) {
        const input = inputs[0];
        if (!input || input.length === 0) {
          return true;
        }

        const channelData = input[0];
        if (!channelData) {
          return true;
        }

        for (let i = 0; i < channelData.length; i++) {
          const sample = Math.max(-1, Math.min(1, channelData[i]));
          this._buffer[this._writeIndex++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;

          if (this._writeIndex >= this._bufferSize) {
            this._flushPending();
          }
        }

        return true;
      }
    }

    registerProcessor('${RECORDER_WORKLET_NAME}', InterviewRecorderProcessor);
  `;

  const blob = new Blob([workletCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
};

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
  const [autoSubmitTimer, setAutoSubmitTimer] = useState<NodeJS.Timeout | null>(null);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const userMediaRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const workletModuleUrlRef = useRef<string | null>(null);
  const flushResolverRef = useRef<(() => void) | null>(null);
  const deepgramSessionActiveRef = useRef(false);

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
    let lastTranscriptTime = Date.now();
    let checkTimer: NodeJS.Timeout | null = null;

    const handleDeepgramTranscript = (_event: any, data: any) => {
      if (data.transcript && data.is_final) {
        setCurrentText((prev: string) => {
          const newTranscript = data.transcript.trim();
          if (!prev.endsWith(newTranscript)) {
            lastTranscriptTime = Date.now();
            const updatedText = prev + (prev ? '\n' : '') + newTranscript;
            
            if (isAutoGPTEnabled) {
              if (autoSubmitTimer) {
                clearTimeout(autoSubmitTimer);
              }
              const newTimer = setTimeout(() => {
                const newContent = updatedText.slice(lastProcessedIndex);
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
      }
    };

    const checkAndSubmit = () => {
      if (isAutoGPTEnabled && Date.now() - lastTranscriptTime >= 2000) {
        const newContent = currentText.slice(lastProcessedIndex);
        if (newContent.trim()) {
          handleAskGPTStable(newContent);
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
  }, [isAutoGPTEnabled, lastProcessedIndex, currentText, handleAskGPTStable, setCurrentText, setLastProcessedIndex]);

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
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      userMediaRef.current = stream;

      const config = await window.electronAPI.getConfig();
      const result = await window.electronAPI.ipcRenderer.invoke('start-deepgram', {
        deepgram_key: config.deepgram_api_key
      });
      if (!result.success) {
        throw new Error(result.error);
      }

      deepgramSessionActiveRef.current = true;

      const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      if (!context.audioWorklet) {
        throw new Error('AudioWorklet API is not supported in this environment.');
      }

      audioContextRef.current = context;
      const workletModuleUrl = createRecorderWorkletModuleUrl();
      workletModuleUrlRef.current = workletModuleUrl;
      await context.audioWorklet.addModule(workletModuleUrl);

      const source = context.createMediaStreamSource(stream);
      // The AudioWorklet mirrors the previous ScriptProcessor pipeline but runs off the
      // main thread for better stability and lower latency scheduling jitter.
      const node = new AudioWorkletNode(context, RECORDER_WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
        processorOptions: {
          bufferSize: 4096,
        },
      });

      workletNodeRef.current = node;

      node.port.onmessage = (event: MessageEvent<RecorderWorkletMessage>) => {
        const message = event.data;
        if (!message) {
          return;
        }

        if (message.type === 'audio' && message.payload) {
          void window.electronAPI.ipcRenderer
            .invoke('send-audio-to-deepgram', message.payload)
            .catch((streamError: Error) => {
              console.error('Failed to stream audio to Deepgram', streamError);
            });
        } else if (message.type === 'flush-complete') {
          if (flushResolverRef.current) {
            flushResolverRef.current();
          }
        }
      };

      if (typeof node.port.start === 'function') {
        node.port.start();
      }

      source.connect(node);
      node.connect(context.destination);

      await context.resume();

      setIsRecording(true);
    } catch (err: any) {
      console.error('Failed to start recording', err);
      await stopRecording();
      deepgramSessionActiveRef.current = false;
      setError("Failed to start recording. Please check permissions or try again.");
    }
  };

  const stopRecording = useCallback(async () => {
    try {
      const node = workletNodeRef.current;
      if (node) {
        const flushPromise = new Promise<void>((resolve) => {
          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          flushResolverRef.current = () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            flushResolverRef.current = null;
            resolve();
          };

          timeoutId = setTimeout(() => {
            flushResolverRef.current = null;
            resolve();
          }, 250);

          try {
            node.port.postMessage({ command: 'flush' });
          } catch (postError) {
            console.error('Failed to request audio worklet flush', postError);
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            flushResolverRef.current = null;
            resolve();
          }
        });

        try {
          await flushPromise;
        } catch (flushError) {
          console.error('Audio worklet flush failed', flushError);
        }

        node.port.onmessage = null;
        try {
          node.disconnect();
        } catch (disconnectError) {
          console.warn('Error disconnecting worklet node', disconnectError);
        }
        workletNodeRef.current = null;
      }

      const stream = userMediaRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        userMediaRef.current = null;
      }

      const context = audioContextRef.current;
      if (context) {
        try {
          if (context.state !== 'closed') {
            await context.close();
          }
        } catch (closeError) {
          console.error('Failed to close audio context', closeError);
        }
        audioContextRef.current = null;
      }

      if (workletModuleUrlRef.current) {
        URL.revokeObjectURL(workletModuleUrlRef.current);
        workletModuleUrlRef.current = null;
      }
    } finally {
      flushResolverRef.current = null;
      if (deepgramSessionActiveRef.current) {
        try {
          await window.electronAPI.ipcRenderer.invoke('stop-deepgram');
        } catch (stopErr) {
          console.error('Failed to stop Deepgram session', stopErr);
        }
        deepgramSessionActiveRef.current = false;
      }
      setIsRecording(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
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
