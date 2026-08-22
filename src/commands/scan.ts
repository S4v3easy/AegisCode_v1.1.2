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

      // Start the animated spinner using oclif native ux to prevent flickering
      ux.action.start('🧠 Scanning code changes')
      const startTime = Date.now()

      // We send the diff string content to the analyzeDiff function
      const aiResult = await analyzeDiff(diff, projectRules)
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      ux.action.stop()

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
