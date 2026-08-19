import { execSync } from 'node:child_process';

export function getDiff(): string {
    let output = '';

    try {
        //We try git diff --cached first when the developer packed the code with git add .
        output = execSync('git diff --cached', { encoding: 'utf-8' });

        //If git diff --cached doesn't work out we use the fallback by using git diff normal
        if(output.trim() === '') {
            output = execSync('git diff', { encoding: 'utf-8' });
        }

    } catch(err: unknown) {
        //Manage the error
        if (err instanceof Error) {
            throw new Error(`Failed to read Git diff: ${err.message}`);
        }

        //Manage unknown error occured
        throw new Error('Failed to read Git diff: Unknown error occurred');
    }

    //If the output is completely empty it means there are no rows modified inside the base code
    if (output.trim() === '') {
        throw new Error('No changes detected in the repository.');
    }

    //If everything is allright and the scanner found something we return the output variabile converted with trim()
    return output;
}