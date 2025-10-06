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
  const [localAsrPythonPath, setLocalAsrPythonPath] = useState('python3');
  const [localAsrModelPath, setLocalAsrModelPath] = useState('large-v3');
  const [localAsrDevice, setLocalAsrDevice] = useState('cuda');
  const [localAsrComputeType, setLocalAsrComputeType] = useState('float16');
  const [localAsrChunkMs, setLocalAsrChunkMs] = useState('320');
  const [localAsrWindowMs, setLocalAsrWindowMs] = useState('3000');
  const [localAsrStrideMs, setLocalAsrStrideMs] = useState('120');
  const [localAsrVadFilter, setLocalAsrVadFilter] = useState(true);

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
      setLocalAsrEnabled(!!localAsrConfig.enabled);
      setLocalAsrPythonPath(localAsrConfig.pythonPath || 'python3');
      setLocalAsrModelPath(localAsrConfig.modelPath || 'large-v3');
      setLocalAsrDevice(localAsrConfig.device || 'cuda');
      setLocalAsrComputeType(localAsrConfig.computeType || 'float16');
      setLocalAsrChunkMs(String(localAsrConfig.chunkMs ?? 320));
      setLocalAsrWindowMs(String(localAsrConfig.windowMs ?? 3000));
      setLocalAsrStrideMs(String(localAsrConfig.strideMs ?? 120));
      setLocalAsrVadFilter(localAsrConfig.vadFilter !== false);
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const handleSave = async () => {
    try {
      const parsedChunkMs = parseInt(localAsrChunkMs, 10);
      const parsedWindowMs = parseInt(localAsrWindowMs, 10);
      const parsedStrideMs = parseInt(localAsrStrideMs, 10);

      await window.electronAPI.setConfig({
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
        api_call_method: apiCallMethod,
        primaryLanguage: primaryLanguage,
        secondaryLanguage: secondaryLanguage,
        deepgram_api_key: deepgramApiKey,
        localAsr: {
          enabled: localAsrEnabled,
          pythonPath: localAsrPythonPath.trim() || 'python3',
          modelPath: localAsrModelPath.trim() || 'large-v3',
          device: localAsrDevice.trim() || 'cuda',
          computeType: localAsrComputeType.trim() || 'float16',
          chunkMs: Number.isNaN(parsedChunkMs) ? 320 : parsedChunkMs,
          windowMs: Number.isNaN(parsedWindowMs) ? 3000 : parsedWindowMs,
          strideMs: Number.isNaN(parsedStrideMs) ? 120 : parsedStrideMs,
          vadFilter: localAsrVadFilter,
          beamSize: 1,
          temperature: 0,
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
      <div className="mt-6 border-t border-base-300 pt-4">
        <h2 className="text-xl font-semibold mb-2">Local ASR (GPU Whisper)</h2>
        <p className="text-sm text-base-content/70 mb-3">
          Prefer the on-device Whisper engine on your RTX 4090 for sub-300&nbsp;ms latency. Provide the Python environment
          with <code>faster-whisper</code> installed and tweak inference parameters.
        </p>
        <label className="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={localAsrEnabled}
            onChange={(e) => setLocalAsrEnabled(e.target.checked)}
          />
          <span className="label-text font-medium">Enable local GPU transcription</span>
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mt-4">
          <div>
            <label className="label">Python Executable</label>
            <input
              type="text"
              value={localAsrPythonPath}
              onChange={(e) => setLocalAsrPythonPath(e.target.value)}
              className="input input-bordered w-full"
              disabled={!localAsrEnabled}
            />
            <label className="label"><span className="label-text-alt">Path to <code>python3</code> with faster-whisper installed.</span></label>
          </div>
          <div>
            <label className="label">Model ID or Path</label>
            <input
              type="text"
              value={localAsrModelPath}
              onChange={(e) => setLocalAsrModelPath(e.target.value)}
              className="input input-bordered w-full"
              disabled={!localAsrEnabled}
            />
            <label className="label"><span className="label-text-alt">E.g. <code>large-v3</code> or a local directory.</span></label>
          </div>
          <div>
            <label className="label">Device</label>
            <input
              type="text"
              value={localAsrDevice}
              onChange={(e) => setLocalAsrDevice(e.target.value)}
              className="input input-bordered w-full"
              disabled={!localAsrEnabled}
            />
            <label className="label"><span className="label-text-alt">Use <code>cuda</code> for RTX GPUs.</span></label>
          </div>
          <div>
            <label className="label">Compute Type</label>
            <input
              type="text"
              value={localAsrComputeType}
              onChange={(e) => setLocalAsrComputeType(e.target.value)}
              className="input input-bordered w-full"
              disabled={!localAsrEnabled}
            />
            <label className="label"><span className="label-text-alt">Typical values: <code>float16</code>, <code>int8</code>.</span></label>
          </div>
          <div>
            <label className="label">Chunk Size (ms)</label>
            <input
              type="number"
              min={80}
              step={20}
              value={localAsrChunkMs}
              onChange={(e) => setLocalAsrChunkMs(e.target.value)}
              className="input input-bordered w-full"
              disabled={!localAsrEnabled}
            />
          </div>
          <div>
            <label className="label">Window Size (ms)</label>
            <input
              type="number"
              min={500}
              step={100}
              value={localAsrWindowMs}
              onChange={(e) => setLocalAsrWindowMs(e.target.value)}
              className="input input-bordered w-full"
              disabled={!localAsrEnabled}
            />
          </div>
          <div>
            <label className="label">Stride (ms)</label>
            <input
              type="number"
              min={40}
              step={20}
              value={localAsrStrideMs}
              onChange={(e) => setLocalAsrStrideMs(e.target.value)}
              className="input input-bordered w-full"
              disabled={!localAsrEnabled}
            />
          </div>
          <div className="flex items-center mt-6 md:mt-0">
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={localAsrVadFilter}
                onChange={(e) => setLocalAsrVadFilter(e.target.checked)}
                disabled={!localAsrEnabled}
              />
              <span className="label-text">Enable VAD noise suppression</span>
            </label>
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
