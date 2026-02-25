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
        const config = providerManager.config;

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

        // JIT Configuration Check
        if (provider === 'gemini') {
            const apiKey = config.get('providers.gemini.apiKey');
            if (!apiKey) {
                console.log(chalk.yellow(`  ! Gemini API Key is not set.`));
                const { key } = await inquirer.prompt([{
                    type: 'password',
                    name: 'key',
                    message: 'Enter Gemini API Key:',
                }]);
                if (key) {
                    config.set('providers.gemini.apiKey', key);
                    providerManager.refreshProviders();
                }
            }
        } else if (provider === 'azure-openai') {
            const settings = config.get('providers.azure-openai') || {};
            const missing = [];
            if (!settings.apiKey) missing.push('apiKey');
            if (!settings.endpoint) missing.push('endpoint');

            if (missing.length > 0) {
                console.log(chalk.yellow(`  ! Azure OpenAI configuration is incomplete.`));
                const prompts = [];
                if (!settings.apiKey) prompts.push({ type: 'password', name: 'apiKey', message: 'Enter Azure API Key:' });
                if (!settings.endpoint) prompts.push({ type: 'input', name: 'endpoint', message: 'Enter Azure Endpoint (e.g., https://resource.openai.azure.com/):' });

                const answers = await inquirer.prompt(prompts);
                for (const [k, v] of Object.entries(answers)) {
                    config.set(`providers.azure-openai.${k}`, v);
                }
                providerManager.refreshProviders();
            }
        } else if (provider === 'ollama') {
            const host = config.get('providers.ollama.host');
            if (!host) {
                console.log(chalk.yellow(`  ! Ollama host is not set.`));
                const { h } = await inquirer.prompt([{
                    type: 'input',
                    name: 'h',
                    message: 'Enter Ollama Host (default: http://localhost:11434):',
                    default: 'http://localhost:11434',
                }]);
                if (h) {
                    config.set('providers.ollama.host', h);
                    providerManager.refreshProviders();
                }
            }
        }

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

            // Special case for Azure: model is deployment
            if (provider === 'azure-openai') {
                config.set('providers.azure-openai.deployment', model);
            }
        }

        console.log(chalk.green(`  ✓ Now using: ${providerManager.getStatusDisplay()}`));
    },
};
