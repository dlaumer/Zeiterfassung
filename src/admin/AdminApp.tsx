import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type PointerEvent } from 'react';
import PocketBase from 'pocketbase';
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Filter,
  LogOut,
  Mail,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { I18nProvider, useI18n, type Language } from '../app/i18n/i18n';
import { LanguageSelector } from '../app/i18n/LanguageSelector';
import { ConfirmDialog } from '../app/components/ui/ConfirmDialog';
import logoMethric from '../assets/logoMethric.png';
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
import { Popover, PopoverContent, PopoverTrigger } from '../app/components/ui/popover';

const pocketBaseUrl = 'https://api.methric.ch';
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
  missingCount: number;
  lastActivityAt: string;
}

interface AdminSubject {
  id: string;
  number: string;
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
  kind: 'submission' | 'deletion' | 'reminder' | string;
  eventType: string;
  happenedAt: string;
  participantId: string;
  participantName: string;
  participantEmail?: string;
  sentByEmail?: string;
  submissionId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  periodDate: string;
  dataRating: number;
  generalAdminTime: number;
  commuteTime: number;
  structuralChanges: number;
  comment: string;
  itemCount: number;
  totalMinutes: number;
  items: AdminEventItem[];
}

interface AdminOverview {
  participants: AdminParticipant[];
  subjects: AdminSubject[];
  events: AdminEvent[];
  referenceDate: string;
}

interface SubjectImportRow {
  number: string;
  key: string;
  label: string;
  credits: number;
}

type AdminMobileTab = 'log' | 'participants' | 'subjects';
type AdminEntryModeFilter = 'all' | 'day' | 'week';

const emptyOverview: AdminOverview = {
  participants: [],
  subjects: [],
  events: [],
  referenceDate: '',
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

function formatPeriodLabel(event: AdminEvent, language: Language, t: (id: string) => string) {
  if (event.periodType === 'week' && event.periodStart && event.periodEnd) {
    return `${formatDate(event.periodStart, language, t)} - ${formatDate(event.periodEnd, language, t)}`;
  }

  return formatDate(event.periodStart, language, t);
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
  if (eventType === 'reminder') {
    return t('admin.event.reminder');
  }

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

function formatSubjectCredits(credits: number, language: Language) {
  return `${credits} ${language === 'de' ? 'KP' : 'CP'}`;
}

function normalizeImportCell(value: unknown) {
  return String(value ?? '').trim();
}

function getImportCell(row: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = normalizeImportCell(row[name]);
    if (value) {
      return value;
    }
  }

  return '';
}

async function parseSubjectImportRows(fileData: ArrayBuffer): Promise<SubjectImportRow[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(fileData, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
  const seenKeys = new Set<string>();

  return rows
    .map((row) => {
      const label = getImportCell(row, ['Modulname DE / EN', 'Modulname', 'Module name', 'Label']);
      const key = getImportCell(row, ['Key', 'Kürzel', 'Kuerzel']) || label;
      const credits = Number(getImportCell(row, ['Anzahl ECTS', 'ECTS', 'Credits']) || 0);

      return {
        number: getImportCell(row, ['LE-Nummer', 'LE Nummer', 'Number']),
        key,
        label,
        credits: Number.isFinite(credits) ? Math.max(0, credits) : 0,
      };
    })
    .filter((row) => row.key && row.label)
    .filter((row) => {
      const normalizedKey = row.key.toLowerCase();
      if (seenKeys.has(normalizedKey)) {
        return false;
      }
      seenKeys.add(normalizedKey);
      return true;
    });
}

function getAdminItemLabel(
  item: AdminSubmissionItem,
  periodType: string,
  language: Language,
  t: (id: string, params?: Record<string, string | number>) => string,
) {
  const subjectName = getSubjectName(
    item.subjectLabelEn,
    item.subjectLabelDe,
    language,
    item.subjectKey || t('admin.subject.fallback'),
  );

  if (periodType === 'week') {
    return subjectName;
  }

  return `${subjectName} - ${item.type || t('admin.time.fallback')}`;
}

function eventBadgeClasses(kind: string, eventType: string) {
  if (kind === 'reminder' || eventType === 'reminder') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }

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

function participantMissingToneClasses(missingCount: number) {
  if (missingCount >= 10) {
    return 'border-l-red-500 bg-red-50/55';
  }

  if (missingCount >= 5) {
    return 'border-l-amber-500 bg-amber-50/55';
  }

  if (missingCount >= 1) {
    return 'border-l-sky-500 bg-sky-50/55';
  }

  return 'border-l-emerald-500 bg-emerald-50/50';
}

function getParticipantLink(participantId: string) {
  return `${window.location.origin}/${participantId}/`;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  return false;
}

function getFilenameFromDisposition(disposition: string | null, fallback: string) {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

async function downloadAdminCsv(endpoint: string, participantId: string, fallbackFilename: string, periodType?: string) {
  const url = new URL(endpoint, pocketBaseUrl);
  url.searchParams.set('participantId', participantId);
  if (periodType === 'day' || periodType === 'week') {
    url.searchParams.set('periodType', periodType);
  }

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
  onCopyLink: (participantId: string) => void;
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
  const handleCopyPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    onCopyLink(participant.id);
  };

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
        <DropdownMenuItem
          onPointerDown={handleCopyPointerDown}
          onSelect={(event) => event.preventDefault()}
          className="cursor-pointer"
        >
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
  const [manualCopyText, setManualCopyText] = useState('');
  const [participantToRemove, setParticipantToRemove] = useState<AdminParticipant | null>(null);
  const [subjectToRemove, setSubjectToRemove] = useState<AdminSubject | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<AdminMobileTab>('participants');
  const [selectedLogDate, setSelectedLogDate] = useState('');
  const [selectedEntryMode, setSelectedEntryMode] = useState<AdminEntryModeFilter>('all');
  const [showParticipantDialog, setShowParticipantDialog] = useState(false);
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [showReferenceDateDialog, setShowReferenceDateDialog] = useState(false);
  const [createStatus, setCreateStatus] = useState<'idle' | 'loading'>('idle');
  const [subjectImportStatus, setSubjectImportStatus] = useState<'idle' | 'loading'>('idle');
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantEntryMode, setNewParticipantEntryMode] = useState<'day' | 'week'>('day');
  const [newSubjectNumber, setNewSubjectNumber] = useState('');
  const [newSubjectKey, setNewSubjectKey] = useState('');
  const [newSubjectLabel, setNewSubjectLabel] = useState('');
  const [newSubjectCredits, setNewSubjectCredits] = useState('0');
  const [referenceDateInput, setReferenceDateInput] = useState('');
  const [referenceDateStatus, setReferenceDateStatus] = useState<'idle' | 'loading'>('idle');

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
      setReferenceDateInput(result.referenceDate || '');
      setStatus('ready');
    } catch (error) {
      console.error('Admin overview lookup failed:', error);
      setOverview(emptyOverview);
      setReferenceDateInput('');
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

  async function handleCopyParticipantLink(participantId: string) {
    const participantLink = getParticipantLink(participantId);

    try {
      const didCopy = await copyTextToClipboard(participantLink);
      if (didCopy) {
        showActionMessage('success', t('admin.participant.linkCopied'));
        return;
      }

      setManualCopyText(participantLink);
    } catch (error) {
      console.error('Participant link copy failed:', error);
      setManualCopyText(participantLink);
    }
  }

  async function handleExportAllParticipantData(participant: AdminParticipant) {
    try {
      const periodType = participant.entryMode === 'week' ? 'week' : 'day';
      await downloadAdminCsv(
        '/api/export-student-flat',
        participant.id,
        `student_${participant.id}_${periodType}_submissions.csv`,
        periodType,
      );
      showActionMessage('success', t('admin.participant.exportStarted'));
    } catch (error) {
      console.error('Flat participant export failed:', error);
      showActionMessage('error', t('admin.participant.exportFailed'));
    }
  }

  async function handleExportCleanParticipantData(participant: AdminParticipant) {
    try {
      const periodType = participant.entryMode === 'week' ? 'week' : 'day';
      await downloadAdminCsv(
        '/api/export-student-clean',
        participant.id,
        `student_${participant.id}_${periodType}_clean.csv`,
        periodType,
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
    setNewSubjectNumber('');
    setNewSubjectKey('');
    setNewSubjectLabel('');
    setNewSubjectCredits('0');
  }

  function openReferenceDateDialog() {
    setReferenceDateInput(overview.referenceDate || '');
    setShowReferenceDateDialog(true);
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
          number: newSubjectNumber,
          labelEn: newSubjectLabel,
          labelDe: newSubjectLabel,
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

  async function handleUpdateReferenceDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReferenceDateStatus('loading');

    try {
      const result = await pb.send<{ referenceDate: string }>('/api/admin/reference-date', {
        method: 'POST',
        body: {
          referenceDate: referenceDateInput,
        },
      });

      const updatedReferenceDate = result.referenceDate || referenceDateInput;
      setOverview((currentOverview) => ({
        ...currentOverview,
        referenceDate: updatedReferenceDate,
      }));
      setReferenceDateInput(updatedReferenceDate);
      setShowReferenceDateDialog(false);
      showActionMessage('success', t('admin.referenceDate.saved'));
      await loadOverview();
    } catch (error) {
      console.error('Reference date update failed:', error);
      showActionMessage('error', t('admin.referenceDate.saveFailed'));
    } finally {
      setReferenceDateStatus('idle');
    }
  }

  async function handleImportSubjects(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    setSubjectImportStatus('loading');

    try {
      const parsedRows = await parseSubjectImportRows(await file.arrayBuffer());
      const existingKeys = new Set(overview.subjects.map((subject) => subject.key.toLowerCase()));
      const rowsToCreate = parsedRows.filter((row) => !existingKeys.has(row.key.toLowerCase()));

      if (rowsToCreate.length === 0) {
        showActionMessage('error', t('admin.subject.importNone'));
        return;
      }

      let createdCount = 0;

      for (const row of rowsToCreate) {
        await pb.send('/api/admin/subjects', {
          method: 'POST',
          body: {
            key: row.key,
            number: row.number,
            labelEn: row.label,
            labelDe: row.label,
            credits: row.credits,
          },
        });
        createdCount += 1;
      }

      setShowSubjectDialog(false);
      resetSubjectForm();
      showActionMessage('success', t('admin.subject.imported', { count: createdCount }));
      await loadOverview();
    } catch (error) {
      console.error('Subject import failed:', error);
      showActionMessage('error', t('admin.subject.importFailed'));
    } finally {
      setSubjectImportStatus('idle');
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
    return overview.participants
      .filter((participant) => {
        const matchesEntryMode = selectedEntryMode === 'all' || participant.entryMode === selectedEntryMode;
        if (!matchesEntryMode) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [participant.name, participant.email, participant.id].join(' ').toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (b.missingCount !== a.missingCount) {
          return b.missingCount - a.missingCount;
        }

        if (a.entryMode !== b.entryMode) {
          return a.entryMode === 'day' ? -1 : 1;
        }

        return (a.name || a.id).localeCompare(b.name || b.id);
      });
  }, [overview.participants, query, selectedEntryMode]);

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return overview.subjects;
    }

    return overview.subjects.filter((subject) =>
      [subject.number, subject.key, subject.labelEn, subject.labelDe, subject.id]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [overview.subjects, query]);

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return overview.events.filter((event) => {
      const matchesEntryMode =
        selectedEntryMode === 'all' || event.kind === 'reminder' || event.periodType === selectedEntryMode;

      if (!matchesEntryMode) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        event.participantName,
        event.participantId,
        event.submissionId,
        event.participantEmail,
        event.sentByEmail,
        event.eventType,
        event.periodDate,
        event.comment,
        ...event.items.map((item) => `${item.subjectKey} ${item.subjectLabelEn} ${item.subjectLabelDe}`),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [overview.events, query, selectedEntryMode]);

  const displayedEvents = useMemo(() => {
    if (!selectedLogDate) {
      return filteredEvents;
    }

    return filteredEvents.filter((event) => event.periodDate === selectedLogDate);
  }, [filteredEvents, selectedLogDate]);

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
              <img
                src={logoMethric}
                alt={t('admin.title')}
                className="h-11 w-auto object-contain"
              />
            </div>

            <div className="order-3 flex w-full max-w-xl gap-2 md:order-2 md:flex-1">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('admin.searchPlaceholder')}
                  className="h-11 w-full rounded-md border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 shadow-sm outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title={
                      selectedLogDate || selectedEntryMode !== 'all'
                        ? t('admin.filters.active')
                        : t('admin.filters.title')
                    }
                    className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-white text-gray-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                      selectedLogDate || selectedEntryMode !== 'all'
                        ? 'border-emerald-500 bg-emerald-100 text-emerald-800 ring-2 ring-emerald-200'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <Filter className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 border-gray-200 bg-white p-4 text-gray-900">
                  <div className="grid gap-3">
                    <div>
                      <div className="text-sm font-semibold">{t('admin.filters.title')}</div>
                      <div className="text-xs text-gray-500">{t('admin.filters.description')}</div>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-sm font-semibold">{t('admin.filters.entryModeTitle')}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['all', 'day', 'week'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setSelectedEntryMode(mode)}
                            className={`inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                              selectedEntryMode === mode
                                ? 'border-gray-950 bg-gray-950 text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {mode === 'all'
                              ? t('admin.filters.mode.all')
                              : mode === 'day'
                                ? t('admin.entryMode.day')
                                : t('admin.entryMode.week')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div className="text-sm font-semibold">{t('admin.log.dateFilterTitle')}</div>
                      <div className="text-xs text-gray-500">{t('admin.log.dateFilterDescription')}</div>
                      <input
                        type="date"
                        value={selectedLogDate}
                        onChange={(event) => setSelectedLogDate(event.target.value)}
                        className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLogDate('');
                        setSelectedEntryMode('all');
                      }}
                      disabled={!selectedLogDate && selectedEntryMode === 'all'}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                      {t('admin.filters.clear')}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="order-2 grid w-full shrink-0 grid-cols-3 gap-2 md:order-3 md:w-auto md:flex md:flex-nowrap md:items-center">
              <div className="min-w-0">
                <LanguageSelector />
              </div>
              <button
                type="button"
                onClick={loadOverview}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 md:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="truncate">{t('admin.refresh')}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 md:w-auto"
              >
                <LogOut className="h-4 w-4" />
                <span className="truncate">{t('admin.logout')}</span>
              </button>
            </div>
          </div>

        </div>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-5 overflow-hidden px-4 py-5 pb-24 md:px-6 md:pb-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
        <section className={`min-w-0 min-h-0 flex-col ${activeMobileTab === 'participants' ? 'flex' : 'hidden'} md:flex`}>
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-bold">{t('admin.participants.title')}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{filteredParticipants.length}</span>
              <button
                type="button"
                onClick={openReferenceDateDialog}
                title={`${t('admin.referenceDate.title')}: ${formatDate(overview.referenceDate, language, t)}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
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
                  <div
                    key={participant.id}
                    className={`flex min-w-0 items-start justify-between gap-3 overflow-hidden border-l-4 p-4 transition-colors ${participantMissingToneClasses(
                      participant.missingCount,
                    )}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-bold text-gray-950">
                              {participant.name || participant.id}
                            </div>
                            <span className="shrink-0 text-xs font-medium text-gray-500">
                              {participant.entryMode === 'week' ? t('admin.entryMode.week') : t('admin.entryMode.day')}
                            </span>
                          </div>
                          <div className="truncate text-xs text-gray-500">{participant.email || participant.id}</div>
                        </div>

                        <div className="hidden shrink-0 flex-wrap items-center justify-end gap-2 text-xs text-gray-600 md:flex">
                          <span>{t('admin.subjects.count', { count: participant.subjectCount })}</span>
                          <span>{t('admin.submissions.count', { count: participant.submissionCount })}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${
                              participant.missingCount >= 10
                                ? 'bg-red-100 text-red-700'
                                : participant.missingCount >= 5
                                  ? 'bg-amber-100 text-amber-800'
                                  : participant.missingCount >= 1
                                    ? 'bg-sky-100 text-sky-700'
                                    : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {t('admin.missing.count', { count: participant.missingCount })}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 md:hidden">
                        <span>{t('admin.subjects.count', { count: participant.subjectCount })}</span>
                        <span>{t('admin.submissions.count', { count: participant.submissionCount })}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            participant.missingCount >= 10
                              ? 'bg-red-100 text-red-700'
                              : participant.missingCount >= 5
                                ? 'bg-amber-100 text-amber-800'
                                : participant.missingCount >= 1
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {t('admin.missing.count', { count: participant.missingCount })}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <ParticipantActionMenu
                        participant={participant}
                        onCopyLink={handleCopyParticipantLink}
                        onSendReminder={handleSendParticipantReminder}
                        onExportAll={handleExportAllParticipantData}
                        onExportClean={handleExportCleanParticipantData}
                        onRemove={setParticipantToRemove}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className={`min-w-0 min-h-0 gap-5 ${activeMobileTab === 'participants' ? 'hidden' : 'grid'} md:grid md:grid-rows-[minmax(0,1fr)_minmax(0,0.8fr)]`}>
          <section className={`min-w-0 min-h-0 flex-col ${activeMobileTab === 'log' ? 'flex' : 'hidden'} md:flex`}>
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-bold">{t('admin.log.title')}</h2>
            </div>
            <span className="text-sm text-gray-500">{t('admin.events.count', { count: displayedEvents.length })}</span>
          </div>

          <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {status === 'loading' ? (
              <div className="p-6 text-sm text-gray-500">{t('admin.loadingActivity')}</div>
            ) : status === 'error' ? (
              <div className="p-6 text-sm font-semibold text-red-700">{t('admin.loadError')}</div>
            ) : displayedEvents.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">{t('admin.noMatchingActivity')}</div>
            ) : (
              <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto">
                {displayedEvents.map((event) => (
                  <article key={event.id} className="grid min-w-0 w-full gap-3 overflow-hidden p-4 md:grid-cols-[minmax(0,_1fr)_9rem] md:items-start md:p-4">
                    <div className="min-w-0 overflow-hidden">
                      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold ${eventBadgeClasses(
                            event.kind,
                            event.eventType,
                          )}`}
                        >
                          {event.kind === 'reminder' && <Mail className="mr-1 h-3.5 w-3.5" />}
                          {(event.kind === 'deletion' || event.eventType === 'deleted') && <Trash2 className="mr-1 h-3.5 w-3.5" />}
                          {getEventLabel(event.eventType, t)}
                        </span>
                        <span className="truncate text-sm font-semibold text-gray-950">
                          {event.participantName || event.participantId || t('admin.unknownParticipant')}
                        </span>
                        <span className="shrink-0 text-xs text-gray-400">
                          {event.kind === 'reminder' ? t('admin.participant.label') : event.periodType || t('admin.period')}
                        </span>
                      </div>

                      <div className="mb-2 text-xs text-gray-500 md:hidden">
                        <div className="font-semibold leading-tight text-gray-900">
                          {formatDateTime(event.happenedAt, language, t)}
                        </div>
                        <div className="mt-1 leading-tight">{formatPeriodLabel(event, language, t)}</div>
                      </div>

                      {event.kind !== 'reminder' && (
                        <details className="group mt-2">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 [&::-webkit-details-marker]:hidden">
                            <ChevronDown className="h-3.5 w-3.5 text-gray-500 transition-transform group-open:rotate-180" />
                            {t('admin.hoursDetails')}
                          </summary>

                          <div className="mt-3 rounded-md bg-gray-50 px-3 py-3">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                              <span>{t('admin.metric.workload', { value: formatMinutes(event.totalMinutes, t) })}</span>
                              <span>{t('admin.metric.admin', { value: formatMinutes(event.generalAdminTime, t) })}</span>
                              <span>
                                {event.periodType === 'week'
                                  ? t('admin.metric.structuralChanges', {
                                      value: formatMinutes(event.structuralChanges, t),
                                    })
                                  : t('admin.metric.commute', { value: formatMinutes(event.commuteTime, t) })}
                              </span>
                              <span>{event.dataRating ? t('admin.metric.rating', { value: event.dataRating }) : t('admin.metric.noRating')}</span>
                            </div>

                            {event.items.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {event.items.map((item) => (
                                  <span
                                    key={item.id}
                                    className="inline-flex rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
                                  >
                                    {getAdminItemLabel(item, event.periodType, language, t)} -{' '}
                                    {formatMinutes(item.durationMinutes, t)}
                                  </span>
                                ))}
                              </div>
                            )}

                            {event.comment && (
                              <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-gray-700 ring-1 ring-gray-200">
                                {event.comment}
                              </p>
                            )}
                          </div>
                        </details>
                      )}
                    </div>

                    <div className="hidden w-36 max-w-36 shrink-0 text-right text-xs text-gray-500 md:block">
                      <div className="font-semibold leading-tight text-gray-900">
                        {formatDateTime(event.happenedAt, language, t)}
                      </div>
                      <div className="mt-1 leading-tight">{formatPeriodLabel(event, language, t)}</div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          </section>

          <section className={`min-w-0 min-h-0 flex-col ${activeMobileTab === 'subjects' ? 'flex' : 'hidden'} md:flex`}>
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
                    <div key={subject.id} className="flex min-w-0 items-start justify-between gap-3 overflow-hidden p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-gray-950">
                              {getSubjectName(subject.labelEn, subject.labelDe, language, subject.key || subject.id)}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              {subject.number ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                                  {subject.number}
                                </span>
                              ) : null}
                              <span className="truncate">{subject.key || subject.id}</span>
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                                {formatSubjectCredits(subject.credits, language)}
                              </span>
                            </div>
                          </div>

                          <div className="hidden shrink-0 flex-wrap items-center justify-end gap-2 text-xs text-gray-600 md:flex">
                            <span>{t('admin.participants.count', { count: subject.participantCount })}</span>
                            <span>{t('admin.logItems.count', { count: subject.submissionItemCount })}</span>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 md:hidden">
                          <span>{t('admin.participants.count', { count: subject.participantCount })}</span>
                          <span>{t('admin.logItems.count', { count: subject.submissionItemCount })}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <SubjectActionMenu subject={subject} onRemove={setSubjectToRemove} />
                      </div>
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white sm:max-w-md">
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
        open={showReferenceDateDialog}
        onOpenChange={(isOpen) => {
          setShowReferenceDateDialog(isOpen);
          if (!isOpen) {
            setReferenceDateInput(overview.referenceDate || '');
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.referenceDate.title')}</DialogTitle>
            <DialogDescription>{t('admin.referenceDate.description')}</DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={handleUpdateReferenceDate}>
            <div className="rounded-md border border-gray-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase text-gray-500">{t('admin.referenceDate.current')}</div>
              <div className="mt-1 text-sm font-bold text-gray-950">
                {formatDate(overview.referenceDate, language, t)}
              </div>
            </div>

            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              {t('admin.referenceDate.input')}
              <input
                type="date"
                value={referenceDateInput}
                onChange={(event) => setReferenceDateInput(event.target.value)}
                required
                className="h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              />
            </label>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowReferenceDateDialog(false)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={referenceDateStatus === 'loading' || !referenceDateInput || referenceDateInput === overview.referenceDate}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-sm font-bold text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                <Save className="h-4 w-4" />
                {referenceDateStatus === 'loading' ? t('admin.referenceDate.saving') : t('admin.referenceDate.save')}
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.subject.addTitle')}</DialogTitle>
            <DialogDescription>{t('admin.subject.addDescription')}</DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-gray-700 ring-1 ring-gray-200">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">{t('admin.subject.importTitle')}</div>
                <p className="mt-1 text-xs text-gray-500">{t('admin.subject.importDescription')}</p>
                <label className="mt-3 inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-within:ring-2 focus-within:ring-gray-900">
                  {subjectImportStatus === 'loading' ? t('admin.subject.importing') : t('admin.subject.importFile')}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    disabled={subjectImportStatus === 'loading'}
                    onChange={handleImportSubjects}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={handleCreateSubject}>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
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
                {t('admin.subject.number')}
                <input
                  value={newSubjectNumber}
                  onChange={(event) => setNewSubjectNumber(event.target.value)}
                  className="h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-gray-700">
                {t('admin.subject.label')}
                <input
                  value={newSubjectLabel}
                  onChange={(event) => setNewSubjectLabel(event.target.value)}
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

      <Dialog open={manualCopyText !== ''} onOpenChange={(isOpen) => !isOpen && setManualCopyText('')}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.participant.manualCopyTitle')}</DialogTitle>
            <DialogDescription>{t('admin.participant.manualCopyDescription')}</DialogDescription>
          </DialogHeader>

          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            {t('admin.participant.manualCopyLabel')}
            <input
              readOnly
              autoFocus
              value={manualCopyText}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
              className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            />
          </label>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setManualCopyText('')}
              className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {t('common.close')}
            </button>
          </DialogFooter>
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
