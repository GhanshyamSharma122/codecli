import chalk from 'chalk';

export default {
    name: 'clear',
    description: 'Clear conversation history and start fresh',
    usage: '/clear',

    async execute(args, { session }) {
        session.clearMessages();
        console.log(chalk.green('  ✓ Conversation cleared'));
        console.log(chalk.dim('  Starting fresh. Your CODECLI.md context is still loaded.'));
        return { cleared: true };
    },
};
