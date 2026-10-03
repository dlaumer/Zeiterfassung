export function needsClassTimeConfirmation(time, previousTime, confirmedTime) {
  return time > 0 &&
    Math.abs(time - Math.round(time)) > 0.000001 &&
    time !== previousTime &&
    time !== confirmedTime;
}

export function getClassTimeWarnings(time, previousTime, confirmedTime, { date, entryMode, participantRole, subjectKey }) {
  if (time <= 0 || time === previousTime || time === confirmedTime) return [];
  const warnings = [];
  if (participantRole === 'student' && needsClassTimeConfirmation(time, previousTime, confirmedTime)) {
    warnings.push('subject.fractionalClassTimeWarning');
  }
  const isContactTime = participantRole === 'student' || subjectKey === 'weekly_contact_time';
  if (entryMode === 'day' && [0, 6].includes(date.getDay()) && isContactTime) {
    warnings.push(`subject.weekendContactTimeWarning.${participantRole}`);
  }
  return warnings;
}
