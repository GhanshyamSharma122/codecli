/**
 * Approximate token counting for context window management.
 * Uses the ~4 chars per token heuristic for English text.
 */

export function estimateTokens(text) {
    if (!text) return 0;
    // Rough estimation: ~4 characters per token for English
    // This is a simplification; real tokenizers are model-specific
    return Math.ceil(text.length / 4);
}

export function estimateMessagesTokens(messages) {
    let total = 0;
    for (const msg of messages) {
        total += 4; // message overhead
        if (typeof msg.content === 'string') {
            total += estimateTokens(msg.content);
        } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
                if (part.type === 'text') {
                    total += estimateTokens(part.text);
                } else if (part.type === 'image_url') {
                    total += 85; // base image token cost
                }
            }
        }
        if (msg.role) total += estimateTokens(msg.role);
        if (msg.tool_calls) total += estimateTokens(JSON.stringify(msg.tool_calls));
    }
    return total;
}

export function formatTokenCount(count) {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
}
