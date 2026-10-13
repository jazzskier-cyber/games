import type { PersistedBoardRun } from './leaderboard';

export const JOURNEY_SCORE_KEY = 'cloud-garden-journey-score';
export interface JourneyScoreState { total: number; pendingRounds: PersistedBoardRun[] }

export function readJourneyScore(raw: string | null): JourneyScoreState {
  if (!raw) return { total: 0, pendingRounds: [] };
  try {
    const value = JSON.parse(raw) as { total?: unknown; pendingRounds?: unknown };
    const total = typeof value.total === 'number' && Number.isSafeInteger(value.total) && value.total >= 0 ? value.total : 0;
    const pendingRounds = Array.isArray(value.pendingRounds) ? value.pendingRounds.filter((round): round is PersistedBoardRun => {
      if (!round || typeof round !== 'object') return false;
      const item = round as Partial<PersistedBoardRun>;
      return typeof item.startKey === 'string' && typeof item.scoreKey === 'string' && Number.isInteger(item.stage) &&
        (item.runId === undefined || typeof item.runId === 'string') && (item.finalScore === undefined || Number.isSafeInteger(item.finalScore) && item.finalScore >= 0);
    }) : [];
    return { total, pendingRounds };
  } catch { return { total: 0, pendingRounds: [] }; }
}

export function addJourneyPoints(state: JourneyScoreState, points: number): JourneyScoreState {
  if (!Number.isSafeInteger(points) || points < 0 || !Number.isSafeInteger(state.total + points)) return state;
  return { ...state, total: state.total + points };
}

export function resetJourneyScore(state: JourneyScoreState): JourneyScoreState { return { ...state, total: 0 }; }
