import { Command, Args } from "@oclif/core";
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';

export default class Rule extends Command {
    static description = 'Manually add a new architectural rule to aegis.config.json.';

    static args = {
        newRule: Args.string({ description: 'The new rule to add (wrap in quotes)', required: false }),
    };

    public async run(): Promise<void> {
        const { args } = await this.parse(Rule);
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

            let ruleToAdd = args.newRule;

            // If the user didn't provide a rule inline, prompt them
            if (!ruleToAdd) {
                ruleToAdd = await input({
                    message: 'Enter the new architectural rule you want to enforce:',
                    validate: (value) => value.length > 5 || 'Rule is too short. Please provide a clear, descriptive rule.'
                });
            }

            // Ensure rules array exists
            if (!Array.isArray(config.ai_rules)) {
                config.ai_rules = [];
            }

            // Add the new rule
            config.ai_rules.push(ruleToAdd);

            // Write it back
            await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

            this.log(`\n${chalk.bgGreen.white.bold(' ✅ RULE ADDED ')} ${chalk.green(`Successfully added rule #${config.ai_rules.length} to aegis.config.json:`)}`);
            this.log(chalk.cyan(`"${ruleToAdd}"\n`));
        } catch (err) {
            this.error(chalk.red(`Failed to add rule: ${err instanceof Error ? err.message : String(err)}`));
        }
    }
}
