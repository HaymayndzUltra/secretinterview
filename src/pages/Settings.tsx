import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { languageOptions } from '../utils/languageOptions';

const Settings: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [llmProvider, setLlmProvider] = useState<'ollama' | 'lmstudio' | 'vllm' | 'generic'>('ollama');
  const [llmBaseUrl, setLlmBaseUrl] = useState('http://localhost:11434');
  const [llmModel, setLlmModel] = useState('llama3.1:8b');
  const [llmTemperature, setLlmTemperature] = useState('0.7');
  const [llmTopP, setLlmTopP] = useState('0.9');
  const [llmMaxTokens, setLlmMaxTokens] = useState('');
  const [llmRequestPath, setLlmRequestPath] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
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
  const [projectFile, setProjectFile] = useState('current_project.md');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      const localLlm = config.localLlm || {};
      setLlmProvider((localLlm.provider as 'ollama' | 'lmstudio' | 'vllm' | 'generic') || 'ollama');
      setLlmBaseUrl(localLlm.baseUrl || 'http://localhost:11434');
      setLlmModel(localLlm.model || 'llama3.1:8b');
      setLlmTemperature(
        typeof localLlm.temperature === 'number'
          ? localLlm.temperature.toString()
          : '0.7'
      );
      setLlmTopP(
        typeof localLlm.topP === 'number'
          ? localLlm.topP.toString()
          : '0.9'
      );
      setLlmMaxTokens(
        typeof localLlm.maxTokens === 'number' ? localLlm.maxTokens.toString() : ''
      );
      setLlmRequestPath(localLlm.requestPath || '');
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
      setProjectFile(config.knowledge?.projectFile || 'current_project.md');
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.setConfig({
        localLlm: {
          provider: llmProvider,
          baseUrl: llmBaseUrl,
          model: llmModel,
          temperature: Number(llmTemperature) || 0.7,
          topP: Number(llmTopP) || 0.9,
          maxTokens: llmMaxTokens === '' ? undefined : Number(llmMaxTokens),
          requestPath: llmRequestPath.trim() || undefined,
        },
        knowledge: {
          projectFile: projectFile.trim() || 'current_project.md',
        },
        primaryLanguage: primaryLanguage,
        secondaryLanguage: secondaryLanguage,
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
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    }
  };

  const testLocalLlmConnection = async () => {
    try {
      setTestResult('Testing...');
      const result = await window.electronAPI.testLocalLlmConfig({
        provider: llmProvider,
        baseUrl: llmBaseUrl,
        model: llmModel,
        temperature: Number(llmTemperature) || 0.7,
        topP: Number(llmTopP) || 0.9,
        maxTokens: llmMaxTokens === '' ? undefined : Number(llmMaxTokens),
        requestPath: llmRequestPath.trim() || undefined,
      });
      if (result.success) {
        setTestResult('Local LLM connection is working!');
      } else {
        setTestResult(`Local LLM test failed: ${result.error || 'Unknown error'}`);
        setError(`Failed to test local LLM configuration: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Local LLM test error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestResult(`Local LLM test failed: ${errorMessage}`);
      setError(`Failed to test local LLM configuration: ${errorMessage}`);
    }
  };


return (
  <div className="max-w-3xl mx-auto p-4 space-y-4">
    <ErrorDisplay error={error} onClose={clearError} />
    <h1 className="text-2xl font-bold">Settings</h1>

    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-4">
        <div>
          <h2 className="card-title">Local LLM Configuration</h2>
          <p className="text-sm text-base-content/70">
            Configure the offline model that powers all interview reasoning. Ensure the server is running before testing.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Provider</label>
              <select
                className="select select-bordered w-full"
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as 'ollama' | 'lmstudio' | 'vllm' | 'generic')}
              >
              <option value="ollama">Ollama</option>
              <option value="lmstudio">LM Studio</option>
              <option value="vllm">vLLM / OpenAI-compatible</option>
              <option value="generic">Generic (OpenAI-compatible)</option>
            </select>
          </div>
          <div>
            <label className="label">Model</label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              placeholder="llama3.1:8b"
            />
          </div>
          <div>
            <label className="label">Base URL</label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={llmBaseUrl}
              onChange={(e) => setLlmBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
            />
            <label className="label">
              <span className="label-text-alt">Use your local inference server address.</span>
            </label>
          </div>
          <div>
            <label className="label">Request Path (optional)</label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={llmRequestPath}
              onChange={(e) => setLlmRequestPath(e.target.value)}
              placeholder="/v1/chat/completions"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Temperature</label>
            <input
              type="number"
              step="0.1"
              className="input input-bordered w-full"
              value={llmTemperature}
              onChange={(e) => setLlmTemperature(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Top P</label>
            <input
              type="number"
              step="0.05"
              className="input input-bordered w-full"
              value={llmTopP}
              onChange={(e) => setLlmTopP(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Max Tokens</label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={llmMaxTokens}
              onChange={(e) => setLlmMaxTokens(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={testLocalLlmConnection} className="btn btn-secondary btn-sm">Test Local LLM</button>
          {testResult && <span className="text-sm text-base-content/70">{testResult}</span>}
        </div>
      </div>
    </div>

    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-3">
        <h2 className="card-title">Knowledge Layers</h2>
        <p className="text-sm text-base-content/70">
          Update the project knowledge file name if you maintain multiple client contexts. Replace the file on disk before starting a new session.
        </p>
        <div>
          <label className="label">Project Knowledge File</label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={projectFile}
            onChange={(e) => setProjectFile(e.target.value)}
            placeholder="current_project.md"
          />
          <label className="label">
            <span className="label-text-alt">Located under <code>knowledge/projects</code>.</span>
          </label>
        </div>
      </div>
    </div>

    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-3">
        <h2 className="card-title">Languages & Transcription</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Primary Language</label>
            <select
              value={primaryLanguage}
              onChange={(e) => setPrimaryLanguage(e.target.value)}
              className="select select-bordered w-full"
            >
              {languageOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Secondary Language</label>
            <input
              type="text"
              value={secondaryLanguage}
              onChange={(e) => setSecondaryLanguage(e.target.value)}
              className="input input-bordered w-full"
              placeholder="Optional fallback language"
            />
          </div>
          <div>
            <label className="label">Deepgram API Key (optional fallback)</label>
            <input
              type="password"
              value={deepgramApiKey}
              onChange={(e) => setDeepgramApiKey(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="card-title">Local ASR Engine</h2>
          <label className="label cursor-pointer gap-2">
            <span className="label-text">Enable Local ASR (GPU)</span>
            <input
              type="checkbox"
              className="toggle"
              checked={localAsrEnabled}
              onChange={(e) => setLocalAsrEnabled(e.target.checked)}
            />
          </label>
        </div>
        <p className="text-sm text-base-content/70">
          When enabled, Whisper/ASR runs locally and Deepgram only triggers as a fallback.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
          <div>
            <label className="label">Model Path</label>
            <input
              type="text"
              value={localAsrModelPath}
              onChange={(e) => setLocalAsrModelPath(e.target.value)}
              disabled={!localAsrEnabled}
              className="input input-bordered w-full"
              placeholder="/opt/local-asr/models/ggml-base.en.bin"
            />
          </div>
          <div>
            <label className="label">Device</label>
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
            <label className="label">Extra Arguments</label>
            <input
              type="text"
              value={localAsrExtraArgs}
              onChange={(e) => setLocalAsrExtraArgs(e.target.value)}
              disabled={!localAsrEnabled}
              className="input input-bordered w-full"
              placeholder="--beam-size 5 --hotwords 'tech 2.0'"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Chunk Milliseconds</label>
            <input
              type="number"
              value={localAsrChunkMs}
              onChange={(e) => setLocalAsrChunkMs(Number(e.target.value))}
              disabled={!localAsrEnabled}
              className="input input-bordered w-full"
            />
          </div>
          <div>
            <label className="label">Endpoint Milliseconds</label>
            <input
              type="number"
              value={localAsrEndpointMs}
              onChange={(e) => setLocalAsrEndpointMs(Number(e.target.value))}
              disabled={!localAsrEnabled}
              className="input input-bordered w-full"
            />
          </div>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-3 justify-end pt-2">
      <button onClick={handleSave} className="btn btn-primary">Save Settings</button>
      {saveSuccess && <span className="text-success">Saved!</span>}
    </div>
  </div>
);
};

export default Settings;
