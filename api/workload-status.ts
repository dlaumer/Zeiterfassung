import PocketBase from 'pocketbase';

interface ApiRequest {
  query?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
}

interface WorkloadStatusItem {
  date: string;
  subjects: string[];
  subjectIds: string[];
}

const PB_URL = process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';
const SUBMISSION_COLLECTION = process.env.WORKLOAD_SUBMISSION_COLLECTION ?? 'workload_submissions';
const APPENDUM_COLLECTION = process.env.WORKLOAD_APPENDUM_COLLECTION ?? 'workload_appendums';

const participantFieldCandidates = ['participant', 'participant_id'];
const dateFieldCandidates = ['date', 'submission_date', 'day'];
const subjectFieldCandidates = ['subject', 'subject_id'];
const subjectRelationFieldCandidates = ['participant_subject', 'participant_subject_id'];

function firstString(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function pickField(record: Record<string, unknown>, candidates: string[]): string | null {
  for (const field of candidates) {
    const value = record[field];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

function inferDate(record: Record<string, unknown>): string | null {
  const explicitDate = pickField(record, dateFieldCandidates);
  if (explicitDate) {
    return explicitDate.slice(0, 10);
  }

  const created = typeof record.created === 'string' ? record.created : null;
  return created ? created.slice(0, 10) : null;
}

async function collectStatuses(pb: PocketBase, participantId: string): Promise<WorkloadStatusItem[]> {
  const subjectLabelsById = new Map<string, string>();

  const participantSubjects = await pb.collection('participant_subjects').getFullList({
    filter: pb.filter('participant = {:participantId}', { participantId }),
    expand: 'subject',
  });

  participantSubjects.forEach((participantSubject) => {
    const subject = participantSubject.expand?.subject as Record<string, unknown> | undefined;
    if (subject?.id && typeof subject.id === 'string') {
      const label =
        (typeof subject.label_en === 'string' && subject.label_en) ||
        (typeof subject.label_de === 'string' && subject.label_de) ||
        (typeof subject.key === 'string' && subject.key) ||
        subject.id;
      subjectLabelsById.set(subject.id, label);
    }
  });

  const participantSubjectToSubjectId = new Map<string, string>();
  participantSubjects.forEach((participantSubject) => {
    if (typeof participantSubject.id === 'string' && typeof participantSubject.subject === 'string') {
      participantSubjectToSubjectId.set(participantSubject.id, participantSubject.subject);
    }
  });

  const grouped = new Map<string, Set<string>>();

  const mergeCollection = async (collectionName: string) => {
    const records = await pb.collection(collectionName).getFullList({
      filter: pb.filter('participant = {:participantId} || participant_id = {:participantId}', { participantId }),
    });

    records.forEach((record) => {
      const raw = record as unknown as Record<string, unknown>;
      const recordParticipant = pickField(raw, participantFieldCandidates);
      if (!recordParticipant || recordParticipant !== participantId) {
        return;
      }

      const date = inferDate(raw);
      if (!date) {
        return;
      }

      const subjectIdFromRecord = pickField(raw, subjectFieldCandidates);
      const participantSubjectId = pickField(raw, subjectRelationFieldCandidates);
      const resolvedSubjectId = subjectIdFromRecord || (participantSubjectId ? participantSubjectToSubjectId.get(participantSubjectId) : null);

      if (!resolvedSubjectId) {
        return;
      }

      const existing = grouped.get(date) ?? new Set<string>();
      existing.add(resolvedSubjectId);
      grouped.set(date, existing);
    });
  };

  await mergeCollection(SUBMISSION_COLLECTION);
  await mergeCollection(APPENDUM_COLLECTION);

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, subjectIds]) => {
      const ids = Array.from(subjectIds);

      return {
        date,
        subjectIds: ids,
        subjects: ids.map((id) => subjectLabelsById.get(id) ?? id),
      };
    });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const participantId = firstString(req.query?.participantId);

  if (!participantId) {
    res.status(400).json({ error: 'Missing required query parameter: participantId' });
    return;
  }

  try {
    const pb = new PocketBase(PB_URL);
    const status = await collectStatuses(pb, participantId);

    res.status(200).json({ participantId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}
