import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Same palette as the participant app. These are replacements, not recovered colors.
const COLORS = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'];
const eligible = person => person.inactive === true && person.type === 'student';

export async function restoreModules(pb, { apply = false, colors = [], log = console.log } = {}) {
  const historicalColors = new Map();
  for (const row of colors) {
    if (!row.participant || !row.subject || !/^#[0-9a-f]{6}$/i.test(row.color || '')) {
      throw new Error('Each color record must contain participant, subject and a six-digit hex color.');
    }
    const key = `${row.participant}:${row.subject}`;
    if (historicalColors.has(key) && historicalColors.get(key) !== row.color.toLowerCase()) {
      throw new Error(`Conflicting historical colors for ${key}. Use one verified snapshot.`);
    }
    historicalColors.set(key, row.color.toLowerCase());
  }
  const participants = await pb.collection('participants').getFullList({ filter: 'inactive = true && type = "student"', sort: 'id' });
  const subjects = new Map((await pb.collection('subjects').getFullList()).map(subject => [subject.id, subject]));
  const report = { mode: apply ? 'apply' : 'preview', students: participants.length, added: 0, proposed: [], skipped: [] };
  for (const participant of participants) {
    if (!eligible(participant)) continue;
    const filter = pb.filter('participant = {:id}', { id: participant.id });
    const enrollments = await pb.collection('participant_subjects').getFullList({ filter });
    // Relation traversal includes every page of historical items, including corrections.
    const items = await pb.collection('submission_items').getFullList({ filter: pb.filter('submission.participant = {:id}', { id: participant.id }) });
    const existing = new Set(enrollments.map(row => row.subject));
    const usedColors = new Set(enrollments.map(row => (row.color || '').toLowerCase()));
    const subjectIds = [...new Set(items.map(row => row.workloadType).filter(Boolean))].sort();
    if (!subjectIds.length) report.skipped.push({ participant: participant.id, reason: 'No module submission history; manual or backup recovery needed.' });
    // Reserve recovered colors before choosing replacements for other modules.
    for (const id of subjectIds) {
      const color = historicalColors.get(`${participant.id}:${id}`);
      if (color) usedColors.add(color);
    }
    for (const subjectId of subjectIds) {
      if (existing.has(subjectId)) continue;
      if (!subjects.has(subjectId)) {
        report.skipped.push({ participant: participant.id, subject: subjectId, reason: 'Module no longer exists.' });
        continue;
      }
      const historicalColor = historicalColors.get(`${participant.id}:${subjectId}`);
      const color = historicalColor || COLORS.find(value => !usedColors.has(value)) || COLORS[0];
      usedColors.add(color);
      const row = { participant: participant.id, name: participant.name, subject: subjectId, module: subjects.get(subjectId).label_en || subjects.get(subjectId).key, color, colorSource: historicalColor ? 'backup' : 'replacement' };
      if (apply) {
        // Recheck scope and duplicates immediately before each write; reruns are safe.
        if (!eligible(await pb.collection('participants').getOne(participant.id))) {
          report.skipped.push({ participant: participant.id, reason: 'Participant is no longer an inactive student.' });
          break;
        }
        const current = await pb.collection('participant_subjects').getFullList({ filter: pb.filter('participant = {:participant} && subject = {:subject}', row) });
        if (current.length) continue;
        const created = await pb.collection('participant_subjects').create({ participant: row.participant, subject: row.subject, color });
        row.enrollmentId = created.id;
        report.added++;
      }
      report.proposed.push(row);
      log(JSON.stringify({ action: apply ? 'added' : 'would-add', ...row }));
    }
  }
  for (const skipped of report.skipped) log(JSON.stringify({ action: 'skipped', ...skipped }));
  log(`${report.mode}: ${report.students} inactive students, ${report.proposed.length} ${apply ? 'added' : 'missing assignments'}, ${report.skipped.length} flagged.`);
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node scripts/restore-inactive-student-modules.mjs [--dry-run | --apply] [--colors backup-colors.json]\nDefault: preview only. Set PB_URL and PB_AUTH_TOKEN (superuser), or PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.\nColors JSON: [{"participant":"id","subject":"id","color":"#e6194b"}]. Existing assignments are never changed.');
    return;
  }
  let apply = false;
  let colors = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') apply = true;
    else if (args[i] === '--dry-run') continue;
    else if (args[i] === '--colors' && args[i + 1]) colors = JSON.parse(readFileSync(args[++i], 'utf8').replace(/^\uFEFF/, ''));
    else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  if (apply && args.includes('--dry-run')) throw new Error('Choose either --apply or --dry-run.');
  if (!Array.isArray(colors)) throw new Error('Colors JSON must be an array.');
  if (!process.env.PB_URL) throw new Error('Set PB_URL. Run with --help for usage.');
  const pb = new PocketBase(process.env.PB_URL);
  if (process.env.PB_AUTH_TOKEN) pb.authStore.save(process.env.PB_AUTH_TOKEN);
  else {
    if (!process.env.PB_SUPERUSER_EMAIL || !process.env.PB_SUPERUSER_PASSWORD) throw new Error('Set PB_AUTH_TOKEN or PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD.');
    await pb.collection('_superusers').authWithPassword(process.env.PB_SUPERUSER_EMAIL, process.env.PB_SUPERUSER_PASSWORD);
  }
  // Fail early for credentials that could silently return incomplete filtered data.
  await pb.collections.getOne('participant_subjects');
  await restoreModules(pb, { apply, colors });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
