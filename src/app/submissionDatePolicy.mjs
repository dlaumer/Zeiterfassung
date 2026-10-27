export function isFutureSubmission(date, mode, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(value => value.type === type).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const period = key => {
    const parsed = new Date(key + 'T00:00:00Z');
    if (mode === 'week') parsed.setUTCDate(parsed.getUTCDate() - (parsed.getUTCDay() + 6) % 7);
    return parsed.toISOString().slice(0, 10);
  };
  return period(date) > period(today);
}
