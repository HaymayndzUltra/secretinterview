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
  const [whisperBinaryPath, setWhisperBinaryPath] = useState('');
  const [whisperModelPath, setWhisperModelPath] = useState('');
  const [useSystemAudio, setUseSystemAudio] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = (await window.electronAPI.getConfig()) || {};
      setApiKey(config.openai_key || '');
      setApiModel(config.gpt_model || 'gpt-4o');
      setApiBase(config.api_base || '');
      setApiCallMethod(config.api_call_method || 'direct');
      setPrimaryLanguage(config.primaryLanguage || 'auto');
      setSecondaryLanguage(config.secondaryLanguage || '');
      setWhisperBinaryPath(config.whisperBinaryPath || '');
      setWhisperModelPath(config.whisperModelPath || '');
      setUseSystemAudio(Boolean(config.useSystemAudio));
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const handleSave = async () => {
    try {
      const existingConfig = (await window.electronAPI.getConfig()) || {};
      await window.electronAPI.setConfig({
        ...existingConfig,
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
        api_call_method: apiCallMethod,
        primaryLanguage: primaryLanguage,
        secondaryLanguage: secondaryLanguage,
        whisperBinaryPath: whisperBinaryPath,
        whisperModelPath: whisperModelPath,
        useSystemAudio,
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
          placeholder="http://localhost:11434"
        />
        <label className="label">
          <span className="label-text-alt">
            For OpenAI: Enter proxy URL if using API proxy. For example: https://your-proxy.com/v1<br/>
            For Ollama: Enter http://localhost:11434 (or your Ollama server URL)
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
          placeholder="llama3:8b"
        />
        <label className="label">
          <span className="label-text-alt">
            For OpenAI: Use gpt-4, gpt-3.5-turbo, etc.<br/>
            For Ollama: Use llama3:8b, llama3:latest, codellama, etc.
          </span>
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
          placeholder="es"
        />
      </div>
      <div className="mb-4 flex items-center gap-3">
        <input
          id="use-system-audio"
          type="checkbox"
          className="checkbox"
          checked={useSystemAudio}
          onChange={(e) => setUseSystemAudio(e.target.checked)}
        />
        <div>
          <label htmlFor="use-system-audio" className="label cursor-pointer">
            <span className="label-text">Capture system audio</span>
          </label>
          <p className="text-sm text-base-content/70">
            When enabled, the app records loopback audio from your system instead of the microphone.
          </p>
        </div>
      </div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Local Whisper</h2>
        <label className="label">Whisper Binary Path</label>
        <input
          type="text"
          value={whisperBinaryPath}
          onChange={(e) => setWhisperBinaryPath(e.target.value)}
          className="input input-bordered w-full"
          placeholder="/path/to/whisper-stream"
        />
        <label className="label">
          <span className="label-text-alt">
            Leave blank to use the bundled whisper-stream binary in the app resources directory.
          </span>
        </label>
        <label className="label">Whisper Model Path</label>
        <input
          type="text"
          value={whisperModelPath}
          onChange={(e) => setWhisperModelPath(e.target.value)}
          className="input input-bordered w-full"
          placeholder="/path/to/ggml-base.en.bin"
        />
        <label className="label">
          <span className="label-text-alt">
            Models should be ggml/gguf whisper checkpoints compatible with whisper.cpp.
          </span>
        </label>
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
