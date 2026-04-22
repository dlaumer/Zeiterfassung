import { Plus, X, BookOpen, Search } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/i18n';

export interface Subject {
  id: string;
  participantSubjectId?: string;
  key: string;
  labelEn: string;
  labelDe: string;
  credits: number;
  color: string;
}

export const getSubjectDisplayName = (subject: Subject, language: 'en' | 'de') =>
  language === 'de' ? subject.labelDe : subject.labelEn;

interface CourseManagementProps {
  subjects: Subject[];
  onAddSubject: (subject: Subject) => void;
  onRemoveSubject: (id: string) => void;
  availableSubjects: Subject[];
}

export function CourseManagement({
  subjects,
  onAddSubject,
  onRemoveSubject,
  availableSubjects
}: CourseManagementProps) {
  const { t, language } = useI18n();
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleAddSubject = (subject: Subject) => {
    onAddSubject(subject);
    setShowAddSubject(false);
    setSearchQuery('');
  };

  const availableToAdd = availableSubjects.filter(
    availableSubject => !subjects.find(subject => subject.id === availableSubject.id)
  );

  const filteredSubjects = availableToAdd.filter(subject =>
    getSubjectDisplayName(subject, language).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canAddMore = subjects.length < 12;

  const renderAddSubjectPanel = (className?: string) => (
    <div className={`bg-gray-50 rounded-xl p-4 space-y-3 ${className ?? ''}`}>
      <p className="text-sm text-gray-600 mb-2">{t('courseManagement.selectToAdd')}</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('courseManagement.search')}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          autoFocus
        />
      </div>
      <div className="border border-gray-200 rounded-lg bg-white flex flex-col min-h-0 max-h-48 md:max-h-60">
        <div className="overflow-y-auto min-h-0 flex-1">
          {filteredSubjects.length > 0 ? (
            filteredSubjects.map(subject => (
              <button
                key={subject.id}
                onClick={() => handleAddSubject(subject)}
                className="w-full px-3 py-2 text-left hover:bg-indigo-50 transition-colors text-sm border-b border-gray-100 last:border-b-0"
              >
                {getSubjectDisplayName(subject, language)}
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              {t('courseManagement.noFound')}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          setShowAddSubject(false);
          setSearchQuery('');
        }}
        className="text-sm text-gray-500 hover:text-gray-700 w-full text-center sticky bottom-0 bg-gray-50 py-1"
      >
        {t('common.cancel')}
      </button>
    </div>
  );

  return (
    <div className="h-full min-h-0 bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="font-semibold text-gray-900">{t('courseManagement.title')}</h3>
        {canAddMore && (
          <button
            onClick={() => setShowAddSubject(true)}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('common.add')}
          </button>
        )}
      </div>

      {showAddSubject && availableToAdd.length > 0 && renderAddSubjectPanel('mb-4 shrink-0 hidden md:block')}

      {subjects.length === 0 && !showAddSubject ? (
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50 text-gray-400" />
          <p className="text-sm text-gray-400 mb-3">{t('courseManagement.none')}</p>
          <button
            onClick={() => setShowAddSubject(true)}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
          >
            {t('courseManagement.first')}
          </button>
        </div>
      ) : subjects.length > 0 ? (
        <div className="space-y-2 overflow-y-auto min-h-0 flex-1 pr-1">
          {subjects.map(subject => (
            <div
              key={subject.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 shrink-0 rounded-full"
                  style={{ backgroundColor: subject.color }}
                />
                <span className="text-sm font-medium text-gray-700">
                  {getSubjectDisplayName(subject, language)}
                </span>
              </div>
              <button
                onClick={() => onRemoveSubject(subject.id)}
                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {!canAddMore && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          {t('courseManagement.maxReached')}
        </p>
      )}

      {showAddSubject && availableToAdd.length > 0 && renderAddSubjectPanel('mt-4 shrink-0 md:hidden')}

      {showAddSubject && availableToAdd.length === 0 && (
        <div className="mt-4 bg-gray-50 rounded-xl p-4 text-center shrink-0">
          <p className="text-sm text-gray-500">{t('courseManagement.allAdded')}</p>
          <button
            onClick={() => setShowAddSubject(false)}
            className="text-sm text-indigo-600 hover:text-indigo-700 mt-2"
          >
            {t('common.close')}
          </button>
        </div>
      )}
    </div>
  );
}
