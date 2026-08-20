import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface DetectedStack {
    languages: string[];
    coreLibs: string[];
}

//Function to find the main stack of the project and then pass it to the init command
export async function scanEnvironment(dirPath: string): Promise<DetectedStack> {
    //Empty declaration
    let detectedLanguages: string[] = [];
    let detectedLibs: string[] = [];

    try {
        const pkgPath = path.join(dirPath, 'package.json');

        //We use an internal try catch to manage the existence of the package JSON
        try {
            const packageJsonContent = await fs.readFile(pkgPath, 'utf-8');
            const pkg = JSON.parse(packageJsonContent);

            detectedLanguages.push("JavaScript/TypeScript");

            //After control the object actually exists we can extract the keys from it
            if(pkg.dependencies) {
                //The three dots (...) are used to "spread" the array of keys inside detectedLibs
                detectedLibs.push(...Object.keys(pkg.dependencies));
            }

            if(pkg.devDependencies) {
                detectedLibs.push(...Object.keys(pkg.devDependencies));
            }

        } catch(err) {
            //Here we just pass the error and go on with the next try catch to see if there's another techonolgy/framework
        }

    } catch(err) {
        throw new Error('Critical error scanning environment.')
    }

    return {
        languages: detectedLanguages,
        coreLibs: detectedLibs
    };
}