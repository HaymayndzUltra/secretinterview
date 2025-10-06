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
  const [localAsrHost, setLocalAsrHost] = useState('127.0.0.1');
  const [localAsrPort, setLocalAsrPort] = useState('3100');
  const [localAsrAuthToken, setLocalAsrAuthToken] = useState('');
  const [localAsrChunkMs, setLocalAsrChunkMs] = useState('80');
  const [localAsrReadinessMs, setLocalAsrReadinessMs] = useState('2000');

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
      const localAsr = config.local_asr || {};
      setLocalAsrEnabled(Boolean(localAsr.enabled));
      setLocalAsrHost(localAsr.host || '127.0.0.1');
      setLocalAsrPort(
        localAsr.port !== undefined && localAsr.port !== null
          ? String(localAsr.port)
          : '3100'
      );
      setLocalAsrAuthToken(localAsr.authToken || '');
      setLocalAsrChunkMs(
        localAsr.chunkMillis !== undefined && localAsr.chunkMillis !== null
          ? String(localAsr.chunkMillis)
          : '80'
      );
      setLocalAsrReadinessMs(
        localAsr.readinessTimeoutMs !== undefined && localAsr.readinessTimeoutMs !== null
          ? String(localAsr.readinessTimeoutMs)
          : '2000'
      );
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
        local_asr: {
          enabled: localAsrEnabled,
          host: localAsrHost,
          port: localAsrPort ? Number(localAsrPort) : undefined,
          authToken: localAsrAuthToken || undefined,
          chunkMillis: localAsrChunkMs ? Number(localAsrChunkMs) : undefined,
          readinessTimeoutMs: localAsrReadinessMs ? Number(localAsrReadinessMs) : undefined,
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
      <div className="mb-6 border-t border-base-300 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Local GPU ASR</h2>
            <p className="text-sm text-base-content/70">
              Stream audio to your on-device transcription server (e.g. Faster-Whisper on RTX 4090).
            </p>
          </div>
          <label className="label cursor-pointer">
            <span className="label-text mr-3">Enable</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={localAsrEnabled}
              onChange={(e) => setLocalAsrEnabled(e.target.checked)}
            />
          </label>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${localAsrEnabled ? '' : 'opacity-60 pointer-events-none'}`}>
          <div>
            <label className="label">Server Host</label>
            <input
              type="text"
              value={localAsrHost}
              onChange={(e) => setLocalAsrHost(e.target.value)}
              className="input input-bordered w-full"
              placeholder="127.0.0.1"
            />
          </div>
          <div>
            <label className="label">Server Port</label>
            <input
              type="number"
              value={localAsrPort}
              onChange={(e) => setLocalAsrPort(e.target.value)}
              className="input input-bordered w-full"
              min={1}
              max={65535}
            />
          </div>
          <div>
            <label className="label">Auth Token (optional)</label>
            <input
              type="password"
              value={localAsrAuthToken}
              onChange={(e) => setLocalAsrAuthToken(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>
          <div>
            <label className="label">Chunk Size (ms)</label>
            <input
              type="number"
              value={localAsrChunkMs}
              onChange={(e) => setLocalAsrChunkMs(e.target.value)}
              className="input input-bordered w-full"
              min={10}
              max={500}
            />
            <label className="label">
              <span className="label-text-alt">Lower values reduce latency. 30-120ms recommended.</span>
            </label>
          </div>
          <div>
            <label className="label">Readiness Timeout (ms)</label>
            <input
              type="number"
              value={localAsrReadinessMs}
              onChange={(e) => setLocalAsrReadinessMs(e.target.value)}
              className="input input-bordered w-full"
              min={500}
            />
          </div>
        </div>
        <p className="text-xs text-base-content/60 mt-3">
          The app will automatically fall back to Deepgram when the local engine is offline.
        </p>
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
