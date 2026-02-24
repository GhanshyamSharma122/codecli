import BaseProvider from './base.js';
import logger from '../utils/logger.js';

class OllamaProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.name = 'ollama';
        const settings = config.get('providers.ollama') || {};
        this.host = settings.host || process.env.OLLAMA_HOST || 'http://localhost:11434';
        this.model = settings.model || process.env.OLLAMA_MODEL || 'llama3.2';
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
            model: this.model,
            messages: this._formatMessages(messages, options.systemPrompt),
            stream: false,
            options: {
                temperature: options.temperature ?? 0.7,
                num_predict: options.maxTokens ?? 4096,
            },
        };

        if (options.tools?.length) {
            body.tools = this.formatTools(options.tools);
        }

        const response = await fetch(`${this.host}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama error (${response.status}): ${error}`);
        }

        const data = await response.json();

        return {
            content: data.message?.content || '',
            toolCalls: data.message?.tool_calls?.map((tc, i) => ({
                id: `call_${Date.now()}_${i}`,
                type: 'function',
                function: {
                    name: tc.function?.name,
                    arguments: JSON.stringify(tc.function?.arguments || {}),
                },
            })) || null,
            usage: {
                prompt_tokens: data.prompt_eval_count || 0,
                completion_tokens: data.eval_count || 0,
                total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            },
            finishReason: data.done_reason || 'stop',
        };
    }

    async *stream(messages, options = {}) {
        const body = {
            model: this.model,
            messages: this._formatMessages(messages, options.systemPrompt),
            stream: true,
            options: {
                temperature: options.temperature ?? 0.7,
                num_predict: options.maxTokens ?? 4096,
            },
        };

        if (options.tools?.length) {
            body.tools = this.formatTools(options.tools);
        }

        const response = await fetch(`${this.host}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Ollama error (${response.status}): ${error}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);

                        if (data.message?.content) {
                            yield { type: 'text', content: data.message.content };
                        }

                        if (data.message?.tool_calls) {
                            const toolCalls = data.message.tool_calls.map((tc, i) => ({
                                id: `call_${Date.now()}_${i}`,
                                type: 'function',
                                function: {
                                    name: tc.function?.name,
                                    arguments: JSON.stringify(tc.function?.arguments || {}),
                                },
                            }));
                            yield { type: 'tool_calls', toolCalls };
                        }

                        if (data.done) {
                            yield {
                                type: 'done',
                                usage: {
                                    prompt_tokens: data.prompt_eval_count || 0,
                                    completion_tokens: data.eval_count || 0,
                                    total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                                },
                                finishReason: data.done_reason || 'stop',
                            };
                        }
                    } catch (e) {
                        logger.debug('Ollama parse error:', e.message);
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    async listModels() {
        try {
            const response = await fetch(`${this.host}/api/tags`);
            if (!response.ok) return ['llama3.2', 'codellama', 'mistral', 'deepseek-coder'];
            const data = await response.json();
            return data.models?.map((m) => m.name) || [];
        } catch {
            return ['llama3.2', 'codellama', 'mistral', 'deepseek-coder'];
        }
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
            } else if (msg.role === 'assistant' && msg.tool_calls) {
                // Ollama expects tool_calls[].function.arguments to be an object
                formatted.push({
                    role: 'assistant',
                    content: msg.content || '',
                    tool_calls: msg.tool_calls.map(tc => {
                        let args = tc.function.arguments;
                        if (typeof args === 'string') {
                            try {
                                args = JSON.parse(args);
                            } catch { /* use as is */ }
                        }
                        return {
                            id: tc.id,
                            type: 'function',
                            function: {
                                name: tc.function.name,
                                arguments: args,
                            },
                        };
                    }),
                });
            } else {
                formatted.push({
                    role: msg.role,
                    content: msg.content,
                    ...(msg.tool_call_id ? { tool_call_id: msg.tool_call_id } : {}),
                });
            }
        }
        return formatted;
    }

    setModel(model) {
        this.model = model;
    }
}

export default OllamaProvider;
