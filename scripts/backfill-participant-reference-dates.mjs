import PocketBase from 'pocketbase';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

const pbUrl = process.env.PB_URL;
const authToken = process.env.PB_AUTH_TOKEN;
const authCollection = process.env.PB_AUTH_COLLECTION || '_superusers';
const authEmail = process.env.PB_SUPERUSER_EMAIL || process.env.PB_ADMIN_EMAIL;
const authPassword = process.env.PB_SUPERUSER_PASSWORD || process.env.PB_ADMIN_PASSWORD;

function usage() {
  console.log(`
Usage:
  PB_URL=https://your-pocketbase.example \\
  PB_SUPERUSER_EMAIL=admin@example.com \\
  PB_SUPERUSER_PASSWORD=secret \\
  npm run backfill:participant-reference-dates -- --dry-run

Options:
  --dry-run   Show what would be updated without writing changes.
  --force     Overwrite existing participant.referenceDate values.

Environment:
  PB_URL                  Required PocketBase base URL.
  PB_AUTH_TOKEN           Optional existing auth token. If set, email/password login is skipped.
  PB_AUTH_COLLECTION      Auth collection for email/password login. Defaults to _superusers.
  PB_SUPERUSER_EMAIL      Superuser email. PB_ADMIN_EMAIL is also accepted.
  PB_SUPERUSER_PASSWORD   Superuser password. PB_ADMIN_PASSWORD is also accepted.
`);
}

function parsePocketBaseDate(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value).includes('T')
    ? String(value)
    : String(value).replace(' ', 'T');
  const withTimezone = /(?:Z|[+-]\d\d:\d\d)$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const date = new Date(withTimezone);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatReferenceDateFromCreated(created) {
  const createdDate = parsePocketBaseDate(created);

  if (!createdDate) {
    return '';
  }

  return `${createdDate.toISOString().slice(0, 10)} 00:00:00.000Z`;
}

async function authenticate(pb) {
  if (authToken) {
    pb.authStore.save(authToken, null);
    return;
  }

  if (!authEmail || !authPassword) {
    throw new Error('Missing auth credentials. Set PB_AUTH_TOKEN or PB_SUPERUSER_EMAIL/PB_SUPERUSER_PASSWORD.');
  }

  await pb.collection(authCollection).authWithPassword(authEmail, authPassword);
}

async function main() {
  if (!pbUrl) {
    usage();
    throw new Error('Missing PB_URL.');
  }

  const pb = new PocketBase(pbUrl);
  await authenticate(pb);

  const participants = await pb.collection('participants').getFullList({
    sort: 'created',
    fields: 'id,name,email,created,referenceDate',
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const participant of participants) {
    const referenceDate = formatReferenceDateFromCreated(participant.created);

    if (!referenceDate) {
      failed++;
      console.error(`Could not parse created date for participant ${participant.id}: ${participant.created}`);
      continue;
    }

    if (participant.referenceDate && !force) {
      skipped++;
      continue;
    }

    const label = participant.name || participant.email || participant.id;
    console.log(`${dryRun ? '[dry-run] ' : ''}${participant.id} (${label}) -> ${referenceDate}`);

    if (!dryRun) {
      await pb.collection('participants').update(participant.id, { referenceDate });
    }

    updated++;
  }

  console.log(`Done. ${dryRun ? 'Would update' : 'Updated'} ${updated}, skipped ${skipped}, failed ${failed}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
