import importlib.machinery
from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import zipfile

loader = importlib.machinery.SourceFileLoader(
    'refresh', str(Path(__file__).with_name('refresh-methric-dev')))
spec = importlib.util.spec_from_loader(loader.name, loader)
refresh = importlib.util.module_from_spec(spec)
loader.exec_module(refresh)


class RefreshTests(unittest.TestCase):
    def test_rejects_archive_traversal_before_extracting(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = root / 'backup.zip'
            with zipfile.ZipFile(archive, 'w') as backup:
                backup.writestr('data.db', 'placeholder')
                backup.writestr('../escaped', 'bad')
            with self.assertRaises(RuntimeError):
                refresh.extract_checked(archive, root / 'staged')
            self.assertFalse((root / 'escaped').exists())
            self.assertFalse((root / 'staged/data.db').exists())

    def test_sanitizes_copy_preserving_records(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            settings = {
                'meta': {'appName': 'Production', 'appURL': 'https://methric.ch'},
                'smtp': {'enabled': True, 'username': 'user', 'password': 'secret'},
                'backups': {'cron': '0 0 * * *', 's3': {'enabled': True, 'secret': 'secret'}},
                's3': {'enabled': False, 'secret': 'secret'},
            }
            with closing(sqlite3.connect(root / 'data.db')) as db, db:
                db.execute('CREATE TABLE _params (id TEXT PRIMARY KEY, value BLOB)')
                db.execute('INSERT INTO _params VALUES (?, ?)', ('settings', json.dumps(settings)))
                db.execute('CREATE TABLE submissions (value TEXT)')
                db.execute("INSERT INTO submissions VALUES ('keep this')")
            archive = root / 'backup.zip'
            with zipfile.ZipFile(archive, 'w') as backup:
                backup.write(root / 'data.db', 'data.db')
            staged = root / 'staged'
            refresh.extract_checked(archive, staged)
            refresh.sanitize_settings(staged)
            with closing(sqlite3.connect(staged / 'data.db')) as db, db:
                copied = json.loads(db.execute('SELECT value FROM _params').fetchone()[0])
                self.assertEqual(db.execute('SELECT value FROM submissions').fetchone()[0], 'keep this')
            self.assertEqual(copied['meta']['appURL'], 'https://dev.methric.ch')
            self.assertFalse(copied['smtp']['enabled'])
            self.assertEqual(copied['smtp']['password'], '')
            self.assertEqual(copied['backups']['cron'], '')
            self.assertFalse(copied['backups']['s3']['enabled'])
            with closing(sqlite3.connect(root / 'data.db')) as db, db:
                original = json.loads(db.execute('SELECT value FROM _params').fetchone()[0])
            self.assertEqual(original, settings)

    def test_failed_start_restores_old_data(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            data, staged = root / 'pb_data', root / 'staged'
            data.mkdir()
            staged.mkdir()
            (data / 'marker').write_text('old')
            (staged / 'marker').write_text('new')
            with patch.object(refresh, 'DEV', root), patch.object(refresh, 'service') as service, \
                    patch.object(refresh, 'wait_healthy', side_effect=[RuntimeError('failed'), None]):
                with self.assertRaises(RuntimeError):
                    refresh.activate(staged, root / 'previous', root / 'failed')
            self.assertEqual((data / 'marker').read_text(), 'old')
            self.assertEqual((root / 'failed/marker').read_text(), 'new')
            self.assertEqual([call.args[0] for call in service.call_args_list],
                             ['stop', 'start', 'stop', 'start'])

    def test_success_retains_previous_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'pb_data').mkdir()
            (root / 'staged').mkdir()
            (root / 'pb_data/old').touch()
            (root / 'staged/new').touch()
            with patch.object(refresh, 'DEV', root), patch.object(refresh, 'service'), \
                    patch.object(refresh, 'wait_healthy'):
                refresh.activate(root / 'staged', root / 'previous', root / 'failed')
            self.assertTrue((root / 'previous/old').exists())
            self.assertTrue((root / 'pb_data/new').exists())


if __name__ == '__main__':
    unittest.main()
