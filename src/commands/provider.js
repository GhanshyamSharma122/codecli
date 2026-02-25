import chalk from 'chalk';
import inquirer from 'inquirer';
import {
    PROVIDER_CHOICES,
    PROVIDER_SETUP_FIELDS,
    getReadyProviders,
    isProviderReady,
    promptForProviderSelection,
    promptForProviderFields,
} from '../utils/provider-setup.js';

const maskValue = (value) => {
    if (!value) return chalk.dim('not set');
    if (value.length <= 8) return value;
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export default {
    name: 'provider',
    description: 'Interactively list/configure AI providers inside the REPL',
    usage: '/provider [list|configure] [provider]',

    async execute(args, { config, providerManager }) {
        const action = (args[0] || 'list').toLowerCase();

        switch (action) {
            case 'list': {
                console.log('');
                console.log(chalk.bold('  Providers:'));
                const providers = PROVIDER_CHOICES.map((choice) => choice.value);
                for (const name of providers) {
                    const ready = isProviderReady(config, name);
                    const status = ready ? chalk.hex('#22D3EE')('configured') : chalk.yellow('missing fields');
                    console.log(`  ${chalk.cyan(name)} — ${status}`);
                    const fields = PROVIDER_SETUP_FIELDS[name] || [];
                    for (const field of fields) {
                        const value = config.get(`providers.${name}.${field.key}`) || '';
                        const display = field.key.toLowerCase().includes('key') ? maskValue(value) : (value || chalk.dim('not set'));
                        console.log(`    ${chalk.dim(field.label)}: ${display}`);
                    }
                }
                console.log('');
                return { action: 'list' };
            }

            case 'configure': {
                let provider = (args[1] || '').toLowerCase();
                if (!PROVIDER_SETUP_FIELDS[provider]) {
                    provider = await promptForProviderSelection(chalk.cyan('Choose provider to configure:'));
                }

                await promptForProviderFields(config, provider);
                providerManager.refreshProviders();

                if (isProviderReady(config, provider)) {
                    const { setDefault } = await inquirer.prompt({
                        type: 'confirm',
                        name: 'setDefault',
                        message: `Set ${provider} as the default provider?`,
                        default: providerManager.currentProvider === provider,
                    });
                    if (setDefault) {
                        providerManager.switchProvider(provider);
                        config.set('defaultProvider', provider, 'global');
                    }
                }

                const ready = getReadyProviders(config);
                if (ready.length === 0) {
                    console.log(chalk.yellow('  ⚠ Provider saved, but no provider is fully configured yet.'));
                } else {
                    console.log(chalk.green(`  ✓ ${provider} credentials saved.`));
                }
                return { action: 'configure', provider };
            }

            default:
                console.log(chalk.yellow('  Usage: /provider list OR /provider configure [provider]'));
                return null;
        }
    },
};
