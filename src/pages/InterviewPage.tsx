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
import { useInterview, Suggestion } from "../contexts/InterviewContext";
import ReactMarkdown from "react-markdown";

const InterviewPage: React.FC = () => {
  const { knowledgeBase, conversations, addConversation, clearConversations } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const {
    currentText,
    setCurrentText,
    displayedAiResult,
    setDisplayedAiResult,
    lastProcessedIndex,
    setLastProcessedIndex,
    suggestions,
    setSuggestions,
  } = useInterview();
  const [isRecording, setIsRecording] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoGPTEnabled, setIsAutoGPTEnabled] = useState(false);
  const [userMedia, setUserMedia] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [processor, setProcessor] = useState<ScriptProcessorNode | null>(null);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSuggestionRef = useRef<string>("");
  const lastFinalTranscriptRef = useRef<string>("");
  const transcriptRef = useRef<string>("");

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

  const createSuggestionId = () =>
    window.crypto?.randomUUID?.() ?? `suggestion-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  const normaliseSuggestionArray = (input: any[]): Suggestion[] => {
    const results: Suggestion[] = [];

    input.forEach((item, index) => {
      if (!item) {
        return;
      }

      if (typeof item === "string") {
        results.push({
          id: createSuggestionId(),
          title: `Suggestion ${index + 1}`,
          content: item.trim(),
        });
        return;
      }

      if (typeof item === "object") {
        const title =
          (typeof item.title === "string" && item.title.trim()) ||
          (typeof item.heading === "string" && item.heading.trim()) ||
          (typeof item.topic === "string" && item.topic.trim()) ||
          `Suggestion ${index + 1}`;
        const content =
          (typeof item.content === "string" && item.content.trim()) ||
          (typeof item.suggestion === "string" && item.suggestion.trim()) ||
          (typeof item.prompt === "string" && item.prompt.trim()) ||
          (typeof item.text === "string" && item.text.trim()) ||
          "";
        const confidence =
          typeof item.confidence === "number"
            ? Math.round(Math.max(0, Math.min(1, item.confidence)) * 100) / 100
            : undefined;

        if (!content) {
          return;
        }

        results.push({
          id: createSuggestionId(),
          title,
          content,
          confidence,
        });
      }
    });

    return results;
  };

  const parseSuggestions = (raw: string): Suggestion[] => {
    const cleaned = raw.trim();
    if (!cleaned) {
      return [];
    }

    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          const result = normaliseSuggestionArray(parsed);
          if (result.length) {
            return result;
          }
        } else if (parsed && typeof parsed === "object") {
          const arrayCandidate = parsed.suggestions || parsed.prompts || parsed.items;
          if (Array.isArray(arrayCandidate)) {
            const result = normaliseSuggestionArray(arrayCandidate);
            if (result.length) {
              return result;
            }
          }
        }
      } catch (error) {
        // Fallback to non-JSON parsing
      }
    }

    const lines = cleaned
      .split(/\n+/)
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);

    return lines.slice(0, 3).map((line, index) => {
      const hasDivider = line.includes(":");
      const [rawTitle, ...rest] = hasDivider ? line.split(":") : [line];
      const title = hasDivider ? rawTitle.trim() : `Suggestion ${index + 1}`;
      const content = hasDivider ? rest.join(":").trim() : line;
      return {
        id: createSuggestionId(),
        title: title || `Suggestion ${index + 1}`,
        content,
      };
    });
  };

  useEffect(() => {
    transcriptRef.current = currentText;
  }, [currentText]);

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

  const generateSuggestions = useCallback(
    async (latestSegment: string, transcriptSnapshot: string) => {
      const trimmedSegment = latestSegment.trim();
      if (!trimmedSegment) {
        return;
      }

      setIsGeneratingSuggestions(true);
      try {
        const config = await window.electronAPI.getConfig();
        const knowledgeContext = knowledgeBase.slice(-5).join("\n");
        const condensedTranscript = transcriptSnapshot
          .split(/\n/)
          .filter(Boolean)
          .slice(-12)
          .join("\n");

        const systemPrompt =
          "You are an AI interview coach that listens to a live client interview and drafts succinct, high-impact prompts the candidate can use to respond effectively." +
          " Suggestions must be grounded in the client's latest question, highlight differentiators from the knowledge base when relevant, and remain under 220 characters.";

        const instructionPrompt =
          "Produce 2-3 actionable suggestions that help the candidate respond to the interviewer next." +
          " Return a JSON array where each item has `title`, `suggestion`, and optional `confidence` between 0 and 1." +
          " Focus on the immediate context without repeating the transcript verbatim.";

        const messages = [
          { role: "system", content: systemPrompt },
          knowledgeContext
            ? {
                role: "user" as const,
                content: `Reference knowledge base entries:\n${knowledgeContext}`,
              }
            : null,
          condensedTranscript
            ? {
                role: "user" as const,
                content: `Transcript so far:\n${condensedTranscript}`,
              }
            : null,
          {
            role: "user" as const,
            content: `Latest interviewer input to analyse:\n${trimmedSegment}`,
          },
          {
            role: "user" as const,
            content: instructionPrompt,
          },
        ].filter(Boolean);

        const response = await window.electronAPI.callOpenAI({
          config,
          messages,
        });

        if ("error" in response) {
          throw new Error(response.error);
        }

        const parsedSuggestions = parseSuggestions(response.content);
        if (parsedSuggestions.length) {
          setSuggestions(parsedSuggestions.slice(0, 3));
        }
      } catch (err) {
        console.error("Failed to generate suggestions", err);
        setError("Unable to generate AI suggestions at the moment. Please try again.");
      } finally {
        setIsGeneratingSuggestions(false);
      }
    },
    [knowledgeBase, setError, setSuggestions]
  );

  const queueSuggestion = useCallback(
    (latestSegment: string, transcriptSnapshot: string) => {
      pendingSuggestionRef.current = pendingSuggestionRef.current
        ? `${pendingSuggestionRef.current}\n${latestSegment}`
        : latestSegment;

      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
      }

      suggestionTimerRef.current = setTimeout(() => {
        const payload = pendingSuggestionRef.current.trim();
        pendingSuggestionRef.current = "";
        if (payload) {
          generateSuggestions(payload, transcriptSnapshot);
        }
      }, 800);
    },
    [generateSuggestions]
  );

  useEffect(() => {
    let lastTranscriptTime = Date.now();
    let checkTimer: NodeJS.Timeout | null = null;

    const scheduleAutoSubmit = (updatedText: string) => {
      if (!isAutoGPTEnabled) {
        return;
      }

      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }

      autoSubmitTimerRef.current = setTimeout(() => {
        const newContent = updatedText.slice(lastProcessedIndex);
        if (newContent.trim()) {
          handleAskGPTStable(newContent);
        }
      }, 1800);
    };

    const handleDeepgramTranscript = (
      _event: any,
      data: { transcript?: string; is_final?: boolean }
    ) => {
      const transcript = data?.transcript?.trim();
      if (!transcript) {
        return;
      }

      lastTranscriptTime = Date.now();

      if (data.is_final) {
        setPartialTranscript("");

        setCurrentText((prev: string) => {
          if (lastFinalTranscriptRef.current === transcript && prev.endsWith(transcript)) {
            return prev;
          }

          const updatedText = prev ? `${prev}\n${transcript}` : transcript;
          lastFinalTranscriptRef.current = transcript;
          transcriptRef.current = updatedText;

          scheduleAutoSubmit(updatedText);
          queueSuggestion(transcript, updatedText);
          return updatedText;
        });
      } else {
        setPartialTranscript(transcript);
      }
    };

    const checkAndSubmit = () => {
      if (isAutoGPTEnabled && Date.now() - lastTranscriptTime >= 2000) {
        const newContent = transcriptRef.current.slice(lastProcessedIndex);
        if (newContent.trim()) {
          handleAskGPTStable(newContent);
        }
      }
      checkTimer = setTimeout(checkAndSubmit, 1000);
    };

    window.electronAPI.ipcRenderer.on(
      "deepgram-transcript",
      handleDeepgramTranscript
    );
    checkTimer = setTimeout(checkAndSubmit, 1000);

    return () => {
      window.electronAPI.ipcRenderer.removeListener(
        "deepgram-transcript",
        handleDeepgramTranscript
      );
      if (checkTimer) {
        clearTimeout(checkTimer);
      }
    };
  }, [handleAskGPTStable, isAutoGPTEnabled, lastProcessedIndex, queueSuggestion, setCurrentText]);

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

      if (!stream.getAudioTracks().length) {
        throw new Error("No microphone input detected");
      }

      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
        suggestionTimerRef.current = null;
      }

      pendingSuggestionRef.current = "";
      lastFinalTranscriptRef.current = "";
      transcriptRef.current = "";

      setPartialTranscript("");
      setSuggestions([]);

      const config = await window.electronAPI.getConfig();
      const result = await window.electronAPI.ipcRenderer.invoke('start-deepgram', {
        deepgram_key: config.deepgram_api_key
      });
      if (!result.success) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error(result.error);
      }

      const context = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      setAudioContext(context);
      await context.resume();
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

      setUserMedia(stream);
      setIsRecording(true);
    } catch (err: any) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      setIsRecording(false);
      setUserMedia(null);
      setAudioContext(null);
      setProcessor(null);
      console.error("Failed to start microphone capture", err);
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
    if (suggestionTimerRef.current) {
      clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }
    pendingSuggestionRef.current = "";
    lastFinalTranscriptRef.current = "";
    window.electronAPI.ipcRenderer.invoke('stop-deepgram');
    setIsRecording(false);
    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
    setPartialTranscript("");
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
      <div className="flex-1 grid grid-cols-1 gap-2 overflow-hidden md:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col bg-base-200 p-2 rounded-lg">
          <textarea
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            className="textarea textarea-bordered flex-1 mb-1 bg-base-100 min-h-[80px] whitespace-pre-wrap"
            placeholder="Transcribed text will appear here..."
          />
          {partialTranscript && (
            <div className="bg-base-100 border border-dashed border-base-300 text-sm text-base-content/70 rounded-md p-2 mb-2">
              <span className="font-semibold text-base-content">Listening…</span>
              <p className="mt-1 whitespace-pre-wrap">{partialTranscript}</p>
            </div>
          )}
          <button
            onClick={() => setCurrentText("")}
            className="btn btn-ghost mt-1"
          >
            Clear Content
          </button>
        </div>
        <div className="flex flex-col bg-base-200 p-2 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">AI Suggestions</h2>
            <button
              onClick={() => setSuggestions([])}
              className="btn btn-ghost btn-xs"
              disabled={!suggestions.length && !isGeneratingSuggestions}
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-auto space-y-2 pr-1">
            {isGeneratingSuggestions && (
              <div className="animate-pulse text-sm text-base-content/70">
                Generating suggestions in real time…
              </div>
            )}
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="bg-base-100 border border-base-300 rounded-md p-2 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-base-content">
                    {suggestion.title}
                  </h3>
                  {typeof suggestion.confidence === "number" && (
                    <span className="text-xs text-base-content/60">
                      Confidence {(suggestion.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap text-base-content/80">
                  {suggestion.content}
                </p>
              </div>
            ))}
            {!isGeneratingSuggestions && !suggestions.length && (
              <p className="text-sm text-base-content/60">
                Contextual prompts will appear here as soon as the interviewer speaks.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col bg-base-200 p-2 rounded-lg">
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
