import { useEffect, useMemo, useState, type FormEvent } from 'react';
import PocketBase from 'pocketbase';
import {
  BookOpen,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileText,
  LogOut,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { I18nProvider, useI18n, type Language } from '../app/i18n/i18n';
import { LanguageSelector } from '../app/i18n/LanguageSelector';
import { ConfirmDialog } from '../app/components/ui/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../app/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../app/components/ui/dropdown-menu';

const pocketBaseUrl = 'http://127.0.0.1:8090';
const pb = new PocketBase(`${pocketBaseUrl}/`);

interface AdminParticipant {
  id: string;
  name: string;
  email: string;
  entryMode: string;
  created: string;
  updated: string;
  subjectCount: number;
  submissionCount: number;
  lastActivityAt: string;
}

interface AdminSubject {
  id: string;
  key: string;
  labelEn: string;
  labelDe: string;
  credits: number;
  created: string;
  updated: string;
  participantCount: number;
  submissionItemCount: number;
}

interface AdminEventItem {
  id: string;
  subjectKey: string;
  subjectLabelEn: string;
  subjectLabelDe: string;
  type: string;
  durationMinutes: number;
}

interface AdminEvent {
  id: string;
  kind: 'submission' | 'deletion' | string;
  eventType: string;
  happenedAt: string;
  participantId: string;
  participantName: string;
  submissionId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  periodDate: string;
  dataRating: number;
  generalAdminTime: number;
  commuteTime: number;
  comment: string;
  itemCount: number;
  totalMinutes: number;
  items: AdminEventItem[];
}

interface AdminOverview {
  participants: AdminParticipant[];
  subjects: AdminSubject[];
  events: AdminEvent[];
}

type AdminMobileTab = 'log' | 'participants' | 'subjects';

const emptyOverview: AdminOverview = {
  participants: [],
  subjects: [],
  events: [],
};

function getIntlLocale(language: Language) {
  return language === 'de' ? 'de-CH' : 'en';
}

function formatDateTime(value: string, language: Language, t: (id: string) => string) {
  if (!value) {
    return t('admin.noActivityYet');
  }

  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(getIntlLocale(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDate(value: string, language: Language, t: (id: string) => string) {
  if (!value) {
    return t('admin.noPeriod');
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat(getIntlLocale(language), {
    dateStyle: 'medium',
  }).format(date);
}

function formatMinutes(minutes: number, t: (id: string, params?: Record<string, string | number>) => string) {
  if (!minutes) {
    return t('admin.duration.minutes', { count: 0 });
  }

  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);

  if (hours === 0) {
    return t('admin.duration.minutes', { count: rest });
  }

  return rest === 0
    ? t('admin.duration.hours', { count: hours })
    : t('admin.duration.hoursMinutes', { hours, minutes: rest });
}

function getEventLabel(eventType: string, t: (id: string) => string) {
  if (eventType === 'appendum') {
    return t('admin.event.appendum');
  }

  if (eventType === 'submitted') {
    return t('admin.event.initial');
  }

  if (eventType === 'deleted') {
    return t('admin.event.deleted');
  }

  if (eventType === 'initial') {
    return t('admin.event.initial');
  }

  if (eventType === 'deletion') {
    return t('admin.event.deletion');
  }

  if (eventType === 'correction') {
    return t('admin.event.correction');
  }

  return eventType || t('admin.event.activity');
}

function getSubjectName(labelEn: string, labelDe: string, language: Language, fallback: string) {
  if (language === 'de') {
    return labelDe || labelEn || fallback;
  }

  return labelEn || labelDe || fallback;
}

function eventBadgeClasses(kind: string, eventType: string) {
  if (kind === 'deletion' || eventType === 'deletion' || eventType === 'deleted') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  if (eventType === 'appendum') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  if (eventType === 'correction') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function getParticipantLink(participantId: string) {
  return `${window.location.origin}/${participantId}/`;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}

function getFilenameFromDisposition(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

async function downloadAdminCsv(endpoint: string, participantId: string, fallbackFilename: string) {
  const url = new URL(endpoint, pocketBaseUrl);
  url.searchParams.set('participantId', participantId);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: pb.authStore.token,
    },
  });

  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = getFilenameFromDisposition(response.headers.get('Content-Disposition'), fallbackFilename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

interface ParticipantActionMenuProps {
  participant: AdminParticipant;
  onCopyLink: (participant: AdminParticipant) => void;
  onSendReminder: (participant: AdminParticipant) => void;
  onExportAll: (participant: AdminParticipant) => void;
  onExportClean: (participant: AdminParticipant) => void;
  onRemove: (participant: AdminParticipant) => void;
}

function ParticipantActionMenu({
  participant,
  onCopyLink,
  onSendReminder,
  onExportAll,
  onExportClean,
  onRemove,
}: ParticipantActionMenuProps) {
  const { t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={t('admin.participantActions')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 border-gray-200 bg-white text-gray-900">
        <DropdownMenuItem onSelect={() => onCopyLink(participant)} className="cursor-pointer">
          <Copy className="h-4 w-4" />
          {t('admin.participant.getLink')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSendReminder(participant)} className="cursor-pointer">
          <Mail className="h-4 w-4" />
          {t('admin.participant.sendReminder')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExportAll(participant)} className="cursor-pointer">
          <Download className="h-4 w-4" />
          {t('admin.participant.exportAll')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExportClean(participant)} className="cursor-pointer">
          <Download className="h-4 w-4" />
          {t('admin.participant.exportClean')}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-gray-100" />
        <DropdownMenuItem
          onSelect={() => onRemove(participant)}
          variant="destructive"
          className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
          {t('admin.participant.remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface SubjectActionMenuProps {
  subject: AdminSubject;
  onRemove: (subject: AdminSubject) => void;
}

function SubjectActionMenu({ subject, onRemove }: SubjectActionMenuProps) {
  const { t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={t('admin.subjectActions')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 border-gray-200 bg-white text-gray-900">
        <DropdownMenuItem
          onSelect={() => onRemove(subject)}
          className="cursor-pointer text-red-700 focus:bg-red-50 focus:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
          {t('admin.subject.remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminContent() {
  const { t, language } = useI18n();
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [authRecord, setAuthRecord] = useState(pb.authStore.record);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [actionStatus, setActionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [actionMessage, setActionMessage] = useState('');
  const [participantToRemove, setParticipantToRemove] = useState<AdminParticipant | null>(null);
  const [subjectToRemove, setSubjectToRemove] = useState<AdminSubject | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<AdminMobileTab>('log');
  const [showParticipantDialog, setShowParticipantDialog] = useState(false);
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [createStatus, setCreateStatus] = useState<'idle' | 'loading'>('idle');
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantEntryMode, setNewParticipantEntryMode] = useState<'day' | 'week'>('day');
  const [newSubjectKey, setNewSubjectKey] = useState('');
  const [newSubjectLabelEn, setNewSubjectLabelEn] = useState('');
  const [newSubjectLabelDe, setNewSubjectLabelDe] = useState('');
  const [newSubjectCredits, setNewSubjectCredits] = useState('0');

  const isAdminAuthenticated = pb.authStore.isValid && authRecord?.collectionName === 'admins';

  async function loadOverview() {
    if (!isAdminAuthenticated) {
      setOverview(emptyOverview);
      setStatus('ready');
      return;
    }

    setStatus('loading');

    try {
      const result = await pb.send<AdminOverview>('/api/admin/overview');
      setOverview(result);
      setStatus('ready');
    } catch (error) {
      console.error('Admin overview lookup failed:', error);
      setOverview(emptyOverview);
      setStatus('error');
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginStatus('loading');

    try {
      await pb.collection('admins').authWithPassword(email.trim(), password);
      setLoginStatus('idle');
      setPassword('');
    } catch (error) {
      console.error('Admin login failed:', error);
      setLoginStatus('error');
      setPassword('');
    }
  }

  function handleLogout() {
    pb.authStore.clear();
    setOverview(emptyOverview);
    setStatus('ready');
  }

  function showActionMessage(status: 'success' | 'error', message: string) {
    setActionStatus(status);
    setActionMessage(message);
  }

  async function handleCopyParticipantLink(participant: AdminParticipant) {
    try {
      await copyTextToClipboard(getParticipantLink(participant.id));
      showActionMessage('success', t('admin.participant.linkCopied'));
    } catch (error) {
      console.error('Participant link copy failed:', error);
      showActionMessage('error', t('admin.participant.linkCopyFailed'));
    }
  }

  async function handleExportAllParticipantData(participant: AdminParticipant) {
    try {
      await downloadAdminCsv(
        '/api/export-student-flat',
        participant.id,
        `student_${participant.id}_submissions.csv`,
      );
      showActionMessage('success', t('admin.participant.exportStarted'));
    } catch (error) {
      console.error('Flat participant export failed:', error);
      showActionMessage('error', t('admin.participant.exportFailed'));
    }
  }

  async function handleExportCleanParticipantData(participant: AdminParticipant) {
    try {
      await downloadAdminCsv(
        '/api/export-student-clean',
        participant.id,
        `student_${participant.id}_clean.csv`,
      );
      showActionMessage('success', t('admin.participant.exportStarted'));
    } catch (error) {
      console.error('Clean participant export failed:', error);
      showActionMessage('error', t('admin.participant.exportFailed'));
    }
  }

  async function handleSendParticipantReminder(participant: AdminParticipant) {
    try {
      await pb.send('/api/admin/participant/reminder', {
        method: 'POST',
        body: {
          participantId: participant.id,
        },
      });
      showActionMessage('success', t('admin.participant.reminderSent', { email: participant.email || participant.name }));
    } catch (error) {
      console.error('Participant reminder failed:', error);
      showActionMessage('error', t('admin.participant.reminderFailed'));
    }
  }

  async function handleConfirmRemoveParticipant() {
    if (!participantToRemove) {
      return;
    }

    try {
      await pb.send('/api/admin/participant', {
        method: 'DELETE',
        query: { participantId: participantToRemove.id },
      });
      setParticipantToRemove(null);
      showActionMessage('success', t('admin.participant.removed'));
      await loadOverview();
    } catch (error) {
      console.error('Participant removal failed:', error);
      showActionMessage('error', t('admin.participant.removeFailed'));
    }
  }

  async function handleConfirmRemoveSubject() {
    if (!subjectToRemove) {
      return;
    }

    try {
      await pb.send('/api/admin/subject', {
        method: 'DELETE',
        query: { subjectId: subjectToRemove.id },
      });
      setSubjectToRemove(null);
      showActionMessage('success', t('admin.subject.removed'));
      await loadOverview();
    } catch (error) {
      console.error('Subject removal failed:', error);
      showActionMessage('error', t('admin.subject.removeFailed'));
    }
  }

  function resetParticipantForm() {
    setNewParticipantName('');
    setNewParticipantEmail('');
    setNewParticipantEntryMode('day');
  }

  function resetSubjectForm() {
    setNewSubjectKey('');
    setNewSubjectLabelEn('');
    setNewSubjectLabelDe('');
    setNewSubjectCredits('0');
  }

  async function handleCreateParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateStatus('loading');

    try {
      await pb.send('/api/admin/participants', {
        method: 'POST',
        body: {
          name: newParticipantName,
          email: newParticipantEmail,
          entryMode: newParticipantEntryMode,
        },
      });

      setShowParticipantDialog(false);
      resetParticipantForm();
      showActionMessage('success', t('admin.participant.created'));
      await loadOverview();
    } catch (error) {
      console.error('Participant creation failed:', error);
      showActionMessage('error', t('admin.participant.createFailed'));
    } finally {
      setCreateStatus('idle');
    }
  }

  async function handleCreateSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateStatus('loading');

    try {
      await pb.send('/api/admin/subjects', {
        method: 'POST',
        body: {
          key: newSubjectKey,
          labelEn: newSubjectLabelEn,
          labelDe: newSubjectLabelDe,
          credits: Number(newSubjectCredits || 0),
        },
      });

      setShowSubjectDialog(false);
      resetSubjectForm();
      showActionMessage('success', t('admin.subject.created'));
      await loadOverview();
    } catch (error) {
      console.error('Subject creation failed:', error);
      showActionMessage('error', t('admin.subject.createFailed'));
    } finally {
      setCreateStatus('idle');
    }
  }

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange(() => {
      setAuthRecord(pb.authStore.record);
    }, true);

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadOverview();
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (!actionMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActionMessage('');
      setActionStatus('idle');
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionMessage]);

  const filteredParticipants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return overview.participants;
    }

    return overview.participants.filter((participant) =>
      [participant.name, participant.email, participant.id]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [overview.participants, query]);

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return overview.subjects;
    }

    return overview.subjects.filter((subject) =>
      [subject.key, subject.labelEn, subject.labelDe, subject.id]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [overview.subjects, query]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return overview.events;
    }

    return overview.events.filter((event) =>
      [
        event.participantName,
        event.participantId,
        event.eventType,
        event.periodDate,
        event.comment,
        ...event.items.map((item) => `${item.subjectKey} ${item.subjectLabelEn} ${item.subjectLabelDe}`),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [overview.events, query]);

  if (!isAdminAuthenticated) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 text-gray-950">
        <div className="absolute right-4 top-4">
          <LanguageSelector />
        </div>
        <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-950 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-normal">{t('admin.login.title')}</h1>
              <p className="text-sm text-gray-500">{t('admin.login.subtitle')}</p>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={handleLogin}>
            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              {t('admin.login.email')}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                className="h-11 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              {t('admin.login.password')}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="h-11 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            {loginStatus === 'error' && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {t('admin.login.failed')}
              </p>
            )}

            <button
              type="submit"
              disabled={loginStatus === 'loading'}
              className="inline-flex h-11 items-center justify-center rounded-md bg-gray-950 px-4 text-sm font-bold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {loginStatus === 'loading' ? t('admin.login.signingIn') : t('admin.login.signIn')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-gray-950">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-950 text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-normal">{t('admin.title')}</h1>
              </div>
            </div>

            <div className="relative order-3 w-full max-w-xl md:order-2 md:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('admin.searchPlaceholder')}
                className="h-11 w-full rounded-md border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </div>

            <div className="order-2 flex shrink-0 flex-wrap items-center gap-2 md:order-3">
              <LanguageSelector />
              <button
                type="button"
                onClick={loadOverview}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <RefreshCw className="h-4 w-4" />
                {t('admin.refresh')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <LogOut className="h-4 w-4" />
                {t('admin.logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-5 overflow-hidden px-4 py-5 pb-24 md:px-6 md:pb-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className={`min-w-0 min-h-0 flex-col ${activeMobileTab === 'log' ? 'flex' : 'hidden'} md:flex`}>
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-bold">{t('admin.log.title')}</h2>
            </div>
            <span className="text-sm text-gray-500">{t('admin.events.count', { count: filteredEvents.length })}</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {status === 'loading' ? (
              <div className="p-6 text-sm text-gray-500">{t('admin.loadingActivity')}</div>
            ) : status === 'error' ? (
              <div className="p-6 text-sm font-semibold text-red-700">{t('admin.loadError')}</div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">{t('admin.noMatchingActivity')}</div>
            ) : (
              <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
                {filteredEvents.map((event) => (
                  <article key={event.id} className="grid gap-3 p-4 md:grid-cols-[10rem_minmax(0,1fr)] md:p-5">
                    <div className="text-sm text-gray-500">
                      <div className="font-semibold text-gray-900">{formatDateTime(event.happenedAt, language, t)}</div>
                      <div>{formatDate(event.periodStart, language, t)}</div>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold ${eventBadgeClasses(
                            event.kind,
                            event.eventType,
                          )}`}
                        >
                          {(event.kind === 'deletion' || event.eventType === 'deleted') && <Trash2 className="mr-1 h-3.5 w-3.5" />}
                          {getEventLabel(event.eventType, t)}
                        </span>
                        <span className="truncate text-sm font-semibold text-gray-950">
                          {event.participantName || event.participantId || t('admin.unknownParticipant')}
                        </span>
                        <span className="text-xs text-gray-400">{event.periodType || t('admin.period')}</span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        <span>{t('admin.metric.workload', { value: formatMinutes(event.totalMinutes, t) })}</span>
                        <span>{t('admin.metric.admin', { value: formatMinutes(event.generalAdminTime, t) })}</span>
                        <span>{t('admin.metric.commute', { value: formatMinutes(event.commuteTime, t) })}</span>
                        <span>{event.dataRating ? t('admin.metric.rating', { value: event.dataRating }) : t('admin.metric.noRating')}</span>
                      </div>

                      {event.items.length > 0 && (
                        <details className="group mt-2">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 [&::-webkit-details-marker]:hidden">
                            <ChevronDown className="h-3.5 w-3.5 text-gray-500 transition-transform group-open:rotate-180" />
                            {t('admin.hoursDetails')}
                          </summary>

                          <div className="mt-3 flex flex-wrap gap-2 rounded-md bg-gray-50 px-3 py-3">
                            {event.items.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
                              >
                                {getSubjectName(
                                  item.subjectLabelEn,
                                  item.subjectLabelDe,
                                  language,
                                  item.subjectKey || t('admin.subject.fallback'),
                                )} - {item.type || t('admin.time.fallback')} -{' '}
                                {formatMinutes(item.durationMinutes, t)}
                              </span>
                            ))}
                          </div>
                        </details>
                      )}

                      {event.comment && (
                        <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">{event.comment}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className={`min-h-0 gap-5 ${activeMobileTab === 'log' ? 'hidden' : 'grid'} md:grid md:grid-rows-2`}>
          <section className={`min-h-0 flex-col ${activeMobileTab === 'participants' ? 'flex' : 'hidden'} md:flex`}>
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-bold">{t('admin.participants.title')}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{filteredParticipants.length}</span>
                <button
                  type="button"
                  onClick={() => setShowParticipantDialog(true)}
                  title={t('admin.participant.add')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {filteredParticipants.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">{t('admin.participants.none')}</div>
              ) : (
                <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
                  {filteredParticipants.map((participant) => (
                    <div key={participant.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-gray-950">
                          {participant.name || participant.id}
                        </div>
                        <div className="truncate text-xs text-gray-500">{participant.email || participant.id}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                          <span>{t('admin.subjects.count', { count: participant.subjectCount })}</span>
                          <span>{t('admin.submissions.count', { count: participant.submissionCount })}</span>
                        </div>
                      </div>
                      <ParticipantActionMenu
                        participant={participant}
                        onCopyLink={handleCopyParticipantLink}
                        onSendReminder={handleSendParticipantReminder}
                        onExportAll={handleExportAllParticipantData}
                        onExportClean={handleExportCleanParticipantData}
                        onRemove={setParticipantToRemove}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={`min-h-0 flex-col ${activeMobileTab === 'subjects' ? 'flex' : 'hidden'} md:flex`}>
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-bold">{t('admin.subjects.title')}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{filteredSubjects.length}</span>
                <button
                  type="button"
                  onClick={() => setShowSubjectDialog(true)}
                  title={t('admin.subject.add')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {filteredSubjects.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">{t('admin.subjects.none')}</div>
              ) : (
                <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
                  {filteredSubjects.map((subject) => (
                    <div key={subject.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-gray-950">
                          {getSubjectName(subject.labelEn, subject.labelDe, language, subject.key || subject.id)}
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-500">{subject.key || subject.id}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                          <span>{t('admin.participants.count', { count: subject.participantCount })}</span>
                          <span>{t('admin.logItems.count', { count: subject.submissionItemCount })}</span>
                        </div>
                      </div>
                      <SubjectActionMenu subject={subject} onRemove={setSubjectToRemove} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
      </main>

      <Dialog
        open={showParticipantDialog}
        onOpenChange={(isOpen) => {
          setShowParticipantDialog(isOpen);
          if (!isOpen) {
            resetParticipantForm();
          }
        }}
      >
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.participant.addTitle')}</DialogTitle>
            <DialogDescription>{t('admin.participant.addDescription')}</DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={handleCreateParticipant}>
            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              {t('admin.participant.name')}
              <input
                value={newParticipantName}
                onChange={(event) => setNewParticipantName(event.target.value)}
                required
                className="h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              {t('admin.participant.email')}
              <input
                type="email"
                value={newParticipantEmail}
                onChange={(event) => setNewParticipantEmail(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              {t('admin.participant.entryMode')}
              <select
                value={newParticipantEntryMode}
                onChange={(event) => setNewParticipantEntryMode(event.target.value as 'day' | 'week')}
                className="h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="day">{t('admin.participant.entryModeDay')}</option>
                <option value="week">{t('admin.participant.entryModeWeek')}</option>
              </select>
            </label>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowParticipantDialog(false)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={createStatus === 'loading'}
                className="inline-flex h-10 items-center justify-center rounded-md bg-gray-950 px-4 text-sm font-bold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {createStatus === 'loading' ? t('admin.creating') : t('admin.create')}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showSubjectDialog}
        onOpenChange={(isOpen) => {
          setShowSubjectDialog(isOpen);
          if (!isOpen) {
            resetSubjectForm();
          }
        }}
      >
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.subject.addTitle')}</DialogTitle>
            <DialogDescription>{t('admin.subject.addDescription')}</DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={handleCreateSubject}>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-gray-700">
                {t('admin.subject.key')}
                <input
                  value={newSubjectKey}
                  onChange={(event) => setNewSubjectKey(event.target.value)}
                  required
                  className="h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </label>

              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-gray-700">
                {t('admin.subject.credits')}
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newSubjectCredits}
                  onChange={(event) => setNewSubjectCredits(event.target.value)}
                  className="h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </label>
            </div>

            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              {t('admin.subject.labelEn')}
              <input
                value={newSubjectLabelEn}
                onChange={(event) => setNewSubjectLabelEn(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              {t('admin.subject.labelDe')}
              <input
                value={newSubjectLabelDe}
                onChange={(event) => setNewSubjectLabelDe(event.target.value)}
                className="h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowSubjectDialog(false)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={createStatus === 'loading'}
                className="inline-flex h-10 items-center justify-center rounded-md bg-gray-950 px-4 text-sm font-bold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {createStatus === 'loading' ? t('admin.creating') : t('admin.create')}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {actionMessage && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-4">
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto max-w-md rounded-md border px-4 py-3 text-sm font-semibold shadow-lg ${
              actionStatus === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {actionMessage}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveMobileTab('log')}
            aria-current={activeMobileTab === 'log' ? 'page' : undefined}
            className={`flex h-12 flex-col items-center justify-center gap-1 rounded-md text-xs font-bold transition-colors ${
              activeMobileTab === 'log' ? 'bg-gray-950 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock3 className="h-4 w-4" />
            <span className="w-full truncate px-1">{t('admin.log.title')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab('participants')}
            aria-current={activeMobileTab === 'participants' ? 'page' : undefined}
            className={`flex h-12 flex-col items-center justify-center gap-1 rounded-md text-xs font-bold transition-colors ${
              activeMobileTab === 'participants' ? 'bg-gray-950 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="h-4 w-4" />
            <span className="w-full truncate px-1">{t('admin.participants.title')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab('subjects')}
            aria-current={activeMobileTab === 'subjects' ? 'page' : undefined}
            className={`flex h-12 flex-col items-center justify-center gap-1 rounded-md text-xs font-bold transition-colors ${
              activeMobileTab === 'subjects' ? 'bg-gray-950 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span className="w-full truncate px-1">{t('admin.subjects.title')}</span>
          </button>
        </div>
      </nav>

      <ConfirmDialog
        open={participantToRemove !== null}
        title={t('admin.participant.removeTitle')}
        description={t('admin.participant.removeDescription', {
          name: participantToRemove?.name || participantToRemove?.id || '',
        })}
        confirmLabel={t('admin.participant.remove')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onCancel={() => setParticipantToRemove(null)}
        onConfirm={handleConfirmRemoveParticipant}
      />

      <ConfirmDialog
        open={subjectToRemove !== null}
        title={t('admin.subject.removeTitle')}
        description={t('admin.subject.removeDescription', {
          name: getSubjectName(
            subjectToRemove?.labelEn || '',
            subjectToRemove?.labelDe || '',
            language,
            subjectToRemove?.key || subjectToRemove?.id || '',
          ),
        })}
        confirmLabel={t('admin.subject.remove')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onCancel={() => setSubjectToRemove(null)}
        onConfirm={handleConfirmRemoveSubject}
      />
    </div>
  );
}

export default function AdminApp() {
  return (
    <I18nProvider>
      <AdminContent />
    </I18nProvider>
  );
}
