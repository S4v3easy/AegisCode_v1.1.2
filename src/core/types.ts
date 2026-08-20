export interface RuleViolation {
    rule: string;
    fix: string;
}

export interface AegisAnalysisReport {
    chainOfThought: string;
    violations: RuleViolation[];
    verdict: 'APPROVED' | 'REJECTED';
}

console.log("ciao zio")