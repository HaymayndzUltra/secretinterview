import React, { useEffect, useMemo, useState } from 'react';
import type { RefinedSuggestionsResult, StatusSnapshot, SuggestionLine, TranscriptSegment } from '@shared/types';
import { StatusLights } from './components/StatusLights';
import { LiveCaption } from './components/LiveCaption';
import { AutosuggestDeck } from './components/AutosuggestDeck';
import { TranscriptTimeline } from './components/TranscriptTimeline';
import { ModeToggle } from './components/ModeToggle';
import { useLoopbackAudio } from './hooks/useLoopbackAudio';
import { useHotkeys } from './hooks/useHotkeys';

const MAX_TRANSCRIPTS = 120;

const audioStatusCopy: Record<string, string> = {
  idle: 'Idle',
  starting: 'Binding loopback…',
  streaming: 'Client (Loopback)',
  error: 'Loopback error'
};

function formatAudioStatus(status: string, label?: string) {
  if (status === 'streaming' && label) {
    return label;
  }
  return audioStatusCopy[status] ?? status;
}

const sortSuggestions = (items: SuggestionLine[]) =>
  [...items].sort((a, b) => a.createdAt - b.createdAt);

const App: React.FC = () => {
  const [status, setStatus] = useState<StatusSnapshot | null>(null);
  const [partial, setPartial] = useState('');
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [deck, setDeck] = useState<SuggestionLine[]>([]);
  const [history, setHistory] = useState<SuggestionLine[]>([]);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const audio = useLoopbackAudio();
  useHotkeys();

  useEffect(() => {
    window.interview.requestStatus().then(setStatus).catch(console.error);
    window.interview.onStatus(setStatus);
    window.interview.onPartial((partial) => {
      setPartial(partial.text);
    });
    window.interview.onFinal((segment) => {
      setPartial('');
      setTranscripts((prev) => {
        const next = [...prev, segment].slice(-MAX_TRANSCRIPTS);
        return next;
      });
      setActiveTxId(segment.id);
    });
    window.interview.onAutosuggest((result: RefinedSuggestionsResult) => {
      setDeck(result.suggestions);
      setHistory((prev) => sortSuggestions([...prev, ...result.suggestions]));
      setActiveTxId(result.txId);
    });
  }, []);

  const mergedSuggestions = useMemo(() => sortSuggestions(history), [history]);

  const handleOverride = (mode: 'discovery' | 'technical') => {
    window.interview.overrideMode(mode);
    setStatus((prev) => (prev ? { ...prev, mode } : prev));
  };

  return (
    <div className="h-screen w-screen p-6 grid grid-cols-[2fr_1fr] gap-6 bg-surface text-white">
      <div className="flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <StatusLights status={status} audioStatus={formatAudioStatus(audio.status, audio.sourceLabel)} />
          {status && <ModeToggle mode={status.mode} onOverride={handleOverride} />}
        </div>
        <LiveCaption partial={partial} />
        {audio.status === 'error' && (
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            Loopback capture failed: {audio.error}
          </div>
        )}
        <div className="flex-1">
          <TranscriptTimeline transcripts={transcripts} suggestions={mergedSuggestions} activeTxId={activeTxId} />
        </div>
      </div>
      <AutosuggestDeck suggestions={deck} activeTxId={activeTxId} />
    </div>
  );
};

export default App;
