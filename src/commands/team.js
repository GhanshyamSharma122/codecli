import chalk from 'chalk';

export default {
    name: 'team',
    description: 'Run an agent team — a lead agent coordinates workers on a complex objective',
    usage: '/team <objective>',

    async execute(args, { agentTeams }) {
        if (!agentTeams) {
            console.log(chalk.red('  Agent teams not available.'));
            return null;
        }

        const objective = args.join(' ');
        if (!objective) {
            console.log(chalk.yellow('  Usage: /team <objective>'));
            console.log(chalk.dim('  Example: /team "add user auth with login, register, and profile pages"'));
            console.log('');
            if (!agentTeams.enabled) {
                console.log(chalk.yellow('  ⚠ Agent Teams is experimental.'));
                console.log(chalk.dim('  Enable with: set CODECLI_EXPERIMENTAL_AGENT_TEAMS=1 in .env'));
            }
            return null;
        }

        if (!agentTeams.enabled) {
            console.log(chalk.yellow('  ⚠ Agent Teams is experimental. Enable with CODECLI_EXPERIMENTAL_AGENT_TEAMS=1'));
            return null;
        }

        console.log('');
        const result = await agentTeams.runTeam(objective);
        console.log('');

        if (result?.summary) {
            console.log(chalk.bold('  📋 Team summary:'));
            console.log('  ' + result.summary);
            console.log('');
        }

        return result;
    },
};
