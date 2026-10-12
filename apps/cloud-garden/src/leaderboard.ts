export const LEADERBOARD_CONFIG = {
  platformOrigin: 'https://www.ai-made.games',
  gameId: '0bd71301-f8c3-4721-b7aa-008cccb9d573',
  boardId: '64121e15-e58b-4bc6-8139-4490b1ce5423',
  order: 'desc',
  unit: 'points',
  minScore: 0,
  maxScore: 10_000_000_000,
  minPlayMs: 0,
  enabled: true,
} as const;

export interface PlayerSession {
  token: string;
  expiresAt: string;
  gameId: string;
  player: { displayName: string; isGuest: boolean };
}
export interface BoardEntry {
  entryId: string; score: number; rank: number | null; achievedAt: string;
  isMe: boolean; player: { displayName: string; avatarUrl: string | null; isGuest: boolean };
}
export interface BoardRun {
  startKey: string;
  scoreKey: string;
  runId?: string;
  stage: number;
  owner?: string;
  finalScore?: number;
  startPromise?: Promise<string>;
  settlementPromise?: Promise<SettlementReceipt>;
}
export interface SettlementReceipt {
  accepted: boolean; submittedScore: number; personalBest?: number;
  isPersonalBest?: boolean; rank?: number | null; participants?: number;
}
export interface RoundStatus { round: BoardRun; state: 'starting' | 'started' | 'settling' | 'settled' | 'error'; message?: string; receipt?: SettlementReceipt }
export class LeaderboardError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number, readonly retryAfter?: string | null) { super(message); }
}
type SessionProvider = (force: boolean) => Promise<PlayerSession>;
type Fetcher = typeof fetch;
interface ClientOptions {
  fetcher?: Fetcher;
  sessionProvider?: SessionProvider;
  onStatus?: (status: RoundStatus) => void;
  delay?: (ms: number) => Promise<void>;
}

function identity(session: PlayerSession) { return session.player.displayName + '\u0000' + String(session.player.isGuest); }
function uuid() { return crypto.randomUUID(); }
function delay(ms: number) { return new Promise<void>(resolve => setTimeout(resolve, ms)); }

export function requestPlayerSession(platformOrigin = LEADERBOARD_CONFIG.platformOrigin): Promise<PlayerSession> {
  if (typeof window === 'undefined' || window.parent === window) return Promise.reject(new Error('Leaderboard identity is available only inside the 1GP player.'));
  return new Promise((resolve, reject) => {
    const requestId = uuid();
    let finished = false;
    const cleanup = () => { window.clearTimeout(timer); window.removeEventListener('message', receive); };
    const finish = (error?: Error, session?: PlayerSession) => {
      if (finished) return;
      finished = true; cleanup();
      if (error) reject(error); else if (session) resolve(session); else reject(new Error('Empty leaderboard session.'));
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== platformOrigin) return;
      const data = event.data;
      if (!data || data.source !== 'aimadegames-platform' || data.type !== 'leaderboard-session' || data.requestId !== requestId) return;
      if (data.error) { finish(new Error(String(data.error))); return; }
      const session = data.session as PlayerSession | undefined;
      if (data.apiOrigin !== platformOrigin || !session?.token || session.gameId !== LEADERBOARD_CONFIG.gameId || !session.player || typeof session.player.displayName !== 'string' || typeof session.player.isGuest !== 'boolean') {
        finish(new Error('Invalid or mismatched leaderboard session.')); return;
      }
      finish(undefined, session);
    };
    const timer = window.setTimeout(() => finish(new Error('Leaderboard session timed out.')), 15000);
    window.addEventListener('message', receive);
    try {
      window.parent.postMessage({ source: 'aimadegames', type: 'leaderboard-session', requestId }, platformOrigin);
    } catch (error) { finish(error instanceof Error ? error : new Error('Unable to request leaderboard session.')); }
  });
}

export function isInsideOneGpPlayer() { return typeof window !== 'undefined' && window.parent !== window; }

export class OneGpLeaderboard {
  private readonly fetcher: Fetcher;
  private readonly sessionProvider: SessionProvider;
  private readonly onStatus?: ClientOptions['onStatus'];
  private readonly wait: (ms: number) => Promise<void>;
  private session?: PlayerSession;
  private sessionPromise?: Promise<PlayerSession>;

  constructor(options: ClientOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.sessionProvider = options.sessionProvider ?? (() => requestPlayerSession());
    this.onStatus = options.onStatus;
    this.wait = options.delay ?? delay;
  }

  beginRound(stage: number): BoardRun {
    const round: BoardRun = { startKey: uuid(), scoreKey: uuid(), stage };
    this.report(round, 'starting', '正在连接排行榜…');
    void this.ensureRun(round).then(() => this.report(round, 'started', '排行榜已连接')).catch(error => this.report(round, 'error', this.message(error)));
    return round;
  }

  async ensureRun(round: BoardRun): Promise<string> {
    if (round.runId) return round.runId;
    if (round.startPromise) return round.startPromise;
    const task = this.postWithRoundAuth<RunResponse>(round, `leaderboards/${LEADERBOARD_CONFIG.boardId}/runs`, undefined, round.startKey)
      .then(result => {
        if (!result.runId || typeof result.runId !== 'string') throw new Error('Leaderboard did not return a runId.');
        round.runId = result.runId;
        this.report(round, 'started', '排行榜已连接');
        return result.runId;
      });
    round.startPromise = task;
    try { return await task; }
    finally { if (round.startPromise === task) round.startPromise = undefined; }
  }

  settleRound(round: BoardRun, score: number): Promise<SettlementReceipt> {
    if (!Number.isSafeInteger(score) || score < LEADERBOARD_CONFIG.minScore || score > LEADERBOARD_CONFIG.maxScore) {
      return Promise.reject(new Error(`Score must be an integer between ${LEADERBOARD_CONFIG.minScore} and ${LEADERBOARD_CONFIG.maxScore}.`));
    }
    if (round.finalScore !== undefined && round.finalScore !== score) return Promise.reject(new Error('This round is already frozen with a different score.'));
    round.finalScore ??= score;
    if (round.settlementPromise) return round.settlementPromise;
    this.report(round, 'settling', '正在提交本关分数…');
    const task = this.settleFrozenRound(round);
    round.settlementPromise = task;
    void task.catch(() => { if (round.settlementPromise === task) round.settlementPromise = undefined; });
    return task;
  }

  async retryRound(round: BoardRun): Promise<SettlementReceipt | undefined> {
    await this.ensureRun(round);
    if (round.finalScore === undefined) return undefined;
    return this.settleRound(round, round.finalScore);
  }

  async getStandings(): Promise<BoardEntry[]> {
    const result = await this.getWithAuth<{ entries: BoardEntry[] }>(`leaderboards/${LEADERBOARD_CONFIG.boardId}/entries?limit=10`);
    return Array.isArray(result.entries) ? result.entries : [];
  }

  async getPersonalRank(): Promise<{ entry: BoardEntry | null; neighbors: BoardEntry[] }> {
    const result = await this.getWithAuth<{ entry: BoardEntry | null; neighbors: BoardEntry[] }>(`leaderboards/${LEADERBOARD_CONFIG.boardId}/me?around=2`);
    return { entry: result.entry ?? null, neighbors: Array.isArray(result.neighbors) ? result.neighbors : [] };
  }

  private async settleFrozenRound(round: BoardRun): Promise<SettlementReceipt> {
    try {
      const runId = await this.ensureRun(round);
      const receipt = await this.postWithRoundAuth<SettlementReceipt>(round, `runs/${encodeURIComponent(runId)}/score`, { score: round.finalScore }, round.scoreKey);
      this.report(round, 'settled', `本关 ${receipt.rank ? `排名第 ${receipt.rank}` : '成绩已记录'}`, receipt);
      return receipt;
    } catch (error) {
      if (error instanceof LeaderboardError && error.code === 'ALREADY_SUBMITTED') {
        const receipt: SettlementReceipt = { accepted: true, submittedScore: round.finalScore! };
        this.report(round, 'settled', '本关成绩已提交', receipt);
        return receipt;
      }
      this.report(round, 'error', this.message(error));
      throw error;
    }
  }

  private async postWithRoundAuth<T>(round: BoardRun, path: string, body: unknown, key: string): Promise<T> {
    const session = await this.getSession();
    round.owner ??= identity(session);
    return this.withAuthRetry<T>(path, session, body, key, round.owner);
  }

  private async getWithAuth<T>(path: string): Promise<T> {
    const session = await this.getSession();
    return this.withAuthRetry<T>(path, session, undefined, undefined, identity(session));
  }

  private async withAuthRetry<T>(path: string, session: PlayerSession, body?: unknown, key?: string, expectedOwner?: string): Promise<T> {
    let current = session;
    let refreshed = false;
    let transientRetries = 0;
    for (;;) {
      try { return await this.request<T>(path, current, body, key); }
      catch (error) {
        if (error instanceof LeaderboardError && error.status === 401 && !refreshed) {
          refreshed = true;
          current = await this.getSession(true);
          if (expectedOwner && identity(current) !== expectedOwner) throw new LeaderboardError('Player changed during the round; the pending score was not rebound.', 'PLAYER_CHANGED', 403);
          continue;
        }
        const retryable = !(error instanceof LeaderboardError) || error.status === 429 || error.status === 503;
        if (!retryable || transientRetries >= 2) throw error;
        transientRetries++;
        const retryAfter = error instanceof LeaderboardError && error.status === 429 ? Number(error.retryAfter) : NaN;
        const waitMs = Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter * 1000 : 700 * transientRetries;
        if (waitMs > 120_000) throw error;
        await this.wait(waitMs);
      }
    }
  }

  private async request<T>(path: string, session: PlayerSession, body?: unknown, key?: string): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(`${LEADERBOARD_CONFIG.platformOrigin}/api/v1/${path}`, {
        method: key ? 'POST' : 'GET', credentials: 'omit',
        headers: { Authorization: `Bearer ${session.token}`, ...(key ? { 'Idempotency-Key': key } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) { throw error instanceof Error ? error : new Error('Leaderboard network request failed.'); }
    let data: unknown;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
      const payload = data as { error?: { code?: unknown; message?: unknown } };
      throw new LeaderboardError(typeof payload.error?.message === 'string' ? payload.error.message : `Leaderboard request failed (${response.status}).`,
        typeof payload.error?.code === 'string' ? payload.error.code : undefined, response.status, response.headers.get('Retry-After'));
    }
    return data as T;
  }

  private getSession(force = false): Promise<PlayerSession> {
    if (this.sessionPromise) return this.sessionPromise;
    const expires = this.session ? Date.parse(this.session.expiresAt) : 0;
    if (!force && this.session && Number.isFinite(expires) && expires > Date.now() + 60_000) return Promise.resolve(this.session);
    const task = this.sessionProvider(force).then(session => {
      if (!session.token || session.gameId !== LEADERBOARD_CONFIG.gameId) throw new Error('Leaderboard session belongs to a different game.');
      this.session = session;
      return session;
    });
    this.sessionPromise = task;
    void task.finally(() => { if (this.sessionPromise === task) this.sessionPromise = undefined; }).catch(() => {});
    return task;
  }

  private report(round: BoardRun, state: RoundStatus['state'], message: string, receipt?: SettlementReceipt) {
    this.onStatus?.({ round, state, message, ...(receipt ? { receipt } : {}) });
  }
  private message(error: unknown) { return error instanceof Error ? error.message : '排行榜暂时不可用，游戏可以继续。'; }
}
interface RunResponse { runId: string; startedAt?: string; submitBefore?: string }
