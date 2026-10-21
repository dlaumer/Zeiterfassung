import importlib.machinery
import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

loader = importlib.machinery.SourceFileLoader('sync', str(Path(__file__).with_name('refresh-methric-dev')))
spec = importlib.util.spec_from_loader(loader.name, loader)
sync = importlib.util.module_from_spec(spec)
loader.exec_module(sync)


def make_db(path, participant, value):
    with closing(sqlite3.connect(path)) as db, db:
        db.execute('CREATE TABLE _collections (id TEXT, name TEXT, type TEXT, system INTEGER, fields TEXT)')
        for name, kind, system, fields in (
            ('participants', 'base', 0, []), ('subjects', 'base', 0, []),
            ('submissions', 'base', 0, [{'name': 'participant', 'type': 'relation', 'collectionId': 'participants'}]),
            ('adminSettings', 'base', 0, []), ('admins', 'auth', 0, []), ('_params', 'base', 1, []),
        ):
            db.execute('INSERT INTO _collections VALUES (?,?,?,?,?)', (name, name, kind, system, json.dumps(fields)))
            db.execute(f'CREATE TABLE "{name}" (id TEXT PRIMARY KEY, value TEXT' + (', participant TEXT' if name == 'submissions' else '') + ')')
        db.execute('INSERT INTO participants VALUES (?,?)', (participant, value))
        db.execute('INSERT INTO subjects VALUES (?,?)', ('module', value))
        db.execute('INSERT INTO submissions VALUES (?,?,?)', ('submission', value, participant))
        for name in ('adminSettings', 'admins', '_params'):
            db.execute(f'INSERT INTO "{name}" VALUES (?,?)', ('setting', value))


def rows(path, table):
    with closing(sqlite3.connect(path)) as db:
        return db.execute(f'SELECT * FROM "{table}" ORDER BY id').fetchall()


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.prod, self.dev = self.root / 'prod.db', self.root / 'dev.db'
        make_db(self.prod, 'new-person', 'production')
        make_db(self.dev, 'dev-person', 'development')

    def tearDown(self):
        self.temp.cleanup()

    def test_upsert_all_base_collections_and_preserve_system_auth(self):
        before = self.prod.read_bytes()
        report, skipped = sync.merge_records(self.prod, self.dev)
        self.assertEqual(report['participants']['added'], 1)
        self.assertEqual(report['subjects']['updated'], 1)
        self.assertEqual(rows(self.dev, 'submissions')[0], ('submission', 'production', 'new-person'))
        self.assertEqual(len(rows(self.dev, 'participants')), 2)
        self.assertEqual(rows(self.dev, 'adminSettings')[0][1], 'production')
        self.assertEqual(rows(self.dev, 'admins')[0][1], 'development')
        self.assertEqual(rows(self.dev, '_params')[0][1], 'development')
        self.assertEqual(self.prod.read_bytes(), before)
        again, _ = sync.merge_records(self.prod, self.dev)
        self.assertEqual(sum(sum(c.values()) for c in again.values()), 0)

    def test_add_only_preserves_existing_records(self):
        report, _ = sync.merge_records(self.prod, self.dev, False)
        self.assertEqual(rows(self.dev, 'subjects')[0][1], 'development')
        self.assertEqual(report['participants']['added'], 1)

    def test_missing_relation_aborts_every_collection(self):
        with closing(sqlite3.connect(self.prod)) as db, db:
            db.execute("UPDATE submissions SET participant='missing'")
        with self.assertRaisesRegex(RuntimeError, 'missing related'):
            sync.merge_records(self.prod, self.dev)
        self.assertEqual(len(rows(self.dev, 'participants')), 1)
        self.assertEqual(rows(self.dev, 'subjects')[0][1], 'development')

    def test_schema_mismatch_aborts_without_copying(self):
        with closing(sqlite3.connect(self.dev)) as db, db:
            db.execute('ALTER TABLE subjects ADD COLUMN extra TEXT')
        with self.assertRaisesRegex(RuntimeError, 'columns differ'):
            sync.merge_records(self.prod, self.dev)
        self.assertEqual(len(rows(self.dev, 'participants')), 1)

    def test_sql_constraint_failure_rolls_back_all_inserts(self):
        with closing(sqlite3.connect(self.dev)) as db, db:
            db.execute("INSERT INTO subjects VALUES ('collision', 'production')")
            db.execute('CREATE UNIQUE INDEX unique_subject_value ON subjects(value)')
        with self.assertRaises(sqlite3.IntegrityError):
            sync.merge_records(self.prod, self.dev)
        self.assertEqual(len(rows(self.dev, 'participants')), 1)

    def test_snapshot_includes_committed_wal(self):
        with closing(sqlite3.connect(self.prod)) as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.execute("INSERT INTO participants VALUES ('wal-person','committed')")
            db.commit()
            sync.snapshot(self.prod, self.root / 'snapshot.db')
            self.assertIn(('wal-person', 'committed'), rows(self.root / 'snapshot.db', 'participants'))

    def test_failed_start_restores_previous_dev_directory(self):
        data, staged = self.root / 'pb_data', self.root / 'staged'
        data.mkdir()
        staged.mkdir()
        (data / 'old').touch()
        (staged / 'new').touch()
        with patch.object(sync, 'DEV', self.root), patch.object(sync, 'service'), \
                patch.object(sync, 'wait_healthy', side_effect=[RuntimeError('failed'), None]):
            with self.assertRaises(RuntimeError):
                sync.activate(staged, self.root / 'previous', self.root / 'failed')
        self.assertTrue((data / 'old').exists())
        self.assertTrue((self.root / 'failed/new').exists())


if __name__ == '__main__':
    unittest.main()
