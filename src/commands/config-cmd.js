import chalk from 'chalk';

export default {
    name: 'config',
    description: 'View or set configuration values',
    usage: '/config [set|list] [key] [value]',

    async execute(args, { config }) {
        const action = args[0] || 'list';

        switch (action) {
            case 'list':
                console.log('');
                console.log(chalk.bold('  Configuration:'));
                console.log(chalk.dim('  ' + JSON.stringify(config.list(), null, 2).replace(/\n/g, '\n  ')));
                console.log('');
                break;

            case 'set':
                if (args.length < 3) {
                    console.log(chalk.yellow('  Usage: /config set <key> <value>'));
                    console.log(chalk.dim('  Example: /config set defaultProvider ollama'));
                    return;
                }
                const key = args[1];
                let value = args.slice(2).join(' ');

                // Try to parse as JSON for booleans/numbers
                try { value = JSON.parse(value); } catch { }

                const scope = args.includes('--global') ? 'global' : 'global';
                config.set(key, value, scope);
                console.log(chalk.green(`  ✓ Set ${key} = ${JSON.stringify(value)}`));
                break;

            case 'get':
                if (args.length < 2) {
                    console.log(chalk.yellow('  Usage: /config get <key>'));
                    return;
                }
                const val = config.get(args[1]);
                console.log(`  ${args[1]} = ${chalk.white(JSON.stringify(val))}`);
                break;

            default:
                console.log(chalk.yellow('  Usage: /config [list|set|get] [key] [value]'));
        }
    },
};
