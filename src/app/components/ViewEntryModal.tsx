import { X, Trash2, Plus } from 'lucide-react';
import { format, endOfWeek } from 'date-fns';
import { useI18n } from '../i18n/i18n';
import { Subject } from './CourseManagement';

interface SubjectTime {
  subjectId: string;
  classTime: number;
  selfStudyTime: number;
}

interface Course {
  id: string;
  name: string;
  hours: number;
}

interface DailyEntry {
  date: string;
  courses: Course[];
  subjectTimes?: SubjectTime[];
  reliability: number;
  adminEffort: number;
  commuteTime: number;
  comment: string;
  skipped: boolean;
}

interface ViewEntryModalProps {
  entry: DailyEntry;
  date: Date;
  onClose: () => void;
  onDelete: () => void;
  onAddWorkload: () => void;
  subjects?: Subject[];
  entryMode?: 'day' | 'week';
}

export function ViewEntryModal({ entry, date, onClose, onDelete, onAddWorkload, entryMode = 'day' }: ViewEntryModalProps) {
  const { t } = useI18n();
  const isWeekly = entryMode === 'week';
  const periodEnd = endOfWeek(date, { weekStartsOn: 1 });
  const periodLabel = isWeekly
    ? `${format(date, 'MMMM d, yyyy')} - ${format(periodEnd, 'MMMM d, yyyy')}`
    : format(date, 'EEEE, MMMM d, yyyy');

  if (entry.skipped) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">{isWeekly ? t('viewEntry.weekSkipped') : t('viewEntry.daySkipped')}</h3>
              <p className="text-sm text-gray-500">{periodLabel}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <p className="text-gray-600 mb-6">{t('viewEntry.skippedInfo')}</p>

          <div className="flex gap-3">
            <button
              onClick={onDelete}
              className="flex-1 px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isWeekly ? t('viewEntry.deleteWeek') : t('viewEntry.deleteDay')}
            </button>
            <button
              onClick={onAddWorkload}
              className="flex-1 px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('viewEntry.addWorkload')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-gray-900">{t('viewEntry.existsTitle')}</h3>
            <p className="text-sm text-gray-500">{periodLabel}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">{isWeekly ? t('viewEntry.weekExistsInfo') : t('viewEntry.existsInfo')}</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onAddWorkload}
            className="w-full px-4 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('dailyEntry.addHours')}
          </button>
          <button
            onClick={onDelete}
            className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {isWeekly ? t('viewEntry.deleteWeek') : t('viewEntry.deleteDay')}
          </button>
        </div>
      </div>
    </div>
  );
}
