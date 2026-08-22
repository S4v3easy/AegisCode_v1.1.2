import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import { Command } from "@oclif/core";
import { select } from '@inquirer/prompts';
import chalk from 'chalk';

export default class Hook extends Command {
    static description = 'Enable or disable the AegisCode Git Pre-commit Hook';

    public async run(): Promise<void> {
        const userAction = await select({
            message: 'AegisCode Pre-commit Hook Status:',
            choices: [
                {
                    name: 'Enable (Turn ON) 🟢',
                    value: 'on'
                },
                {
                    name: 'Disable (Turn OFF) 🔴',
                    value: 'off'
                }
            ]
        });

        // Initialize the path of the git hooks directory
        const hooksDir = path.join(process.cwd(), '.git', 'hooks');
        const hookPath = path.join(hooksDir, 'pre-commit');

        // We have to create the pre-commit file with the bash script inside

        // The bash script
        const bashScript = `#!/bin/sh
    echo "🛡️ AegisCode is analyzing your commit..."
    npx aegis scan
    
    if [ $? -ne 0 ]; then
      echo "❌ Commit REJECTED by AegisCode. Fix the violations and try again."
      exit 1
    fi`;

        try {
            // We create the switch logic to turn on and off the automatic aegis control
            if(userAction === 'on') {
                // We create the file
                await fs.writeFile(hookPath, bashScript);

                // We change the file permissions to make it executable
                await fs.chmod(hookPath, '755');

                this.log(`\n${chalk.bgGreen.white.bold(' 🟢 AEGIS HOOK ENABLED ')} ${chalk.green('The pre-commit hook is now active.\n')}`);
            } else {
                // We delete the file, strong process
                await fs.rm(hookPath, { force: true });

                this.log(`\n${chalk.bgRed.white.bold(' 🔴 AEGIS HOOK DISABLED ')} ${chalk.red('The pre-commit hook has been removed.\n')}`);
            }

        } catch(err: unknown) {
            this.error(chalk.red(err instanceof Error ? err.message : 'Unknown error'));
        }
    }
}

