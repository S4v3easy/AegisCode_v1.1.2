import 'dotenv/config';
import Groq from "groq-sdk";
import { AegisAnalysisReport } from './types.js';

// Initialize the Groq client.
// By default, the SDK automatically looks for the process.env.GROQ_API_KEY environment variable.
const groq = new Groq();

/**
 * Sends the git diff to Groq (Llama 3.3 70B) for architectural validation.
 * @param diff The raw git diff string extracted by the interceptor.
 * @returns The AI's judgement as a string.
 */

export async function analyzeDiff(diff: string, projectRules: string): Promise<AegisAnalysisReport> {
    //The master prompt to ensure the AI is gonna judge the base code correctly by using aegis.config.json
    const systemPrompt = `You are a ruthless, elite Tech Lead and Staff Engineer. 
    Your job is to analyze the following git diff and enforce the company's architectural rules.
    Here is the configuration containing the company's strict rules:
    <rules>
    ${projectRules}
    </rules>

    You MUST reply ONLY with a valid JSON object. Do not output any markdown formatting (like \`\`\`json) or conversation text. 
    Start your response immediately with { and end it with }.
    The JSON MUST have this exact structure:
    {
      "chainOfThought": "Write your brutal step-by-step reasoning here.",
      "violations": [
        { "rule": "Name of the violated rule", "fix": "How to fix it" }
      ],
      "verdict": "REJECTED"
    }

    If there are no violations, leave the 'violations' array empty and set 'verdict' to "APPROVED".
    If there is even one violation, set 'verdict' to "REJECTED".`;

    try {
        const response = await groq.chat.completions.create({
            model: "qwen/qwen3.6-27b", // Fixed model ID based on the 2026 dashboard
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Analyze this git diff:\n\n${diff}` }
            ],
            temperature: 0.1, // Low temperature to maximize logical consistency and determinism
            max_tokens: 4096, // Hard limit increased to allow the AI to finish its <think> block
        });

        // Estrazione sicura del JSON (Fallback per le "chiacchiere" dell'AI e i tag <think>)
        let content = response.choices[0]?.message?.content || '{}';
        
        // 1. Rimuoviamo in modo aggressivo qualsiasi blocco <think> (case insensitive, spazi extra)
        content = content.replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, '').trim();
        
        // 2. Rimuoviamo eventuali backtick markdown (```json ... ```)
        content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        // 3. Tagliamo brutalmente la stringa dalla prima { all'ultima }
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            content = content.substring(firstBrace, lastBrace + 1);
        }

        try {
            return JSON.parse(content) as AegisAnalysisReport;
        } catch (e) {
            throw new Error(`JSON Parse Error: ${(e as Error).message}\n\n[RAW AI OUTPUT FOR DEBUGGING]:\n${response.choices[0]?.message?.content}`);
        }
        
    } catch (err: unknown) {
        // Safety fallback in case the API is down or the key is missing
        if (err instanceof Error) {
            throw new Error(`Error communicating with Groq API: ${err.message}`);
        }
        throw new Error('Unknown error occurred while communicating with Groq API.');
    }
}
