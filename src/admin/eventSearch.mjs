export function matchesEventSearch(event, query, subjects = []) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;

  const searchableText = [
    event.participantName,
    event.participantId,
    event.submissionId,
    event.participantEmail,
    event.sentByEmail,
    event.eventType,
    event.periodDate,
    event.comment,
    ...(event.items ?? []).flatMap((item) => {
      const subject = subjects.find((candidate) => candidate.id === item.subjectId);
      return [
        item.subjectId,
        item.subjectNumber,
        item.subjectKey,
        item.subjectLabelEn,
        item.subjectLabelDe,
        subject?.number,
        subject?.key,
        subject?.labelEn,
        subject?.labelDe,
      ];
    }),
  ].join(' ').toLowerCase();

  return terms.every((term) => searchableText.includes(term));
}
