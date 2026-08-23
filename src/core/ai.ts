import 'dotenv/config';
import { AegisAnalysisReport } from './types.js';
import { buildSystemPrompt } from './promptBuilder.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

interface AegisConfig {
    severity?: string;
    languages?: string[];
    stack?: string[];
    ai_rules?: string[];
}

function getAuthDetails() {
    const aegisDir = path.join(os.homedir(), '.aegiscode');
    const credsPath = path.join(aegisDir, 'credentials.json');
    const tokenPath = path.join(aegisDir, 'token.json');

    // 1. Try BYOK (OpenRouter Key)
    if (fs.existsSync(credsPath)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
            if (creds.openRouterKey) {
                return { type: 'byok', key: creds.openRouterKey };
            }
        } catch(e) {}
    }

    // 2. Try JWT Token (Free Tier / Pro via Proxy)
    if (fs.existsSync(tokenPath)) {
        try {
            const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
            if (tokens.accessToken) {
                return { type: 'jwt', token: tokens.accessToken };
            }
        } catch(e) {}
    }

    // 3. Fallback to env for local dev
    if (process.env.OPEN_ROUTER_API_KEY) {
        return { type: 'byok', key: process.env.OPEN_ROUTER_API_KEY };
    }

    return null;
}

export async function analyzeDiff(diff: string, projectRules: string): Promise<AegisAnalysisReport> {
    let parsedConfig: AegisConfig = {};
    try {
        parsedConfig = JSON.parse(projectRules);
    } catch (e) {
        console.warn('Warning: aegis.config.json is missing or corrupted. Using fallback settings.');
    }

    const auth = getAuthDetails();
    if (!auth) {
        throw new Error("Authentication missing.\nRun 'aegis login' to use your 5 free daily scans, or 'aegis auth' to use your own API key.");
    }

    let response;

    const severity = parsedConfig.severity || 'medium';
    const stack = {
        languages: parsedConfig.languages || [],
        coreLibs: parsedConfig.stack || []
    };
    const customRules = parsedConfig.ai_rules || [];
    const systemPrompt = buildSystemPrompt(severity, stack, customRules);

    if (auth.type === 'byok') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.key}`,
                'HTTP-Referer': 'https://aegiscode.dev',
                'X-Title': 'AegisCode CLI',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "deepseek/deepseek-r1",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Analyze this git diff:\n\n${diff}` }
                ],
                temperature: 0.1,
            })
        });
    } else {
        const proxyUrl = process.env.AEGIS_PROXY_URL || 'https://www.aegiscode.app/api/scan';
        // Proxy flow
        response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                diff: diff,
                systemPrompt: systemPrompt
            })
        });
    }

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `API Error: ${response.statusText}`);
    }

    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

    let pureJsonString = '';
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i) || content.match(/```\s*([\s\S]*?)\s*```/i);
    
    if (jsonMatch && jsonMatch[1]) {
        pureJsonString = jsonMatch[1].trim();
    } else {
        const keywordIndex = content.lastIndexOf('"verdict"');
        if (keywordIndex === -1) {
             throw new Error(`No JSON block and no "verdict" key found in the response.\n\n[RAW OUTPUT]:\n${content}`);
        }
        const startIndex = content.lastIndexOf('{', keywordIndex);
        const endIndex = content.lastIndexOf('}');
        
        if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
            pureJsonString = content.substring(startIndex, endIndex + 1);
        } else {
            throw new Error(`Error during surgical JSON extraction.\n\n[RAW OUTPUT]:\n${content}`);
        }
    }
    
    try {
        pureJsonString = pureJsonString.replace(/\\(?!["\\/bfnrt])/g, '\\\\');
        return JSON.parse(pureJsonString) as AegisAnalysisReport;
    } catch (e) {
        throw new Error(`JSON Parse Error: ${(e as Error).message}\n\n[EXTRACTED STRING]:\n${pureJsonString}`);
    }
}

export async function generateArchitecturalRules(languages: string[], stack: string[], folderStructure: string): Promise<string[]> {
    const auth = getAuthDetails();
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
        let response;
        if (auth.type === 'byok') {
            response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${auth.key}`,
                    'HTTP-Referer': 'https://aegiscode.dev',
                    'X-Title': 'AegisCode CLI',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: "qwen/qwen3-32b",
                    messages: [{ role: "user", content: architectPrompt }],
                    temperature: 0.3,
                })
            });
        } else {
            response = await fetch(process.env.AEGIS_INIT_URL || 'https://www.aegiscode.app/api/init', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${auth.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ languages, stack, folderStructure })
            });
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `API Error: ${response.statusText}`);
        }

        const data = await response.json();
        let content = data.choices ? data.choices[0]?.message?.content : (data.content || '[]');
        if (content === '[]' && data.choices === undefined) {
             // In case proxy returns something slightly different, usually it forwards openrouter format
             content = data.choices ? data.choices[0]?.message?.content : '[]';
        }
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

        const jsonMatch = content.match(/\[\s*([\s\S]*?)\s*\]/i);
        if (jsonMatch) {
            const pureArray = `[${jsonMatch[1]}]`;
            const parsedRules = JSON.parse(pureArray);
            if (Array.isArray(parsedRules)) return parsedRules;
        }
        return [];
    } catch(err: any) {
        throw new Error(err.message || 'Failed to generate rules');
    }
}

export async function upgradeArchitecturalRules(oldRules: string[], languages: string[], stack: string[], folderStructure: string): Promise<string[]> {
    const auth = getAuthDetails();
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
        let response;
        if (auth.type === 'byok') {
            response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${auth.key}`,
                    'HTTP-Referer': 'https://aegiscode.dev',
                    'X-Title': 'AegisCode CLI',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: "qwen/qwen3-32b",
                    messages: [{ role: "user", content: architectPrompt }],
                    temperature: 0.3,
                })
            });
        } else {
            response = await fetch(process.env.AEGIS_UPDATE_URL || 'https://www.aegiscode.app/api/update', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${auth.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ oldRules, languages, stack, folderStructure })
            });
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || `API Error: ${response.statusText}`);
        }

        const data = await response.json();
        let content = data.choices ? data.choices[0]?.message?.content : (data.content || '[]');
        if (content === '[]' && data.choices === undefined) {
             content = data.choices ? data.choices[0]?.message?.content : '[]';
        }
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

        const jsonMatch = content.match(/\[\s*([\s\S]*?)\s*\]/i);
        if (jsonMatch) {
            const pureArray = `[${jsonMatch[1]}]`;
            const parsedRules = JSON.parse(pureArray);
            if (Array.isArray(parsedRules)) return parsedRules;
        }
        return oldRules;
    } catch(err: any) {
        throw new Error(err.message || 'Failed to update rules');
    }
}
