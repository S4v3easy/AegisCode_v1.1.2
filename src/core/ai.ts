import 'dotenv/config';
import Groq from "groq-sdk";
import { AegisAnalysisReport } from './types.js';
import { buildSystemPrompt } from './promptBuilder.js';//AI prompt builder function

// Initialize the Groq client.
// By default, the SDK automatically looks for the process.env.GROQ_API_KEY environment variable.
const groq = new Groq();

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
 * Sends the git diff to Groq (Llama 3.3 70B) for architectural validation.
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

    try {
        const response = await groq.chat.completions.create({
            model: "qwen/qwen3.6-27b", // Fixed model ID based on the 2026 dashboard
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Analyze this git diff:\n\n${diff}` }
            ],
            temperature: 0.1, // Low temperature to maximize logical consistency and determinism
            max_tokens: 4000, // Balanced for Groq Free Tier (8000 TPM limit)
            // REMOVED response_format: { type: "json_object" } to allow <think> tags natively
        });

        let content = response.choices[0]?.message?.content || '{}';
        
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
            throw new Error(`Error communicating with Groq API: ${err.message}`);
        }
        throw new Error('Unknown error occurred while communicating with Groq API.');
    }
}
