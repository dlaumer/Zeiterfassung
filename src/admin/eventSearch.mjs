export function matchesEventSearch(event, query, subjects = [], participants = []) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const participant = participants.find(candidate => candidate.id === event.participantId);
  const facultySubjects = (event.participantRole || participant?.participantRole) === 'faculty'
    ? participant?.subjects ?? []
    : [];

  const searchableText = [
    event.participantName,
    event.participantId,
    event.submissionId,
    event.participantEmail,
    event.sentByEmail,
    event.eventType,
    event.periodDate,
    event.comment,
    ...facultySubjects.flatMap(subject => [subject.id, subject.number, subject.key, subject.labelEn, subject.labelDe]),
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
