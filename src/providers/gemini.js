import { GoogleGenerativeAI } from '@google/generative-ai';
import BaseProvider from './base.js';
import logger from '../utils/logger.js';

class GeminiProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.name = 'gemini';
        const settings = config.get('providers.gemini') || {};
        this.apiKey = settings.apiKey || '';
        this.model = settings.model || '';
        this.client = new GoogleGenerativeAI(this.apiKey);
    }

    formatTools(tools) {
        return [{
            functionDeclarations: tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: this._convertSchema(tool.parameters),
            })),
        }];
    }

    _convertSchema(schema) {
        if (!schema) return undefined;
        const converted = {};
        if (schema.type) converted.type = schema.type.toUpperCase();
        if (schema.description) converted.description = schema.description;
        if (schema.properties) {
            converted.properties = {};
            for (const [key, value] of Object.entries(schema.properties)) {
                converted.properties[key] = this._convertSchema(value);
            }
        }
        if (schema.required) converted.required = schema.required;
        if (schema.items) converted.items = this._convertSchema(schema.items);
        if (schema.enum) converted.enum = schema.enum;
        return converted;
    }

    async chat(messages, options = {}) {
        const model = this.client.getGenerativeModel({
            model: this.model,
            systemInstruction: options.systemPrompt || undefined,
        });

        const formattedMessages = this._formatMessages(messages);
        const generationConfig = {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 4096,
        };

        const chatArgs = {
            generationConfig,
            history: formattedMessages.slice(0, -1),
        };

        if (options.tools?.length) {
            chatArgs.tools = this.formatTools(options.tools);
        }

        const chat = model.startChat(chatArgs);
        const lastMessage = formattedMessages[formattedMessages.length - 1];
        const result = await chat.sendMessage(lastMessage.parts);

        const response = result.response;
        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        const text = parts
            .filter(p => p.text)
            .map(p => p.text)
            .join('');

        const toolCalls = this._extractToolCalls(parts);

        return {
            content: text,
            toolCalls,
            usage: {
                prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
                completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: response.usageMetadata?.totalTokenCount || 0,
            },
            finishReason: 'stop',
        };
    }

    async *stream(messages, options = {}) {
        const model = this.client.getGenerativeModel({
            model: this.model,
            systemInstruction: options.systemPrompt || undefined,
        });

        const formattedMessages = this._formatMessages(messages);
        const generationConfig = {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 4096,
        };

        const chatArgs = {
            generationConfig,
            history: formattedMessages.slice(0, -1),
        };

        if (options.tools?.length) {
            chatArgs.tools = this.formatTools(options.tools);
        }

        const chat = model.startChat(chatArgs);
        const lastMessage = formattedMessages[formattedMessages.length - 1];
        const result = await chat.sendMessageStream(lastMessage.parts);

        let allToolCalls = [];

        for await (const chunk of result.stream) {
            const candidate = chunk.candidates?.[0];
            const content = candidate?.content;
            const parts = content?.parts || [];

            for (const part of parts) {
                if (part.text) {
                    yield { type: 'text', content: part.text };
                }

                // Preserve thought/reasoning for Gemini 3 and 2.0 Thinking models
                if (part.thought) {
                    yield { type: 'thought', content: part.thought };
                }
            }

            const chunkToolCalls = this._extractToolCalls(parts);
            if (chunkToolCalls) {
                allToolCalls.push(...chunkToolCalls);
            }
        }

        if (allToolCalls.length > 0) {
            yield { type: 'tool_calls', toolCalls: allToolCalls };
        }

        const response = await result.response;
        yield {
            type: 'done',
            usage: {
                prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
                completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: response.usageMetadata?.totalTokenCount || 0,
            },
            finishReason: 'stop',
        };
    }

    /**
     * Extract tool calls from response parts, preserving thoughtSignature.
     */
    _extractToolCalls(parts) {
        const functionCallParts = parts.filter(p => p.functionCall);
        if (functionCallParts.length === 0) return null;

        return functionCallParts.map((part, i) => ({
            id: `call_${Date.now()}_${i}`,
            type: 'function',
            function: {
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args || {}),
            },
            // Preserve thought signature for Gemini 3 models
            thoughtSignature: part.thoughtSignature || part.thought_signature || undefined,
        }));
    }

    async listModels() {
        return [
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-2.5-flash-preview-05-20',
            'gemini-2.5-pro-preview-05-06',
            'gemini-3-flash-preview',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
        ];
    }

    _formatMessages(messages) {
        const formatted = [];

        for (const msg of messages) {
            if (msg.role === 'system') continue;

            const role = msg.role === 'assistant' ? 'model' : 'user';

            if (msg.role === 'tool') {
                // Format tool response for Gemini
                formatted.push({
                    role: 'function',
                    parts: [{
                        functionResponse: {
                            name: msg.name || 'tool',
                            response: {
                                name: msg.name || 'tool',
                                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                            },
                        },
                    }],
                });
                continue;
            }

            if (msg.tool_calls) {
                // Assistant message with tool calls
                const parts = [];
                if (msg.content) parts.push({ text: msg.content });

                // If message has 'thought', preserve it in the history
                if (msg.thought) {
                    parts.push({ thought: msg.thought });
                }

                for (const tc of msg.tool_calls) {
                    const part = {
                        functionCall: {
                            name: tc.function.name,
                            args: JSON.parse(tc.function.arguments || '{}'),
                        },
                    };
                    // Pass through thought signature if present
                    if (tc.thoughtSignature) {
                        part.thoughtSignature = tc.thoughtSignature;
                    }
                    parts.push(part);
                }
                formatted.push({ role: 'model', parts });
                continue;
            }

            // Handle image content
            if (Array.isArray(msg.content)) {
                const parts = [];
                for (const part of msg.content) {
                    if (part.type === 'text') {
                        parts.push({ text: part.text });
                    } else if (part.type === 'image_url') {
                        const match = part.image_url.url.match(/^data:(.*?);base64,(.*)$/);
                        if (match) {
                            parts.push({
                                inlineData: {
                                    mimeType: match[1],
                                    data: match[2],
                                },
                            });
                        }
                    }
                }
                formatted.push({ role, parts });
            } else {
                formatted.push({ role, parts: [{ text: msg.content || '' }] });
            }
        }

        if (formatted.length === 0) {
            formatted.push({ role: 'user', parts: [{ text: '' }] });
        }

        return formatted;
    }

    setModel(model) {
        this.model = model;
    }
}

export default GeminiProvider;
