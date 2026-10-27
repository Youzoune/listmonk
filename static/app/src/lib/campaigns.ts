// What can be done with a campaign in each status, and its rates.
import type { CampaignStatus } from '../api/types';

export type CampaignAction = 'start' | 'schedule' | 'unschedule' | 'pause' | 'resume' | 'cancel';

export const ACTIONS: Record<CampaignStatus, CampaignAction[]> = {
  draft: ['start', 'schedule'],
  scheduled: ['start', 'unschedule'],
  running: ['pause', 'cancel'],
  paused: ['resume', 'cancel'],
  finished: [],
  cancelled: [],
};

// The status each action sets (PUT /api/campaigns/:id/status).
export const ACTION_STATUS: Record<CampaignAction, CampaignStatus> = {
  start: 'running',
  schedule: 'scheduled',
  unschedule: 'draft',
  pause: 'paused',
  resume: 'running',
  cancel: 'cancelled',
};

export const ACTION_LABEL: Record<CampaignAction, string> = {
  start: 'Lancer maintenant',
  schedule: 'Programmer',
  unschedule: 'Annuler la programmation',
  pause: 'Mettre en pause',
  resume: 'Reprendre',
  cancel: 'Annuler la campagne',
};

// Only drafts, scheduled and paused campaigns can still be changed.
export const isEditable = (s: CampaignStatus) => s === 'draft' || s === 'scheduled' || s === 'paused';

// "42 %" of a part over a total, or "—".
export function rate(part: number, total: number): string {
  if (!total) return '—';
  const r = (part / total) * 100;
  return `${r < 10 ? r.toFixed(1).replace('.', ',') : Math.round(r)} %`;
}

// The analytics API takes a date range; a campaign's whole life by default.
export function analyticsRange(createdAt: string, now = new Date()): { from: string; to: string } {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  return { from: day(new Date(createdAt)), to: day(end) };
}
