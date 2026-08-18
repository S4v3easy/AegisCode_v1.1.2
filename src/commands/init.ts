import { Command, Flags } from "@oclif/core";
import process from 'node:process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
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

        this.log('Initializing AegisCode...');

        try {
            const currentFolder = process.cwd();
            const packageJsonPath = path.join(currentFolder, 'package.json');

            //Read package JSON
            const contentFile = await fs.readFile(packageJsonPath, 'utf-8');

            //Formatting the json text in an object
            const packageJsonObject = JSON.parse(contentFile);

            //Key Extraction from package JSON
            const librerieBase = packageJsonObject.dependencies || {};
            const librerieDev = packageJsonObject.devDependencies || {};

            this.log('Libraries found:', Object.keys(librerieBase).join(', '));

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

            const configData = {
                aegisVersion: "0.1.0",
                severity: severityLevel,
                stack: Object.keys(librerieBase),
                ai_rules: [] //Future rules for AI models
            };

            await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8'); //Correct format of aegis.package.json

            this.log('✅ AegisCode Configured! File aegis.config.json generated successfully.');

        } catch (err) {
            this.log('[Error]: package.json not found!');
            this.exit(1);
        }

    }
}