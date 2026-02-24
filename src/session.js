import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class Session {
    constructor(config) {
        this.config = config;
        this.sessionsDir = path.join(config.globalConfigDir, 'sessions');
        this.currentSession = null;
        this.messages = [];
        this.checkpoints = [];
    }

    create() {
        this.currentSession = {
            id: uuidv4(),
            name: `session-${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            provider: this.config.get('defaultProvider'),
            cwd: process.cwd(),
        };
        this.messages = [];
        this.checkpoints = [];
        return this.currentSession;
    }

    addMessage(role, content, toolCalls = null, toolResults = null) {
        const msg = {
            role,
            content,
            timestamp: new Date().toISOString(),
        };
        if (toolCalls) msg.toolCalls = toolCalls;
        if (toolResults) msg.toolResults = toolResults;
        this.messages.push(msg);
        return msg;
    }

    /**
     * Replace all messages with a compacted set (used by auto-compaction).
     */
    replaceMessages(messages) {
        this.messages = messages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp || new Date().toISOString(),
            ...(m.toolCalls ? { toolCalls: m.toolCalls } : {}),
            ...(m.tool_calls ? { toolCalls: m.tool_calls } : {}),
            ...(m.toolResults ? { toolResults: m.toolResults } : {}),
        }));
        this.checkpoints = [];
    }

    createCheckpoint(label = null) {
        const checkpoint = {
            id: uuidv4(),
            label: label || `checkpoint-${this.checkpoints.length + 1}`,
            messageIndex: this.messages.length,
            timestamp: new Date().toISOString(),
        };
        this.checkpoints.push(checkpoint);
        return checkpoint;
    }

    rewindTo(checkpointId) {
        const cp = this.checkpoints.find((c) => c.id === checkpointId);
        if (!cp) return false;
        this.messages = this.messages.slice(0, cp.messageIndex);
        this.checkpoints = this.checkpoints.filter(
            (c) => c.messageIndex <= cp.messageIndex
        );
        return true;
    }

    save() {
        if (!this.currentSession) return;
        this.currentSession.updatedAt = new Date().toISOString();
        const sessionFile = path.join(this.sessionsDir, `${this.currentSession.id}.json`);
        const data = {
            session: this.currentSession,
            messages: this.messages,
            checkpoints: this.checkpoints,
        };
        fs.writeFileSync(sessionFile, JSON.stringify(data, null, 2));

        // Also save to local workspace file for auto-resume
        this.saveLocal();
    }

    saveLocal() {
        if (!this.currentSession) return;
        const localFile = path.join(process.cwd(), '.codecli_session.json');
        const data = {
            sessionId: this.currentSession.id,
            updatedAt: this.currentSession.updatedAt,
        };
        fs.writeFileSync(localFile, JSON.stringify(data, null, 2));
    }

    loadLocal() {
        const localFile = path.join(process.cwd(), '.codecli_session.json');
        if (!fs.existsSync(localFile)) return null;

        try {
            const data = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
            if (data.sessionId) {
                return this.load(data.sessionId);
            }
        } catch {
            return null;
        }
        return null;
    }

    load(sessionId) {
        let sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);

        // Exact match
        if (fs.existsSync(sessionFile)) {
            return this._loadFromFile(sessionFile);
        }

        // Partial match
        const sessions = this.listSessions();
        const matches = sessions.filter(s => s.id.startsWith(sessionId));

        if (matches.length > 0) {
            // Sort by updatedAt descending to get the most recent one if multiple match
            const bestMatch = matches.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
            sessionFile = path.join(this.sessionsDir, `${bestMatch.id}.json`);
            return this._loadFromFile(sessionFile);
        }

        return null;
    }

    _loadFromFile(sessionFile) {
        try {
            const data = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
            this.currentSession = data.session;
            this.messages = data.messages || [];
            this.checkpoints = data.checkpoints || [];
            return this.currentSession;
        } catch {
            return null;
        }
    }

    loadLatest() {
        const sessions = this.listSessions();
        if (sessions.length === 0) return null;
        const latest = sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
        return this.load(latest.id);
    }

    listSessions() {
        if (!fs.existsSync(this.sessionsDir)) return [];
        return fs.readdirSync(this.sessionsDir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(this.sessionsDir, f), 'utf-8'));
                    return data.session;
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
    }

    getMessages() {
        return this.messages;
    }

    getConversationForProvider() {
        return this.messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
            ...(m.toolResults ? { tool_call_id: m.toolResults.id, name: m.toolResults.name } : {}),
        }));
    }

    clearMessages() {
        this.messages = [];
        this.checkpoints = [];
    }

    get messageCount() {
        return this.messages.length;
    }
}

export default Session;
