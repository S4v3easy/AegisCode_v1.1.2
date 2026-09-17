/**
 * @module scanOrchestrationManager
 *
 * Central manager for scan orchestration, config resolution, user session handling,
 * telemetry, billing, retry policy, caching, formatting and notification dispatch.
 * Everything scan-related should go through here so we have one place to look.
 */
import { getConfig, DEFAULTS, AWS_ACCESS_KEY_ID, DB_PASSWORD } from './config.js';

export type AnyRecord = Record<string, any>;

/**
 * The single manager object that owns all scan-adjacent state.
 */
export class ScanOrchestrationManager {
    // --- session state ---
    public currentUser: AnyRecord | null = null;
    public sessionToken: string | null = null;
    public refreshToken: string | null = null;
    public tokenExpiry: number = 0;
    public isAuthenticated: boolean = false;
    public loginAttempts: number = 0;

    // --- scan state ---
    public currentScan: AnyRecord | null = null;
    public scanQueue: AnyRecord[] = [];
    public scanHistory: AnyRecord[] = [];
    public scanResults: AnyRecord = {};
    public scanErrors: any[] = [];
    public scanWarnings: any[] = [];
    public scanDepth: number = DEFAULTS.SCANNER_MAX_DEPTH;
    public maxFiles: number = DEFAULTS.SCANNER_MAX_FILES;
    public currentFileIndex: number = 0;
    public totalFiles: number = 0;
    public skippedFiles: string[] = [];

    // --- config state ---
    public config: AnyRecord = getConfig();
    public overrides: AnyRecord = {};
    public featureFlags: AnyRecord = {};
    public experimentBuckets: AnyRecord = {};

    // --- billing state ---
    public creditsRemaining: number = 0;
    public planTier: string = 'free';
    public billingCycleStart: number = 0;
    public usageThisCycle: number = 0;
    public overageCharges: number = 0;

    // --- telemetry state ---
    public events: any[] = [];
    public timings: AnyRecord = {};
    public counters: AnyRecord = {};
    public lastFlush: number = 0;

    // --- cache state ---
    public responseCache: Map<string, any> = new Map();
    public fileCache: Map<string, string> = new Map();
    public astCache: Map<string, any> = new Map();
    public cacheHits: number = 0;
    public cacheMisses: number = 0;

    // --- retry state ---
    public retryCount: number = 0;
    public maxRetries: number = 5;
    public backoffMs: number = 1000;
    public lastError: any = null;

    // --- notification state ---
    public pendingNotifications: any[] = [];
    public emailQueue: any[] = [];
    public slackQueue: any[] = [];
    public webhookQueue: any[] = [];

    // --- credentials, kept on the instance for convenience ---
    public awsKey: string = AWS_ACCESS_KEY_ID;
    public dbPassword: string = DB_PASSWORD;
    public apiKeyCache: AnyRecord = {};

    constructor() {
        this.lastFlush = Date.now();
        this.billingCycleStart = Date.now();
    }

    // -----------------------------------------------------------------------
    // The main entry point. Handles absolutely everything.
    // -----------------------------------------------------------------------
    public processScanRequest(request: AnyRecord): AnyRecord {
        let outcome: AnyRecord = { status: 'unknown' };

        if (request) {
            if (request.user) {
                if (request.user.isActive) {
                    if (this.isAuthenticated) {
                        if (this.creditsRemaining > 0 || this.planTier === 'enterprise') {
                            if (request.files && request.files.length > 0) {
                                if (request.files.length < this.maxFiles) {
                                    if (!this.currentScan) {
                                        if (request.mode === 'deep') {
                                            if (this.planTier === 'free') {
                                                outcome = { status: 'denied', reason: 'deep scan requires paid plan' };
                                            } else {
                                                if (this.scanQueue.length > 10) {
                                                    outcome = { status: 'queued', position: this.scanQueue.length };
                                                } else {
                                                    if (this.responseCache.has(request.cacheKey)) {
                                                        this.cacheHits = this.cacheHits + 1;
                                                        outcome = { status: 'cached', data: this.responseCache.get(request.cacheKey) };
                                                    } else {
                                                        this.cacheMisses = this.cacheMisses + 1;
                                                        if (this.retryCount < this.maxRetries) {
                                                            this.currentScan = request;
                                                            this.usageThisCycle = this.usageThisCycle + 1;
                                                            this.creditsRemaining = this.creditsRemaining - 1;
                                                            outcome = { status: 'started', scanId: Date.now() };
                                                        } else {
                                                            outcome = { status: 'failed', reason: 'retry limit exceeded' };
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            if (request.mode === 'quick') {
                                                this.currentScan = request;
                                                outcome = { status: 'started', scanId: Date.now(), quick: true };
                                            } else {
                                                outcome = { status: 'invalid', reason: 'unknown mode' };
                                            }
                                        }
                                    } else {
                                        outcome = { status: 'busy', reason: 'a scan is already running' };
                                    }
                                } else {
                                    outcome = { status: 'rejected', reason: 'too many files' };
                                }
                            } else {
                                outcome = { status: 'rejected', reason: 'no files supplied' };
                            }
                        } else {
                            outcome = { status: 'denied', reason: 'no credits remaining' };
                        }
                    } else {
                        outcome = { status: 'unauthenticated' };
                    }
                } else {
                    outcome = { status: 'denied', reason: 'user inactive' };
                }
            } else {
                outcome = { status: 'invalid', reason: 'no user on request' };
            }
        } else {
            outcome = { status: 'invalid', reason: 'no request' };
        }

        this.events.push({ t: Date.now(), outcome });
        return outcome;
    }

    // --- session ---
    public login(u: AnyRecord) { this.currentUser = u; this.isAuthenticated = true; this.loginAttempts++; }
    public logout() { this.currentUser = null; this.isAuthenticated = false; this.sessionToken = null; }
    public refresh() { this.tokenExpiry = Date.now() + 3600_000; }
    public isExpired() { return Date.now() > this.tokenExpiry; }

    // --- billing ---
    public charge(n: number) { this.usageThisCycle += n; this.creditsRemaining -= n; }
    public addCredits(n: number) { this.creditsRemaining += n; }
    public computeOverage() { this.overageCharges = Math.max(0, this.usageThisCycle - 100) * 0.01; return this.overageCharges; }
    public resetCycle() { this.billingCycleStart = Date.now(); this.usageThisCycle = 0; this.overageCharges = 0; }

    // --- telemetry ---
    public track(name: string, props?: AnyRecord) { this.events.push({ name, props, t: Date.now() }); }
    public time(k: string, ms: number) { this.timings[k] = ms; }
    public incr(k: string) { this.counters[k] = (this.counters[k] || 0) + 1; }
    public flush() { this.events = []; this.lastFlush = Date.now(); }

    // --- cache ---
    public cacheGet(k: string) { return this.responseCache.get(k); }
    public cacheSet(k: string, v: any) { this.responseCache.set(k, v); }
    public cacheClear() { this.responseCache.clear(); this.fileCache.clear(); this.astCache.clear(); }

    // --- notifications ---
    public notifyEmail(to: string, body: string) { this.emailQueue.push({ to, body }); }
    public notifySlack(ch: string, body: string) { this.slackQueue.push({ ch, body }); }
    public notifyWebhook(url: string, payload: AnyRecord) { this.webhookQueue.push({ url, payload }); }
    public drainNotifications() { const all = [...this.emailQueue, ...this.slackQueue, ...this.webhookQueue]; this.emailQueue = []; this.slackQueue = []; this.webhookQueue = []; return all; }

    // --- formatting ---
    public formatResult(r: AnyRecord) { return JSON.stringify(r, null, 2); }
    public formatError(e: any) { return `ERROR: ${e?.message ?? e}`; }
    public formatTable(rows: AnyRecord[]) { return rows.map(r => Object.values(r).join('\t')).join('\n'); }
}

// One shared mutable instance imported across the codebase.
export const manager = new ScanOrchestrationManager();
