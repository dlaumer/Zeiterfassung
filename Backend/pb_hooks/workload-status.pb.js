/// <reference path="../pb_data/types.d.ts" />

const participantFieldCandidates = ['participant', 'participant_id'];
const dateFieldCandidates = ['date', 'submission_date', 'day'];
const subjectFieldCandidates = ['subject', 'subject_id'];
const subjectRelationFieldCandidates = ['participant_subject', 'participant_subject_id'];

const submissionCollection = $os.getenv('WORKLOAD_SUBMISSION_COLLECTION') || 'workload_submissions';
const appendumCollection = $os.getenv('WORKLOAD_APPENDUM_COLLECTION') || 'workload_appendums';

function readField(record, candidates) {
  for (const field of candidates) {
    let value = null;

    if (record && typeof record.get === 'function') {
      value = record.get(field);
    } else if (record && Object.prototype.hasOwnProperty.call(record, field)) {
      value = record[field];
    }

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

function inferDate(record) {
  const explicitDate = readField(record, dateFieldCandidates);
  if (explicitDate) {
    return explicitDate.slice(0, 10);
  }

  const created = record && typeof record.get === 'function' ? record.get('created') : null;
  if (typeof created === 'string' && created.length >= 10) {
    return created.slice(0, 10);
  }

  return null;
}

function findRecords(collection, filter, params = {}) {
  return $app.findRecordsByFilter(collection, filter, '-created', 500, 0, params);
}

routerAdd('GET', '/api/workload-status', (e) => {
  const participantId = e.request.url.query().get('participantId');

  if (!participantId) {
    return e.json(400, { error: 'Missing required query parameter: participantId' });
  }

  try {
    const participantSubjects = findRecords(
      'participant_subjects',
      'participant = {:participantId}',
      { participantId },
    );

    const participantSubjectToSubjectId = {};
    const relevantSubjectIds = new Set();

    for (const participantSubject of participantSubjects) {
      const participantSubjectId = participantSubject.id;
      const subjectId =
        (typeof participantSubject.get === 'function' && participantSubject.get('subject')) ||
        participantSubject.subject ||
        null;

      if (typeof participantSubjectId === 'string' && typeof subjectId === 'string') {
        participantSubjectToSubjectId[participantSubjectId] = subjectId;
        relevantSubjectIds.add(subjectId);
      }
    }

    const subjectLabelsById = {};
    const relevantSubjectIdList = Array.from(relevantSubjectIds);

    if (relevantSubjectIdList.length > 0) {
      const subjects = findRecords(
        'subjects',
        'id ~ {:subjectIds}',
        { subjectIds: relevantSubjectIdList },
      );

      for (const subject of subjects) {
        const id = subject.id;
        const labelEn = typeof subject.get === 'function' ? subject.get('label_en') : subject.label_en;
        const labelDe = typeof subject.get === 'function' ? subject.get('label_de') : subject.label_de;
        const key = typeof subject.get === 'function' ? subject.get('key') : subject.key;

        if (typeof id === 'string') {
          subjectLabelsById[id] =
            (typeof labelEn === 'string' && labelEn) ||
            (typeof labelDe === 'string' && labelDe) ||
            (typeof key === 'string' && key) ||
            id;
        }
      }
    }

    const grouped = {};

    const mergeCollection = (collectionName) => {
      const records = findRecords(
        collectionName,
        'participant = {:participantId} || participant_id = {:participantId}',
        { participantId },
      );

      for (const record of records) {
        const recordParticipant = readField(record, participantFieldCandidates);
        if (!recordParticipant || recordParticipant !== participantId) {
          continue;
        }

        const date = inferDate(record);
        if (!date) {
          continue;
        }

        const subjectIdFromRecord = readField(record, subjectFieldCandidates);
        const participantSubjectId = readField(record, subjectRelationFieldCandidates);
        const resolvedSubjectId = subjectIdFromRecord || (participantSubjectId ? participantSubjectToSubjectId[participantSubjectId] : null);

        if (!resolvedSubjectId) {
          continue;
        }

        if (!grouped[date]) {
          grouped[date] = new Set();
        }

        grouped[date].add(resolvedSubjectId);
      }
    };

    mergeCollection(submissionCollection);
    mergeCollection(appendumCollection);

    const status = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, subjectSet]) => {
        const subjectIds = Array.from(subjectSet);

        return {
          date,
          subjectIds,
          subjects: subjectIds.map((id) => subjectLabelsById[id] || id),
        };
      });

    return e.json(200, { participantId, status });
  } catch (error) {
    return e.json(500, { error: `Unable to load workload status: ${error}` });
  }
});
