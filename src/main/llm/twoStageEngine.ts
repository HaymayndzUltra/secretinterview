import fetch from 'node-fetch';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { ContextEnvelope, DraftSuggestion, RefinedSuggestionsResult, SuggestionLine } from '@shared/types';

const DRAFT_MODEL = 'phi3:mini';
const REFINE_MODEL = 'llama3.1:8b-instruct-q4_K_M';

interface OllamaResponse {
  response_id?: string;
  response?: string;
  error?: string;
}

async function callOllama(prompt: string, model: string, temperature: number) {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, temperature, stream: false })
  });
  const text = await res.text();
  let parsed: OllamaResponse;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse Ollama response: ${text}`);
  }
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  if (!parsed.response) {
    throw new Error(`Missing response payload: ${text}`);
  }
  return parsed.response;
}

function safeJSONParse<T>(input: string): T {
  try {
    return JSON.parse(input) as T;
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${input}`);
  }
}

interface DraftPayload {
  suggestions: DraftSuggestion[];
}

interface RefinePayload {
  suggestions: Array<{
    summary: string;
    next_line: string;
    probe: string | null;
    why: string;
  }>;
}

export class TwoStageEngine {
  public async run(context: ContextEnvelope): Promise<RefinedSuggestionsResult> {
    const start = performance.now();
    const draftPrompt = [
      context.systemPrompt,
      '\nYou are stage A (draft). Produce 3 terse JSON suggestions as {"suggestions":[{"summary","next_line","probe","confidence"}]}',
      context.userPrompt
    ].join('\n\n');
    const draftRaw = await callOllama(draftPrompt, DRAFT_MODEL, 0.2);
    const draft = safeJSONParse<DraftPayload>(draftRaw);

    const refinerPrompt = [
      context.systemPrompt,
      'You are stage B (refiner). You receive draft suggestions and must return the top 3 ranked suggestions with reason codes.',
      'Return JSON: {"suggestions":[{"summary","next_line","probe","why"}]}.',
      `Conversation mode: ${context.mode}.`,
      `Draft suggestions: ${JSON.stringify(draft.suggestions)}`,
      context.userPrompt
    ].join('\n\n');
    const refinedRaw = await callOllama(refinerPrompt, REFINE_MODEL, 0.4);
    const refined = safeJSONParse<RefinePayload>(refinedRaw);
    const latencyMs = performance.now() - start;

    const suggestions: SuggestionLine[] = refined.suggestions.slice(0, 3).map((entry, index) => ({
      id: randomUUID(),
      txId: context.txId,
      mode: context.mode,
      summary: entry.summary.trim(),
      nextLine: entry.next_line.trim(),
      probe: entry.probe ? entry.probe.trim() : null,
      why: entry.why.trim(),
      createdAt: Date.now() + index
    }));

    return {
      txId: context.txId,
      mode: context.mode,
      suggestions,
      latencyMs
    };
  }
}
