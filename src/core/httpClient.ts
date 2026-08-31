import { getConfig } from './config.js';
import { persistTokens } from './auth.js';

export async function aegisFetch(url: string, options: RequestInit & { headers: Record<string, string> }, auth: { token: string; refreshToken?: string }): Promise<Response> {
    let response = await fetch(url, options);

    if (response.status === 401 && auth.refreshToken) {
        const { proxyUrls } = getConfig();
        try {
            const refreshRes = await fetch(proxyUrls.refresh, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: auth.refreshToken })
            });

            if (refreshRes.ok) {
                const newTokens = await refreshRes.json();
                await persistTokens(newTokens.access_token, newTokens.refresh_token);

                auth.token = newTokens.access_token;
                auth.refreshToken = newTokens.refresh_token;
                options.headers['Authorization'] = `Bearer ${auth.token}`;

                response = await fetch(url, options);
            }
        } catch (e) {
            // Silently fall back to returning the original 401 response
        }
    }
    return response;
}
