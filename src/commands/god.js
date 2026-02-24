import chalk from 'chalk';

export default {
    name: 'god',
    description: 'Toggle God Mode (auto-approve all file/folder operations in current directory)',
    usage: '/god [on|off]',

    async execute(args, { permissions }) {
        const action = args[0]?.toLowerCase();

        if (action === 'on') {
            permissions.enableGodMode();
            return;
        }

        if (action === 'off') {
            permissions.disableGodMode();
            console.log(chalk.hex('#FB7185')('\n  ⚡ GOD MODE DISABLED'));
            console.log(chalk.hex('#64748B')('  Permissions will be requested for all operations.'));
            console.log('');
            return;
        }

        // Toggle
        if (permissions.godMode) {
            permissions.disableGodMode();
            console.log(chalk.hex('#FB7185')('\n  ⚡ GOD MODE DISABLED'));
            console.log(chalk.hex('#64748B')('  Permissions will be requested for all operations.'));
            console.log('');
        } else {
            permissions.enableGodMode();
        }
    },
};
