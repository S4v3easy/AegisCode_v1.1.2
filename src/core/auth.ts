import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import { getConfig } from './config.js';

export type AuthConfig = 
    | { type: 'byok'; key: string; scanModel?: string; initModel?: string } 
    | { type: 'jwt'; token: string; refreshToken?: string } 
    | { type: 'local'; endpoint: string; model: string };

export function getAegisDir(): string {
    return path.join(os.homedir(), '.aegiscode');
}

export async function getAuthConfig(): Promise<AuthConfig | null> {
    const aegisDir = getAegisDir();
    const credsPath = path.join(aegisDir, 'credentials.json');
    const tokenPath = path.join(aegisDir, 'token.json');

    try {
        const credsRaw = await fs.readFile(credsPath, 'utf-8');
        const creds = JSON.parse(credsRaw);
        if (creds.provider === 'local') {
            return { type: 'local', endpoint: creds.endpoint, model: creds.model };
        }
        if (creds.openRouterKey) {
            return { type: 'byok', key: creds.openRouterKey };
        }
    } catch (e) {
        // Ignore file not found or JSON error
    }

    try {
        const tokensRaw = await fs.readFile(tokenPath, 'utf-8');
        const tokens = JSON.parse(tokensRaw);
        if (tokens.accessToken) {
            return { type: 'jwt', token: tokens.accessToken, refreshToken: tokens.refreshToken };
        }
    } catch (e) {
        // Ignore
    }

    const { openRouterApiKey } = getConfig();
    if (openRouterApiKey) {
        return { type: 'byok', key: openRouterApiKey };
    }

    return null;
}

export async function persistTokens(accessToken: string, refreshToken: string): Promise<void> {
    const aegisDir = getAegisDir();
    const tokenPath = path.join(aegisDir, 'token.json');
    
    await fs.mkdir(aegisDir, { recursive: true });
    await fs.writeFile(tokenPath, JSON.stringify({ accessToken, refreshToken }, null, 2), 'utf-8');
}
