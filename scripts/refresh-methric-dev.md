# One-command development data refresh

From Git Bash on the laptop:

```bash
cd /c/repos/Zeiterfassung
scp scripts/refresh-methric-dev root@78.47.244.186:/usr/local/bin/refresh-methric-dev
ssh root@78.47.244.186 "chmod 700 /usr/local/bin/refresh-methric-dev"
```

On the server, run `refresh-methric-dev` as root. The first run requests the
production PocketBase **superuser** email and password and saves them in
`/root/.config/methric-dev-refresh.json` with mode 0600. Later runs need only
the command. This is a sensitive plaintext credential file; it must remain
root-only and outside the repository. If credentials change, edit that file
on the server. MFA-enabled logins are not supported by this helper.

Each run creates a fresh backup via production's API on localhost:8090,
validates and extracts it before stopping dev, sanitizes copied settings,
swaps only dev's `pb_data`, starts its service, and checks localhost:8091.
Startup failure triggers rollback to the prior dev database. Dev migrations
run normally on startup. Production is never stopped or restored.

All dev data is replaced. Existing dev hooks, migrations, and Resend
configuration are preserved. The helper checks the email redirects used in
this setup; new mail-sending code still needs review before deployment.
Production S3 file/backup storage and scheduled dev hooks are rejected until
explicitly supported. No email is sent by the helper itself.

Previous dev snapshots and generated production backups are retained and
consume disk space. Failed staging/restore directories are also retained
for diagnosis. Review and remove obsolete snapshots manually. An interrupted
process or host failure may require manual recovery; use the retained data
and `journalctl -u pocketbase-dev` to diagnose.

Local verification: `python scripts/test-refresh-methric-dev.py` tests archive
path rejection, copied settings sanitization with original data preservation,
successful activation, and rollback after a simulated startup failure.
The live server flow must be verified after installation.
