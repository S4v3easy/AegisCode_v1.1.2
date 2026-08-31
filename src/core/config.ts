/**
 * @module config
 */
export const DEFAULTS = {
    SCAN_MODEL: 'deepseek/deepseek-r1',
    INIT_MODEL: 'qwen/qwen3-32b',
    SCAN_TEMPERATURE: 0.1,
    INIT_TEMPERATURE: 0.3,
    CLOUD_TIMEOUT: 60_000,
    LOCAL_TIMEOUT: 180_000,
    LOGIN_TIMEOUT: 120_000,
    PROXY_SCAN_URL: 'https://www.aegiscode.app/api/scan',
    PROXY_INIT_URL: 'https://www.aegiscode.app/api/init',
    PROXY_UPDATE_URL: 'https://www.aegiscode.app/api/update',
    PROXY_REFRESH_URL: 'https://www.aegiscode.app/api/refresh',
    AUTH_UI_URL: 'https://www.aegiscode.app/cli-auth',
    LOGIN_PORT: 3456,
    SCANNER_MAX_DEPTH: 3,
    SCANNER_MAX_FILES: 500,
    MAX_DIFF_SIZE_KB: 100,
    MAX_DIFF_LINES: 5000,
    OPENROUTER_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    OPENROUTER_REFERER: 'https://aegiscode.dev',
    OPENROUTER_TITLE: 'AegisCode CLI',
    OLLAMA_DEFAULT_ENDPOINT: 'http://localhost:11434',
    OLLAMA_DEFAULT_MODEL: 'qwen2.5-coder:7b'
} as const;

export function getConfig() {
    return {
        proxyUrls: {
            scan: process.env.AEGIS_PROXY_URL || DEFAULTS.PROXY_SCAN_URL,
            init: process.env.AEGIS_INIT_URL || DEFAULTS.PROXY_INIT_URL,
            update: process.env.AEGIS_UPDATE_URL || DEFAULTS.PROXY_UPDATE_URL,
            refresh: process.env.AEGIS_REFRESH_URL || DEFAULTS.PROXY_REFRESH_URL
        },
        authUiUrl: process.env.AEGIS_UI_URL || DEFAULTS.AUTH_UI_URL,
        openRouterApiKey: process.env.OPEN_ROUTER_API_KEY
    };
}

export function isTrustedUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.hostname.endsWith('aegiscode.app') || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}
