import { AuthConfig } from '../auth.js';
import { AIProvider } from './types.js';
import { OpenRouterProvider } from './openrouter.js';
import { OllamaProvider } from './ollama.js';

export * from './types.js';
export * from './openrouter.js';
export * from './cloudProxy.js';
export * from './ollama.js';

export function createProvider(auth: Exclude<AuthConfig, { type: 'jwt' }>): AIProvider {
    if (auth.type === 'local') {
        return new OllamaProvider(auth.endpoint, auth.model);
    }
    if (auth.type === 'byok') {
        return new OpenRouterProvider(auth.key);
    }
    throw new Error('Unsupported auth type for provider creation');
}
