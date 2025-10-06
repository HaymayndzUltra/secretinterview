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
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const [collapsedSegments, setCollapsedSegments] = useState<Record<string, boolean>>({});
  const wasNearBottomRef = useRef(true);
  const lastTranscriptRef = useRef<string>('');

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

  useEffect(() => {
    loadConfig();
  }, []);

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

  const handleTranscriptionResult = useCallback((_event: any, data: any) => {
    if (data?.transcript) {
      const transcript = String(data.transcript).trim();
      if (!transcript) {
        return;
      }
      if (lastTranscriptRef.current === transcript) {
        return;
      }
      setCurrentText((prev: string) => {
        const needsSpace = prev.length > 0 && !prev.endsWith(' ');
        return `${prev}${needsSpace ? ' ' : ''}${transcript} `;
      });
      lastTranscriptRef.current = transcript;
    }
  }, [setCurrentText]);

  const handleTranscriptionError = useCallback((_event: any, payload: any) => {
    if (payload?.message) {
      setError(`Transcription error${payload.engine ? ` (${payload.engine})` : ''}: ${payload.message}`);
    }
  }, [setError]);

  useEffect(() => {
    let lastTranscriptTime = Date.now();
    let checkTimer: NodeJS.Timeout | null = null;

    const handleResult = (_event: any, data: any) => {
      if (data?.transcript && data?.is_final) {
        lastTranscriptTime = Date.now();
      }
      handleTranscriptionResult(_event, data);
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

    window.electronAPI.ipcRenderer.on('transcription-result', handleResult);
    window.electronAPI.ipcRenderer.on('transcription-error', handleTranscriptionError);
    checkTimer = setTimeout(checkAndSubmit, 1000);

    return () => {
      window.electronAPI.ipcRenderer.removeListener('transcription-result', handleResult);
      window.electronAPI.ipcRenderer.removeListener('transcription-error', handleTranscriptionError);
      if (checkTimer) {
        clearTimeout(checkTimer);
      }
    };
  }, [isAutoGPTEnabled, lastProcessedIndex, currentText, handleAskGPTStable, handleTranscriptionResult, handleTranscriptionError]);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      const localAsr = config?.local_asr || {};
      const hasLocal = Boolean(localAsr.enabled && localAsr.host && localAsr.port);
      const hasDeepgram = Boolean(config?.deepgram_api_key);
      if (hasLocal || hasDeepgram) {
        setIsConfigured(true);
        clearError();
      } else {
        setIsConfigured(false);
        setError("No streaming transcription engine configured. Enable a local GPU ASR server or add a Deepgram API key in Settings.");
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
      setUserMedia(stream);

      const config = await window.electronAPI.getConfig();
      lastTranscriptRef.current = '';
      const startResult = await window.electronAPI.startTranscriptionEngine({
        deepgram_key: config.deepgram_api_key,
        primaryLanguage: config.primaryLanguage,
        local_asr: config.local_asr,
      });
      if (!startResult.success) {
        throw new Error(startResult.error || 'Failed to initialise transcription engine');
      }

      const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000, latencyHint: 'interactive' });
      setAudioContext(context);
      const source = context.createMediaStreamSource(stream);
      const bufferSize = 1024;
      const processor = context.createScriptProcessor(bufferSize, 1, 1) as ScriptProcessorNode & {
        pendingRemainder?: Float32Array;
      };
      setProcessor(processor);

      source.connect(processor);
      processor.connect(context.destination);

      const usingLocalEngine = (startResult.engine ?? (config?.local_asr?.enabled ? 'local' : 'deepgram')) === 'local' && Boolean(config?.local_asr?.host && config?.local_asr?.port);
      const chunkDurationMsRaw = usingLocalEngine ? Number(config?.local_asr?.chunkMillis ?? 80) : 160;
      const chunkDurationMs = Math.min(300, Math.max(20, Number.isFinite(chunkDurationMsRaw) ? chunkDurationMsRaw : 80));
      const samplesPerChunk = Math.max(256, Math.floor((context.sampleRate * chunkDurationMs) / 1000));
      let pendingRemainder = new Float32Array(0);

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const combined = new Float32Array(pendingRemainder.length + inputData.length);
        combined.set(pendingRemainder);
        combined.set(inputData, pendingRemainder.length);

        let offset = 0;
        while (offset + samplesPerChunk <= combined.length) {
          const chunk = combined.subarray(offset, offset + samplesPerChunk);
          const audioData = new Int16Array(chunk.length);
          for (let i = 0; i < chunk.length; i++) {
            const clamped = Math.max(-1, Math.min(1, chunk[i]));
            audioData[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
          }
          window.electronAPI.sendStreamingAudioChunk(audioData.buffer);
          offset += samplesPerChunk;
        }

        pendingRemainder = offset < combined.length ? combined.slice(offset) : new Float32Array(0);
        processor.pendingRemainder = pendingRemainder;
      };

      setIsRecording(true);
    } catch (err: any) {
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
      const remainder = (processor as any).pendingRemainder as Float32Array | undefined;
      if (remainder && remainder.length) {
        const audioData = new Int16Array(remainder.length);
        for (let i = 0; i < remainder.length; i++) {
          const clamped = Math.max(-1, Math.min(1, remainder[i]));
          audioData[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
        }
        window.electronAPI.sendStreamingAudioChunk(audioData.buffer);
      }
    }
    window.electronAPI.stopTranscriptionEngine();
    setIsRecording(false);
    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
    lastTranscriptRef.current = '';
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
