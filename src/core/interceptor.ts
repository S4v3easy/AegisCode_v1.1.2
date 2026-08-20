import { execSync } from 'node:child_process';

export function getDiff(): string {
    let output = '';

    try {
        
        try {
            //We found everything using this command but the project has to have a first commit
            output = execSync('git diff HEAD', { encoding: 'utf-8' });
        } catch {
            //If it fails (e.g. newly created repo without first commit), we concatenate the two diffs
            const staged = execSync('git diff --cached', { encoding: 'utf-8' });
            const unstaged = execSync('git diff', { encoding: 'utf-8' });
            output = staged + '\n' + unstaged;
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