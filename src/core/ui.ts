import chalk from 'chalk';
import { RuleViolation } from './types.js';

export interface SpinnerPhrase {
    icon: string;
    text: string;
}

export interface CylonSpinner {
    start(): void;
    stop(): void;
}

export function createCylonSpinner(phrases: SpinnerPhrase[]): CylonSpinner {
    let spinnerInterval: NodeJS.Timeout;
    const spinnerFrames = [
        "[=       ]",
        "[ =      ]",
        "[  =     ]",
        "[   =    ]",
        "[    =   ]",
        "[     =  ]",
        "[      = ]",
        "[       =]",
        "[      = ]",
        "[     =  ]",
        "[    =   ]",
        "[   =    ]",
        "[  =     ]",
        "[ =      ]"
    ];
    let i = 0;
    let phraseIndex = 0;
    let ticks = 0;

    return {
        start() {
            spinnerInterval = setInterval(() => {
                ticks++;
                if (ticks % 20 === 0) { // Rotate phrase every 2 seconds (100ms * 20)
                    phraseIndex = (phraseIndex + 1) % phrases.length;
                }
                const frame = spinnerFrames[i];
                const activePhrase = phrases[phraseIndex];
                
                // Color the cylon eye
                const coloredFrame = frame.replace('=', chalk.cyanBright('='));
                
                process.stdout.write(`\r${chalk.dim(coloredFrame)} ${activePhrase.icon} ${activePhrase.text}`);
                i = (i + 1) % spinnerFrames.length;
            }, 100);
        },
        stop() {
            clearInterval(spinnerInterval);
            process.stdout.write('\r\x1b[K'); // clear line
        }
    };
}

export function renderApprovedBanner(elapsed: string): string {
    return chalk.bgGreen.black.bold(` ✅ AEGIS VERDICT: APPROVED `) + 
           chalk.dim(` (${elapsed}) `) + 
           chalk.green(`You are good to go! 🚀\n`);
}

export function renderApprovedWithWarningsBanner(elapsed: string, warningCount: number): string {
    return chalk.bgYellow.black.bold(` ⚠️ AEGIS VERDICT: APPROVED WITH WARNINGS `) + 
           chalk.dim(` (${elapsed}) `) + 
           chalk.yellow(`Found ${warningCount} minor issue(s).\n`);
}

export function renderRejectedBanner(elapsed: string): string {
    return chalk.bgRed.white.bold(` 🛑 AEGIS VERDICT: REJECTED `) + 
           chalk.dim(` (${elapsed})\n`);
}

export function renderCacheHitBanner(): string {
    return chalk.bgGreen.black.bold(` ✅ AEGIS VERDICT: CACHE HIT `) + 
           chalk.dim(` (0.00s) `) + 
           chalk.green(`You are good to go! 🚀\n`);
}

export function renderDeterministicRejection(rule: string, fix: string, elapsed: string): string {
    let output = renderRejectedBanner(elapsed);
    output += chalk.dim.italic(`\n--- Fast-path analysis ---\n\n`);
    output += `${chalk.red('❌')} ${chalk.bold('Rule:')} ${rule}\n`;
    output += `   ${chalk.bold('Fix:')} ${fix}\n`;
    return output;
}

export function renderViolation(v: RuleViolation): string {
    const isWarn = v.severity === 'WARN';
    const icon = isWarn ? chalk.yellow('⚠️') : chalk.red('❌');
    let output = `${icon} ${chalk.bold('Rule:')} ${v.rule}\n`;
    output += `   ${chalk.bold('Fix:')} ${v.fix}\n`;
    return output;
}

export function renderChainOfThought(cot: string): string {
    if (!cot) return '';
    return chalk.dim.italic(`\n--- AI Chain of Thought ---\n${cot}\n\n`);
}

export function renderDiffTruncationWarning(originalLines: number, truncatedLines: number): string {
    return chalk.yellow(`\n⚠️ Diff too large (${originalLines} lines). Truncated to first ${truncatedLines} lines for AI scan.\n`);
}

export function renderFailOpenWarning(): string {
    return chalk.yellow(`\n⚠️ Network timeout or unreachable. Fail-Open active. Allowing commit.\n`);
}
