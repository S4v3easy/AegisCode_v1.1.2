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
        const preHookPath = path.join(hooksDir, 'pre-commit');
        const postHookPath = path.join(hooksDir, 'post-commit');

        // We have to create the pre-commit and post-commit files with the bash scripts inside

        // The bash script
        const bashScript = `#!/bin/sh
    echo "🛡️ AegisCode is analyzing your commit..."
    
    # Try global binary first, fallback to npx
    if command -v aegis >/dev/null 2>&1; then
      aegis scan
    else
      npx aegis scan
    fi
    
    if [ $? -ne 0 ]; then
      echo "❌ Commit REJECTED by AegisCode. Fix the violations and try again."
      exit 1
    fi`;

        const postCommitScript = `#!/bin/sh
    if [ -f .aegis/.scan_passed ]; then
        rm .aegis/.scan_passed
    else
        mkdir -p .aegis
        COMMIT_HASH=$(git rev-parse HEAD)
        DATE=$(date)
        echo "[$DATE] BYPASS DETECTED: Commit $COMMIT_HASH was forced without AegisCode validation (--no-verify)" >> .aegis/audit.log
    fi`;

        try {
            // We create the switch logic to turn on and off the automatic aegis control
            if(userAction === 'on') {
                // We create the file
                await fs.writeFile(preHookPath, bashScript);
                await fs.writeFile(postHookPath, postCommitScript);

                // We change the file permissions to make it executable
                await fs.chmod(preHookPath, '755');
                await fs.chmod(postHookPath, '755');

                this.log(`\n${chalk.bgGreen.white.bold(' 🟢 AEGIS HOOK ENABLED ')} ${chalk.green('The pre-commit and audit hooks are now active.\n')}`);
            } else {
                // We delete the file, strong process
                await fs.rm(preHookPath, { force: true });
                await fs.rm(postHookPath, { force: true });

                this.log(`\n${chalk.bgRed.white.bold(' 🔴 AEGIS HOOK DISABLED ')} ${chalk.red('The pre-commit and audit hooks have been removed.\n')}`);
            }

        } catch(err: unknown) {
            this.error(chalk.red(err instanceof Error ? err.message : 'Unknown error'));
        }
    }
}

