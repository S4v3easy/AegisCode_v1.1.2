import { AIProvider, ChatMessage, ChatOptions } from './types.js';
import { DEFAULTS } from '../config.js';

export class OllamaProvider implements AIProvider {
    private endpoint: string;
    private defaultModel: string;

    constructor(endpoint?: string, defaultModel?: string) {
        this.endpoint = endpoint || DEFAULTS.OLLAMA_DEFAULT_ENDPOINT;
        this.defaultModel = defaultModel || DEFAULTS.OLLAMA_DEFAULT_MODEL;
    }

    async healthCheck(model?: string): Promise<void> {
        const targetModel = model || this.defaultModel;
        try {
            const response = await fetch(`${this.endpoint}/api/tags`);
            if (!response.ok) {
                throw new Error(`Failed to fetch models from Ollama: ${response.statusText}`);
            }
            const data = await response.json();
            const models = data.models || [];
            const hasModel = models.some((m: any) => m.name === targetModel || m.name === `${targetModel}:latest`);
            if (!hasModel) {
                throw new Error(`Model '${targetModel}' not found. Run 'ollama pull ${targetModel}'`);
            }
        } catch (e: any) {
            if (e.cause?.code === 'ECONNREFUSED' || e.code === 'ECONNREFUSED') {
                throw new Error('Connection refused. Run ollama serve');
            }
            throw e;
        }
    }

    async complete(messages: ChatMessage[], options: ChatOptions): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

        try {
            const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: options.model,
                    messages,
                    temperature: options.temperature,
                    stream: false
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
