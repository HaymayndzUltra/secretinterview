import { app, BrowserWindow, ipcMain, session, nativeTheme } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC_CHANNELS } from './ipc/channels.js';
import { loadKnowledge } from './services/knowledgeLoader.js';
import { ContextBuilder } from './services/contextBuilder.js';
import { ModeDetector } from './services/modeDetector.js';
import { TwoStageEngine } from './llm/twoStageEngine.js';
import { WhisperWorker } from './asr/whisperWorker.js';
import { SqliteStore } from './db/sqliteStore.js';
import { SystemState } from './state/systemState.js';
import type { ConversationMode, SuggestionLine, TranscriptSegment } from '@shared/types';
import { logger } from './services/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
const systemState = new SystemState();
const modeDetector = new ModeDetector();
const contextBuilder = new ContextBuilder(modeDetector);
const llmEngine = new TwoStageEngine();
const whisperWorker = new WhisperWorker();
const dbStore = new SqliteStore();
let knowledgeReady = false;
let currentDeck: SuggestionLine[] = [];

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#0F172A',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: true
    }
  });

  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

async function bootstrapKnowledge() {
  const knowledge = await loadKnowledge();
  contextBuilder.prime(knowledge);
  knowledgeReady = true;
}

function setupNetworkGuards() {
  const filter = {
    urls: ['*://*/*']
  };
  session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    const { url } = details;
    if (url.startsWith('http://localhost:11434')) {
      callback({ cancel: false });
      return;
    }
    if (url.startsWith('file://')) {
      callback({ cancel: false });
      return;
    }
    logger.warn({ url }, 'Blocked non-local request');
    callback({ cancel: true });
  });
}

function broadcastStatus() {
  if (!mainWindow) return;
  mainWindow.webContents.send(IPC_CHANNELS.STATUS_SNAPSHOT, systemState.snapshot());
}

async function handleFinalSegment(segment: TranscriptSegment) {
  dbStore.saveTranscript(segment);
  const context = contextBuilder.assemble(segment);
  modeDetector.override(context.mode);
  systemState.setMode(context.mode);
  broadcastStatus();
  try {
    const result = await llmEngine.run(context);
    currentDeck = result.suggestions;
    dbStore.saveSuggestions(result.suggestions);
    mainWindow?.webContents.send(IPC_CHANNELS.AUTOSUGGEST_RESULT, result);
    systemState.updateLlmReady(true);
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate suggestions');
    systemState.updateLlmReady(false);
  } finally {
    broadcastStatus();
  }
}

function bindWhisperWorker() {
  whisperWorker.on('ready', () => {
    logger.info('Whisper worker ready');
    systemState.updateAsrReady(true);
    broadcastStatus();
  });

  whisperWorker.on('partial', (partial) => {
    mainWindow?.webContents.send(IPC_CHANNELS.TRANSCRIPT_PARTIAL, partial);
  });

  whisperWorker.on('final', (segment) => {
    mainWindow?.webContents.send(IPC_CHANNELS.TRANSCRIPT_FINAL, segment);
    handleFinalSegment(segment).catch((error) => {
      logger.error({ err: error }, 'handleFinalSegment failed');
    });
  });

  whisperWorker.on('error', (error) => {
    logger.error({ err: error }, 'Whisper worker error');
    systemState.updateAsrReady(false);
    broadcastStatus();
  });

  whisperWorker.start();
}

function setupIpcHandlers() {
  ipcMain.on(IPC_CHANNELS.LOOPBACK_AUDIO_CHUNK, (_event, payload: ArrayBuffer) => {
    const buffer = Buffer.from(payload);
    whisperWorker.sendAudio(buffer);
  });

  ipcMain.handle(IPC_CHANNELS.REQUEST_STATUS, () => {
    return systemState.snapshot();
  });

  ipcMain.handle(IPC_CHANNELS.REQUEST_KNOWLEDGE, () => {
    if (!knowledgeReady) {
      throw new Error('Knowledge not ready');
    }
    return true;
  });

  ipcMain.on(IPC_CHANNELS.MODE_OVERRIDE, (_event, mode: ConversationMode) => {
    modeDetector.override(mode);
    systemState.setMode(mode);
    broadcastStatus();
  });

  ipcMain.on(IPC_CHANNELS.HOTKEY_TRIGGER, (_event, index: number) => {
    const suggestion = currentDeck[index];
    if (suggestion) {
      logger.info({ suggestion, index }, 'Hotkey triggered');
    }
  });
}

app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  setupNetworkGuards();
  await createWindow();
  systemState.updateDbReady(true);
  broadcastStatus();
  setupIpcHandlers();
  bindWhisperWorker();
  await bootstrapKnowledge();
  broadcastStatus();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => logger.error({ err: error }, 'Failed to create window'));
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    whisperWorker.stop();
    app.quit();
  }
});
