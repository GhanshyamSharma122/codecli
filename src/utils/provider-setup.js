import inquirer from 'inquirer';

export const PROVIDER_SETUP_FIELDS = {
    'azure-openai': [
        { key: 'apiKey', label: 'Azure OpenAI API key', required: true },
        { key: 'endpoint', label: 'Azure OpenAI endpoint URL', required: true },
        { key: 'deployment', label: 'Azure deployment name (e.g., gpt-4o)', required: true, default: 'gpt-4o' },
    ],
    gemini: [
        { key: 'apiKey', label: 'Google Gemini API key', required: true },
        { key: 'model', label: 'Gemini model name', default: 'gemini-2.0-flash' },
    ],
    ollama: [
        { key: 'host', label: 'Ollama host URL', default: 'http://localhost:11434', required: true },
        { key: 'model', label: 'Ollama model name', default: 'llama3.2', required: true },
    ],
};

export const PROVIDER_CHOICES = [
    { name: 'Azure OpenAI (cloud)', value: 'azure-openai', short: 'Azure' },
    { name: 'Google Gemini (cloud)', value: 'gemini', short: 'Gemini' },
    { name: 'Ollama (local)', value: 'ollama', short: 'Ollama' },
];

export function isProviderReady(config, name) {
    const providers = config.get('providers') || {};
    const settings = providers[name] || {};

    if (name === 'azure-openai') {
        return Boolean(settings.apiKey && settings.endpoint && settings.deployment);
    }
    if (name === 'gemini') {
        return Boolean(settings.apiKey && settings.model);
    }
    if (name === 'ollama') {
        return Boolean(settings.host && settings.model);
    }
    return false;
}

export function getReadyProviders(config) {
    return PROVIDER_CHOICES.map((choice) => choice.value).filter((name) => isProviderReady(config, name));
}

export async function promptForProviderSelection(message = 'Choose a provider:') {
    const { provider } = await inquirer.prompt({
        type: 'list',
        name: 'provider',
        message,
        choices: PROVIDER_CHOICES,
    });
    return provider;
}

export async function promptForProviderFields(config, provider, options = {}) {
    const scope = options.scope || 'global';
    const fields = PROVIDER_SETUP_FIELDS[provider] || [];

    for (const field of fields) {
        const existing = config.get(`providers.${provider}.${field.key}`) || '';
        const defaultValue = existing || field.default || '';

        const { value } = await inquirer.prompt({
            type: 'input',
            name: 'value',
            message: `${field.label}${defaultValue ? ` (default: ${defaultValue})` : ''}`,
            default: defaultValue,
            validate: (input) => {
                if (field.required && !(input || '').trim()) {
                    return 'This value is required.';
                }
                return true;
            },
        });

        const trimmed = (value || defaultValue || '').trim();
        if (trimmed) {
            config.set(`providers.${provider}.${field.key}`, trimmed, scope);
        }
    }
}
