import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import { Command, ux } from "@oclif/core";
import { scanEnvironment } from '../core/scanner.js'; // Function to update the project environment
import { upgradeArchitecturalRules } from '../core/ai.js';
import chalk from 'chalk';

export default class Update extends Command {
    // Description
    static description = 'Smart update of AegisCode configuration, merging new tech stack with existing rules.';

    public async run(): Promise<void> {
        const currentFolder = process.cwd();
        const configPath = path.join(currentFolder, 'aegis.config.json');

        try {
            // Read the file and parse it
            const fileBuffer = await fs.readFile(configPath, 'utf-8');
            const oldConfig = JSON.parse(fileBuffer);

            // Save the old rules
            const oldRules = oldConfig.ai_rules || [];
            this.log(`\n📂 ${chalk.blue('Found existing config with')} ${chalk.cyan.bold(String(oldRules.length))} ${chalk.blue('rules.')}\n`);

            // Start the new scan for the updated environment
            ux.action.start('Scanning project environment for new dependencies');
            const detectedStack = await scanEnvironment(currentFolder);
            ux.action.stop(chalk.green('completed'));
            this.log(chalk.green(`Mechanical scan completed. Detected languages: ${chalk.cyan(detectedStack.languages.join(', ') || 'None')}\n`));
            
            // Surgical Look: Map the directory structure
            let folderStructure = 'Unknown';
            try {
                const srcPath = path.join(currentFolder, 'src');
                const dirs = await fs.readdir(srcPath);
                folderStructure = `/src: ${dirs.join(', ')}`;
            } catch {
                try {
                    const dirs = await fs.readdir(currentFolder);
                    folderStructure = `/root: ${dirs.filter(d => !d.startsWith('.') && d !== 'node_modules').join(', ')}`;
                } catch {}
            }
            
            ux.action.start('Invoking AI Architect for smart rule merge');

            const mergedRules = await upgradeArchitecturalRules(oldRules, detectedStack.languages, detectedStack.coreLibs, folderStructure);
            ux.action.stop(chalk.green('completed'));
            this.log(chalk.green('Smart merge completed.'));

            // Build the new JSON file keeping version and severity intact
            const newConfig = {
                aegisVersion: oldConfig.aegisVersion || "0.1.0",
                severity: oldConfig.severity || "medium",
                languages: detectedStack.languages,
                stack: detectedStack.coreLibs,
                ai_rules: mergedRules 
            };

            await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');

            this.log(`\n${chalk.bgGreen.white.bold(' ✅ AEGISCODE UPDATED SUCCESSFULLY! ')} ${chalk.green('Existing rules preserved and new ones merged.\n')}`);

        } catch(err: unknown) {
            if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
                this.error(chalk.red("The aegis.config.json file does not exist. You must run 'aegis init' first."));
            } else {
                this.error(chalk.red(err instanceof Error ? err.message : String(err)));
            }
        }
    }
}