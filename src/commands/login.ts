import { Command } from '@oclif/core';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

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

            this.log(`\n${chalk.bgGreen.black.bold(' ✅ BYOK AUTHENTICATION SUCCESSFUL ')}`);
            this.log(chalk.green('Your OpenRouter API Key has been saved locally.'));
            this.log(chalk.white('AegisCode will now use this key for all future scans (Bypassing free limits).\n'));
        } 
        else if (authMethod === 'github') {
            this.log(chalk.yellow('\n1. Open this URL in your browser to login with GitHub:'));
            this.log(chalk.cyan.underline('http://localhost:3000\n'));
            
            const newToken = await input({
                message: '2. Paste the Secure Token from the website:',
                validate: (value) => value.length > 10 ? true : 'Please enter a valid Token.'
            });

            const tokenPath = path.join(aegisDir, 'token.json');
            fs.writeFileSync(tokenPath, JSON.stringify({ accessToken: newToken }, null, 2));

            this.log(`\n${chalk.bgBlue.white.bold(' 🌐 GITHUB AUTHENTICATION SUCCESSFUL ')}`);
            this.log(chalk.blue('Your Token has been saved locally.'));
            this.log(chalk.white('You now have 5 free AI scans per day. Run "aegis init" to begin.\n'));
        }
    }
}
