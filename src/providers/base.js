/**
 * Base LLM provider interface.
 * All providers must implement these methods.
 */
class BaseProvider {
    constructor(config) {
        this.config = config;
        this.name = 'base';
        this.model = '';
    }

    /**
     * Send a chat completion request.
     * @param {Array} messages - Conversation messages
     * @param {Object} options - { tools, maxTokens, temperature, stream, systemPrompt }
     * @returns {AsyncGenerator|Object} Streamed chunks or complete response
     */
    async chat(messages, options = {}) {
        throw new Error('chat() must be implemented by provider');
    }

    /**
     * Stream a chat completion, yielding chunks.
     * @param {Array} messages
     * @param {Object} options
     * @yields {{ type: 'text'|'tool_call'|'done', content?, toolCall?, usage? }}
     */
    async *stream(messages, options = {}) {
        throw new Error('stream() must be implemented by provider');
    }

    /**
     * List available models for this provider.
     * @returns {Array<string>}
     */
    async listModels() {
        return [];
    }

    /**
     * Get tool definitions in the provider's expected format.
     * @param {Array} tools - Universal tool definitions
     * @returns {Array} Provider-specific tool format
     */
    formatTools(tools) {
        return tools;
    }

    /**
     * Get display info for this provider.
     */
    getInfo() {
        return { name: this.name, model: this.model };
    }
}

export default BaseProvider;
