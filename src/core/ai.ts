import 'dotenv/config';
import { AegisAnalysisReport } from './types.js';
import { buildSystemPrompt } from './promptBuilder.js';//AI prompt builder function

/**
* Define the interface for the configuration file to enforce strict typing.
*/
interface AegisConfig {
    severity?: string;
    languages?: string[];
    stack?: string[];
    ai_rules?: string[];
}

/**
* Sends the git diff to OpenRouter (DeepSeek) for architectural validation.
* @param diff The raw git diff string extracted by the interceptor.
* @returns The AI's judgement as a string.
*/

export async function analyzeDiff(diff: string, projectRules: string): Promise<AegisAnalysisReport> {
    // Transform the raw string into a JSON object
    let parsedConfig: AegisConfig = {};
    try {
        parsedConfig = JSON.parse(projectRules);
    } catch (e) {
        console.warn('Warning: aegis.config.json is missing or corrupted. Using fallback settings.');
    }

    // Extract necessary data with safety fallbacks
    const severity = parsedConfig.severity || 'medium';
    const stack = {
        languages: parsedConfig.languages || [],
        coreLibs: parsedConfig.stack || []
    };
    const customRules = parsedConfig.ai_rules || [];

    // Initialize the prompt
    const systemPrompt = buildSystemPrompt(severity, stack, customRules);
    const apiKey = process.env.OPEN_ROUTER_API_KEY;

    if(!apiKey) {
        throw new Error("OPENROUTER_API_KEY is missing in the environment variables.");
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://aegiscode.dev', // Required by OpenRouter
                'X-Title': 'AegisCode CLI',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "deepseek/deepseek-r1-0528",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Analyze this git diff:\n\n${diff}` }
                ],
                temperature: 0.1,
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`API Error: ${errData.error?.message || response.statusText}`);
        }

        const data = await response.json();

        let content = data.choices[0]?.message?.content || '{}';
        
        // Preemptively remove the entire <think>...</think> block if present
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

        let pureJsonString = '';

        // STRATEGY 1: Look for Markdown JSON blocks ```json ... ``` (Safest approach)
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i) || content.match(/```\s*([\s\S]*?)\s*```/i);
        
        if (jsonMatch && jsonMatch[1]) {
            pureJsonString = jsonMatch[1].trim();
        } else {
            // STRATEGY 2 (Fallback): Extraction based on structural anchoring
            // Since the AI thinks out loud, we ignore everything until we hit the "verdict" key
            const keywordIndex = content.lastIndexOf('"verdict"');
            
            if (keywordIndex === -1) {
                 throw new Error(`No JSON block and no "verdict" key found in the response.\n\n[RAW OUTPUT]:\n${content}`);
            }

            // Find the opening curly brace immediately preceding the "verdict" key
            const startIndex = content.lastIndexOf('{', keywordIndex);
            // The last curly brace in the string acts as the JSON closure
            const endIndex = content.lastIndexOf('}');
            
            if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                pureJsonString = content.substring(startIndex, endIndex + 1);
            } else {
                throw new Error(`Error during surgical JSON extraction.\n\n[RAW OUTPUT]:\n${content}`);
            }
        }
        
        try {
            // Extreme Backend Sanitization: 
            // Resolves the "Bad escaped character" error. Replaces single backslashes (e.g., \s) with double backslashes (\\s) 
            // if they are not followed by valid JSON escape characters (such as " \ / b f n r t).
            pureJsonString = pureJsonString.replace(/\\(?!["\\/bfnrt])/g, '\\\\');
            
            return JSON.parse(pureJsonString) as AegisAnalysisReport;
        } catch (e) {
            throw new Error(`JSON Parse Error: ${(e as Error).message}\n\n[EXTRACTED STRING]:\n${pureJsonString}`);
        }
        
    } catch (err: unknown) {
        if (err instanceof Error) {
            throw new Error(`Error communicating with API: ${err.message}`);
        }
        throw new Error('Unknown error occurred while communicating with OpenRouter API.');
    }
}

/**
* @param languages Array of detected languages (e.g. ["typescript", "javascript"])
* @param stack Array of frameworks/libraries (e.g. ["react", "express", "mongoose"])
* @param folderStructure Structure of the main project directories
* @returns Array of strings (The 3 Golden Rules)
*/

export async function generateArchitecturalRules(languages: string[], stack: string[], folderStructure: string): Promise<string[]> {
    //Check the API key validation
    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    
    if (!apiKey) {
        // If the key is missing, mechanical safety fallback: return an empty array
        console.warn('OPENROUTER_API_KEY is missing. Skipping AI rule generation (Fallback to empty rules).');
        return [];
    }

    // Build the prompt for Qwen
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
You MUST output ONLY a valid JSON array of strings. No markdown formatting, no explanations, no chat.
Example output for a React + Express stack:
[
  "Frontend State: UI components must not contain business logic; delegate to hooks or state managers.",
  "Backend Routing: Express route handlers must contain NO business logic; they must delegate to isolated Services.",
  "Integration Boundary: All data payloads passed between client and API must be validated against shared DTO schemas."
]`;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://aegiscode.dev',
                    'X-Title': 'AegisCode CLI',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                model: "qwen/qwen3-32b", // THE ORCHESTRA DIRECTOR
                messages: [
                    { role: "user", content: architectPrompt }
                ],
                temperature: 0.3, // Slightly more creative than the sniper, but firm
            })
        });

        // Verify that the response is successful
        if (!response.ok) {
            console.warn('AI Architect API failed. Falling back to empty rules.');
            return [];
        }

        const data = await response.json();
        let content = data.choices[0]?.message?.content || '[]';
        
        // Clean up <think> blocks (Qwen sometimes uses it if you use the R1 version or similar)
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

        // Brute force JSON extraction
        const jsonMatch = content.match(/\[\s*([\s\S]*?)\s*\]/i);
        
        if (jsonMatch) {
            const pureArray = `[${jsonMatch[1]}]`;
            const parsedRules = JSON.parse(pureArray);
            if (Array.isArray(parsedRules)) {
                return parsedRules;
            }
        }

        //Create a fallback if the wifi is not connected
        //The aegis.config.json will be created anyway
        return [];

    } catch(err: unknown) {
        console.warn('Error during AI Rule Generation. Falling back to mechanical scan only.');
        return [];
    }
}

export async function upgradeArchitecturalRules(
    oldRules: string[], 
    languages: string[], 
    stack: string[], 
    folderStructure: string
): Promise<string[]> {
    //Check the API Key validation
    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    
    if (!apiKey) {
        // If the key is missing, mechanical safety fallback: return an empty array
        console.warn('OPENROUTER_API_KEY is missing. Skipping AI rule generation (Fallback to empty rules).');
        return [];
    }

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
You MUST output ONLY a valid JSON array of strings containing the final merged rules. No markdown formatting, no explanations, no chat.
Example: ["Old Rule 1", "Old Rule 2", "New Rule 1"]`;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://aegiscode.dev',
                    'X-Title': 'AegisCode CLI',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                model: "qwen/qwen3-32b", // THE ORCHESTRA DIRECTOR
                messages: [
                    { role: "user", content: architectPrompt }
                ],
                temperature: 0.3, // Slightly more creative than the sniper, but firm
            })
        });

        // Verify that the response is successful
        if (!response.ok) {
            console.warn('AI Architect API failed. Falling back to EXISTING rules.');
            return oldRules;
        }

        const data = await response.json();
        let content = data.choices[0]?.message?.content || '[]';
        
        // Clean up <think> blocks (Qwen sometimes uses it if you use the R1 version or similar)
        content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

        // Brute force JSON extraction
        const jsonMatch = content.match(/\[\s*([\s\S]*?)\s*\]/i);
        
        if (jsonMatch) {
            const pureArray = `[${jsonMatch[1]}]`;
            const parsedRules = JSON.parse(pureArray);
            if (Array.isArray(parsedRules)) {
                return parsedRules;
            }
        }

        return oldRules;

    } catch(err: unknown) {
        console.warn('Error during AI Rule Generation. Falling back to mechanical scan only.');
        return oldRules;
    }
}
