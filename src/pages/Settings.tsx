import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { languageOptions } from '../utils/languageOptions';
import { useKnowledgeBase } from '../contexts/KnowledgeBaseContext';

type LlmProviderOption = 'ollama' | 'lmstudio' | 'vllm' | 'openai-compatible' | 'custom';

const Settings: React.FC = () => {
  const { error, setError, clearError } = useError();
  const { refreshKnowledgeLayers } = useKnowledgeBase();
  const [llmProvider, setLlmProvider] = useState<LlmProviderOption>('ollama');
  const [llmBaseUrl, setLlmBaseUrl] = useState('http://localhost:11434');
  const [llmModel, setLlmModel] = useState('');
  const [llmTemperature, setLlmTemperature] = useState<number | ''>(0.7);
  const [llmTopP, setLlmTopP] = useState<number | ''>(0.9);
  const [llmMaxTokens, setLlmMaxTokens] = useState<number | ''>('');
  const [llmTimeout, setLlmTimeout] = useState<number | ''>('');
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
  const [projectKnowledgeFile, setProjectKnowledgeFile] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      const localLlmConfig = config.localLlm || {};
      const availableProviders: LlmProviderOption[] = ['ollama', 'lmstudio', 'vllm', 'openai-compatible', 'custom'];
      const providerValue = typeof localLlmConfig.provider === 'string' ? localLlmConfig.provider : '';
      setLlmProvider(availableProviders.includes(providerValue as LlmProviderOption)
        ? (providerValue as LlmProviderOption)
        : 'ollama');
      setLlmBaseUrl(localLlmConfig.baseUrl || 'http://localhost:11434');
      setLlmModel(localLlmConfig.model || '');
      setLlmTemperature(
        typeof localLlmConfig.temperature === 'number' ? Number(localLlmConfig.temperature) : 0.7
      );
      setLlmTopP(
        typeof localLlmConfig.top_p === 'number' ? Number(localLlmConfig.top_p) : 0.9
      );
      setLlmMaxTokens(
        typeof localLlmConfig.max_tokens === 'number' ? Number(localLlmConfig.max_tokens) : ''
      );
      setLlmTimeout(
        typeof localLlmConfig.requestTimeoutMs === 'number' ? Number(localLlmConfig.requestTimeoutMs) : ''
      );
      setPrimaryLanguage(config.primaryLanguage || 'auto');
      setSecondaryLanguage(config.secondaryLanguage || '');
      setDeepgramApiKey(config.deepgram_api_key || '');
      setProjectKnowledgeFile(config.projectKnowledgeFile || '');
      const localAsrConfig = config.localAsr || {};
      setLocalAsrEnabled(Boolean(localAsrConfig.enabled));
      setLocalAsrBinaryPath(localAsrConfig.binaryPath || '');
      setLocalAsrModelPath(localAsrConfig.modelPath || '');
      setLocalAsrDevice(localAsrConfig.device || 'cuda:0');
      setLocalAsrChunkMs(localAsrConfig.chunkMilliseconds || 200);
      setLocalAsrEndpointMs(localAsrConfig.endpointMilliseconds || 800);
      setLocalAsrExtraArgs(localAsrConfig.extraArgs ? localAsrConfig.extraArgs.join(' ') : '');
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
          temperature: typeof llmTemperature === 'number' ? llmTemperature : undefined,
          top_p: typeof llmTopP === 'number' ? llmTopP : undefined,
          max_tokens: typeof llmMaxTokens === 'number' ? llmMaxTokens : undefined,
          requestTimeoutMs: typeof llmTimeout === 'number' ? llmTimeout : undefined,
        },
        projectKnowledgeFile: projectKnowledgeFile || undefined,
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
      await refreshKnowledgeLayers();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    }
  };

  const testAPIConfig = async () => {
    try {
      setTestResult('Testing...');
      const payload = {
        localLlm: {
          provider: llmProvider,
          baseUrl: llmBaseUrl,
          model: llmModel,
          temperature: typeof llmTemperature === 'number' ? llmTemperature : undefined,
          top_p: typeof llmTopP === 'number' ? llmTopP : undefined,
          max_tokens: typeof llmMaxTokens === 'number' ? llmMaxTokens : undefined,
          requestTimeoutMs: typeof llmTimeout === 'number' ? llmTimeout : undefined,
        },
      };
      console.log('Sending test-api-config request with config:', payload);
      const result = await window.electronAPI.testAPIConfig(payload);
      console.log('Received test-api-config result:', result);
      if (result.success) {
        setTestResult('Local LLM configuration is valid!');
      } else {
        setTestResult(`Local LLM test failed: ${result.error || 'Unknown error'}`);
        setError(`Failed to test local LLM: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('API configuration test error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestResult(`Local LLM test failed: ${errorMessage}`);
      setError(`Failed to test local LLM: ${errorMessage}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <ErrorDisplay error={error} onClose={clearError} />
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Local LLM Configuration</h2>
        <div className="mb-4">
          <label className="label">LLM Provider</label>
          <select
            value={llmProvider}
            onChange={(e) => setLlmProvider(e.target.value as LlmProviderOption)}
            className="select select-bordered w-full"
          >
            <option value="ollama">Ollama</option>
            <option value="lmstudio">LM Studio</option>
            <option value="vllm">vLLM / OpenAI-compatible</option>
            <option value="openai-compatible">Generic OpenAI-compatible</option>
            <option value="custom">Custom</option>
          </select>
          <label className="label">
            <span className="label-text-alt">Select the runtime that exposes your offline model.</span>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Base URL</label>
            <input
              type="text"
              value={llmBaseUrl}
              onChange={(e) => setLlmBaseUrl(e.target.value)}
              className="input input-bordered w-full"
              placeholder="http://localhost:11434"
            />
            <label className="label">
              <span className="label-text-alt">Address of your local inference server.</span>
            </label>
          </div>
          <div>
            <label className="label">Model Name</label>
            <input
              type="text"
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              className="input input-bordered w-full"
              placeholder="llama3"
            />
            <label className="label">
              <span className="label-text-alt">Must match the model identifier exposed by the runtime.</span>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">Temperature</label>
            <input
              type="number"
              step="0.1"
              value={llmTemperature === '' ? '' : llmTemperature}
              onChange={(e) => setLlmTemperature(e.target.value === '' ? '' : Number(e.target.value))}
              className="input input-bordered w-full"
            />
          </div>
          <div>
            <label className="label">Top P</label>
            <input
              type="number"
              step="0.05"
              value={llmTopP === '' ? '' : llmTopP}
              onChange={(e) => setLlmTopP(e.target.value === '' ? '' : Number(e.target.value))}
              className="input input-bordered w-full"
            />
          </div>
          <div>
            <label className="label">Max Tokens</label>
            <input
              type="number"
              value={llmMaxTokens === '' ? '' : llmMaxTokens}
              onChange={(e) => setLlmMaxTokens(e.target.value === '' ? '' : Number(e.target.value))}
              className="input input-bordered w-full"
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="label">Request Timeout (ms)</label>
          <input
            type="number"
            value={llmTimeout === '' ? '' : llmTimeout}
            onChange={(e) => setLlmTimeout(e.target.value === '' ? '' : Number(e.target.value))}
            className="input input-bordered w-full"
            placeholder="60000"
          />
          <label className="label">
            <span className="label-text-alt">Optional override. Leave blank to use the default.</span>
          </label>
        </div>
      </div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Knowledge Base</h2>
        <label className="label">Project Knowledge File</label>
        <input
          type="text"
          value={projectKnowledgeFile}
          onChange={(e) => setProjectKnowledgeFile(e.target.value)}
          className="input input-bordered w-full"
          placeholder="knowledge/project/current_project.md"
        />
        <label className="label">
          <span className="label-text-alt">Relative or absolute path. Update before switching projects.</span>
        </label>
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
      <div className="mb-4">
        <label className="label">Secondary Language (optional)</label>
        <input
          type="text"
          value={secondaryLanguage}
          onChange={(e) => setSecondaryLanguage(e.target.value)}
          className="input input-bordered w-full"
          placeholder="en-PH"
        />
      </div>
      <div className="flex justify-between mt-4">
        <button onClick={handleSave} className="btn btn-primary">
          Save Settings
        </button>
        <button onClick={testAPIConfig} className="btn btn-secondary">
          Test Local LLM
        </button>
      </div>
      {saveSuccess && <p className="text-success mt-2">Settings saved successfully</p>}
      {testResult && <p className={`mt-2 ${testResult.includes('valid') ? 'text-success' : 'text-error'}`}>{testResult}</p>}
    </div>
  );
};

export default Settings;
