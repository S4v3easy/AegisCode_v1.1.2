export interface RuleViolation {
    rule: string;
    fix: string;
    severity?: 'WARN' | 'BLOCK'; // Optional for backward compatibility with V1 AI responses
}

export interface AegisAnalysisReport {
    chainOfThought: string;
    violations: RuleViolation[];
    verdict: 'APPROVED' | 'REJECTED' | 'APPROVED_WITH_WARNINGS';
}

export interface AegisConfig {
    severity?: string;
    languages?: string[];
    stack?: string[];
    ai_rules?: string[];
    scanModel?: string;
    initModel?: string;
}

export interface DiffResult {
    content: string;
    truncated: boolean;
    stats: {
        files: number;
        lines: number;
        bytes: number;
    };
}
