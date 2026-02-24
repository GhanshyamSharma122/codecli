import BaseProvider from './base.js';
import logger from '../utils/logger.js';

class AzureOpenAIProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.name = 'azure-openai';
        const settings = config.get('providers.azure-openai') || {};
        this.apiKey = settings.apiKey || process.env.AZURE_OPENAI_API_KEY || '';
        this.endpoint = settings.endpoint || process.env.AZURE_OPENAI_ENDPOINT || '';
        this.deployment = settings.deployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
        this.apiVersion = settings.apiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
        this.model = this.deployment;
    }

    _getUrl(stream = false) {
        const base = this.endpoint.replace(/\/$/, '');
        return `${base}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
    }

    formatTools(tools) {
        return tools.map((tool) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }

    async chat(messages, options = {}) {
        const body = {
            messages: this._formatMessages(messages, options.systemPrompt),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
            stream: false,
        };

        if (options.tools?.length) {
            body.tools = this.formatTools(options.tools);
            body.tool_choice = 'auto';
        }

        const response = await fetch(this._getUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': this.apiKey,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Azure OpenAI error (${response.status}): ${error}`);
        }

        const data = await response.json();
        const choice = data.choices[0];

        return {
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls || null,
            usage: data.usage,
            finishReason: choice.finish_reason,
        };
    }

    async *stream(messages, options = {}) {
        const body = {
            messages: this._formatMessages(messages, options.systemPrompt),
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 4096,
            stream: true,
        };

        if (options.tools?.length) {
            body.tools = this.formatTools(options.tools);
            body.tool_choice = 'auto';
        }

        const response = await fetch(this._getUrl(true), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': this.apiKey,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Azure OpenAI error (${response.status}): ${error}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let toolCalls = [];

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (!trimmed.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(trimmed.slice(6));
                        const delta = data.choices?.[0]?.delta;
                        if (!delta) continue;

                        if (delta.content) {
                            yield { type: 'text', content: delta.content };
                        }

                        if (delta.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                if (tc.id) {
                                    toolCalls.push({
                                        id: tc.id,
                                        type: 'function',
                                        function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' },
                                    });
                                } else if (toolCalls.length > 0 && tc.function?.arguments) {
                                    toolCalls[toolCalls.length - 1].function.arguments += tc.function.arguments;
                                }
                            }
                        }

                        if (data.choices?.[0]?.finish_reason) {
                            if (toolCalls.length > 0) {
                                yield { type: 'tool_calls', toolCalls };
                                toolCalls = [];
                            }
                            yield { type: 'done', usage: data.usage, finishReason: data.choices[0].finish_reason };
                        }
                    } catch (e) {
                        logger.debug('SSE parse error:', e.message);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    async listModels() {
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
    }

    _formatMessages(messages, systemPrompt) {
        const formatted = [];
        if (systemPrompt) {
            formatted.push({ role: 'system', content: systemPrompt });
        }
        for (const msg of messages) {
            if (msg.role === 'tool') {
                formatted.push({
                    role: 'tool',
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                    tool_call_id: msg.tool_call_id,
                });
            } else {
                formatted.push({
                    role: msg.role,
                    content: msg.content,
                    ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
                });
            }
        }
        return formatted;
    }

    setModel(model) {
        this.deployment = model;
        this.model = model;
    }
}

export default AzureOpenAIProvider;
