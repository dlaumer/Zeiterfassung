// Candidates must be ordered newest first. Empty correction values keep the
// previous displayed comment rather than clearing it.
export function latestNonEmptyComment(...candidates) {
  return candidates.map(value => String(value ?? '').trim()).find(Boolean) ?? '';
}
