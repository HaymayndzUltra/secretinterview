import React, { useState, useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';
import ErrorDisplay from '../components/ErrorDisplay';
import { languageOptions } from '../utils/languageOptions';

type LocalLLMEngineOption = 'ollama' | 'lmstudio' | 'vllm' | 'openaiCompatible';

const Settings: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [engine, setEngine] = useState<LocalLLMEngineOption>('ollama');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState('0.7');
  const [topP, setTopP] = useState('0.9');
  const [maxTokens, setMaxTokens] = useState('1024');
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
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      const llmConfig = config?.llm || {};
      setEngine(llmConfig.engine || 'ollama');
      setBaseUrl(llmConfig.baseUrl || '');
      setModel(llmConfig.model || '');
      setTemperature(
        typeof llmConfig.temperature === 'number'
          ? llmConfig.temperature.toString()
          : '0.7'
      );
      setTopP(
        typeof llmConfig.topP === 'number'
          ? llmConfig.topP.toString()
          : '0.9'
      );
      setMaxTokens(
        typeof llmConfig.maxTokens === 'number'
          ? llmConfig.maxTokens.toString()
          : '1024'
      );
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
      setProjectFile(config?.knowledge?.projectFile || 'current_project.md');

      try {
        const knowledgeContext = await window.electronAPI.loadKnowledgeContext();
        if (knowledgeContext?.availableProjects) {
          setAvailableProjects(knowledgeContext.availableProjects);
        }
      } catch (knowledgeError) {
        console.warn('Failed to load knowledge context', knowledgeError);
      }
    } catch (err) {
      console.error('Failed to load configuration', err);
      setError('Failed to load configuration. Please check your settings.');
    }
  };

  const handleSave = async () => {
    try {
      const parsedTemperature = parseFloat(temperature);
      const parsedTopP = parseFloat(topP);
      const parsedMaxTokens = parseInt(maxTokens, 10);
      await window.electronAPI.setConfig({
        llm: {
          engine,
          baseUrl,
          model,
          temperature: Number.isFinite(parsedTemperature) ? parsedTemperature : undefined,
          topP: Number.isFinite(parsedTopP) ? parsedTopP : undefined,
          maxTokens: Number.isFinite(parsedMaxTokens) ? parsedMaxTokens : undefined,
        },
        primaryLanguage,
        secondaryLanguage,
        deepgram_api_key: deepgramApiKey,
        knowledge: {
          projectFile,
        },
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

  const testLocalLLM = async () => {
    try {
      setTestResult('Testing...');
      const parsedTemperature = parseFloat(temperature);
      const parsedTopP = parseFloat(topP);
      const parsedMaxTokens = parseInt(maxTokens, 10);
      const result = await window.electronAPI.testLocalLLMConfig({
        llm: {
          engine,
          baseUrl,
          model,
          temperature: Number.isFinite(parsedTemperature) ? parsedTemperature : undefined,
          topP: Number.isFinite(parsedTopP) ? parsedTopP : undefined,
          maxTokens: Number.isFinite(parsedMaxTokens) ? parsedMaxTokens : undefined,
        },
      });
      if (result.success) {
        setTestResult('Local LLM connection is valid!');
      } else {
        setTestResult(`Local LLM test failed: ${result.error || 'Unknown error'}`);
        setError(`Failed to test local LLM: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Local LLM configuration test error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setTestResult(`Local LLM test failed: ${errorMessage}`);
      setError(`Failed to test local LLM: ${errorMessage}`);
    }
  };

  const handleProjectSelection = async (value: string) => {
    setProjectFile(value);
    try {
      await window.electronAPI.setActiveProject(value);
      const knowledgeContext = await window.electronAPI.loadKnowledgeContext();
      if (knowledgeContext?.availableProjects) {
        setAvailableProjects(knowledgeContext.availableProjects);
      }
    } catch (projectError) {
      console.error('Failed to switch project knowledge', projectError);
      setError('Failed to switch project knowledge file.');
    }
  };

  const handleCreateProject = async () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) {
      return;
    }
    try {
      const response = await window.electronAPI.setActiveProject(trimmedName);
      if (response?.success) {
        const sanitized = trimmedName.endsWith('.md') ? trimmedName : `${trimmedName}.md`;
        setProjectFile(sanitized);
        setNewProjectName('');
        const knowledgeContext = await window.electronAPI.loadKnowledgeContext();
        if (knowledgeContext?.availableProjects) {
          setAvailableProjects(knowledgeContext.availableProjects);
        }
      } else if (response?.error) {
        setError(response.error);
      }
    } catch (creationError) {
      console.error('Failed to create project knowledge file', creationError);
      setError('Failed to create project knowledge file.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <ErrorDisplay error={error} onClose={clearError} />
      <div>
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <div className="bg-base-200 rounded-lg p-4 space-y-4">
          <h2 className="text-xl font-semibold">Local LLM Engine</h2>
          <div>
            <label className="label">Engine</label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value as LocalLLMEngineOption)}
              className="select select-bordered w-full"
            >
              <option value="ollama">Ollama</option>
              <option value="lmstudio">LM Studio</option>
              <option value="vllm">vLLM / OpenAI Compatible</option>
              <option value="openaiCompatible">Generic OpenAI-Compatible</option>
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              Make sure the engine is running locally and accessible from this device.
            </p>
          </div>
          <div>
            <label className="label">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="input input-bordered w-full"
              placeholder={engine === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}
            />
            <p className="text-xs text-neutral-500 mt-1">
              Examples: Ollama → http://localhost:11434, LM Studio → http://localhost:1234/v1
            </p>
          </div>
          <div>
            <label className="label">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="input input-bordered w-full"
              placeholder={engine === 'ollama' ? 'llama3.1' : 'gpt-4o-mini'}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Temperature</label>
              <input
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label">Top P</label>
              <input
                type="number"
                step="0.05"
                value={topP}
                onChange={(e) => setTopP(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
            <div>
              <label className="label">Max Tokens</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-outline" onClick={testLocalLLM}>Test Local LLM</button>
            {testResult && <span className="text-sm text-neutral-600">{testResult}</span>}
          </div>
        </div>
      </div>
      <div className="bg-base-200 rounded-lg p-4 space-y-4">
        <h2 className="text-xl font-semibold">Knowledge Layers</h2>
        <div>
          <label className="label">Active Project File</label>
          <select
            value={projectFile}
            onChange={(e) => handleProjectSelection(e.target.value)}
            className="select select-bordered w-full"
          >
            {[...new Set([projectFile, ...availableProjects])].map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500 mt-1">
            Update <code>{projectFile}</code> before each engagement to switch project context.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="input input-bordered flex-1"
            placeholder="New project file name"
          />
          <button className="btn btn-outline" type="button" onClick={handleCreateProject}>
            Create &amp; Activate
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Files are stored in <code>knowledge/project</code>. The active file is merged with permanent knowledge on every prompt.
        </p>
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
        <label className="label">Secondary Language (Optional)</label>
        <input
          type="text"
          value={secondaryLanguage}
          onChange={(e) => setSecondaryLanguage(e.target.value)}
          className="input input-bordered w-full"
          placeholder="Tagalog"
        />
      </div>
      <div className="flex justify-between mt-4">
        <button onClick={handleSave} className="btn btn-primary">
          Save Settings
        </button>
      </div>
      {saveSuccess && <p className="text-success mt-2">Settings saved successfully</p>}
    </div>
  );
};

export default Settings;
