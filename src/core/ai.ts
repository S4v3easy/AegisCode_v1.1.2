import 'dotenv/config';
import type { AegisAnalysisReport, AegisConfig } from './types.js';
import { buildSystemPrompt } from './promptBuilder.js';
import { getAuthConfig, type AuthConfig } from './auth.js';
import { DEFAULTS } from './config.js';
import { createProvider, CloudProxyClient } from './providers/index.js';
import { parseAnalysisResponse, parseRulesResponse } from './jsonParser.js';

// ─── INTERNAL HELPERS ─────────────────────────────────────────────

/**
 * Parses the project rules string into a typed config.
 */
function parseProjectConfig(projectRules: string): AegisConfig {
    try {
        return JSON.parse(projectRules);
    } catch {
        console.warn('Warning: aegis.config.json is missing or corrupted. Using fallback settings.');
        return {};
    }
}

/**
 * Resolves authentication or throws a clear error.
 */
async function requireAuth(): Promise<AuthConfig> {
    const auth = await getAuthConfig();
    if (!auth) {
        throw new Error(
            "Authentication missing.\nRun 'aegis login' to use your 5 free daily scans, or 'aegis auth' to use your own API key."
        );
    }
    return auth;
}

/**
 * Determines the appropriate model for scanning based on auth type.
 */
function getScanModel(auth: AuthConfig): string {
    if (auth.type === 'byok' && auth.scanModel) return auth.scanModel;
    if (auth.type === 'local') return auth.model;
    return DEFAULTS.SCAN_MODEL;
}

/**
 * Determines the appropriate model for rule generation based on auth type.
 */
function getInitModel(auth: AuthConfig): string {
    if (auth.type === 'byok' && auth.initModel) return auth.initModel;
    if (auth.type === 'local') return auth.model;
    return DEFAULTS.INIT_MODEL;
}

/**
 * Determines the appropriate timeout based on auth type (local models need more time).
 */
function getTimeout(auth: AuthConfig): number {
    return auth.type === 'local' ? DEFAULTS.LOCAL_TIMEOUT : DEFAULTS.CLOUD_TIMEOUT;
}

/**
 * Checks if an error is a network/timeout issue for Fail-Open behavior.
 */
function isNetworkError(e: unknown): boolean {
    if (e instanceof Error) {
        if (e.name === 'AbortError') return true;
        if (e.message?.toLowerCase().includes('fetch')) return true;
        if ((e as NodeJS.ErrnoException).code === 'ENOTFOUND') return true;
        if ((e as NodeJS.ErrnoException).code === 'ECONNREFUSED') return true;
    }
    return false;
}

// ─── MAIN EXPORTED FUNCTIONS (Signatures unchanged from V1) ──────

/**
 * Analyzes a git diff against architectural rules using AI.
 * Returns a structured verdict with violations.
 */
export async function analyzeDiff(diff: string, projectRules: string): Promise<AegisAnalysisReport> {
    const parsedConfig = parseProjectConfig(projectRules);
    const auth = await requireAuth();

    const severity = parsedConfig.severity || 'medium';
    const stack = {
        languages: parsedConfig.languages || [],
        coreLibs: parsedConfig.stack || [],
    };
    const customRules = parsedConfig.ai_rules || [];
    const systemPrompt = buildSystemPrompt(severity, stack, customRules);

    let rawContent: string;

    try {
        if (auth.type === 'jwt') {
            const proxy = new CloudProxyClient(auth);
            rawContent = await proxy.scan(diff, systemPrompt, getTimeout(auth));
        } else {
            const provider = createProvider(auth);
            rawContent = await provider.complete(
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Analyze this git diff:\n\n${diff}` },
                ],
                {
                    model: getScanModel(auth),
                    temperature: DEFAULTS.SCAN_TEMPERATURE,
                    timeoutMs: getTimeout(auth),
                }
            );
        }
    } catch (e: unknown) {
        // Fail-Open for network issues or timeouts
        if (isNetworkError(e)) {
            console.warn('\n⚠️  \x1b[33m[AEGIS WARNING]: Network timeout or unreachable. Fail-Open active. Allowing commit.\x1b[0m\n');
            return {
                verdict: 'APPROVED',
                violations: [],
                chainOfThought: 'Fail-open: Network timeout. Allowing commit to prevent blocking developer workflow.',
            };
        }
        throw e;
    }

    return parseAnalysisResponse(rawContent);
}

/**
 * Generates architectural rules for a new project using AI.
 * Prompt content is defined inline and must NOT be modified without explicit approval.
 */
export async function generateArchitecturalRules(
    languages: string[],
    stack: string[],
    folderStructure: string
): Promise<string[]> {
    const auth = await getAuthConfig();
    if (!auth) {
        console.warn('Authentication missing. Run aegis login or aegis auth.');
        return [];
    }

    const architectPrompt = `You are an elite Senior Staff Engineer at a FAANG company. 
I am initializing a new software project. My mechanical sensors detected the following stack:
- Languages: ${languages.join(', ') || 'Unknown'}
- Core Libraries/Frameworks: ${stack.join(', ') || 'Unknown'}
- Project Structure: ${folderStructure}
    
Your task: Generate between 3 and 5 strict, production-grade architectural rules that developers MUST follow.

CRITICAL INSTRUCTIONS FOR RULE GENERATION:
1. FULL-STACK COVERAGE: The rules MUST be universally applicable to the SPECIFIC stack detected. If you detect both a Frontend and a Backend framework, you must generate rules that cover the Frontend, the Backend, and the Integration Boundary between them.
2. ARCHITECTURAL DEPTH: Do NOT generate trivial advice (e.g., "use TypeScript", "write clean code"). Generate deep architectural constraints regarding State Management, Data Access Isolation, Security Boundaries, or Concurrency.
3. ADAPTIVE QUANTITY: Generate 3 rules for simple stacks. Generate up to 5 rules for complex, multi-layer monorepos.

OUTPUT FORMAT:
You MUST output ONLY a valid JSON array of strings. No markdown formatting, no explanations, no chat.`;

    try {
        let rawContent: string;

        if (auth.type === 'jwt') {
            const proxy = new CloudProxyClient(auth);
            rawContent = await proxy.generateRules(languages, stack, folderStructure, getTimeout(auth));
        } else {
            const provider = createProvider(auth);
            rawContent = await provider.complete(
                [{ role: 'user', content: architectPrompt }],
                {
                    model: getInitModel(auth),
                    temperature: DEFAULTS.INIT_TEMPERATURE,
                    timeoutMs: getTimeout(auth),
                }
            );
        }

        const rules = parseRulesResponse(rawContent);
        if (rules.length > 0) return rules;

        // Fallback if AI response was empty or unparseable
        console.warn('\n⚠️ AI returned malformed JSON. Using fallback baseline rules.');
        return [
            'BASELINE_SECURITY: No exposed secrets or credentials.',
            'CROSS_PLATFORM_SAFETY: Avoid OS-specific bindings unless required by stack.',
        ];
    } catch (err: unknown) {
        throw new Error((err instanceof Error ? err.message : String(err)) || 'Failed to generate rules');
    }
}

/**
 * Upgrades existing architectural rules by merging with current project state.
 * Prompt content is defined inline and must NOT be modified without explicit approval.
 */
export async function upgradeArchitecturalRules(
    oldRules: string[],
    languages: string[],
    stack: string[],
    folderStructure: string
): Promise<string[]> {
    const auth = await getAuthConfig();
    if (!auth) return oldRules;

    const architectPrompt = `You are an elite Senior Staff Engineer at a FAANG company.
We are updating an EXISTING software project.

Here is the EXACT list of historical architectural rules the team has been using:
${JSON.stringify(oldRules, null, 2)}

My mechanical sensors just detected the CURRENT technology stack and project structure:
- Languages: ${languages.join(', ') || 'Unknown'}
- Core Libraries/Frameworks: ${stack.join(', ') || 'Unknown'}
- Project Structure: ${folderStructure}

Your task is to merge the rules intelligently. There is no strict limit on the total number of output rules. You must output ALL valid preserved historical rules, PLUS any new rules you generate.

CRITICAL INSTRUCTIONS FOR RULE MERGING:
1. PRESERVE all general architectural rules and manually added team rules.
2. DELETE any historical rule that is EXPLICITLY and ONLY tied to a technology (like Django, pytest, Go, etc.) that is NO LONGER present in the current stack list above.
3. ADD up to 2 NEW strict architectural rules based ONLY on any new technologies you spot in the stack. Ensure FULL-STACK COVERAGE and ARCHITECTURAL DEPTH.
4. Do NOT generate trivial advice. Focus on State Management, Data Access, Security, or Integration Boundaries.

OUTPUT FORMAT:
You MUST output ONLY a valid JSON array of strings containing the final merged rules. No markdown formatting, no explanations, no chat.`;

    try {
        let rawContent: string;

        if (auth.type === 'jwt') {
            const proxy = new CloudProxyClient(auth);
            rawContent = await proxy.upgradeRules(oldRules, languages, stack, folderStructure, getTimeout(auth));
        } else {
            const provider = createProvider(auth);
            rawContent = await provider.complete(
                [{ role: 'user', content: architectPrompt }],
                {
                    model: getInitModel(auth),
                    temperature: DEFAULTS.INIT_TEMPERATURE,
                    timeoutMs: getTimeout(auth),
                }
            );
        }

        const rules = parseRulesResponse(rawContent);
        if (rules.length > 0) return rules;

        return oldRules; // Preserve existing rules if parsing fails
    } catch {
        return oldRules; // Preserve existing rules on error
    }
}
