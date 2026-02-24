import fs from 'fs';
import path from 'path';
import { estimateTokens } from './utils/tokens.js';

const CODECLI_MD_FILES = ['CODECLI.md', '.codecli.md', 'codecli.md'];

class Context {
    constructor(config) {
        this.config = config;
        this.maxTokens = 128000; // default, overridden by setMaxTokens()
        this.systemPrompt = '';
        this.projectContext = '';
        this.additionalDirs = [];
        this.tokenUsage = { prompt: 0, completion: 0, total: 0 };
    }

    /**
     * Set max tokens from the provider manager's model detection.
     */
    setMaxTokens(maxTokens) {
        this.maxTokens = maxTokens;
    }

    loadProjectContext(cwd = process.cwd()) {
        const contexts = [];

        // Look for CODECLI.md in project root
        for (const filename of CODECLI_MD_FILES) {
            const filePath = path.join(cwd, filename);
            if (fs.existsSync(filePath)) {
                contexts.push(`# Project Context (${filename})\n${fs.readFileSync(filePath, 'utf-8')}`);
                break;
            }
        }

        // Look for CODECLI.md in home dir (global memory)
        for (const filename of CODECLI_MD_FILES) {
            const globalPath = path.join(this.config.globalConfigDir, filename);
            if (fs.existsSync(globalPath)) {
                contexts.push(`# Global Memory\n${fs.readFileSync(globalPath, 'utf-8')}`);
                break;
            }
        }

        this.projectContext = contexts.join('\n\n---\n\n');
        return this.projectContext;
    }

    buildSystemPrompt(customPrompt = null, appendPrompt = null) {
        const parts = [];

        parts.push(`You are CodeCLI, an AI-powered coding assistant running in the terminal. You are an expert software engineer helping the user with coding tasks.

## Your Capabilities
- Read, write, and edit files in the user's project
- Execute shell commands
- Search code and files
- Analyze images
- Manage project context and memory

## Guidelines
- Be concise but thorough in explanations
- Always show diffs when editing files
- Ask for confirmation before destructive operations
- Use the available tools to complete tasks
- When writing code, follow the project's existing style and conventions
- Provide clear explanations of what you're doing and why

## Current Working Directory
${process.cwd()}

## Operating System
${process.platform} (${process.arch})`);

        if (this.projectContext) {
            parts.push(this.projectContext);
        }

        if (customPrompt) {
            parts.push(`## Custom Instructions\n${customPrompt}`);
        }

        if (appendPrompt) {
            parts.push(appendPrompt);
        }

        this.systemPrompt = parts.join('\n\n');
        return this.systemPrompt;
    }

    updateTokenUsage(prompt, completion) {
        this.tokenUsage.prompt += prompt;
        this.tokenUsage.completion += completion;
        this.tokenUsage.total = this.tokenUsage.prompt + this.tokenUsage.completion;
    }

    getTokenUsage() {
        return { ...this.tokenUsage };
    }

    estimateCurrentUsage(messages) {
        let total = estimateTokens(this.systemPrompt);
        for (const msg of messages) {
            total += estimateTokens(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
        }
        return {
            used: total,
            max: this.maxTokens,
            remaining: this.maxTokens - total,
            percentage: ((total / this.maxTokens) * 100).toFixed(1),
        };
    }

    /**
     * Check if auto-compaction is needed (at 75% of context window).
     */
    needsCompaction(messages) {
        const usage = this.estimateCurrentUsage(messages);
        return parseFloat(usage.percentage) >= 75;
    }

    async compactConversation(messages, provider) {
        const lastN = messages.slice(-4);
        const toSummarize = messages.slice(0, -4);

        if (toSummarize.length < 4) return messages;

        const summaryPrompt = `Summarize the following conversation concisely, preserving key decisions, code changes, and context:\n\n${toSummarize.map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n')}`;

        try {
            const summary = await provider.chat([{ role: 'user', content: summaryPrompt }], {
                maxTokens: 2000,
                stream: false,
            });
            return [
                { role: 'system', content: `## Previous Conversation Summary\n${summary.content}` },
                ...lastN,
            ];
        } catch {
            return messages;
        }
    }

    addDir(dirPath) {
        const resolved = path.resolve(dirPath);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            this.additionalDirs.push(resolved);
            return true;
        }
        return false;
    }

    getAdditionalDirs() {
        return [...this.additionalDirs];
    }
}

export default Context;
