import chalk from 'chalk';

export default {
    name: 'mcp',
    description: 'Manage MCP server connections and tools',
    usage: '/mcp [connect|list|disconnect|tools] [args...]',

    async execute(args, { mcpClient }) {
        if (!mcpClient) {
            console.log(chalk.red('  MCP client not available.'));
            return null;
        }

        if (!mcpClient.enabled) {
            console.log(chalk.yellow('  ⚠ MCP is experimental. Enable with /config set experimental.mcp true --global'));
            return null;
        }

        const action = (args[0] || 'list').toLowerCase();

        switch (action) {
            case 'connect': {
                const name = args[1];
                const url = args[2];
                const transport = args[3] || 'http';

                if (!name || !url) {
                    console.log(chalk.yellow('  Usage: /mcp connect <name> <url> [transport]'));
                    console.log(chalk.dim('  Example: /mcp connect myserver http://localhost:3000 http'));
                    return null;
                }

                const connected = await mcpClient.connect({ name, url, transport });
                return { connected };
            }

            case 'list': {
                const servers = mcpClient.listServers();
                console.log('');
                if (servers.length === 0) {
                    console.log(chalk.dim('  No MCP servers connected.'));
                    console.log(chalk.dim('  Use: /mcp connect <name> <url>'));
                } else {
                    console.log(chalk.bold('  MCP Servers:'));
                    servers.forEach(s => {
                        const statusColor = s.status === 'connected' ? chalk.green : chalk.red;
                        console.log(`  ${chalk.cyan(s.name.padEnd(15))} ${statusColor(s.status.padEnd(12))} ${s.tools} tools  ${chalk.dim(s.url)}`);
                    });
                }
                console.log('');
                return { servers };
            }

            case 'tools': {
                const tools = mcpClient.getToolDefinitions();
                console.log('');
                if (tools.length === 0) {
                    console.log(chalk.dim('  No MCP tools available. Connect to a server first.'));
                } else {
                    console.log(chalk.bold(`  MCP Tools (${tools.length}):`));
                    tools.forEach(t => {
                        console.log(`  ${chalk.cyan(t.name)}`);
                        console.log(chalk.dim(`    ${t.description}`));
                    });
                }
                console.log('');
                return { tools };
            }

            case 'disconnect': {
                const name = args[1];
                if (!name) {
                    console.log(chalk.yellow('  Usage: /mcp disconnect <name>'));
                    return null;
                }
                mcpClient.disconnect(name);
                return { disconnected: name };
            }

            default:
                console.log(chalk.yellow(`  Unknown MCP action: ${action}`));
                console.log(chalk.dim('  Available: connect, list, disconnect, tools'));
                return null;
        }
    },
};
