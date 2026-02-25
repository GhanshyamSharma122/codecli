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
import chalk from 'chalk';
import {
    getReadyProviders,
    promptForProviderFields,
    promptForProviderSelection,
} from './utils/provider-setup.js';

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
        this.agentTeams = new AgentTeams(this.providerManager, this.toolExecutor, this.context, this.config);
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
        await this.ensureProviderConfig({ interactive: true });
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
        await this.ensureProviderConfig({ interactive: false });
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

    async ensureProviderConfig({ interactive }) {
        const ready = this._readyProviders();
        if (ready.length > 0) {
            if (!ready.includes(this.providerManager.currentProvider)) {
                this.providerManager.switchProvider(ready[0]);
            }
            return;
        }

        if (!interactive || !process.stdin.isTTY) {
            throw new Error(
                'No AI provider is configured. Use `codecli config set providers.<provider>.<field> <value> --global` to configure one before running.'
            );
        }

        await this._onboardProvider();
    }

    _readyProviders() {
        return getReadyProviders(this.config);
    }

    async _onboardProvider() {
        console.log(chalk.cyan('\nNo provider credentials were found. Let’s configure one to continue.'));
        while (this._readyProviders().length === 0) {
            const provider = await promptForProviderSelection(chalk.cyan('Choose a provider (use arrow keys or press 1/2/3):'));
            await promptForProviderFields(this.config, provider);
            this.providerManager.refreshProviders();
        }

        const ready = this._readyProviders();
        if (ready.length === 0) {
            throw new Error('No provider could be configured.');
        }

        const chosen = ready[0];
        this.providerManager.switchProvider(chosen);
        this.config.set('defaultProvider', chosen, 'global');
        console.log(chalk.green(`  ✓ ${chosen} is now the default provider.`));
    }
}
