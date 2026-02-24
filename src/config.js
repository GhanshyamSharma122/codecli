import fs from 'fs';
import path from 'path';
import os from 'os';

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), '.codecli');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'config.json');
const PROJECT_CONFIG_FILE = '.codecli.json';

const DEFAULT_CONFIG = {
  defaultProvider: process.env.DEFAULT_PROVIDER || 'gemini',
  theme: 'dark',
  permissions: {
    autoApproveRead: true,
    autoApproveWrite: false,
    autoApproveExecute: false,
    allowedCommands: ['ls', 'dir', 'cat', 'type', 'echo', 'pwd', 'cd', 'git status', 'git diff', 'git log', 'node --version', 'npm --version'],
    blockedCommands: ['rm -rf /', 'format', 'del /s /q'],
  },
  providers: {
    'azure-openai': {
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
    },
    ollama: {
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.2',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    },
  },
  editor: process.env.EDITOR || 'code',
  maxTokens: 128000,
  temperature: 0.7,
  experimental: {
    agentTeams: false,
    subagents: false,
    mcp: false,
  },
};

class Config {
  constructor() {
    this.global = {};
    this.project = {};
    this.merged = {};
    this._ensureGlobalDir();
    this.load();
  }

  _ensureGlobalDir() {
    if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
      fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }
    const sessionsDir = path.join(GLOBAL_CONFIG_DIR, 'sessions');
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }
    const tasksDir = path.join(GLOBAL_CONFIG_DIR, 'tasks');
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }
  }

  load() {
    // Load global config
    if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
      try {
        this.global = JSON.parse(fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf-8'));
      } catch {
        this.global = {};
      }
    }

    // Load project config
    const projectConfigPath = path.resolve(process.cwd(), PROJECT_CONFIG_FILE);
    if (fs.existsSync(projectConfigPath)) {
      try {
        this.project = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
      } catch {
        this.project = {};
      }
    }

    // Merge: defaults < global < project < env
    this.merged = this._deepMerge(DEFAULT_CONFIG, this.global, this.project);
  }

  get(key) {
    return key.split('.').reduce((obj, k) => obj?.[k], this.merged);
  }

  set(key, value, scope = 'global') {
    const target = scope === 'global' ? this.global : this.project;
    const keys = key.split('.');
    let obj = target;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    this._save(scope);
    this.load(); // reload merged
  }

  list() {
    return this.merged;
  }

  _save(scope) {
    if (scope === 'global') {
      fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(this.global, null, 2));
    } else {
      fs.writeFileSync(
        path.resolve(process.cwd(), PROJECT_CONFIG_FILE),
        JSON.stringify(this.project, null, 2)
      );
    }
  }

  _deepMerge(...objects) {
    const result = {};
    for (const obj of objects) {
      for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          result[key] = this._deepMerge(result[key] || {}, obj[key]);
        } else {
          result[key] = obj[key];
        }
      }
    }
    return result;
  }

  get globalConfigDir() {
    return GLOBAL_CONFIG_DIR;
  }
}

export default Config;
