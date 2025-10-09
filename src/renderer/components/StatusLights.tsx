import type { StatusSnapshot } from '@shared/types';
import React from 'react';

interface Props {
  status: StatusSnapshot | null;
  audioStatus: string;
}

const LIGHT_CLASSES: Record<'on' | 'off', string> = {
  on: 'bg-green-400',
  off: 'bg-slate-700'
};

function Light({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full transition-colors ${active ? LIGHT_CLASSES.on : LIGHT_CLASSES.off}`}></span>
      <span className="text-xs uppercase tracking-wide text-slate-300">{label}</span>
    </div>
  );
}

export const StatusLights: React.FC<Props> = ({ status, audioStatus }) => {
  return (
    <div className="flex items-center gap-4 bg-slate-900/60 px-4 py-2 rounded-lg border border-slate-800">
      <Light label="ASR" active={Boolean(status?.asrReady)} />
      <Light label="LLM" active={Boolean(status?.llmReady)} />
      <Light label="DB" active={Boolean(status?.dbReady)} />
      <span className="text-xs text-slate-400">Mode: {status?.mode.toUpperCase() ?? '---'}</span>
      <span className="text-xs text-slate-400">Audio: {audioStatus}</span>
    </div>
  );
};
