import AzureOpenAIProvider from './azure-openai.js';
import OllamaProvider from './ollama.js';
import GeminiProvider from './gemini.js';
import chalk from 'chalk';

/**
 * Known context window sizes per model.
 * Used for auto-compaction decisions.
 */
const MODEL_TOKEN_LIMITS = {
    // Azure OpenAI / OpenAI models
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4-turbo-preview': 128000,
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-3.5-turbo': 16385,
    'gpt-35-turbo': 16385,
    'gpt-3.5-turbo-16k': 16385,
    'o1': 200000,
    'o1-mini': 128000,
    'o1-preview': 128000,
    'o3-mini': 200000,

    // Ollama models
    'llama3.2': 131072,
    'llama3.1': 131072,
    'llama3': 8192,
    'llama2': 4096,
    'mistral': 32768,
    'mixtral': 32768,
    'codellama': 16384,
    'deepseek-coder': 16384,
    'deepseek-r1': 131072,
    'phi3': 128000,
    'phi4': 16384,
    'qwen2.5': 131072,
    'qwen2.5-coder': 131072,
    'qwen3': 262144,
    'qwen3-coder': 262144,
    'gemma2': 8192,
    'command-r': 131072,

    // Gemini models
    'gemini-2.0-flash': 1048576,
    'gemini-2.0-flash-lite': 1048576,
    'gemini-2.5-flash': 1048576,
    'gemini-2.5-pro': 1048576,
    'gemini-3-flash': 1048576,
    'gemini-1.5-pro': 2097152,
    'gemini-1.5-flash': 1048576,
    'gemini-1.5-flash-8b': 1048576,
    'gemini-1.0-pro': 32768,
    'gemini-pro': 32768,
};

class ProviderManager {
    constructor(config) {
        this.config = config;
        this.providers = {
            'azure-openai': new AzureOpenAIProvider(config),
            ollama: new OllamaProvider(config),
            gemini: new GeminiProvider(config),
        };
        this.currentProvider = config.get('defaultProvider') || 'gemini';
    }

    get provider() {
        return this.providers[this.currentProvider];
    }

    switchProvider(name) {
        if (!this.providers[name]) {
            throw new Error(`Unknown provider: ${name}. Available: ${Object.keys(this.providers).join(', ')}`);
        }
        this.currentProvider = name;
        return this.provider;
    }

    switchModel(model) {
        this.provider.setModel(model);
    }

    async listModels(providerName = null) {
        const provider = providerName ? this.providers[providerName] : this.provider;
        if (!provider) throw new Error(`Unknown provider: ${providerName}`);
        return provider.listModels();
    }

    /**
     * Get the max context window tokens for the current model.
     * Falls back to a safe default if the model is unknown.
     */
    getMaxTokens() {
        const model = this.provider.model;
        // Check exact match, then check if model name starts with a known prefix
        if (MODEL_TOKEN_LIMITS[model]) return MODEL_TOKEN_LIMITS[model];
        for (const [key, limit] of Object.entries(MODEL_TOKEN_LIMITS)) {
            if (model.startsWith(key)) return limit;
        }
        // Conservative default
        return 8192;
    }

    /**
     * Get a human-readable token limit string.
     */
    getMaxTokensDisplay() {
        const max = this.getMaxTokens();
        if (max >= 1000000) return `${(max / 1000000).toFixed(1)}M`;
        if (max >= 1000) return `${(max / 1000).toFixed(0)}K`;
        return `${max}`;
    }

    getInfo() {
        return {
            provider: this.currentProvider,
            model: this.provider.model,
            maxTokens: this.getMaxTokens(),
            maxTokensDisplay: this.getMaxTokensDisplay(),
            available: Object.keys(this.providers),
        };
    }

    getStatusDisplay() {
        const info = this.getInfo();
        const providerColors = {
            'azure-openai': chalk.hex('#0078D4'),
            ollama: chalk.hex('#B8860B'),
            gemini: chalk.hex('#4285F4'),
        };
        const color = providerColors[info.provider] || chalk.white;
        return `${color('●')} ${color.bold(info.provider)} ${chalk.dim('/')} ${chalk.white(info.model)} ${chalk.dim('(')}${chalk.hex('#9CA3AF')(info.maxTokensDisplay + ' ctx')}${chalk.dim(')')}`;
    }
}

export default ProviderManager;
