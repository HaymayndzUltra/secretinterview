/// <reference path="../renderer.d.ts" />

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
  }
}

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Timer from "../components/Timer";
import { useKnowledgeBase, KnowledgeCategory, KnowledgeEntry } from "../contexts/KnowledgeBaseContext";
import ErrorDisplay from "../components/ErrorDisplay";
import { useError } from "../contexts/ErrorContext";
import { ResponseSegment, useInterview } from "../contexts/InterviewContext";
import TemplateSelector from "../components/TemplateSelector";
import ConversationMemoryManager from "../components/ConversationMemoryManager";
import ReactMarkdown from 'react-markdown';
import { buildInterviewPrompt } from '../utils/promptBuilder';
import { processConversationExchange } from '../services/conversationMemory';
import TeleprompterViewer from "../components/TeleprompterViewer";
import OpenAI from 'openai';

const InterviewPage: React.FC = () => {
  const {
    knowledgeBase,
    addToKnowledgeBase,
    conversations,
    addConversation,
    clearConversations,
    profileSummary,
    selectedScenario,
    templateContent,
    addConversationSummary,
    getRelevantSummaries,
  } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const {
    currentText,
    setCurrentText,
    displayedAiResult,
    setDisplayedAiResult,
    lastProcessedIndex,
    setLastProcessedIndex,
    autoScrollEnabled,
    setAutoScrollEnabled,
    teleprompterMode,
    setTeleprompterMode,
  } = useInterview();
  const [isRecording, setIsRecording] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoGPTEnabled, setIsAutoGPTEnabled] = useState(false);
  const [userMedia, setUserMedia] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [processor, setProcessor] = useState<ScriptProcessorNode | null>(null);
  const [activeEngine, setActiveEngine] = useState<'local' | 'deepgram' | null>(null);
  const [engineStatus, setEngineStatus] = useState<'idle' | 'connecting' | 'open' | 'closed'>('idle');
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const [collapsedSegments, setCollapsedSegments] = useState<Record<string, boolean>>({});
  const wasNearBottomRef = useRef(true);
  const configRef = useRef<any>({});
  const lastTranscriptRef = useRef<number>(Date.now());
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const knowledgeEntriesForPrompt = useMemo(() => {
    const prioritizedCategories = [
      KnowledgeCategory.ActionItem,
      KnowledgeCategory.Feedback,
      KnowledgeCategory.Document,
      KnowledgeCategory.Profile,
      KnowledgeCategory.General,
    ];

    return prioritizedCategories
      .flatMap(category => (knowledgeBase[category] || []) as KnowledgeEntry[])
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12);
  }, [knowledgeBase]);

  const markdownStyles = `
    .markdown-body {
      font-size: 14px;
      line-height: 1.2;
    }
    .markdown-body p {
      margin-bottom: 2px;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 {
      margin-top: 8px;
      margin-bottom: 4px;
      font-weight: 600;
      line-height: 1.1;
    }
    .markdown-body code {
      padding: 0.1em 0.3em;
      margin: 0;
      font-size: 85%;
      background-color: rgba(27,31,35,0.05);
      border-radius: 3px;
    }
    .markdown-body pre {
      word-wrap: normal;
      padding: 8px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.2;
      background-color: #f6f8fa;
      border-radius: 3px;
    }
    .markdown-body ul, .markdown-body ol {
      margin-bottom: 4px;
    }
    .markdown-body li {
      margin-bottom: 2px;
    }
  `;

  const handleAskGPT = async (newContent?: string) => {
    const contentToProcess = newContent || currentText.slice(lastProcessedIndex).trim();
    if (!contentToProcess) return;

    setIsLoading(true);
    const shouldAutoScroll = autoScrollEnabled && wasNearBottomRef.current;
    try {
      const config = await window.electronAPI.getConfig();
      
      // Build the system prompt using the prompt builder
      let systemPrompt = buildInterviewPrompt(profileSummary, selectedScenario, knowledgeBase);
      
      // Merge template content if available
      if (templateContent) {
        systemPrompt = `${systemPrompt}\n\n## Additional Template Instructions\n\n${templateContent}`;
      }

      // Get relevant conversation summaries
      const relevantSummaries = await getRelevantSummaries(contentToProcess, 3);
      
      // Build conversation context from summaries
      let conversationContext = '';
      if (relevantSummaries.length > 0) {
        conversationContext = '\n\n## Previous Conversation Context\n\n';
        relevantSummaries.forEach((summary, index) => {
          conversationContext += `**Previous Discussion ${index + 1}:**\n`;
          conversationContext += `Summary: ${summary.summary}\n`;
          conversationContext += `Tags: ${summary.tags.join(', ')}\n`;
          if (summary.pinned) {
            conversationContext += `(Pinned)\n`;
          }
          conversationContext += '\n';
        });
      }
      
      const knowledgeMessages: OpenAI.Chat.ChatCompletionMessageParam[] = knowledgeEntriesForPrompt.map(entry => {
        if (entry.content.startsWith('data:image')) {
          return {
            role: "user" as const,
            content: [{ type: "image_url", image_url: { url: entry.content } } as const],
          } as OpenAI.Chat.ChatCompletionUserMessageParam;
        }

        const formattedContent = `[${entry.category.toUpperCase()} | confidence:${entry.confidence.toFixed(2)}] ${entry.content}`;
        return { role: "user", content: formattedContent } as OpenAI.Chat.ChatCompletionUserMessageParam;
      });

      const messages = [
        { role: "system", content: systemPrompt + conversationContext },
        ...knowledgeMessages,
        // Only include recent conversations (last 5 exchanges) to avoid token limits
        ...conversations.slice(-10),
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
      const newSegment: ResponseSegment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: formattedResponse,
        metadata: {
          timestamp: Date.now(),
        },
      };
      setDisplayedAiResult(prev => [...prev, newSegment]);
      setCollapsedSegments(prev => {
        const updated = { ...prev };
        delete updated[newSegment.id];
        return updated;
      });
      setLastProcessedIndex(currentText.length);
      
      // Generate conversation summary for long-term memory
      try {
        const { conversationSummary, knowledgeCategory } = await processConversationExchange(
          contentToProcess,
          formattedResponse,
          conversations.slice(-6) // Include recent context
        );
        addConversationSummary(conversationSummary);
        addToKnowledgeBase({
          content: conversationSummary.summary,
          category: knowledgeCategory,
          tags: conversationSummary.tags,
          confidence: 0.7,
          relatedSummaryId: conversationSummary.id,
        });
      } catch (summaryError) {
        console.error('Failed to generate conversation summary:', summaryError);
        // Don't fail the main conversation if summary generation fails
      }
    } catch (error) {
      setError('Failed to get response from GPT. Please try again.');
    } finally {
      setIsLoading(false);
      if (aiResponseRef.current) {
        requestAnimationFrame(() => {
          const container = aiResponseRef.current;
          if (!container) {
            return;
          }
          if (shouldAutoScroll) {
            container.scrollTop = container.scrollHeight;
            wasNearBottomRef.current = true;
          } else {
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            wasNearBottomRef.current = distanceFromBottom <= 40;
          }
        });
      }
    }
  };

  const handleAskGPTStable = useCallback(async (newContent: string) => {
    handleAskGPT(newContent);
  }, [handleAskGPT]);

  useEffect(() => {
    let checkTimer: NodeJS.Timeout | null = null;

    const handleTranscript = (_event: any, data: any) => {
      if (data?.engine) {
        setActiveEngine(prev => data.engine ?? prev);
      }
      const isFinal = data?.is_final ?? data?.isFinal;
      if (data?.transcript && isFinal) {
        lastTranscriptRef.current = Date.now();
        setCurrentText((prev: string) => {
          const newTranscript = data.transcript.trim();
          if (!newTranscript) {
            return prev;
          }
          const alreadyPresent = prev.endsWith(newTranscript);
          if (alreadyPresent) {
            return prev;
          }
          const updatedText = prev + (prev ? '\n' : '') + newTranscript;

          if (isAutoGPTEnabled) {
            if (autoSubmitTimerRef.current) {
              clearTimeout(autoSubmitTimerRef.current);
            }
            const newTimer = setTimeout(() => {
              const newContent = updatedText.slice(lastProcessedIndex);
              if (newContent.trim()) {
                handleAskGPTStable(newContent);
              }
            }, 2000);
            autoSubmitTimerRef.current = newTimer;
          }

          return updatedText;
        });
      }
    };

    const handleStatus = (_event: any, data: any) => {
      if (data?.engine) {
        setActiveEngine(data.engine);
      }
      if (data?.status) {
        setEngineStatus(data.status);
      }
    };

    const handleErrorEvent = (_event: any, data: any) => {
      const engineLabel = data?.engine ? data.engine.toUpperCase() : 'ENGINE';
      if (data?.engine) {
        setActiveEngine(data.engine);
      }
      setEngineStatus('closed');
      if (data?.message) {
        setError(`Transcription (${engineLabel}) error: ${data.message}`);
      } else {
        setError('Transcription engine error.');
      }
    };

    const checkAndSubmit = () => {
      if (isAutoGPTEnabled && Date.now() - lastTranscriptRef.current >= 2000) {
        const newContent = currentText.slice(lastProcessedIndex);
        if (newContent.trim()) {
          handleAskGPTStable(newContent);
        }
      }
      checkTimer = setTimeout(checkAndSubmit, 1000);
    };

    window.electronAPI.ipcRenderer.on('transcription-transcript', handleTranscript);
    window.electronAPI.ipcRenderer.on('transcription-status', handleStatus);
    window.electronAPI.ipcRenderer.on('transcription-error', handleErrorEvent);
    checkTimer = setTimeout(checkAndSubmit, 1000);

    return () => {
      window.electronAPI.ipcRenderer.removeListener('transcription-transcript', handleTranscript);
      window.electronAPI.ipcRenderer.removeListener('transcription-status', handleStatus);
      window.electronAPI.ipcRenderer.removeListener('transcription-error', handleErrorEvent);
      if (checkTimer) {
        clearTimeout(checkTimer);
      }
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    };
  }, [isAutoGPTEnabled, lastProcessedIndex, currentText, handleAskGPTStable, setCurrentText, setError]);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      configRef.current = config || {};
      const hasLocalEngine = Boolean(
        config?.local_asr_config?.enabled && config?.local_asr_config?.url
      );
      const hasDeepgram = Boolean(config?.deepgram_api_key);

      if (hasLocalEngine || hasDeepgram) {
        setIsConfigured(true);
        setEngineStatus('idle');
        setActiveEngine(null);
        clearError();
      } else {
        setIsConfigured(false);
        setError("No transcription engine configured. Configure a local GPU ASR endpoint or provide a Deepgram API key in settings.");
      }
    } catch (err) {
      setError("Failed to load configuration. Please check settings.");
      setIsConfigured(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      clearError();
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });
      setUserMedia(stream);

      const existingConfig = configRef.current && Object.keys(configRef.current).length > 0
        ? configRef.current
        : await window.electronAPI.getConfig();
      configRef.current = existingConfig || {};

      const transcriptionConfig = {
        ...configRef.current,
        deepgram_key: configRef.current.deepgram_api_key,
      };

      const result = await window.electronAPI.ipcRenderer.invoke('start-transcription', transcriptionConfig);
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to start transcription engine');
      }

      if (result.engine) {
        setActiveEngine(result.engine);
      }
      setEngineStatus('connecting');
      lastTranscriptRef.current = Date.now();

      const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      setAudioContext(context);
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(2048, 1, 1);
      setProcessor(processor);

      source.connect(processor);
      processor.connect(context.destination);

      processor.onaudioprocess = (e: { inputBuffer: { getChannelData: (arg0: number) => any; }; }) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        void window.electronAPI.ipcRenderer.invoke('send-audio-chunk', audioData.buffer);
      };

      setIsRecording(true);
    } catch (err: any) {
      console.error('Failed to start recording', err);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setUserMedia(null);
      setActiveEngine(null);
      setEngineStatus('idle');
      setIsRecording(false);
      setError(err?.message ? `Failed to start recording: ${err.message}` : "Failed to start recording. Please check permissions or try again.");
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
    void window.electronAPI.ipcRenderer.invoke('stop-transcription');
    setIsRecording(false);
    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
    setActiveEngine(null);
    setEngineStatus('closed');
  };

  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, [isRecording]);

  useEffect(() => {
    const shouldAutoScroll = autoScrollEnabled && wasNearBottomRef.current;
    if (!aiResponseRef.current) {
      return;
    }
    requestAnimationFrame(() => {
      const container = aiResponseRef.current;
      if (!container) {
        return;
      }
      if (shouldAutoScroll) {
        container.scrollTop = container.scrollHeight;
        wasNearBottomRef.current = true;
      } else {
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        wasNearBottomRef.current = distanceFromBottom <= 40;
      }
    });
  }, [displayedAiResult, autoScrollEnabled]);

  useEffect(() => {
    const container = aiResponseRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      wasNearBottomRef.current = distanceFromBottom <= 40;
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleCopySegment = async (segment: ResponseSegment) => {
    try {
      await navigator.clipboard.writeText(segment.text);
    } catch (copyError) {
      console.error('Failed to copy segment', copyError);
    }
  };

  const toggleSegmentCollapsed = (segmentId: string) => {
    setCollapsedSegments(prev => ({
      ...prev,
      [segmentId]: !prev[segmentId],
    }));
  };

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
      
      {/* Template Selector */}
      <TemplateSelector />
      
      {/* Conversation Memory Manager */}
      <ConversationMemoryManager />
      
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
      <div className="text-center text-xs opacity-70">
        {activeEngine
          ? `Transcription engine: ${activeEngine === 'local' ? 'Local GPU' : 'Deepgram'} (${engineStatus})`
          : `Transcription engine status: ${engineStatus}`}
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
        <div className="flex-1 flex flex-col bg-base-200 p-2 rounded-lg relative">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">AI Response:</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={autoScrollEnabled}
                  onChange={(event) => setAutoScrollEnabled(event.target.checked)}
                />
                <span>Auto-scroll</span>
              </label>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setTeleprompterMode(true)}
                type="button"
                disabled={displayedAiResult.length === 0}
              >
                Teleprompter
              </button>
            </div>
          </div>
          <div
            ref={aiResponseRef}
            className="flex-1 overflow-auto bg-base-100 p-2 rounded mb-1 min-h-[80px]"
          >
            <div className="space-y-1">
              {displayedAiResult.map(segment => {
                const isCollapsed = collapsedSegments[segment.id];
                return (
                  <div
                    key={segment.id}
                    className="rounded border border-base-300 bg-base-200/60 p-2 shadow-sm"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2 text-xs text-base-content/70">
                      <span>
                        {segment.metadata?.timestamp
                          ? new Date(segment.metadata.timestamp).toLocaleTimeString()
                          : 'Assistant'}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleCopySegment(segment)}
                          className="btn btn-ghost btn-xs"
                          type="button"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => toggleSegmentCollapsed(segment.id)}
                          className="btn btn-ghost btn-xs"
                          type="button"
                        >
                          {isCollapsed ? 'Expand' : 'Collapse'}
                        </button>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <ReactMarkdown
                        className="markdown-body whitespace-pre-wrap"
                        components={{
                          p: ({ node, ...props }) => (
                            <p style={{ whiteSpace: 'pre-wrap' }} {...props} />
                          ),
                        }}
                      >
                        {segment.text}
                      </ReactMarkdown>
                    )}
                  </div>
                );
              })}
            </div>
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
              setDisplayedAiResult([]);
              setCollapsedSegments({});
            }} className="btn btn-ghost">
              Clear AI Result
            </button>
          </div>
        </div>
      </div>
      {teleprompterMode && (
        <TeleprompterViewer
          segments={displayedAiResult}
          onClose={() => setTeleprompterMode(false)}
        />
      )}
    </div>
  );
};

export default InterviewPage;
