import { aegisFetch } from '../httpClient.js';
import { getConfig } from '../config.js';

export class CloudProxyClient {
    private auth: { token: string; refreshToken?: string };

    constructor(auth: { token: string; refreshToken?: string }) {
        this.auth = { ...auth };
    }

    async scan(diff: string, systemPrompt: string, timeoutMs: number): Promise<string> {
        const { proxyUrls } = getConfig();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await aegisFetch(proxyUrls.scan, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ diff, systemPrompt }),
                signal: controller.signal
            }, this.auth);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content ?? data.content ?? '';
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async generateRules(languages: string[], stack: string[], folderStructure: string, timeoutMs: number): Promise<string> {
        const { proxyUrls } = getConfig();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await aegisFetch(proxyUrls.init, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ languages, stack, folderStructure }),
                signal: controller.signal
            }, this.auth);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content ?? data.content ?? '';
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async upgradeRules(oldRules: string[], languages: string[], stack: string[], folderStructure: string, timeoutMs: number): Promise<string> {
        const { proxyUrls } = getConfig();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await aegisFetch(proxyUrls.update, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.auth.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ oldRules, languages, stack, folderStructure }),
                signal: controller.signal
            }, this.auth);

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content ?? data.content ?? '';
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
