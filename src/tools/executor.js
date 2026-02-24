import chalk from 'chalk';
import ora from 'ora';
import fileRead from './file-read.js';
import fileWrite from './file-write.js';
import fileSearch from './file-search.js';
import codeSearch from './code-search.js';
import terminal from './terminal.js';
import listDir from './list-dir.js';

// Tool icons for beautiful output
const TOOL_ICONS = {
    read_file: '📄',
    write_file: '✏️',
    file_search: '🔍',
    code_search: '🔎',
    run_command: '⚡',
    list_directory: '📁',
};

class ToolExecutor {
    constructor(permissions) {
        this.permissions = permissions;
        this.tools = new Map();
        this.cwd = process.cwd();

        // Register all built-in tools
        this.register(fileRead);
        this.register(fileWrite);
        this.register(fileSearch);
        this.register(codeSearch);
        this.register(terminal);
        this.register(listDir);
    }

    register(tool) {
        this.tools.set(tool.name, tool);
    }

    getToolDefinitions() {
        return Array.from(this.tools.values()).map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }));
    }

    async executeTool(name, args) {
        const tool = this.tools.get(name);
        if (!tool) {
            return { error: `Unknown tool: ${name}` };
        }

        const icon = TOOL_ICONS[name] || '🔧';
        const startTime = Date.now();

        try {
            const context = {
                permissions: this.permissions,
                cwd: this.cwd,
            };

            // Display with icon and themed colors
            console.log(
                `  ${icon} ${chalk.hex('#22D3EE').bold(name)} ${chalk.hex('#475569')(this._summarizeArgs(name, args))}`
            );

            const result = await tool.execute(args, context);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            if (result.error) {
                console.log(`     ${chalk.hex('#FB7185')('✗')} ${chalk.hex('#FCA5A5')(result.error)} ${chalk.hex('#475569')(`(${duration}s)`)}`);
            } else {
                // Show condensed success info
                const info = this._resultInfo(name, result);
                if (info) {
                    console.log(`     ${chalk.hex('#A3E635')('✓')} ${chalk.hex('#94A3B8')(info)} ${chalk.hex('#475569')(`(${duration}s)`)}`);
                }
            }

            return result;
        } catch (err) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`     ${chalk.hex('#FB7185')('✗')} ${chalk.hex('#FCA5A5')(err.message)} ${chalk.hex('#475569')(`(${duration}s)`)}`);
            return { error: err.message };
        }
    }

    async executeToolCalls(toolCalls) {
        const results = [];

        for (const tc of toolCalls) {
            const name = tc.function.name;
            let args;

            try {
                args = JSON.parse(tc.function.arguments || '{}');
            } catch {
                args = {};
            }

            const result = await this.executeTool(name, args);

            results.push({
                role: 'tool',
                content: JSON.stringify(result),
                tool_call_id: tc.id,
                name: name,
            });
        }

        return results;
    }

    _summarizeArgs(toolName, args) {
        switch (toolName) {
            case 'read_file':
                return args.path || '';
            case 'write_file':
                return `${args.path || ''} (${args.mode || 'write'})`;
            case 'file_search':
                return args.pattern || '';
            case 'code_search':
                return `"${args.query || ''}"`;
            case 'run_command':
                return args.command || '';
            case 'list_directory':
                return args.path || '.';
            default:
                return JSON.stringify(args).substring(0, 60);
        }
    }

    _resultInfo(toolName, result) {
        switch (toolName) {
            case 'read_file':
                return result.content ? `${result.totalLines || '?'} lines` : null;
            case 'write_file':
                return result.success ? 'written' : null;
            case 'file_search':
                return result.matches ? `${result.matches.length} matches` : null;
            case 'code_search':
                return result.matches ? `${result.matches.length} results` : null;
            case 'run_command':
                return result.stdout ? `${result.stdout.split('\n').length} lines output` : 'completed';
            case 'list_directory':
                return result.entries ? `${result.entries.length} entries` : null;
            default:
                return null;
        }
    }

    setCwd(cwd) {
        this.cwd = cwd;
    }
}

export default ToolExecutor;
