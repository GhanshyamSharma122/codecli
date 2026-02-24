import chalk from 'chalk';
import inquirer from 'inquirer';

export default {
    name: 'rewind',
    description: 'Rewind conversation to a previous checkpoint',
    usage: '/rewind [checkpoint-id]',

    async execute(args, { session }) {
        const checkpoints = session.checkpoints;

        if (checkpoints.length === 0) {
            console.log(chalk.yellow('  No checkpoints available.'));
            console.log(chalk.dim('  Checkpoints are created automatically during the conversation.'));
            return;
        }

        let targetId;

        if (args.length > 0) {
            targetId = args[0];
        } else {
            // Interactive selection
            const { checkpoint } = await inquirer.prompt([{
                type: 'list',
                name: 'checkpoint',
                message: 'Select checkpoint to rewind to:',
                choices: checkpoints.map(cp => ({
                    name: `${cp.label} (${cp.timestamp}) - ${cp.messageIndex} messages`,
                    value: cp.id,
                })).reverse(),
            }]);
            targetId = checkpoint;
        }

        const success = session.rewindTo(targetId);
        if (success) {
            console.log(chalk.green(`  ✓ Rewound to checkpoint. ${session.messageCount} messages remaining.`));
        } else {
            console.log(chalk.red(`  ✗ Checkpoint not found: ${targetId}`));
        }
    },
};
