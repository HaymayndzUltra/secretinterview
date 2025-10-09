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
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const handleSave = async () => {
    try {
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
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save configuration');
    }
  };

  const testAPIConfig = async () => {
    try {
      setTestResult('Testing...');
      console.log('Sending test-api-config request with config:', {
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
      });
      const result = await window.electronAPI.testAPIConfig({
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
      });
      console.log('Received test-api-config result:', result);
      if (result.success) {
        setTestResult('API configuration is valid!');
      } else {
        setTestResult(`API configuration test failed: ${result.error || 'Unknown error'}`);
        setError(`Failed to test API configuration: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('API configuration test error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestResult(`API configuration test failed: ${errorMessage}`);
      setError(`Failed to test API configuration: ${errorMessage}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <ErrorDisplay error={error} onClose={clearError} />
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="mb-4">
        <label className="label">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input input-bordered w-full"
        />
      </div>
      <div className="mb-4">
        <label className="label">API Base URL (Optional)</label>
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
        <label className="label">API Model</label>
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
        <label className="label">API Call Method</label>
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
      <div className="flex justify-between mt-4">
        <button onClick={handleSave} className="btn btn-primary">
          Save Settings
        </button>
        <button onClick={testAPIConfig} className="btn btn-secondary">
          Test API Configuration
        </button>
      </div>
      {saveSuccess && <p className="text-success mt-2">Settings saved successfully</p>}
      {testResult && <p className={`mt-2 ${testResult.includes('valid') ? 'text-success' : 'text-error'}`}>{testResult}</p>}
    </div>
  );
};

export default Settings;
