import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import process from 'node:process';
import { Command } from "@oclif/core";
import { scanEnvironment } from '../core/scanner.js';//function to update the project enviroment
import { upgradeArchitecturalRules } from '../core/ai.js';

export default class Update extends Command {
    //Description
    static description = 'Smart update of AegisCode configuration, merging new tech stack with existing rules.';

    public async run(): Promise<void> {
        const currentFolder = process.cwd();
        const configPath = path.join(currentFolder, 'aegis.config.json');

        try {
            //We read the file and convert it to JSON format
            const fileBuffer = await fs.readFile(configPath, 'utf-8');
            const oldConfig = JSON.parse(fileBuffer);

            //Save the old rules
            const oldRules = oldConfig.ai_rules || [];
            this.log(`\n📂 Found existing config with ${oldRules.length} rules.`);

            //Start the new scan for the updated enviroment
            this.log('🔍 Scanning project environment for new dependencies...');

            //Insert scan enviroment
            const detectedStack = await scanEnvironment(currentFolder);
            
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
            
            this.log(`👀 Surgical Look: Passed folder structure to AI (${folderStructure})`);
            this.log('⚙️ Invoking AI Architect for smart rule merge...');

            const mergedRules = await upgradeArchitecturalRules(oldRules, detectedStack.languages, detectedStack.coreLibs, folderStructure);

            // Costruiamo il nuovo file JSON mantenendo version e severity intatti
            const newConfig = {
                aegisVersion: oldConfig.aegisVersion || "0.1.0",
                severity: oldConfig.severity || "medium",
                languages: detectedStack.languages,
                stack: detectedStack.coreLibs,
                ai_rules: mergedRules 
            };

            await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');

            this.log('✅ AegisCode Updated Successfully! Existing rules preserved and new ones merged.');

        } catch(err: any) {
            if (err.code === 'ENOENT') {
                this.error("The aegis.config.json file does not exist. You must run 'aegis init' first.");
            } else {
                this.error(err instanceof Error ? err.message : String(err));
            }
        }
    }
}