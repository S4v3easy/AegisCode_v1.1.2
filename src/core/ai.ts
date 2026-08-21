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
    const apiKey = process.env.OPEN_ROUTER_API_KEY;

    if(!apiKey) {
        throw new Error("OPENROUTER_API_KEY is missing in the environment variables.");
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://aegiscode.dev', // OpenRouter lo richiede
                'X-Title': 'AegisCode CLI',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'deepseek/deepseek-coder',
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
            throw new Error(`Error communicating with Groq API: ${err.message}`);
        }
        throw new Error('Unknown error occurred while communicating with Groq API.');
    }
}
