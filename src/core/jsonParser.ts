import { AegisAnalysisReport, RuleViolation } from './types.js';

export function stripThinkTags(content: string): string {
    return content.replace(/<think>[\s\S]*?<\/think>/gi, '');
}

export function extractJsonObject(content: string): string {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i) || content.match(/```\s*([\s\S]*?)\s*```/i);
    if (jsonMatch && jsonMatch[1]) {
        return jsonMatch[1].trim();
    }
    
    const keywordIndex = content.lastIndexOf('"verdict"');
    if (keywordIndex === -1) {
        throw new Error(`No JSON block and no "verdict" key found in the response.\n\n[RAW OUTPUT]:\n${content}`);
    }
    const startIndex = content.lastIndexOf('{', keywordIndex);
    const endIndex = content.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        return content.substring(startIndex, endIndex + 1);
    }
    throw new Error(`Error during surgical JSON extraction.\n\n[RAW OUTPUT]:\n${content}`);
}

export function extractJsonArray(content: string): string {
    const jsonMatch = content.match(/\[\s*([\s\S]*?)\s*\]/i);
    if (jsonMatch) {
        let pureArray = `[${jsonMatch[1]}]`;
        return pureArray.replace(/\n/g, ' ').replace(/\r/g, '').replace(/\t/g, ' ');
    }
    throw new Error('No JSON array found in the response.');
}

export function parseAnalysisResponse(rawContent: string): AegisAnalysisReport {
    const stripped = stripThinkTags(rawContent);
    let pureJsonString = extractJsonObject(stripped);
    pureJsonString = pureJsonString.replace(/\\(?!["\\/bfnrt])/g, '\\\\');
    
    const parsed = JSON.parse(pureJsonString) as AegisAnalysisReport;
    if (parsed.violations) {
        parsed.violations = parsed.violations.map((v: RuleViolation) => ({
            ...v,
            severity: v.severity || 'BLOCK'
        }));
    }
    return parsed;
}

export function parseRulesResponse(rawContent: string): string[] {
    try {
        const stripped = stripThinkTags(rawContent);
        const arrayStr = extractJsonArray(stripped);
        const parsed = JSON.parse(arrayStr);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
