import { Command } from '@oclif/core';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { DEFAULTS, isTrustedUrl } from '../core/config.js';

export default class Login extends Command {
    static description = 'Authenticate with AegisCode (Free Tier or BYOK)';

    public async run(): Promise<void> {
        this.log(chalk.cyan('\n🛡️  AegisCode Authentication Setup\n'));

        const authMethod = await select({
            message: 'How do you want to authenticate?',
            choices: [
                {
                    name: '🌐 GitHub Login (5 Free Scans / Day)',
                    value: 'github',
                    description: 'Use the free tier powered by AegisCode Cloud.'
                },
                {
                    name: '🔑 OpenRouter API Key (Unlimited BYOK)',
                    value: 'byok',
                    description: 'Use your own API key for unlimited, local scans.'
                }
            ]
        });

        const aegisDir = path.join(os.homedir(), '.aegiscode');
        await fs.mkdir(aegisDir, { recursive: true });

        if (authMethod === 'byok') {
            const newKey = await input({
                message: 'Paste your OpenRouter API Key (starts with sk-or-):',
                validate: (value) => value.startsWith('sk-or-') ? true : 'Invalid format. OpenRouter API keys must start with "sk-or-".'
            });

            const credsPath = path.join(aegisDir, 'credentials.json');
            await fs.writeFile(credsPath, JSON.stringify({ openRouterKey: newKey }, null, 2));

            const tokenPath = path.join(aegisDir, 'token.json');
            await fs.rm(tokenPath, { force: true });

            this.log(`\n${chalk.bgGreen.black.bold(' ✅ BYOK AUTHENTICATION SUCCESSFUL ')}`);
            this.log(chalk.green('Your OpenRouter API Key has been saved locally.'));
            this.log(chalk.white('AegisCode will now use this key for all future scans (Bypassing free limits).\n'));
        } 
        else if (authMethod === 'github') {
            this.log(chalk.yellow('\nWaiting for browser authentication...'));

            // Generate CSRF state parameter
            const state = crypto.randomBytes(16).toString('hex');

            return new Promise<void>((resolve, reject) => {
                const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
                    if (req.url && req.url.startsWith('/callback')) {
                        const url = new URL(req.url, `http://${req.headers.host}`);

                        // Verify CSRF state parameter
                        const receivedState = url.searchParams.get('state');
                        if (receivedState !== state) {
                            res.writeHead(403, { 'Content-Type': 'text/plain' });
                            res.end('State mismatch: possible CSRF attack.');
                            return;
                        }

                        const accessToken = url.searchParams.get('access_token');
                        const refreshToken = url.searchParams.get('refresh_token');

                        if (accessToken) {
                            const tokenPath = path.join(aegisDir, 'token.json');
                            const credsPath = path.join(aegisDir, 'credentials.json');

                            // Handle async file operations inside the callback
                            Promise.all([
                                fs.writeFile(tokenPath, JSON.stringify({ accessToken, refreshToken }, null, 2)),
                                fs.rm(credsPath, { force: true }),
                            ]).then(() => {
                                res.writeHead(200, { 'Content-Type': 'text/html' });
                                res.end('<body style="background:#09090b;color:#fff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;"><h1>Authentication Successful! You can close this tab.</h1><script>setTimeout(() => window.close(), 2000)</script></body>');

                                this.log(`\n${chalk.bgBlue.white.bold(' 🌐 GITHUB AUTHENTICATION SUCCESSFUL ')}`);
                                this.log(chalk.blue('Your Token has been securely intercepted and saved.'));
                                this.log(chalk.white('You now have 5 free AI scans per day. Run "aegis init" to begin.\n'));

                                clearTimeout(loginTimeout);
                                server.close();
                                resolve();
                            }).catch((err) => {
                                res.writeHead(500, { 'Content-Type': 'text/plain' });
                                res.end('Failed to save authentication tokens.');
                                clearTimeout(loginTimeout);
                                server.close();
                                reject(err);
                            });
                        } else {
                            res.writeHead(400, { 'Content-Type': 'text/plain' });
                            res.end('Authentication failed: Missing token');
                            clearTimeout(loginTimeout);
                            server.close();
                            reject(new Error('Missing token in callback'));
                        }
                    }
                });

                // Bind to 127.0.0.1 only (prevents LAN access to OAuth callback)
                server.listen(DEFAULTS.LOGIN_PORT, '127.0.0.1', () => {
                    let authUrl = process.env.AEGIS_UI_URL || DEFAULTS.AUTH_UI_URL;
                    if (!isTrustedUrl(authUrl)) {
                        this.warn('Warning: AEGIS_UI_URL is not a trusted AegisCode domain. Using default URL.');
                        authUrl = DEFAULTS.AUTH_UI_URL;
                    }

                    // Append CSRF state to auth URL
                    const fullAuthUrl = `${authUrl}?state=${state}`;
                    this.log(chalk.cyan(`Opening browser to: ${authUrl}`));
                    
                    const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
                    exec(`${start} "${fullAuthUrl}"`);
                });

                // Timeout: close server after LOGIN_TIMEOUT if auth not completed
                const loginTimeout = setTimeout(() => {
                    server.close();
                    reject(new Error(`Authentication timed out after ${DEFAULTS.LOGIN_TIMEOUT / 1000} seconds. Please try again.`));
                }, DEFAULTS.LOGIN_TIMEOUT);
            });
        }
    }
}
