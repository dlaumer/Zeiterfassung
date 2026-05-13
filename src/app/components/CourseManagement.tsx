import { Plus, X, BookOpen, Search } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/i18n';

export interface Subject {
  id: string;
  participantSubjectId?: string;
  number?: string;
  key: string;
  labelEn: string;
  labelDe: string;
  credits: number;
  color: string;
}

export const getSubjectDisplayName = (subject: Subject, language: 'en' | 'de') =>
  language === 'de' ? subject.labelDe : subject.labelEn;

const formatSubjectCredits = (credits: number, language: 'en' | 'de') => `${credits} ${language === 'de' ? 'KP' : 'CP'}`;

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
    [getSubjectDisplayName(subject, language), subject.number ?? '', subject.key]
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const canAddMore = subjects.length < 12;

  const closeAddSubjectOverlay = () => {
    setShowAddSubject(false);
    setSearchQuery('');
  };

  const renderAddSubjectOverlay = () => (
    <div className="fixed inset-0 z-50 bg-white md:flex md:items-center md:justify-center md:bg-gray-950/35 md:p-6">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={closeAddSubjectOverlay}
        className="hidden md:block absolute inset-0 cursor-default"
      />

      <div className="relative flex h-dvh w-full flex-col bg-white p-5 shadow-xl md:h-auto md:max-h-[min(34rem,calc(100dvh-3rem))] md:max-w-md md:rounded-xl md:border md:border-gray-200 md:p-5">
        <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">{t('common.add')}</h4>
            <p className="mt-1 text-sm text-gray-600">{t('courseManagement.selectToAdd')}</p>
          </div>
          <button
            type="button"
            onClick={closeAddSubjectOverlay}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {availableToAdd.length > 0 ? (
          <>
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('courseManagement.search')}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white md:max-h-80">
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredSubjects.length > 0 ? (
                  filteredSubjects.map(subject => (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => handleAddSubject(subject)}
                      className="w-full border-b border-gray-100 px-4 py-3 text-left text-sm font-medium transition-colors last:border-b-0 hover:bg-indigo-50"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {getSubjectDisplayName(subject, language)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          {subject.number && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                              {subject.number}
                            </span>
                          )}
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                            {formatSubjectCredits(subject.credits, language)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">
                    {t('courseManagement.noFound')}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-gray-50 p-6 text-center">
            <p className="text-sm text-gray-500">{t('courseManagement.allAdded')}</p>
          </div>
        )}

        <div className="mt-4 shrink-0 md:hidden">
          <button
            type="button"
            onClick={closeAddSubjectOverlay}
            className="flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 shadow-sm"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-6 flex flex-col">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3 shrink-0">
        <h3 className="min-w-0 truncate font-semibold text-gray-900">{t('courseManagement.title')}</h3>
        {canAddMore && (
          <button
            onClick={() => setShowAddSubject(true)}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-indigo-600 transition-colors hover:text-indigo-700"
          >
            <Plus className="w-4 h-4" />
            {t('common.add')}
          </button>
        )}
      </div>

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
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {subjects.map(subject => (
            <div
              key={subject.id}
              className="group flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="w-3 h-3 shrink-0 rounded-full"
                  style={{ backgroundColor: subject.color }}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-700">
                    {getSubjectDisplayName(subject, language)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {subject.number && (
                      <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-700 ring-1 ring-gray-200">
                        {subject.number}
                      </span>
                    )}
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                      {formatSubjectCredits(subject.credits, language)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onRemoveSubject(subject.id)}
                className="shrink-0 rounded p-1 opacity-100 transition-opacity hover:bg-gray-200 md:opacity-0 md:group-hover:opacity-100"
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

      {showAddSubject && renderAddSubjectOverlay()}
    </div>
  );
}
