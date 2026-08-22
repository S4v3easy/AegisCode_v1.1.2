import { execSync } from 'node:child_process';

export function getDiff(): string {
    let output = '';

    try {
        try {
            // Try to diff against HEAD (requires at least one commit in the repo)
            // 'ignore' on stderr suppresses the ugly Git error message on fresh repos
            output = execSync('git diff HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
        } catch {
            // If it fails (e.g., newly created repo without a first commit), we concatenate the two diffs
            const staged = execSync('git diff --cached', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
            const unstaged = execSync('git diff', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
            output = staged + '\n' + unstaged;
        }

    } catch(err: unknown) {
        // Manage the error
        if (err instanceof Error) {
            throw new Error(`Failed to read Git diff: ${err.message}`);
        }

        // Manage unknown error occurrence
        throw new Error('Failed to read Git diff: Unknown error occurred');
    }

    // If the output is completely empty, it means there are no modified rows
    if (output.trim() === '') {
        throw new Error('No changes detected in the repository.');
    }

    // Return the trimmed output
    return output;
}