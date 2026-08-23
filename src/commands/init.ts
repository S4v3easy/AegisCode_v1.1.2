import { Command, Flags, ux } from "@oclif/core";
import { scanEnvironment } from '../core/scanner.js';
import { generateArchitecturalRules } from '../core/ai.js';
import process from 'node:process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path'; 
import { select } from '@inquirer/prompts'; 
import chalk from 'chalk';

export default class Init extends Command {
    // Help command description for AegisCode (e.g. aegis --help)
    static description = 'Initialization of AegisCode in the current project...';

    // Flags creation (--force, --silent)
    static flags = {
        force: Flags.boolean({ char: 'f', description: 'Overwrites existing configuration' }),
    };

    // Main async method
    public async run(): Promise<void> {
        const { flags } = await this.parse(Init);

        const configPath = path.join(process.cwd(), 'aegis.config.json');

        // Security check to avoid overwriting the aegis.config.json file
        let fileExists = false;
        
        try {
            await fs.access(configPath);
            fileExists = true;
        } catch(err) {
            // File doesn't exist, which is fine
        }

        // We check this OUTSIDE the try-catch so this.error isn't swallowed
        if (fileExists && !flags.force) {
            this.error(chalk.red("The aegis.config.json file already exists. Use aegis init --force to overwrite it."));
        }

        this.log(chalk.cyan.bold('\nInitializing AegisCode...'));

        try {
            const currentFolder = process.cwd();

            // Animated spinner for mechanical scan
            ux.action.start('Scanning project environment');
            const detectedStack = await scanEnvironment(currentFolder);
            ux.action.stop(chalk.green('completed'));
            this.log(chalk.green(`Mechanical scan completed. Detected languages: ${chalk.cyan(detectedStack.languages.join(', ') || 'None')}`));

            this.log(''); // Empty line for spacing
            const severityLevel = await select({
                message: 'Select the severity level for AegisCode:',
                choices: [
                    {
                        name: 'Relaxed (Architectural Tips Only)',
                        value: 'relaxed' // Fixed from 'low' to match promptBuilder SEVERITY_PROFILES
                    },
                    {
                        name: 'Standard (Block obviously incorrect patterns)',
                        value: 'medium'
                    },
                    {
                        name: 'Paranoid (Strict Enterprise Rules, Zero Tolerance)',
                        value: 'high'
                    },
                ],
            });

            this.log(`\n${chalk.dim('Chosen Level:')} ${chalk.cyan.bold(severityLevel)}\n`);

            // Animated spinner for AI generation
            ux.action.start('Invoking AI Architect for smart rule generation');
            
            // Surgical Look: Map the directory structure
            let folderStructure = 'Unknown';
            try {
                // Try to read the src folder first if it exists (typical in TS/JS projects)
                const srcPath = path.join(currentFolder, 'src');
                const dirs = await fs.readdir(srcPath);
                folderStructure = `/src: ${dirs.join(', ')}`;
            } catch {
                try {
                    // Fallback to the root excluding hidden folders and node_modules
                    const dirs = await fs.readdir(currentFolder);
                    folderStructure = `/root: ${dirs.filter(d => !d.startsWith('.') && d !== 'node_modules').join(', ')}`;
                } catch {}
            }

            // Invoking Qwen with the data found by the mechanical scanner AND the folder structure
            const generatedRules = await generateArchitecturalRules(detectedStack.languages, detectedStack.coreLibs, folderStructure);

            if (generatedRules.length > 0) {
                ux.action.stop(chalk.green('completed'));
                this.log(chalk.green('The AI Architect has generated your custom rules!'));
            } else {
                ux.action.stop(chalk.yellow('failed'));
                this.warn(chalk.yellow('AI Architect offline or unconfigured. Rules must be inserted manually.'));
            }

            const configData = {
                aegisVersion: "0.1.0",
                severity: severityLevel,
                languages: detectedStack.languages, // <--- New key!
                stack: detectedStack.coreLibs,      // <--- Extracted base libraries
                ai_rules: generatedRules 
            };

            await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8'); // Correct format for aegis.config.json

            this.log(`\n${chalk.bgGreen.white.bold(' ✅ AEGISCODE CONFIGURED! ')} ${chalk.green('File aegis.config.json generated successfully.\n')}`);

        } catch (err) {
            this.error(chalk.red(err instanceof Error ? err.message : String(err)));
        }
    }
}

