import {Command, Flags} from '@oclif/core'
import {getDiff} from '../core/interceptor.js'
//We import the main brain, using groq AI
import {analyzeDiff} from '../core/ai.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export default class Scan extends Command {
  //Usefull fot aegis --help
  static description = 'Analyze Git Diffs with AI'

  async run(): Promise<void> {
    //We take the path of aegis.config.json
    const configPath = path.join(process.cwd(), 'aegis.config.json')

    //Fallback variable in case there are no rules in the project
    let projectRules = 'No specific rules provided.'

    //We try to read the file
    try {
      //We read the file
      projectRules = await fs.readFile(configPath, 'utf-8')
    } catch (err) {
      //If the file doesn't exist we don't block the process
      //The AI will apply stanrd rules
      this.warn('No aegis.config.json file found. AI will apply standard rules.')
    }

    try {
      //We incapsulate the getDiff function inside diff
      const diff = getDiff()

      this.log('\n🧠 Connecting to Groq servers...AI is reading your code.')

      //We send the diff string content to the analyzeDiff function to get the AI analyze it
      const aiResult = await analyzeDiff(diff, projectRules)

      //We print the Chain of thought of AI
      this.log('\n---- AI CHAIN OF THOUGHT ----')
      this.log(aiResult.chainOfThought)
      this.log('---------------------------\n')

      //Print the AI response from groq server
      this.log('\n----- OFFICIAL VERDICT -----')
      this.log(`VERDICT: ${aiResult.verdict}`)

      //We print the violations
      if (aiResult.violations.length > 0) {
        this.log('\nVIOLATIONS FOUND:')
        aiResult.violations.forEach((v) => {
          this.log(`- [${v.rule}]: ${v.fix}`)
        })
      }

      this.log('---------------------------\n')

      //We print the error if it fails
      if (aiResult.verdict === 'REJECTED') {
        process.exit(1)
      }

    } catch (err: unknown) {
      //If the print of getDiff function doesn't work out
      if (err instanceof Error) {
        this.error(err.message)
      } else {
        this.error('Errore sconosciuto durante lo scan.')
      }
    }
  }
}
