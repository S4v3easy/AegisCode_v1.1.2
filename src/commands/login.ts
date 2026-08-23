import { Command } from '@oclif/core';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as http from 'node:http';
import { exec } from 'node:child_process';

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
        if (!fs.existsSync(aegisDir)) {
            fs.mkdirSync(aegisDir, { recursive: true });
        }

        if (authMethod === 'byok') {
            const newKey = await input({
                message: 'Paste your OpenRouter API Key (starts with sk-or-):',
                validate: (value) => value.startsWith('sk-or-') ? true : 'Invalid format. OpenRouter API keys must start with "sk-or-".'
            });

            const credsPath = path.join(aegisDir, 'credentials.json');
            fs.writeFileSync(credsPath, JSON.stringify({ openRouterKey: newKey }, null, 2));

            const tokenPath = path.join(aegisDir, 'token.json');
            if (fs.existsSync(tokenPath)) {
                fs.unlinkSync(tokenPath);
            }

            this.log(`\n${chalk.bgGreen.black.bold(' ✅ BYOK AUTHENTICATION SUCCESSFUL ')}`);
            this.log(chalk.green('Your OpenRouter API Key has been saved locally.'));
            this.log(chalk.white('AegisCode will now use this key for all future scans (Bypassing free limits).\n'));
        } 
        else if (authMethod === 'github') {
            this.log(chalk.yellow('\nWaiting for browser authentication...'));
            
            return new Promise<void>((resolve, reject) => {
                const server = http.createServer((req: any, res: any) => {
                    if (req.url && req.url.startsWith('/callback')) {
                        const url = new URL(req.url, `http://${req.headers.host}`);
                        const accessToken = url.searchParams.get('access_token');
                        const refreshToken = url.searchParams.get('refresh_token');

                        if (accessToken) {
                            const tokenPath = path.join(aegisDir, 'token.json');
                            fs.writeFileSync(tokenPath, JSON.stringify({ accessToken, refreshToken }, null, 2));

                            const credsPath = path.join(aegisDir, 'credentials.json');
                            if (fs.existsSync(credsPath)) {
                                fs.unlinkSync(credsPath);
                            }

                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end('<body style="background:#09090b;color:#fff;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;"><h1>Authentication Successful! You can close this tab.</h1><script>setTimeout(() => window.close(), 2000)</script></body>');

                            this.log(`\n${chalk.bgBlue.white.bold(' 🌐 GITHUB AUTHENTICATION SUCCESSFUL ')}`);
                            this.log(chalk.blue('Your Token has been securely intercepted and saved.'));
                            this.log(chalk.white('You now have 5 free AI scans per day. Run "aegis init" to begin.\n'));
                            
                            server.close();
                            resolve();
                        } else {
                            res.writeHead(400, { 'Content-Type': 'text/plain' });
                            res.end('Authentication failed: Missing token');
                            server.close();
                            reject(new Error('Missing token in callback'));
                        }
                    }
                });

                server.listen(3456, () => {
                    let authUrl = process.env.AEGIS_UI_URL || 'https://www.aegiscode.app/cli-auth';
                    if (!/^https?:\/\/([a-zA-Z0-9-]+\.)*aegiscode\.app(\/.*)?$/.test(authUrl) && !/^http:\/\/localhost:\d+(\/.*)?$/.test(authUrl)) {
                        this.warn('Warning: AEGIS_UI_URL is not a trusted AegisCode domain. Using default URL.');
                        authUrl = 'https://www.aegiscode.app/cli-auth';
                    }
                    this.log(chalk.cyan(`Opening browser to: ${authUrl}`));
                    
                    const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
                    exec(`${start} "${authUrl}"`);
                });
            });
        }
    }
}
