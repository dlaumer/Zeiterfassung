import { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { DailyEntryModal } from './components/DailyEntryModal';
import { ViewEntryModal } from './components/ViewEntryModal';
import { CourseManagement, Subject } from './components/CourseManagement';
import { BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { I18nProvider, useI18n } from './i18n/i18n';
import { LanguageSelector } from './i18n/LanguageSelector';
import PocketBase from 'pocketbase';
import { ConfirmDialog } from './components/ui/ConfirmDialog';

interface SubjectTime {
  subjectId: string;
  classTime: number;
  selfStudyTime: number;
  hasClassEntry?: boolean;
  hasStudyEntry?: boolean;
}

interface Course {
  id: string;
  name: string;
  hours: number;
}

interface DailyEntry {
  date: string;
  courses: Course[];
  subjectTimes: SubjectTime[];
  reliability: number;
  adminEffort: number;
  commuteTime: number;
  comment: string;
  skipped: boolean;
}

interface SaveDailyEntryPayload {
  participantId: string;
  date: string;
  reliability: number;
  adminEffortMinutes: number;
  commuteMinutes: number;
  comment: string;
  subjectTimes: {
    subjectId: string;
    classMinutes: number;
    studyMinutes: number;
  }[];
}

interface WorkloadStatusSubject {
  id: string;
  key: string;
  labelEn: string;
  labelDe: string;
  classTime: number;
  selfStudyTime: number;
  hasClassEntry?: boolean;
  hasStudyEntry?: boolean;
}

interface WorkloadStatusHistoryEntry {
  periodType: 'day' | 'week' | string;
  periodDate: string;
  commuteTime?: number;
  generalAdminTime?: number;
  dataRating?: number;
  comment?: string;
  comments?: string[];
  subjects: WorkloadStatusSubject[];
}

interface WorkloadStatusResponse {
  submissionHistory: WorkloadStatusHistoryEntry[];
}

function getNewestComment(historyEntry: WorkloadStatusHistoryEntry): string {
  const comments = historyEntry.comments ?? [];
  const newestAppendum = comments
    .map((comment) => String(comment ?? '').trim())
    .filter(Boolean)
    .at(0);

  if (newestAppendum) {
    return newestAppendum;
  }

  return String(historyEntry.comment ?? '').trim();
}

const SUBJECT_COLORS = [
  '#e6194b',
  '#3cb44b',
  '#ffe119',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#46f0f0',
  '#f032e6',
  '#bcf60c',
  '#fabebe',
  '#008080',
  '#e6beff',
  '#9a6324',
  '#fffac8',
  '#800000',
  '#aaffc3',
  '#808000',
  '#ffd8b1',
  '#000075',
  '#808080',
];

const normalizeColor = (color?: string) => color?.trim().toLowerCase() ?? '';

const getNextSubjectColor = (usedColors: string[]) => {
  const usedColorSet = new Set(usedColors.map(normalizeColor));

  return SUBJECT_COLORS.find((color) => !usedColorSet.has(normalizeColor(color))) ?? SUBJECT_COLORS[0];
};

const ensureUniqueSubjectColors = <T extends { color?: string }>(subjects: T[]) => {
  const usedColors: string[] = [];

  return subjects.map((subject) => {
    const currentColor = subject.color ?? '';
    const hasUniqueColor = currentColor && !usedColors.some((color) => normalizeColor(color) === normalizeColor(currentColor));
    const color = hasUniqueColor ? currentColor : getNextSubjectColor(usedColors);

    usedColors.push(color);

    return {
      ...subject,
      color
    };
  });
};

interface AppContentProps {
  participantId: string | null;
}

type ParticipantStatus = 'loading' | 'valid' | 'invalid';

function AppContent({ participantId }: AppContentProps) {
  const pb = new PocketBase('http://127.0.0.1:8090/');

  const { t } = useI18n();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [entries, setEntries] = useState<Map<string, DailyEntry>>(new Map());
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [defaultCommuteTime, setDefaultCommuteTime] = useState(0);
  const [participantName, setParticipantName] = useState<string>('');
  const [participantStatus, setParticipantStatus] = useState<ParticipantStatus>('loading');
  const [submissionHistory, setSubmissionHistory] = useState<WorkloadStatusHistoryEntry[]>([]);
  const [subjectPendingRemoval, setSubjectPendingRemoval] = useState<Subject | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function validateParticipant(id: string | null) {
      if (!id) {
        if (isMounted) {
          setParticipantStatus('invalid');
          setParticipantName('');
        }
        return;
      }

      try {
        const participant = await pb.collection('participants').getOne(id);

        if (!isMounted) {
          return;
        }

        setParticipantName(participant.name ?? '');
        setParticipantStatus('valid');
      } catch (error) {
        console.error('Participant lookup failed:', error);

        if (!isMounted) {
          return;
        }

        setParticipantStatus('invalid');
        setParticipantName('');
      }
    }

    setParticipantStatus('loading');
    validateParticipant(participantId);

    return () => {
      isMounted = false;
    };
  }, [participantId]);

  useEffect(() => {
    async function loadAvailableSubjects() {
      const allSubjects = await pb.collection('subjects').getFullList();

      return allSubjects.map((subject) => ({
        id: subject.id,
        key: subject.key,
        labelEn: subject.label_en,
        labelDe: subject.label_de,
        credits: subject.credits,
        color: subject.color ?? SUBJECT_COLORS[0],
      }));
    }

    loadAvailableSubjects()
      .then(setAvailableSubjects)
      .catch(console.error);
  }, []);

  useEffect(() => {
    async function loadSubjectsForParticipant(participantId: string) {
      const enrollments = await pb
        .collection("participant_subjects")
        .getFullList({
          filter: pb.filter("participant = {:participantId}", { participantId }),
          expand: "subject",
        });

      const subjects = enrollments.map((enrollment) => {
        const subject = enrollment.expand?.subject;

        return {
          id: subject.id,
          key: subject.key,
          labelEn: subject.label_en,
          labelDe: subject.label_de,
          credits: subject.credits,
          color: enrollment.color,
          participantSubjectId: enrollment.id,
        };
      });

      const subjectsWithUniqueColors = ensureUniqueSubjectColors(subjects);

      await Promise.all(
        subjectsWithUniqueColors
          .filter((subject, index) => normalizeColor(subject.color) !== normalizeColor(subjects[index].color))
          .map((subject) =>
            pb.collection('participant_subjects').update(subject.participantSubjectId, {
              color: subject.color,
            })
          )
      );

      return subjectsWithUniqueColors;
    }
    if (!participantId || participantStatus !== 'valid') {
      return;
    }

    loadSubjectsForParticipant(participantId)
      .then((subjects) => {
        console.log('Loaded subjects for participant:', subjects);
        setSubjects(subjects);
      })
      .catch(console.error);
  }, [participantId, participantStatus]);

  useEffect(() => {
    let isMounted = true;

    async function loadSubmissionHistory(id: string) {
      const response = await pb.send<WorkloadStatusResponse>('/api/workload-status', {
        query: { participantId: id, lookbackDays: 365 },
      });

      if (!isMounted) {
        return;
      }

      const history = response.submissionHistory ?? [];
      setSubmissionHistory(history);

      const backendEntries = new Map<string, DailyEntry>();

      history
        .filter((item) => item.periodType === 'day' && item.periodDate)
        .forEach((item) => {
          backendEntries.set(item.periodDate, {
            date: item.periodDate,
            courses: [],
            subjectTimes: item.subjects.map((subject) => ({
              subjectId: subject.id,
              classTime: 0,
              selfStudyTime: 0,
              hasClassEntry: !!subject.hasClassEntry,
              hasStudyEntry: !!subject.hasStudyEntry,
            })),
            reliability: Number(item.dataRating ?? 0),
            adminEffort: Number(item.generalAdminTime ?? 0) / 60,
            commuteTime: Number(item.commuteTime ?? 0) / 60,
            comment: getNewestComment(item),
            skipped: false,
          });
        });

      setEntries(backendEntries);
    }

    if (!participantId || participantStatus !== 'valid') {
      setSubmissionHistory([]);
      setEntries(new Map());
      return;
    }

    loadSubmissionHistory(participantId).catch((error) => {
      console.error('Workload status lookup failed:', error);
      if (!isMounted) {
        return;
      }
      setSubmissionHistory([]);
      setEntries(new Map());
    });

    return () => {
      isMounted = false;
    };
  }, [participantId, participantStatus]);

  const saveEntry = async (entry: DailyEntry) => {
    if (!participantId) {
      throw new Error('Missing participantId');
    }

    const payload: SaveDailyEntryPayload = {
      participantId,
      date: entry.date,
      reliability: entry.skipped ? 0 : entry.reliability,
      adminEffortMinutes: entry.skipped ? 0 : Math.round(entry.adminEffort * 60),
      commuteMinutes: entry.skipped ? 0 : Math.round(entry.commuteTime * 60),
      comment: entry.comment ?? '',
      subjectTimes: entry.skipped
        ? []
        : entry.subjectTimes.map((subjectTime) => ({
          subjectId: subjectTime.subjectId,
          classMinutes: Math.round((subjectTime.classTime ?? 0) * 60),
          studyMinutes: Math.round((subjectTime.selfStudyTime ?? 0) * 60),
        })),
    };

    await pb.send('/api/submissions/daily', {
      method: 'POST',
      body: payload,
    });

    const newEntries = new Map(entries);
    newEntries.set(entry.date, entry);
    setEntries(newEntries);

    const entriesObj = Object.fromEntries(newEntries);
    //localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesObj));

    setShowEntryModal(false);
    setShowViewModal(false);
  };

  const deleteEntry = async (date: string) => {
    if (!participantId) {
      throw new Error('Missing participantId');
    }

    await pb.send('/api/submissions/daily', {
      method: 'DELETE',
      body: {
        participantId,
        date,
      },
    });

    const newEntries = new Map(entries);
    newEntries.delete(date);
    setEntries(newEntries);

    const entriesObj = Object.fromEntries(newEntries);
    //localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesObj));

    setShowViewModal(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    const dateKey = format(date, 'yyyy-MM-dd');
    const existingEntry = entries.get(dateKey);

    if (existingEntry && !existingEntry.skipped) {
      setShowViewModal(true);
    } else {
      setShowEntryModal(true);
    }
  };

  const handleAddWorkload = () => {
    setShowViewModal(false);
    setShowEntryModal(true);
  };

  const handleAddSubject = async (subject: Subject) => {
    if (!participantId) {
      return;
    }

    const color = getNextSubjectColor(subjects.map((subject) => subject.color));
    const data = {
      participant: participantId,
      subject: subject.id,
      color,
    };

    const record = await pb.collection('participant_subjects').create(data);

    setSubjects((prev) => [
      ...prev,
      {
        ...subject,
        color: record.color ?? color,
        participantSubjectId: record.id,
      },
    ]);
  };

  const handleRemoveSubject = (id: string) => {
    const selectedSubject = subjects.find((subject) => subject.id === id);
    if (!selectedSubject) {
      return;
    }

    const subjectHasData = Array.from(entries.values()).some((entry) =>
      entry.subjectTimes.some(
        (subjectTime) =>
          subjectTime.subjectId === id &&
          (
            subjectTime.hasClassEntry ||
            subjectTime.hasStudyEntry ||
            subjectTime.classTime > 0 ||
            subjectTime.selfStudyTime > 0
          ),
      ),
    );

    if (subjectHasData) {
      setSubjectPendingRemoval(selectedSubject);
      return;
    }

    confirmRemoveSubject(selectedSubject).catch((error) => {
      console.error('Failed to remove subject:', error);
    });
  };

  const confirmRemoveSubject = async (selectedSubject: Subject | null = subjectPendingRemoval) => {
    if (!participantId) {
      return;
    }

    if (!selectedSubject) {
      return;
    }

    if (selectedSubject.participantSubjectId) {
      await pb.collection('participant_subjects').delete(selectedSubject.participantSubjectId);
    } else {
      const records = await pb.collection('participant_subjects').getFullList({
        filter: pb.filter('participant = {:participantId} && subject = {:subjectId}', {
          participantId,
          subjectId: selectedSubject.id,
        }),
      });

      await Promise.all(records.map((record) => pb.collection('participant_subjects').delete(record.id)));
    }

    setSubjects((prev) => prev.filter((subject) => subject.id !== selectedSubject.id));
    setSubjectPendingRemoval(null);
  };

  const existingEntry = selectedDate ? entries.get(format(selectedDate, 'yyyy-MM-dd')) || null : null;

  if (participantStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8" />
    );
  }

  if (participantStatus === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-red-700 font-semibold text-lg">{t('app.participantMissing')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-2 md:p-4">
      <div className="absolute right-2 top-2 z-20 md:right-4 md:top-4">
        <LanguageSelector />
      </div>
      <div className="max-w-7xl h-full mx-auto flex flex-col min-h-0">
        <div className="mb-2 md:mb-4 shrink-0">
          <div className="flex items-start gap-3 pr-24 md:gap-4 mb-2">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-500 rounded-lg md:rounded-xl flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 md:w-6 md:h-6 text-white" />
              </div>
              <h1 className="font-bold text-lg md:text-xl text-gray-900 leading-tight">
                {participantName ? `${t('app.title')} - ${participantName}` : t('app.title')}
              </h1>
            </div>

          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-rows-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3 md:gap-4 lg:grid-cols-[minmax(0,1fr)_clamp(18rem,26vw,24rem)] lg:grid-rows-1">
          <div className="min-h-0 lg:pr-2">
            <div className="h-full w-full max-w-5xl mx-auto">
              <Calendar
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
                entriesMap={entries}
                subjects={subjects}
              />
            </div>
          </div>

          <div className="min-h-0">
            <CourseManagement
              subjects={subjects}
              onAddSubject={handleAddSubject}
              onRemoveSubject={handleRemoveSubject}
              availableSubjects={availableSubjects}
            />
          </div>
        </div>
      </div>

      {showEntryModal && selectedDate && (
        <DailyEntryModal
          date={selectedDate}
          onClose={() => {
            setShowEntryModal(false);
            setSelectedDate(null);
          }}
          onSave={saveEntry}
          existingEntry={existingEntry}
          availableCourses={availableSubjects.map((subject) => subject.labelEn)}
          subjects={subjects}
          defaultCommuteTime={defaultCommuteTime}
        />
      )}

      {showViewModal && selectedDate && existingEntry && (
        <ViewEntryModal
          entry={existingEntry}
          date={selectedDate}
          onClose={() => {
            setShowViewModal(false);
            setSelectedDate(null);
          }}
          onDelete={() => {
            deleteEntry(format(selectedDate, 'yyyy-MM-dd')).catch((error) => {
              console.error('Failed to delete day entry:', error);
            });
          }}
          onAddWorkload={handleAddWorkload}
          subjects={subjects}
        />
      )}

      <ConfirmDialog
        open={!!subjectPendingRemoval}
        title={t('subject.removeTitle')}
        description={t('subject.removeConfirm')}
        confirmLabel={t('common.remove')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onCancel={() => setSubjectPendingRemoval(null)}
        onConfirm={() => confirmRemoveSubject(subjectPendingRemoval)}
      />
    </div>
  );
}

interface AppProps {
  participantId: string | null;
}

export default function App({ participantId }: AppProps) {
  return (
    <I18nProvider>
      <AppContent participantId={participantId} />
    </I18nProvider>
  );
}
