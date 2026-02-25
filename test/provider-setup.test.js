import assert from 'node:assert';
import { getReadyProviders, isProviderReady } from '../src/utils/provider-setup.js';

function createMockConfig(initial = {}) {
    const state = JSON.parse(JSON.stringify(initial));

    const get = (key) => {
        if (!key) return state;
        return key.split('.').reduce((obj, part) => (obj ? obj[part] : undefined), state);
    };

    const set = (key, value) => {
        const parts = key.split('.');
        let target = state;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!target[part] || typeof target[part] !== 'object') {
                target[part] = {};
            }
            target = target[part];
        }
        target[parts[parts.length - 1]] = value;
    };

    return { get, set };
}

const config = createMockConfig({
    providers: {
        'azure-openai': {
            apiKey: 'test-key',
            endpoint: 'https://example.com',
            deployment: 'gpt-4o',
        },
        gemini: {},
        ollama: {},
    },
});

assert.strictEqual(isProviderReady(config, 'azure-openai'), true, 'Azure should be ready when all fields are present');
assert.strictEqual(isProviderReady(config, 'gemini'), false, 'Gemini should be missing fields');
assert.strictEqual(isProviderReady(config, 'ollama'), false, 'Ollama should be missing fields');

config.set('providers.gemini.apiKey', 'gemini-key');
config.set('providers.gemini.model', 'gemini-2.0-flash');
assert.strictEqual(isProviderReady(config, 'gemini'), true, 'Gemini should be ready after api key/model set');

const ready = getReadyProviders(config);
assert.ok(Array.isArray(ready), 'getReadyProviders returns an array');
assert.ok(ready.includes('azure-openai'), 'Ready providers should include azure-openai');
assert.ok(ready.includes('gemini'), 'Ready providers should include gemini after configuration');
assert.strictEqual(ready.includes('ollama'), false, 'Ollama remains unconfigured');

console.log('Provider setup smoke test passed.');
