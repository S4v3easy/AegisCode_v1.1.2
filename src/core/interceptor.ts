import { execSync } from 'node:child_process';


export function getDiff(): string {
    try {
        //We start by taking all the modified rows inside git diff using git diff --cached
        const diffOutput = execSync('git diff --cached', { encoding: 'utf-8' });

        //If it has any real useful text, go out and return it
        if(diffOutput.trim() !== '') {
            return diffOutput;
        }

        //If the content is empty we execute a normal git diff without --cached flag
        const normalDiffOutput = execSync('git diff', { encoding: 'utf-8' });

        //If the normal dif command doesn't and is empty, we throw an error, it means the scanner didn't found any changes in the repository
        if(normalDiffOutput.trim() === '') {
            throw new Error('No changes detected in the repository.');
        }

        return normalDiffOutput;

    } catch(err) {
        //Manage the error
        if (err instanceof Error) {
            throw new Error(`Failed to read Git diff: ${err.message}`);
        }

        //Manage unknown error occured
        throw new Error('Failed to read Git diff: Unknown error occurred');
    }
}