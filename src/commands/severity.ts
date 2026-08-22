import { Command } from "@oclif/core";
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import { select } from '@inquirer/prompts';

export default class Severity extends Command {
    static description = 'Change the AI severity level of AegisCode without altering your rules or stack.';

    public async run(): Promise<void> {
        const configPath = path.join(process.cwd(), 'aegis.config.json');

        // Check if the config exists
        try {
            await fs.access(configPath);
        } catch (err) {
            this.error("The aegis.config.json file does not exist. You must run 'aegis init' first.");
        }

        try {
            // Read the current config
            const fileContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(fileContent);

            this.log(`Current severity level is: ${config.severity || 'unknown'}`);

            // Prompt the user for the new severity level
            const newSeverity = await select({
                message: 'Select the new severity level for AegisCode:',
                choices: [
                    {
                        name: 'Relaxed (Sanity Checker, forgives Junior mistakes)',
                        value: 'relaxed'
                    },
                    {
                        name: 'Medium (Standard Mid-Level Engineer Review)',
                        value: 'medium'
                    },
                    {
                        name: 'Paranoid (Strict Enterprise Rules, Zero Tolerance)',
                        value: 'high'
                    },
                ],
            });

            // Update the severity field
            config.severity = newSeverity;

            // Write it back
            await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

            this.log(`✅ AegisCode severity successfully updated to: ${newSeverity}`);
        } catch (err) {
            this.error(`Failed to update severity: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}
