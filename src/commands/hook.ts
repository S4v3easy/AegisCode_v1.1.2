import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import { Command } from "@oclif/core";
import { select } from '@inquirer/prompts';

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

        //We inizialyze the path of hooks git service
        const hooksDir = path.join(process.cwd(), '.git', 'hooks');
        const hookPath = path.join(hooksDir, 'pre-commit');

        //We have to create the pre-commit files with the bash script execute inside

        //The bash script
        const bashScript = `#!/bin/sh
    echo "🛡️ AegisCode is analyzing your commit..."
    npx aegis scan
    
    if [ $? -ne 0 ]; then
      echo "❌ Commit REJECTED by AegisCode. Fix the violations and try again."
      exit 1
    fi`;

        try {
            //We create the switch logic to turn on and off the aegis automatic control
            if(userAction === 'on') {
                //We create the file
                await fs.writeFile(hookPath, bashScript);

                //We change the file permission
                await fs.chmod(hookPath, '755');

                this.log('AegisCode Hook ENABLED 🟢');
            } else {
                //We delete the file, strong process
                await fs.rm(hookPath, { force: true });

                this.log('AegisCode Hook DISABLED 🔴');
            }

        } catch(err: unknown) {
            this.error(err instanceof Error ? err.message : 'Unknown error');
        }
    }
}

