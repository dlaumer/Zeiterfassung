import { useState, useEffect } from 'react';
import { Calendar } from './components/Calendar';
import { DailyEntryModal } from './components/DailyEntryModal';
import { ViewEntryModal } from './components/ViewEntryModal';
import { CourseManagement, Subject } from './components/CourseManagement';
import { BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { I18nProvider, useI18n } from './i18n/i18n';
import PocketBase from 'pocketbase';

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
  subjects: WorkloadStatusSubject[];
}

interface WorkloadStatusResponse {
  submissionHistory: WorkloadStatusHistoryEntry[];
}

const SUBJECT_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
  '#6366f1',
];

const STORAGE_KEY = 'student-workload-tracker';
const DEFAULT_COMMUTE_KEY = 'student-workload-default-commute';

interface AppContentProps {
  participantId: string | null;
}

type ParticipantStatus = 'loading' | 'valid' | 'invalid';

function AppContent({ participantId }: AppContentProps) {
  const pb = new PocketBase('http://127.0.0.1:8090/');

  const { t, language, setLanguage } = useI18n();
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

      return subjects;
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
            comment: '',
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

  const saveEntry = (entry: DailyEntry) => {
    const newEntries = new Map(entries);
    newEntries.set(entry.date, entry);
    setEntries(newEntries);

    const entriesObj = Object.fromEntries(newEntries);
    //localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesObj));

    setShowEntryModal(false);
    setShowViewModal(false);
  };

  const deleteEntry = (date: string) => {
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

    const color = SUBJECT_COLORS[subjects.length % SUBJECT_COLORS.length];
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

  const handleRemoveSubject = async (id: string) => {
    if (!participantId) {
      return;
    }

    const selectedSubject = subjects.find((subject) => subject.id === id);
    if (!selectedSubject) {
      return;
    }

    if (selectedSubject.participantSubjectId) {
      await pb.collection('participant_subjects').delete(selectedSubject.participantSubjectId);
    } else {
      const records = await pb.collection('participant_subjects').getFullList({
        filter: pb.filter('participant = {:participantId} && subject = {:subjectId}', {
          participantId,
          subjectId: id,
        }),
      });

      await Promise.all(records.map((record) => pb.collection('participant_subjects').delete(record.id)));
    }

    setSubjects((prev) => prev.filter((subject) => subject.id !== id));
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h1 className="font-bold text-gray-900">
                {participantName ? `${t('app.title')} — ${participantName}` : t('app.title')}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${language === 'en' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-300'
                  }`}
              >
                {t('language.en')}
              </button>
              <button
                onClick={() => setLanguage('de')}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${language === 'de' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-300'
                  }`}
              >
                {t('language.de')}
              </button>
            </div>
          </div>
          <p className="text-gray-600">{t('app.subtitle')}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Calendar
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              entriesMap={entries}
              subjects={subjects}
            />
          </div>

          <div className="lg:col-span-1">
            <div className="space-y-6">
              <CourseManagement
                subjects={subjects}
                onAddSubject={handleAddSubject}
                onRemoveSubject={handleRemoveSubject}
                availableSubjects={availableSubjects}
              />
              
            </div>
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
          onDelete={() => deleteEntry(format(selectedDate, 'yyyy-MM-dd'))}
          onAddWorkload={handleAddWorkload}
          subjects={subjects}
        />
      )}
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
