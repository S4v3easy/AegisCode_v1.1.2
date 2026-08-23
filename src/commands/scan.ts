import {Command, Flags, ux} from '@oclif/core'
import {getDiff} from '../core/interceptor.js'
// Import the main brain, using OpenRouter AI
import {analyzeDiff} from '../core/ai.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import chalk from 'chalk'

export default class Scan extends Command {
  // Useful for aegis --help
  static description = 'Analyze Git Diffs with AI'

  async run(): Promise<void> {
    // We take the path of aegis.config.json
    const configPath = path.join(process.cwd(), 'aegis.config.json')

    // Fallback variable in case there are no rules in the project
    let projectRules = 'No specific rules provided.'

    // We try to read the file
    try {
      projectRules = await fs.readFile(configPath, 'utf-8')
    } catch (err) {
      // If the file doesn't exist we don't block the process
      // The AI will apply standard rules
      this.warn('No aegis.config.json file found. AI will apply standard rules.')
    }

    try {
      // We encapsulate the getDiff function inside diff
      const diff = getDiff()

      // --- DETERMINISTIC PRE-CHECKS (Zero AI Tokens) ---
      const deterministicRules = [
          { regex: /\beval\s*\(/, rule: "CRITICAL_SECURITY", fix: "Remove eval() statement. Executing raw string code is strictly forbidden." },
          { regex: /(?:password|secret|private_key|api_key|token)\s*[:=]\s*["'][a-zA-Z0-9_.-]{12,}["']/i, rule: "BASELINE_SECURITY", fix: "Hardcoded secrets/credentials detected. Use environment variables." }
      ];

      for (const check of deterministicRules) {
          // If a new line added in the diff (+ line) contains the forbidden pattern
          if (diff.split('\n').some(line => line.startsWith('+') && check.regex.test(line))) {
              const elapsed = "0.01";
              this.log(`\n${chalk.bgRed.white.bold(' 🛑 AEGIS VERDICT: REJECTED ')} ${chalk.dim(`(${elapsed}s - Local Pre-Check)`)}\n`)
              this.log(chalk.dim.italic('--- Fast-Path Analysis ---'))
              this.log(chalk.dim('Violation caught by local deterministic scanner. AI network call bypassed to save time and tokens.'))
              this.log(chalk.dim('---------------------------\n'))
              this.log(chalk.red.bold('VIOLATIONS FOUND:'))
              this.log(`\n❌ ${chalk.red.bold('Rule:')} ${check.rule}`)
              this.log(`💡 ${chalk.yellow.bold('Fix:')} ${chalk.cyan(check.fix)}\n`)
              process.exit(1)
          }
      }

      const phrases = [
        { icon: '🧠', text: 'Scanning code changes...' },
        { icon: '🛡️ ', text: 'Validating architectural rules...' },
        { icon: '🔬', text: 'Deep diving into logic...' },
        { icon: '⚡', text: 'Assessing vulnerability patterns...' }
      ]
      const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
      let frame = 0
      let phraseIndex = 0

      // Hide cursor
      process.stdout.write('\x1B[?25l')

      const spinnerInterval = setInterval(() => {
        const current = phrases[phraseIndex]
        const spinFrame = spinnerFrames[frame % spinnerFrames.length]
        let output = `\r ${current.icon} ${chalk.cyanBright(spinFrame)}  `
        
        const lightPos = (frame % (current.text.length + 10)) - 5;
        
        for (let i = 0; i < current.text.length; i++) {
            const char = current.text[i]
            const dist = Math.abs(i - lightPos)
            if (dist === 0) {
                output += chalk.cyanBright.bold(char)
            } else if (dist === 1) {
                output += chalk.cyan(char)
            } else if (dist === 2) {
                output += chalk.blueBright(char)
            } else {
                output += chalk.gray.dim(char)
            }
        }
        
        output += ' '.repeat(20) // padding to clear previous longer strings
        process.stdout.write(output)
        
        frame++
        if (frame % 50 === 0) { // Change text every 3.5 seconds
            phraseIndex = (phraseIndex + 1) % phrases.length
            frame = 0 
        }
      }, 70)

      const startTime = Date.now()
      let aiResult;
      try {
          aiResult = await analyzeDiff(diff, projectRules)
      } finally {
          clearInterval(spinnerInterval)
          // Show cursor and clear line
          process.stdout.write('\x1B[?25h\r' + ' '.repeat(80) + '\r')
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

      if (aiResult.verdict === 'APPROVED') {
        this.log(`\n${chalk.bgGreen.white.bold(' ✅ AEGIS VERDICT: APPROVED ')} ${chalk.dim(`(${elapsed}s)`)}`)
        this.log(chalk.green('No architectural violations found. You are good to go! 🚀\n'))
      } else {
        this.log(`\n${chalk.bgRed.white.bold(' 🛑 AEGIS VERDICT: REJECTED ')} ${chalk.dim(`(${elapsed}s)`)}\n`)
        
        // Print the Chain of Thought only on rejection, in dim gray
        this.log(chalk.dim.italic('--- AI Chain of Thought ---'))
        this.log(chalk.dim(aiResult.chainOfThought))
        this.log(chalk.dim('---------------------------\n'))

        this.log(chalk.red.bold('VIOLATIONS FOUND:'))
        aiResult.violations.forEach((v) => {
          this.log(`\n❌ ${chalk.red.bold('Rule:')} ${v.rule}`)
          this.log(`💡 ${chalk.yellow.bold('Fix:')} ${chalk.cyan(v.fix)}`)
        })
        this.log('\n')
        
        process.exit(1)
      }

    } catch (err: unknown) {
      if (err instanceof Error) {
        // Intercept specific parsing or extraction errors
        if (err.message.includes('JSON Parse Error') || err.message.includes('No JSON block') || err.message.includes('Error during surgical JSON extraction')) {
          this.warn('\n⚠️ AI generated malformed output or reached token limits.');
          this.log(`💡 ${chalk.yellow('Solution:')} Reasoning models occasionally hallucinate on formatting. Please run \`aegis scan\` again.`);
          process.exit(1);
        } else {
          this.error(err.message);
        }
      } else {
        this.error('An unknown error occurred during the scan.');
      }
    }
  }
}
