import { Command, Flags } from "@oclif/core";
import { scanEnvironment } from '../core/scanner.js';
import { generateArchitecturalRules } from '../core/ai.js';
import process from 'node:process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path'; //To process correctly the path format
import { select } from '@inquirer/prompts'; //To communicate with the CLI
// Imports native Node.js moduels for the file system if you need them

export default class Init extends Command {
    //help command description of AegisCode (es: aegis --help)
    static description = 'Inizialization of AegisCode in the current project...';

    //Flags creation (--force, --silent)
    static flags = {
        force: Flags.boolean({ char: 'f', description: 'Overwrites existing configuration' }),
    };

    //Main async method
    public async run(): Promise<void> {
        const { flags } = await this.parse(Init);

        const configPath = path.join(process.cwd(), 'aegis.config.json');

        //Security check to do not overwrite the aegis.config.file
        let fileExists = false;
        
        try {
            await fs.access(configPath);
            fileExists = true;
        } catch(err) {
            // File doesn't exist, which is fine
        }

        // We check this OUTSIDE the try-catch so this.error isn't swallowed
        if (fileExists && !flags.force) {
            this.error("The aegis.config.json file already exists. Use aegis init --force to overwrite it.");
        }

        this.log('Initializing AegisCode...');

        try {
            const currentFolder = process.cwd();

            //We call the scanEnviroment function inside scanner.ts to find all the tech stack of the project
            this.log('\n🔍 Scanning project environment...');
            const detectedStack = await scanEnvironment(currentFolder);

            const severityLevel = await select({
                message: 'Select the severity level for AegisCode:',
                choices: [
                    {
                        name: 'Relaxed (Architectural Tips Only)',
                        value: 'low'
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

            this.log('Chosen Level:', severityLevel);

            //Path configuration to create the aegis.config.json
            const configPath = path.join(currentFolder, 'aegis.config.json');

            this.log('\n⚙️ Mechanical scan completed. Invoking AI Architect for rule generation...');
            
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

            this.log(`👀 Surgical Look: Passed folder structure to AI (${folderStructure})`);

            // Invoking Qwen with the data found by the mechanical scanner AND the folder structure
            const generatedRules = await generateArchitecturalRules(detectedStack.languages, detectedStack.coreLibs, folderStructure);

            if (generatedRules.length > 0) {
                this.log('✨ The AI Architect has generated your custom rules!');
            } else {
                this.log('⚠️ AI Architect offline or unconfigured. Rules must be inserted manually.');
            }

            const configData = {
                aegisVersion: "0.1.0",
                severity: severityLevel,
                languages: detectedStack.languages, // <--- Nuova chiave!
                stack: detectedStack.coreLibs,      // <--- Object.keys(librerieBase)
                ai_rules: generatedRules 
            };

            await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8'); //Correct format of aegis.package.json

            this.log('✅ AegisCode Configured! File aegis.config.json generated successfully.');

        } catch (err) {
            this.error(err instanceof Error ? err.message : String(err));
        }
    }
}

