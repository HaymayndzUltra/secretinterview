import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { languageOptions } from '../utils/languageOptions';

const Settings: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [apiModel, setApiModel] = useState('gpt-4o');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiCallMethod, setApiCallMethod] = useState<'direct' | 'proxy'>('direct');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [primaryLanguage, setPrimaryLanguage] = useState('auto');
  const [secondaryLanguage, setSecondaryLanguage] = useState('');
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [localAsrEnabled, setLocalAsrEnabled] = useState(false);
  const [localAsrBinaryPath, setLocalAsrBinaryPath] = useState('');
  const [localAsrModelPath, setLocalAsrModelPath] = useState('');
  const [localAsrDevice, setLocalAsrDevice] = useState('cuda:0');
  const [localAsrChunkMs, setLocalAsrChunkMs] = useState(200);
  const [localAsrEndpointMs, setLocalAsrEndpointMs] = useState(800);
  const [localAsrExtraArgs, setLocalAsrExtraArgs] = useState('');
  const [localLlmProvider, setLocalLlmProvider] = useState<'ollama' | 'openai-compatible'>('ollama');
  const [localLlmEndpoint, setLocalLlmEndpoint] = useState('http://localhost:11434');
  const [localLlmModel, setLocalLlmModel] = useState('llama3');
  const [localLlmTemperature, setLocalLlmTemperature] = useState('0.7');
  const [localLlmTopP, setLocalLlmTopP] = useState('0.9');
  const [localLlmMaxTokens, setLocalLlmMaxTokens] = useState('');
  const [localLlmTimeout, setLocalLlmTimeout] = useState('180000');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setApiKey(config.openai_key || '');
      setApiModel(config.gpt_model || 'gpt-4o');
      setApiBase(config.api_base || '');
      setApiCallMethod(config.api_call_method || 'direct');
      setPrimaryLanguage(config.primaryLanguage || 'auto');
      setSecondaryLanguage(config.secondaryLanguage || '');
      setDeepgramApiKey(config.deepgram_api_key || '');
      const localAsrConfig = config.localAsr || {};
      setLocalAsrEnabled(Boolean(localAsrConfig.enabled));
      setLocalAsrBinaryPath(localAsrConfig.binaryPath || '');
      setLocalAsrModelPath(localAsrConfig.modelPath || '');
      setLocalAsrDevice(localAsrConfig.device || 'cuda:0');
      setLocalAsrChunkMs(localAsrConfig.chunkMilliseconds || 200);
      setLocalAsrEndpointMs(localAsrConfig.endpointMilliseconds || 800);
      setLocalAsrExtraArgs(localAsrConfig.extraArgs ? localAsrConfig.extraArgs.join(' ') : '');
      const localLlmConfig = config.localLlm || {};
      setLocalLlmProvider(localLlmConfig.provider || 'ollama');
      setLocalLlmEndpoint(localLlmConfig.baseUrl || 'http://localhost:11434');
      setLocalLlmModel(localLlmConfig.model || 'llama3');
      setLocalLlmTemperature(
        localLlmConfig.temperature !== undefined
          ? String(localLlmConfig.temperature)
          : '0.7'
      );
      setLocalLlmTopP(
        localLlmConfig.topP !== undefined
          ? String(localLlmConfig.topP)
          : '0.9'
      );
      setLocalLlmMaxTokens(
        localLlmConfig.maxTokens !== undefined
          ? String(localLlmConfig.maxTokens)
          : ''
      );
      setLocalLlmTimeout(
        localLlmConfig.requestTimeoutMs !== undefined
          ? String(localLlmConfig.requestTimeoutMs)
          : '180000'
      );
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const handleSave = async () => {
    try {
      const parsedTemperature = Number(localLlmTemperature);
      const parsedTopP = Number(localLlmTopP);
      const parsedMaxTokens = localLlmMaxTokens.trim() ? Number(localLlmMaxTokens) : undefined;
      const parsedTimeout = localLlmTimeout.trim() ? Number(localLlmTimeout) : undefined;
      await window.electronAPI.setConfig({
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
        api_call_method: apiCallMethod,
        primaryLanguage: primaryLanguage,
        deepgram_api_key: deepgramApiKey,
        localAsr: {
          enabled: localAsrEnabled,
          binaryPath: localAsrBinaryPath,
          modelPath: localAsrModelPath,
          device: localAsrDevice,
          chunkMilliseconds: Number(localAsrChunkMs) || 200,
          endpointMilliseconds: Number(localAsrEndpointMs) || 800,
          extraArgs: localAsrExtraArgs
            ? localAsrExtraArgs
                .split(' ')
                .map(arg => arg.trim())
                .filter(Boolean)
            : [],
        },
        localLlm: {
          provider: localLlmProvider,
          baseUrl: localLlmEndpoint.trim(),
          model: localLlmModel.trim(),
          temperature: Number.isFinite(parsedTemperature) ? parsedTemperature : undefined,
          topP: Number.isFinite(parsedTopP) ? parsedTopP : undefined,
          maxTokens: parsedMaxTokens,
          requestTimeoutMs: parsedTimeout,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    }
  };

  const testLocalLlmConnection = async () => {
    try {
      setTestResult('Testing local LLM...');
      const payload = {
        localLlm: {
          provider: localLlmProvider,
          baseUrl: localLlmEndpoint.trim(),
          model: localLlmModel.trim(),
          temperature: Number(localLlmTemperature),
          topP: Number(localLlmTopP),
          maxTokens: localLlmMaxTokens.trim() ? Number(localLlmMaxTokens) : undefined,
          requestTimeoutMs: localLlmTimeout.trim() ? Number(localLlmTimeout) : undefined,
        },
      };
      const result = await window.electronAPI.testLocalLlm(payload);
      if (result.success) {
        setTestResult('Local LLM connection looks good!');
        clearError();
      } else {
        const message = result.error || 'Unknown error';
        setTestResult(`Local LLM test failed: ${message}`);
        setError(`Failed to reach local LLM: ${message}`);
      }
    } catch (err) {
      console.error('Local LLM test error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestResult(`Local LLM test failed: ${errorMessage}`);
      setError(`Failed to reach local LLM: ${errorMessage}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <ErrorDisplay error={error} onClose={clearError} />
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <section className="mb-6 p-4 border border-base-300 rounded-lg bg-base-200/40">
        <h2 className="text-xl font-semibold mb-2">Local LLM Engine</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Configure the offline model that powers the entire interview workflow. The assistant will
          combine permanent knowledge, the active project file, and your conversation history before
          sending prompts to this endpoint.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Engine Provider</label>
            <select
              value={localLlmProvider}
              onChange={(e) => setLocalLlmProvider(e.target.value as 'ollama' | 'openai-compatible')}
              className="select select-bordered w-full"
            >
              <option value="ollama">Ollama</option>
              <option value="openai-compatible">OpenAI-Compatible (LM Studio, vLLM, etc.)</option>
            </select>
            <label className="label">
              <span className="label-text-alt">Choose Ollama for the native /api/chat endpoint.</span>
            </label>
          </div>
          <div>
            <label className="label">Model Name</label>
            <input
              type="text"
              value={localLlmModel}
              onChange={(e) => setLocalLlmModel(e.target.value)}
              className="input input-bordered w-full"
              placeholder="llama3"
            />
            <label className="label">
              <span className="label-text-alt">Exact model identifier configured in your local engine.</span>
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="label">Endpoint URL</label>
            <input
              type="text"
              value={localLlmEndpoint}
              onChange={(e) => setLocalLlmEndpoint(e.target.value)}
              className="input input-bordered w-full"
              placeholder="http://localhost:11434"
            />
            <label className="label">
              <span className="label-text-alt">The base URL where the local LLM server is listening.</span>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">Temperature</label>
            <input
              type="number"
              step="0.05"
              value={localLlmTemperature}
              onChange={(e) => setLocalLlmTemperature(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
          <div>
            <label className="label">Top P</label>
            <input
              type="number"
              step="0.05"
              value={localLlmTopP}
              onChange={(e) => setLocalLlmTopP(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
          <div>
            <label className="label">Max Tokens (Optional)</label>
            <input
              type="number"
              value={localLlmMaxTokens}
              onChange={(e) => setLocalLlmMaxTokens(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="label">Request Timeout (ms)</label>
            <input
              type="number"
              value={localLlmTimeout}
              onChange={(e) => setLocalLlmTimeout(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
          <div className="md:col-span-2 flex flex-col md:flex-row md:items-center md:gap-4">
            <button onClick={testLocalLlmConnection} className="btn btn-secondary mb-2 md:mb-0">
              Test Local LLM Connection
            </button>
            {testResult && <span className="text-sm text-neutral-500">{testResult}</span>}
          </div>
        </div>
      </section>
      <div className="mb-4">
        <label className="label">Cloud Whisper API Key (Optional)</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input input-bordered w-full"
        />
      </div>
      <div className="mb-4">
        <label className="label">Cloud Whisper Base URL (Optional)</label>
        <input
          type="text"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          className="input input-bordered w-full"
        />
        <label className="label">
          <span className="label-text-alt">
            Enter proxy URL if using API proxy. For example: https://your-proxy.com/v1
          </span>
        </label>
      </div>
      <div className="mb-4">
        <label className="label">Cloud Whisper Model</label>
        <input
          type="text"
          value={apiModel}
          onChange={(e) => setApiModel(e.target.value)}
          className="input input-bordered w-full"
        />
        <label className="label">
          <span className="label-text-alt">Please use a model supported by your API. Preferably gpt-4.</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="label">Cloud Whisper Call Method</label>
        <select
          value={apiCallMethod}
          onChange={(e) => setApiCallMethod(e.target.value as 'direct' | 'proxy')}
          className="select select-bordered w-full"
        >
          <option value="direct">Direct</option>
          <option value="proxy">Proxy</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="label">Deepgram API Key</label>
        <input
          type="password"
          value={deepgramApiKey}
          onChange={(e) => setDeepgramApiKey(e.target.value)}
          className="input input-bordered w-full"
        />
      </div>
      <div className="mb-4">
        <label className="label flex justify-between items-center">
          <span>Enable Local ASR (GPU)</span>
          <input
            type="checkbox"
            className="toggle"
            checked={localAsrEnabled}
            onChange={(e) => setLocalAsrEnabled(e.target.checked)}
          />
        </label>
        <p className="text-xs text-neutral-500">
          Local Whisper/ASR engine streamed from your RTX 4090. When enabled, this becomes the primary transcription pipeline and
          Deepgram is only used as a fallback.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="label">Local ASR Binary</label>
          <input
            type="text"
            value={localAsrBinaryPath}
            onChange={(e) => setLocalAsrBinaryPath(e.target.value)}
            disabled={!localAsrEnabled}
            className="input input-bordered w-full"
            placeholder="/opt/local-asr/bin/server"
          />
          <label className="label">
            <span className="label-text-alt">Absolute path to the streaming transcription executable.</span>
          </label>
        </div>
        <div>
          <label className="label">Model Path</label>
          <input
            type="text"
            value={localAsrModelPath}
            onChange={(e) => setLocalAsrModelPath(e.target.value)}
            disabled={!localAsrEnabled}
            className="input input-bordered w-full"
            placeholder="/opt/local-asr/models/whisper-large-v3"
          />
          <label className="label">
            <span className="label-text-alt">Optional. Override the default model loaded by the binary.</span>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="label">GPU Device</label>
          <input
            type="text"
            value={localAsrDevice}
            onChange={(e) => setLocalAsrDevice(e.target.value)}
            disabled={!localAsrEnabled}
            className="input input-bordered w-full"
            placeholder="cuda:0"
          />
        </div>
        <div>
          <label className="label">Chunk Size (ms)</label>
          <input
            type="number"
            value={localAsrChunkMs}
            min={50}
            max={2000}
            onChange={(e) => setLocalAsrChunkMs(Number(e.target.value))}
            disabled={!localAsrEnabled}
            className="input input-bordered w-full"
          />
          <label className="label">
            <span className="label-text-alt">Lower values reduce latency. 200 ms recommended.</span>
          </label>
        </div>
        <div>
          <label className="label">Endpoint (ms)</label>
          <input
            type="number"
            value={localAsrEndpointMs}
            min={200}
            max={5000}
            onChange={(e) => setLocalAsrEndpointMs(Number(e.target.value))}
            disabled={!localAsrEnabled}
            className="input input-bordered w-full"
          />
          <label className="label">
            <span className="label-text-alt">Silence duration that finalizes a segment.</span>
          </label>
        </div>
      </div>
      <div className="mb-4">
        <label className="label">Extra Engine Arguments</label>
        <input
          type="text"
          value={localAsrExtraArgs}
          onChange={(e) => setLocalAsrExtraArgs(e.target.value)}
          disabled={!localAsrEnabled}
          className="input input-bordered w-full"
          placeholder="--threads 4 --beam-size 4"
        />
        <label className="label">
          <span className="label-text-alt">Optional CLI flags separated by spaces. Used when spawning the local engine.</span>
        </label>
      </div>
      <div className="mb-4">
        <label className="label">Primary Language</label>
        <select
          value={primaryLanguage}
          onChange={(e) => setPrimaryLanguage(e.target.value)}
          className="select select-bordered w-full"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end mt-4">
        <button onClick={handleSave} className="btn btn-primary">
          Save Settings
        </button>
      </div>
      {saveSuccess && <p className="text-success mt-2">Settings saved successfully</p>}
    </div>
  );
};

export default Settings;
