import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Renderer from './renderer.js';
import Spinner from './spinner.js';
import theme from './theme.js';
import AutocompleteInput from './autocomplete.js';

class REPL {
    constructor({ providerManager, toolExecutor, session, context, commands, config, permissions,
        subagentManager, agentTeams, mcpClient, git, skillsManager }) {
        this.providerManager = providerManager;
        this.toolExecutor = toolExecutor;
        this.session = session;
        this.context = context;
        this.commands = commands;
        this.config = config;
        this.permissions = permissions;
        this.renderer = new Renderer();
        this.spinner = new Spinner();
        this.running = false;
        this.inputHistory = [];
        this.ultrathink = false;
        this.turnCount = 0;
        this._keepAlive = null;
        this._shutdownCalled = false;

        // Experimental features
        this.subagentManager = subagentManager || null;
        this.agentTeams = agentTeams || null;
        this.mcpClient = mcpClient || null;
        this.git = git || null;
        this.skillsManager = skillsManager || null;

        // Autocomplete input handler
        this.autocomplete = null;

        // Auto-resume feedback
        this.resumedLocal = false;
    }

    async start(initialPrompt = null) {
        this.running = true;

        // Prevent silent crashes
        process.on('uncaughtException', (err) => {
            console.error(chalk.red(`\n  Uncaught error: ${err.message}`));
        });
        process.on('unhandledRejection', (err) => {
            console.error(chalk.red(`\n  Unhandled rejection: ${err?.message || err}`));
        });

        // Initialize session
        if (!this.session.currentSession) {
            this.session.create();
            this.context.loadProjectContext();
            this.context.setMaxTokens(this.providerManager.getMaxTokens());
            this.context.buildSystemPrompt();
        } else {
            // Adjust max tokens for existing session
            this.context.setMaxTokens(this.providerManager.getMaxTokens());
            // Ensure system prompt is built if it was resumed without one or needs refresh
            if (!this.context.systemPrompt) {
                this.context.buildSystemPrompt();
            }
        }

        // Inject active skills
        if (this.skillsManager) {
            const skillsPrompt = this.skillsManager.getActiveSkillsPrompt();
            if (skillsPrompt) {
                this.context.buildSystemPrompt(null, skillsPrompt);
            }
        }

        // Build autocomplete with all registered commands
        const allCmds = this.commands.getCommands();
        this.autocomplete = new AutocompleteInput(allCmds);

        // Show welcome
        const tokenInfo = `${this.providerManager.getMaxTokensDisplay()} context window`;
        await this.renderer.renderWelcome(this.providerManager.getStatusDisplay(), tokenInfo);

        if (this.resumedLocal) {
            const { gutterStr } = theme.layout || { gutterStr: '  ' };
            process.stdout.write(`${gutterStr}${chalk.hex('#A3E635')('✦ Resumed local workspace session')} ${chalk.hex('#475569')(`(${this.session.currentSession.id.slice(0, 8)})`)}\n`);
            process.stdout.write(`${gutterStr}${chalk.hex('#64748B')('Tip: Add .codecli_session.json to your .gitignore')}\n\n`);
        }

        this._showExperimentalStatus();

        // Handle initial prompt
        if (initialPrompt) {
            await this.processInput(initialPrompt);
        }

        // Start REPL loop
        await this.loop();
    }

    _showExperimentalStatus() {
        const features = [];
        if (this.git?.isGitRepo) features.push(chalk.hex('#A3E635')('● git'));
        if (this.subagentManager) features.push(chalk.hex('#A3E635')('● subagents'));
        if (this.agentTeams?.enabled) features.push(chalk.hex('#A3E635')('● teams'));
        else if (this.agentTeams) features.push(chalk.hex('#475569')('○ teams'));
        if (this.mcpClient?.enabled) features.push(chalk.hex('#A3E635')('● mcp'));
        else if (this.mcpClient) features.push(chalk.hex('#475569')('○ mcp'));
        if (this.skillsManager) {
            const count = this.skillsManager.list().length;
            if (count > 0) features.push(chalk.hex('#A3E635')(`● ${count} skills`));
            else features.push(chalk.hex('#475569')('○ skills'));
        }
        if (features.length > 0) {
            const { gutterStr } = theme.layout;
            process.stdout.write(`${gutterStr}${chalk.hex('#64748B')('Features')}   ${features.join(chalk.hex('#475569')(' · '))}\n\n`);
        }
    }

    _getPromptString() {
        const info = this.providerManager.getInfo();
        const { gutterStr } = theme.layout;
        const color = theme.providerColors[info.provider] || chalk.white;
        const separator = chalk.hex('#475569')(theme.symbols.dot);
        const indicator = `${color(theme.symbols.bullet)} ${chalk.hex('#64748B')(info.provider)} ${separator} ${chalk.hex('#94A3B8')(info.model)}`;
        return `\n${gutterStr}${indicator}\n`;
    }

    async loop() {
        // Keepalive prevents Node from exiting between questions
        this._keepAlive = setInterval(() => { }, 30000);

        while (this.running) {
            const promptStr = this._getPromptString();
            process.stdout.write(promptStr);

            // Use custom autocomplete input handler
            const input = await this.autocomplete.ask('');
            const trimmed = input.trim();

            if (!trimmed) continue;

            this.inputHistory.push(trimmed);

            try {
                await this.processInput(trimmed);
            } catch (err) {
                await this.renderer.renderError(err);
            }
        }

        this.shutdown();
    }

    async processInput(input) {
        if (['exit', 'quit', '/exit', '/quit'].includes(input.toLowerCase())) {
            this.running = false;
            return;
        }

        if (input.startsWith('!')) {
            const command = input.slice(1).trim();
            if (command) {
                const { gutterStr } = theme.layout;
                if (await this.permissions.checkExecute(command)) {
                    this.renderer.renderStatus({ provider: 'shell', tokens: command });
                    const { execSync } = await import('child_process');
                    try {
                        const output = execSync(command, { encoding: 'utf-8' });
                        process.stdout.write('\n' + output.split('\n').map(l => gutterStr + l).join('\n') + '\n');
                    } catch (err) {
                        await this.renderer.renderError(err);
                    }
                }
            }
            return;
        }

        if (input.startsWith('/')) {
            const ctx = {
                session: this.session,
                context: this.context,
                providerManager: this.providerManager,
                toolExecutor: this.toolExecutor,
                commands: this.commands,
                config: this.config,
                cwd: process.cwd(),
                subagentManager: this.subagentManager,
                agentTeams: this.agentTeams,
                mcpClient: this.mcpClient,
                git: this.git,
                skillsManager: this.skillsManager,
            };

            const result = await this.commands.execute(input, ctx);
            if (result?.reviewPrompt) {
                await this.chat(result.reviewPrompt);
            }
            if (input.startsWith('/model')) {
                this.context.setMaxTokens(this.providerManager.getMaxTokens());
            }
            return;
        }

        if (input.startsWith('>') && input.toLowerCase().includes('ultrathink')) {
            this.ultrathink = true;
            const { gutterStr } = theme.layout;
            process.stdout.write(`${gutterStr}${chalk.hex('#FBBF24')('🧠 Extended thinking enabled for next response')}\n`);
            return;
        }

        const expandedInput = await this._expandFileReferences(input);

        if (this.skillsManager) {
            const activated = this.skillsManager.autoActivate(expandedInput);
            if (activated.length > 0) {
                const { gutterStr } = theme.layout;
                process.stdout.write(gutterStr);
                await this.renderer.renderMarkdown(`${theme.symbols.sparkle} Auto-activated skills: ${activated.join(', ')}`);
                console.log('');
                const skillsPrompt = this.skillsManager.getActiveSkillsPrompt();
                this.context.buildSystemPrompt(null, skillsPrompt);
            }
        }

        await this.chat(expandedInput);
    }

    async chat(userMessage) {
        this.turnCount++;
        this.session.addMessage('user', userMessage);

        if (this.session.messageCount % 10 === 0) {
            this.session.createCheckpoint();
        }

        let messages = this.session.getConversationForProvider();
        const tools = this.toolExecutor.getToolDefinitions();

        if (this.context.needsCompaction(messages)) {
            await this.renderer.renderCompacting();
            const beforeCount = messages.length;
            messages = await this.context.compactConversation(messages, this.providerManager.provider);
            this.renderer.renderCompacted(beforeCount, messages.length);
            this.session.replaceMessages(messages);
        }

        const options = {
            systemPrompt: this.context.systemPrompt,
            tools,
            temperature: this.ultrathink ? 0.9 : parseFloat(this.config.get('temperature')) || 0.7,
            maxTokens: this.ultrathink ? 8192 : 4096,
            stream: true,
        };
        this.ultrathink = false;

        await this._agentLoop(messages, options);
        this.session.save();

        if (this.turnCount % 3 === 0) {
            const usage = this.context.estimateCurrentUsage(messages);
            this.renderer.renderTokenUsage(usage);
        }
    }

    async _agentLoop(messages, options) {
        let iterations = 0;
        const maxIterations = this.permissions.godMode ? 1000 : 25;

        while (iterations < maxIterations) {
            iterations++;
            this.spinner.thinking();

            let fullContent = '';
            let fullThought = '';
            let toolCalls = null;

            try {
                this.spinner.stop();
                console.log('');

                const provider = this.providerManager.provider;
                for await (const chunk of provider.stream(messages, options)) {
                    switch (chunk.type) {
                        case 'text':
                            this.renderer.streamChunk(chunk.content);
                            fullContent += chunk.content;
                            break;
                        case 'thought':
                            this.renderer.streamThought(chunk.content);
                            fullThought += chunk.content;
                            break;
                        case 'tool_calls':
                            toolCalls = chunk.toolCalls;
                            break;
                        case 'done':
                            if (chunk.usage) {
                                this.context.updateTokenUsage(chunk.usage.prompt_tokens || 0, chunk.usage.completion_tokens || 0);
                            }
                            break;
                    }
                }
                this.renderer.endStream();
                this.renderer.endStreamThought();

            } catch (err) {
                this.spinner.stop();
                try {
                    const provider = this.providerManager.provider;
                    const result = await provider.chat(messages, { ...options, stream: false });
                    fullContent = result.content;
                    toolCalls = result.toolCalls;
                    if (result.usage) {
                        this.context.updateTokenUsage(result.usage.prompt_tokens || 0, result.usage.completion_tokens || 0);
                    }
                    if (fullContent) {
                        console.log('');
                        this.renderer.renderMarkdown(fullContent);
                    }
                } catch (fallbackErr) {
                    await this.renderer.renderError(fallbackErr);
                    return;
                }
            }

            if (!toolCalls || toolCalls.length === 0) {
                if (fullContent || fullThought) {
                    this.session.addMessage('assistant', fullContent, null, { thought: fullThought });
                }
                break;
            }

            this.session.addMessage('assistant', fullContent || '', toolCalls, { thought: fullThought });
            messages.push({ role: 'assistant', content: fullContent || '', tool_calls: toolCalls, thought: fullThought });

            console.log('');
            console.log(theme.separator('Tool Execution'));

            const toolResults = await this.toolExecutor.executeToolCalls(toolCalls);
            for (const result of toolResults) {
                this.session.addMessage('tool', result.content, null, { id: result.tool_call_id, name: result.name });
                messages.push(result);
            }

            console.log(theme.separator());
            console.log('');

            if (this.context.needsCompaction(messages)) {
                await this.renderer.renderCompacting();
                const beforeCount = messages.length;
                messages = await this.context.compactConversation(messages, this.providerManager.provider);
                this.renderer.renderCompacted(beforeCount, messages.length);
            }
        }

        if (iterations >= maxIterations) {
            const { gutterStr } = theme.layout;
            process.stdout.write(`\n${gutterStr}${chalk.hex('#FBBF24')('⚠ Maximum tool iterations reached.')}\n`);
        }
    }

    async _expandFileReferences(input) {
        const fileRefRegex = /@([\w.\/\\-]+)/g;
        let expanded = input;
        let match;
        while ((match = fileRefRegex.exec(input)) !== null) {
            const filePath = match[1];
            const resolved = path.resolve(process.cwd(), filePath);
            if (fs.existsSync(resolved)) {
                try {
                    const content = fs.readFileSync(resolved, 'utf-8');
                    const truncated = content.length > 10000 ? content.substring(0, 10000) + '\n... (truncated)' : content;
                    expanded = expanded.replace(match[0], `\n\n--- File: ${filePath} ---\n\`\`\`\n${truncated}\n\`\`\`\n`);
                } catch { /* keep original */ }
            }
        }
        return expanded;
    }

    shutdown() {
        if (this._shutdownCalled) return;
        this._shutdownCalled = true;
        this.running = false;

        if (this._keepAlive) {
            clearInterval(this._keepAlive);
            this._keepAlive = null;
        }

        const { gutterStr } = theme.layout;
        process.stdout.write('\n' + gutterStr + chalk.hex('#64748B')('Saving session...') + '\n');
        this.session.save();

        const usage = this.context.getTokenUsage();
        if (usage.total > 0) {
            process.stdout.write(gutterStr + chalk.hex('#64748B')(`Session: ${usage.total.toLocaleString()} tokens used`) + '\n');
        }

        process.stdout.write('\n' + gutterStr + chalk.hex('#A78BFA').bold(`${theme.symbols.sparkle} Goodbye!`) + '\n\n');
        process.exit(0);
    }
}

export default REPL;
