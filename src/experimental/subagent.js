import chalk from 'chalk';
import { execSync } from 'child_process';

/**
 * Experimental: Subagent system.
 * Spawns specialized agents for focused tasks.
 */
class SubagentManager {
    constructor(providerManager, toolExecutor, context) {
        this.providerManager = providerManager;
        this.toolExecutor = toolExecutor;
        this.context = context;
        this.activeAgents = new Map();
    }

    async spawn(name, task, options = {}) {
        console.log(chalk.cyan(`  🤖 Spawning subagent: ${name}`));

        const agentId = `agent_${Date.now()}`;
        const systemPrompt = `You are a specialized subagent named "${name}". Your task is:
${task}

Focus exclusively on this task. Be concise and thorough.
Working directory: ${process.cwd()}`;

        const agent = {
            id: agentId,
            name,
            task,
            status: 'running',
            messages: [{ role: 'user', content: task }],
            createdAt: new Date().toISOString(),
        };

        this.activeAgents.set(agentId, agent);

        try {
            const provider = this.providerManager.provider;
            const tools = this.toolExecutor.getToolDefinitions();

            let iterations = 0;
            const maxIterations = options.maxIterations || 10;

            while (iterations < maxIterations && agent.status === 'running') {
                iterations++;

                const result = await provider.chat(agent.messages, {
                    systemPrompt,
                    tools,
                    temperature: 0.5,
                    maxTokens: 4096,
                });

                if (result.content) {
                    agent.messages.push({ role: 'assistant', content: result.content });
                }

                if (!result.toolCalls || result.toolCalls.length === 0) {
                    agent.status = 'completed';
                    break;
                }

                // Execute tools
                agent.messages.push({ role: 'assistant', content: result.content || '', tool_calls: result.toolCalls });
                const toolResults = await this.toolExecutor.executeToolCalls(result.toolCalls);

                for (const tr of toolResults) {
                    agent.messages.push(tr);
                }
            }

            if (iterations >= maxIterations) {
                agent.status = 'max_iterations';
            }

            console.log(chalk.green(`  ✓ Subagent "${name}" finished (${agent.status})`));
            return {
                id: agentId,
                name,
                status: agent.status,
                result: agent.messages[agent.messages.length - 1]?.content || '',
            };
        } catch (err) {
            agent.status = 'error';
            console.log(chalk.red(`  ✗ Subagent error: ${err.message}`));
            return { id: agentId, name, status: 'error', error: err.message };
        }
    }

    list() {
        return Array.from(this.activeAgents.values()).map(a => ({
            id: a.id,
            name: a.name,
            status: a.status,
            created: a.createdAt,
        }));
    }
}

export default SubagentManager;
