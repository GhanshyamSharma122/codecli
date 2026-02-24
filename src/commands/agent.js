import chalk from 'chalk';

export default {
    name: 'agent',
    description: 'Spawn a subagent for a focused task',
    usage: '/agent <task description>  |  /agent list',
    aliases: ['subagent', 'spawn'],

    async execute(args, { subagentManager }) {
        if (!subagentManager) {
            console.log(chalk.red('  Subagent system not available.'));
            return null;
        }

        const action = args[0]?.toLowerCase();

        if (action === 'list') {
            const agents = subagentManager.list();
            if (agents.length === 0) {
                console.log(chalk.dim('  No subagents have been spawned this session.'));
            } else {
                console.log('');
                console.log(chalk.bold('  Subagents:'));
                agents.forEach(a => {
                    const statusColor = a.status === 'completed' ? chalk.green
                        : a.status === 'running' ? chalk.yellow
                            : a.status === 'error' ? chalk.red
                                : chalk.dim;
                    console.log(`  ${chalk.cyan(a.id.slice(0, 12))}  ${statusColor(a.status.padEnd(12))}  ${a.name}`);
                });
                console.log('');
            }
            return { agents };
        }

        // Spawn a new subagent
        const task = args.join(' ');
        if (!task) {
            console.log(chalk.yellow('  Usage: /agent <task description>'));
            console.log(chalk.dim('  Example: /agent "refactor the login module to use async/await"'));
            return null;
        }

        // Parse name from task if format is "name: task"
        let name = 'worker';
        let taskDescription = task;
        if (task.includes(':')) {
            const colonIdx = task.indexOf(':');
            const possibleName = task.slice(0, colonIdx).trim();
            if (possibleName.length < 30 && !possibleName.includes(' ')) {
                name = possibleName;
                taskDescription = task.slice(colonIdx + 1).trim();
            }
        }

        console.log('');
        const result = await subagentManager.spawn(name, taskDescription);
        console.log('');

        if (result.status === 'completed') {
            console.log(chalk.bold('  Subagent result:'));
            console.log(chalk.dim('  ' + (result.result || 'No output').substring(0, 500)));
        }

        return result;
    },
};
