import chalk from 'chalk';
import SubagentManager from './subagent.js';

class AgentTeams {
    constructor(providerManager, toolExecutor, context, config) {
        this.providerManager = providerManager;
        this.toolExecutor = toolExecutor;
        this.context = context;
        this.config = config;
        this.subagentManager = new SubagentManager(providerManager, toolExecutor, context);
    }

    get enabled() {
        return Boolean(this.config.get('experimental.agentTeams'));
    }

    async runTeam(objective) {
        if (!this.enabled) {
            console.log(chalk.yellow('  Agent Teams is experimental. Enable with `/config set experimental.agentTeams true --global`'));
            return null;
        }

        console.log('');
        console.log(chalk.cyan.bold('  🏢 Agent Team Mode'));
        console.log(chalk.dim(`  Objective: ${objective}`));
        console.log('');

        // Step 1: Lead agent plans the work
        console.log(chalk.cyan('  📋 Lead agent planning...'));

        const planPrompt = `You are a lead agent coordinating a team. Break down this objective into 2-4 specific, independent tasks that can be assigned to worker agents:

Objective: ${objective}

Respond in JSON format:
{
  "tasks": [
    { "name": "agent-name", "task": "specific task description" }
  ]
}`;

        const provider = this.providerManager.provider;
        const result = await provider.chat([{ role: 'user', content: planPrompt }], {
            systemPrompt: 'You are a project planning agent. Respond only in valid JSON.',
            temperature: 0.3,
            maxTokens: 2000,
        });

        let plan;
        try {
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            plan = JSON.parse(jsonMatch[0]);
        } catch {
            console.log(chalk.red('  ✗ Failed to parse plan'));
            return null;
        }

        console.log(chalk.green(`  ✓ Plan: ${plan.tasks.length} tasks`));
        for (const task of plan.tasks) {
            console.log(chalk.dim(`    • ${task.name}: ${task.task.substring(0, 60)}...`));
        }
        console.log('');

        // Step 2: Execute tasks (sequentially for now, could be parallelized)
        const results = [];
        for (const task of plan.tasks) {
            const agentResult = await this.subagentManager.spawn(task.name, task.task, { maxIterations: 8 });
            results.push(agentResult);
        }

        // Step 3: Lead agent summarizes results
        console.log(chalk.cyan('  📝 Lead agent summarizing...'));

        const summaryPrompt = `You coordinated a team to accomplish this objective: ${objective}

Here are the results from each agent:
${results.map(r => `### ${r.name} (${r.status}):\n${r.result || r.error || 'No output'}`).join('\n\n')}

Provide a summary of what was accomplished and any remaining items.`;

        const summary = await provider.chat([{ role: 'user', content: summaryPrompt }], {
            temperature: 0.3,
            maxTokens: 2000,
        });

        console.log('');
        return {
            objective,
            tasks: plan.tasks,
            results,
            summary: summary.content,
        };
    }
}

export default AgentTeams;
