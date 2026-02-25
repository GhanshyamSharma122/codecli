#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
    .name('codecli')
    .description('AI-powered coding assistant CLI with Azure OpenAI, Ollama & Gemini')
    .version(pkg.version)
    .argument('[prompt]', 'Initial prompt to start with')
    .option('-c, --continue', 'Continue the most recent conversation')
    .option('-r, --resume <session-id>', 'Resume a specific session by ID')
    .option('-m, --model <model>', 'Specify the model to use')
    .option('-p, --provider <provider>', 'Specify the provider (azure-openai, ollama, gemini)')
    .option('--system-prompt <prompt>', 'Set a custom system prompt')
    .option('--system-prompt-file <file>', 'Load system prompt from a file')
    .option('--append-system-prompt <prompt>', 'Append to the system prompt')
    .option('--output-format <format>', 'Output format: text or json', 'text')
    .option('--add-dir <dirs...>', 'Add additional working directories')
    .option('--think', 'Enable extended thinking mode')
    .option('--image <path>', 'Include an image for analysis')
    .option('--headless', 'Run in headless (non-interactive) mode')
    .option('--god-mode', 'Auto-approve all file/folder operations in the working directory')
    .option('--verbose', 'Enable verbose logging')
    .action(async (prompt, options) => {
        try {
            const { default: CodeCLI } = await import('../src/index.js');

            let systemPrompt = options.systemPrompt || null;
            if (options.systemPromptFile) {
                const filePath = path.resolve(options.systemPromptFile);
                if (fs.existsSync(filePath)) {
                    systemPrompt = fs.readFileSync(filePath, 'utf-8');
                } else {
                    console.error(chalk.red(`System prompt file not found: ${filePath}`));
                    process.exit(1);
                }
            }
            if (options.appendSystemPrompt) {
                systemPrompt = (systemPrompt || '') + '\n' + options.appendSystemPrompt;
            }

            if (options.verbose) {
                process.env.LOG_LEVEL = 'debug';
            }

            const cli = new CodeCLI({
                provider: options.provider,
                model: options.model,
                systemPrompt,
                addDirs: options.addDir,
                godMode: options.godMode,
            });

            if (options.continue) {
                await cli.continueSession();
            } else if (options.resume) {
                await cli.resumeSession(options.resume);
            } else if (options.headless && prompt) {
                const result = await cli.runHeadless(prompt, {
                    outputFormat: options.outputFormat,
                    systemPrompt,
                });
                console.log(result);
            } else {
                if (options.think) {
                    process.env.CODECLI_THINK = '1';
                }

                if (options.image) {
                    const imagePath = path.resolve(options.image);
                    if (fs.existsSync(imagePath)) {
                        const imageData = fs.readFileSync(imagePath);
                        const base64 = imageData.toString('base64');
                        const ext = path.extname(imagePath).slice(1);
                        const mimeType = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/png';

                        if (prompt) {
                            prompt = JSON.stringify([
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                            ]);
                        }
                    } else {
                        console.error(chalk.red(`Image not found: ${imagePath}`));
                        process.exit(1);
                    }
                }

                await cli.startInteractive(prompt);
            }
        } catch (err) {
            console.error(chalk.red(`\n  Error: ${err.message}`));
            if (options.verbose) console.error(err.stack);
            process.exit(1);
        }
    });

// Sub-commands
program
    .command('config')
    .description('Manage configuration')
    .argument('[action]', 'Action: list, set, get', 'list')
    .argument('[key]', 'Config key')
    .argument('[value]', 'Config value')
    .option('--global', 'Set globally')
    .action(async (action, key, value, options) => {
        const { default: Config } = await import('../src/config.js');
        const config = new Config();

        switch (action) {
            case 'list':
                console.log(JSON.stringify(config.list(), null, 2));
                break;
            case 'get':
                console.log(config.get(key));
                break;
            case 'set':
                try { value = JSON.parse(value); } catch { }
                config.set(key, value, options.global ? 'global' : 'project');
                console.log(chalk.green(`Set ${key} = ${JSON.stringify(value)}`));
                break;
        }
    });

program
    .command('sessions')
    .description('List saved sessions')
    .action(async () => {
        const { default: Config } = await import('../src/config.js');
        const { default: Session } = await import('../src/session.js');
        const config = new Config();
        const session = new Session(config);
        const sessions = session.listSessions();

        if (sessions.length === 0) {
            console.log(chalk.dim('No saved sessions.'));
            return;
        }

        console.log(chalk.bold('\nSaved Sessions:\n'));
        for (const s of sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))) {
            console.log(`  ${chalk.cyan(s.id.substring(0, 8))}  ${chalk.dim(s.updatedAt)}  ${s.provider}  ${chalk.dim(s.cwd)}`);
        }
        console.log('');
    });

program
    .command('mcp')
    .description('Manage MCP server connections')
    .argument('[action]', 'Action: connect, list, disconnect')
    .argument('[name]', 'Server name')
    .argument('[url]', 'Server URL')
    .action(async (action, name, url) => {
        const { default: MCPClient } = await import('../src/experimental/mcp.js');
        const { default: Config } = await import('../src/config.js');
        const mcp = new MCPClient(new Config());

        switch (action) {
            case 'connect':
                await mcp.connect({ name, url });
                break;
            case 'list':
                const servers = mcp.listServers();
                if (servers.length === 0) {
                    console.log(chalk.dim('No MCP servers connected.'));
                } else {
                    servers.forEach(s => console.log(`  ${s.name} (${s.status}) - ${s.tools} tools`));
                }
                break;
            case 'disconnect':
                mcp.disconnect(name);
                break;
            default:
                console.log('Usage: codecli mcp [connect|list|disconnect] [name] [url]');
        }
    });

program.parse();
