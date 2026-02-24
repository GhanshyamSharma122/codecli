import chalk from 'chalk';

/**
 * Experimental: Model Context Protocol (MCP) Client.
 * Connects to MCP servers for external tool integration.
 */
class MCPClient {
    constructor(config) {
        this.config = config;
        this.servers = new Map();
        this.tools = new Map();
    }

    get enabled() {
        return process.env.CODECLI_EXPERIMENTAL_MCP === '1';
    }

    async connect(serverConfig) {
        if (!this.enabled) {
            console.log(chalk.yellow('  MCP is experimental. Enable with CODECLI_EXPERIMENTAL_MCP=1'));
            return false;
        }

        const { name, url, transport = 'stdio' } = serverConfig;

        console.log(chalk.cyan(`  🔌 Connecting to MCP server: ${name} (${url})`));

        try {
            if (transport === 'http' || transport === 'sse') {
                // HTTP/SSE transport
                const response = await fetch(`${url}/tools`, {
                    headers: { 'Content-Type': 'application/json' },
                });

                if (!response.ok) throw new Error(`Server responded with ${response.status}`);

                const data = await response.json();
                const serverTools = data.tools || [];

                this.servers.set(name, { url, transport, status: 'connected', tools: serverTools });

                for (const tool of serverTools) {
                    this.tools.set(`${name}.${tool.name}`, {
                        server: name,
                        ...tool,
                    });
                }

                console.log(chalk.green(`  ✓ Connected to ${name}: ${serverTools.length} tools available`));
                return true;
            }

            // Stdio transport placeholder
            console.log(chalk.yellow(`  ⚠ Stdio transport not yet implemented for MCP`));
            return false;
        } catch (err) {
            console.log(chalk.red(`  ✗ Failed to connect: ${err.message}`));
            this.servers.set(name, { url, transport, status: 'error', error: err.message });
            return false;
        }
    }

    async callTool(fullName, args) {
        const tool = this.tools.get(fullName);
        if (!tool) throw new Error(`MCP tool not found: ${fullName}`);

        const server = this.servers.get(tool.server);
        if (!server || server.status !== 'connected') {
            throw new Error(`MCP server not connected: ${tool.server}`);
        }

        const response = await fetch(`${server.url}/tools/${tool.name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arguments: args }),
        });

        if (!response.ok) throw new Error(`Tool call failed: ${response.status}`);
        return response.json();
    }

    getToolDefinitions() {
        return Array.from(this.tools.values()).map(tool => ({
            name: `mcp_${tool.server}_${tool.name}`,
            description: `[MCP:${tool.server}] ${tool.description || tool.name}`,
            parameters: tool.inputSchema || tool.parameters || { type: 'object', properties: {} },
        }));
    }

    listServers() {
        return Array.from(this.servers.entries()).map(([name, server]) => ({
            name,
            url: server.url,
            status: server.status,
            tools: server.tools?.length || 0,
        }));
    }

    disconnect(name) {
        const server = this.servers.get(name);
        if (server) {
            // Remove associated tools
            for (const [key, tool] of this.tools) {
                if (tool.server === name) this.tools.delete(key);
            }
            this.servers.delete(name);
            console.log(chalk.dim(`  Disconnected from ${name}`));
        }
    }
}

export default MCPClient;
