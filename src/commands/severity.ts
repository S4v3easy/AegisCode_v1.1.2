import { Command } from "@oclif/core";
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';

export default class Severity extends Command {
    static description = 'Change the AI severity level of AegisCode without altering your rules or stack.';

    public async run(): Promise<void> {
        const configPath = path.join(process.cwd(), 'aegis.config.json');

        // Check if the config exists
        try {
            await fs.access(configPath);
        } catch (err) {
            this.error(chalk.red("The aegis.config.json file does not exist. You must run 'aegis init' first."));
        }

        try {
            // Read the current config
            const fileContent = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(fileContent);

            this.log(`\n${chalk.dim('Current severity level is:')} ${chalk.cyan.bold(config.severity || 'unknown')}\n`);

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

            this.log(`\n${chalk.bgGreen.white.bold(' ✅ SEVERITY UPDATED ')} ${chalk.green(`AegisCode severity successfully set to: ${chalk.bold(newSeverity)}\n`)}`);
        } catch (err) {
            this.error(chalk.red(`Failed to update severity: ${err instanceof Error ? err.message : String(err)}`));
        }
    }
}
