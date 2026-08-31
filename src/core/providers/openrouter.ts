import { AIProvider, ChatMessage, ChatOptions } from './types.js';
import { DEFAULTS } from '../config.js';

export class OpenRouterProvider implements AIProvider {
    constructor(private apiKey: string) {}

    async complete(messages: ChatMessage[], options: ChatOptions): Promise<string> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

        try {
            const response = await fetch(DEFAULTS.OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': DEFAULTS.OPENROUTER_REFERER,
                    'X-Title': DEFAULTS.OPENROUTER_TITLE,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: options.model,
                    messages,
                    temperature: options.temperature,
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || '';
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
