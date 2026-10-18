const dateTimeFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}
