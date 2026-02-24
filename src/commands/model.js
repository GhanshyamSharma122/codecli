import chalk from 'chalk';
import inquirer from 'inquirer';
import theme from '../ui/theme.js';

export default {
    name: 'model',
    description: 'Switch AI provider or model',
    usage: '/model [provider] [model]',

    async execute(args, { providerManager }) {
        if (args.length >= 2) {
            // Direct switch: /model gemini gemini-2.0-flash
            try {
                providerManager.switchProvider(args[0]);
                providerManager.switchModel(args[1]);
                console.log(chalk.green(`  ✓ Switched to ${args[0]} / ${args[1]}`));
                return;
            } catch (err) {
                console.log(chalk.red(`  ✗ ${err.message}`));
                return;
            }
        }

        if (args.length === 1) {
            // Switch provider only: /model gemini
            try {
                providerManager.switchProvider(args[0]);
                console.log(chalk.green(`  ✓ Switched to ${args[0]} / ${providerManager.provider.model}`));
                return;
            } catch (err) {
                console.log(chalk.red(`  ✗ ${err.message}`));
                return;
            }
        }

        // Interactive mode
        const info = providerManager.getInfo();
        console.log('');
        console.log(theme.header('  Select Provider & Model'));
        console.log(chalk.dim(`  Current: ${info.provider} / ${info.model}`));
        console.log('');

        const { provider } = await inquirer.prompt([{
            type: 'list',
            name: 'provider',
            message: 'Select provider:',
            choices: info.available.map(p => ({
                name: `${p} ${p === info.provider ? chalk.dim('(current)') : ''}`,
                value: p,
            })),
        }]);

        providerManager.switchProvider(provider);

        const models = await providerManager.listModels(provider);
        if (models.length > 0) {
            const { model } = await inquirer.prompt([{
                type: 'list',
                name: 'model',
                message: 'Select model:',
                choices: models.map(m => ({
                    name: `${m} ${m === providerManager.provider.model ? chalk.dim('(current)') : ''}`,
                    value: m,
                })),
            }]);

            providerManager.switchModel(model);
        }

        console.log(chalk.green(`  ✓ Now using: ${providerManager.getStatusDisplay()}`));
    },
};
