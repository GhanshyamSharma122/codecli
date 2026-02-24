import Config from './config.js';
import Session from './session.js';
import Context from './context.js';
import Permissions from './permissions.js';
import ProviderManager from './providers/manager.js';
import ToolExecutor from './tools/executor.js';
import CommandRegistry from './commands/index.js';
import REPL from './ui/repl.js';
import SubagentManager from './experimental/subagent.js';
import AgentTeams from './experimental/agent-teams.js';
import MCPClient from './experimental/mcp.js';
import GitIntegration from './experimental/git-integration.js';
import SkillsManager from './skills.js';

export default class CodeCLI {
    constructor(options = {}) {
        this.config = new Config();
        this.session = new Session(this.config);
        this.context = new Context(this.config);
        this.permissions = new Permissions(this.config);
        this.providerManager = new ProviderManager(this.config);
        this.toolExecutor = new ToolExecutor(this.permissions);
        this.commands = new CommandRegistry();

        // Experimental features
        this.subagentManager = new SubagentManager(this.providerManager, this.toolExecutor, this.context);
        this.agentTeams = new AgentTeams(this.providerManager, this.toolExecutor, this.context);
        this.mcpClient = new MCPClient(this.config);
        this.git = new GitIntegration();

        // Skills system
        this.skillsManager = new SkillsManager(this.config);
        this.skillsManager.discover();

        // Merge MCP tools into the tool executor when MCP is enabled
        if (this.mcpClient.enabled) {
            this._registerMCPTools();
        }

        // Apply options
        if (options.provider) this.providerManager.switchProvider(options.provider);
        if (options.model) this.providerManager.switchModel(options.model);
        if (options.systemPrompt) this.context.buildSystemPrompt(options.systemPrompt);
        if (options.addDirs) options.addDirs.forEach(d => this.context.addDir(d));
        if (options.godMode) this.permissions.enableGodMode();
    }

    _registerMCPTools() {
        const mcpClient = this.mcpClient;
        const mcpToolDefs = mcpClient.getToolDefinitions();

        for (const def of mcpToolDefs) {
            this.toolExecutor.register({
                name: def.name,
                description: def.description,
                parameters: def.parameters,
                async execute(args) {
                    try {
                        const parts = def.name.replace('mcp_', '').split('_');
                        const serverName = parts[0];
                        const toolName = parts.slice(1).join('_');
                        const fullName = `${serverName}.${toolName}`;
                        const result = await mcpClient.callTool(fullName, args);
                        return result;
                    } catch (err) {
                        return { error: err.message };
                    }
                },
            });
        }
    }

    async startInteractive(initialPrompt = null) {
        // Attempt auto-resume if no session is currently loaded
        let resumed = false;
        if (!this.session.currentSession) {
            const localSession = this.session.loadLocal();
            if (localSession) {
                resumed = true;
            }
        }

        const repl = new REPL({
            providerManager: this.providerManager,
            toolExecutor: this.toolExecutor,
            session: this.session,
            context: this.context,
            commands: this.commands,
            config: this.config,
            permissions: this.permissions,
            subagentManager: this.subagentManager,
            agentTeams: this.agentTeams,
            mcpClient: this.mcpClient,
            git: this.git,
            skillsManager: this.skillsManager,
        });

        if (resumed) {
            repl.resumedLocal = true;
        }

        await repl.start(initialPrompt);
    }

    async runHeadless(prompt, options = {}) {
        this.session.create();
        this.context.loadProjectContext();
        this.context.buildSystemPrompt(options.systemPrompt);

        this.session.addMessage('user', prompt);
        const messages = this.session.getConversationForProvider();
        const tools = this.toolExecutor.getToolDefinitions();

        let result;
        let iterations = 0;
        const maxIterations = this.permissions.godMode ? 1000 : (options.maxIterations || 15);

        while (iterations < maxIterations) {
            iterations++;

            result = await this.providerManager.provider.chat(messages, {
                systemPrompt: this.context.systemPrompt,
                tools,
                temperature: 0.7,
                maxTokens: 4096,
            });

            if (!result.toolCalls || result.toolCalls.length === 0) break;

            messages.push({ role: 'assistant', content: result.content || '', tool_calls: result.toolCalls });
            const toolResults = await this.toolExecutor.executeToolCalls(result.toolCalls);
            messages.push(...toolResults);
        }

        if (options.outputFormat === 'json') {
            return JSON.stringify({
                content: result?.content || '',
                usage: result?.usage,
                session: this.session.currentSession?.id,
            });
        }

        return result?.content || '';
    }

    async continueSession() {
        const loaded = this.session.loadLatest();
        if (!loaded) {
            throw new Error('No previous session found');
        }
        return this.startInteractive();
    }

    async resumeSession(sessionId) {
        const loaded = this.session.load(sessionId);
        if (!loaded) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        return this.startInteractive();
    }
}
