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
  const [localAsrUrl, setLocalAsrUrl] = useState('');
  const [localAsrAuthToken, setLocalAsrAuthToken] = useState('');
  const [localAsrChunkMs, setLocalAsrChunkMs] = useState(160);
  const [localAsrTimeoutMs, setLocalAsrTimeoutMs] = useState(5000);

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
      const localConfig = config.local_asr_config || {};
      setLocalAsrEnabled(Boolean(localConfig.enabled));
      setLocalAsrUrl(localConfig.url || '');
      setLocalAsrAuthToken(localConfig.auth_token || '');
      setLocalAsrChunkMs(typeof localConfig.chunk_ms === 'number' ? localConfig.chunk_ms : 160);
      setLocalAsrTimeoutMs(typeof localConfig.handshake_timeout_ms === 'number' ? localConfig.handshake_timeout_ms : 5000);
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
        secondaryLanguage: secondaryLanguage,
        deepgram_api_key: deepgramApiKey,
        local_asr_config: {
          enabled: localAsrEnabled,
          url: localAsrUrl,
          auth_token: localAsrAuthToken || undefined,
          chunk_ms: Number.isFinite(Number(localAsrChunkMs)) ? Number(localAsrChunkMs) : 160,
          handshake_timeout_ms: Number.isFinite(Number(localAsrTimeoutMs)) ? Number(localAsrTimeoutMs) : 5000,
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
      <div className="mb-6 rounded-lg border border-base-300 p-4">
        <h2 className="text-lg font-semibold mb-2">Local GPU Transcription (Primary)</h2>
        <p className="text-sm opacity-70 mb-3">
          Configure your on-device speech engine. Deepgram will only be used when this engine is disabled or unreachable.
        </p>
        <label className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={localAsrEnabled}
            onChange={(e) => setLocalAsrEnabled(e.target.checked)}
          />
          <span className="label-text">Enable local GPU ASR</span>
        </label>
        <div className="mt-3">
          <label className="label">WebSocket Endpoint</label>
          <input
            type="text"
            value={localAsrUrl}
            onChange={(e) => setLocalAsrUrl(e.target.value)}
            className="input input-bordered w-full"
            placeholder="ws://127.0.0.1:5678"
            disabled={!localAsrEnabled}
          />
          <label className="label">
            <span className="label-text-alt">Expecting 16kHz mono PCM frames.</span>
          </label>
        </div>
        <div className="mt-3">
          <label className="label">Auth Token (optional)</label>
          <input
            type="password"
            value={localAsrAuthToken}
            onChange={(e) => setLocalAsrAuthToken(e.target.value)}
            className="input input-bordered w-full"
            disabled={!localAsrEnabled}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Chunk Size (ms)</label>
            <input
              type="number"
              min={40}
              step={10}
              value={localAsrChunkMs}
              onChange={(e) => {
                const value = Number(e.target.value);
                setLocalAsrChunkMs(Number.isNaN(value) ? 0 : value);
              }}
              className="input input-bordered w-full"
              disabled={!localAsrEnabled}
            />
          </div>
          <div>
            <label className="label">Handshake Timeout (ms)</label>
            <input
              type="number"
              min={1000}
              step={500}
              value={localAsrTimeoutMs}
              onChange={(e) => {
                const value = Number(e.target.value);
                setLocalAsrTimeoutMs(Number.isNaN(value) ? 0 : value);
              }}
              className="input input-bordered w-full"
              disabled={!localAsrEnabled}
            />
          </div>
        </div>
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
        <label className="label">Secondary Language (Optional)</label>
        <input
          type="text"
          value={secondaryLanguage}
          onChange={(e) => setSecondaryLanguage(e.target.value)}
          className="input input-bordered w-full"
          placeholder="Use ISO code, e.g., en"
        />
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
