import { getFormattingLocale } from './index.js';

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(getFormattingLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString(getFormattingLocale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
