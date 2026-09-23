import contextlib
import io
import json
import os
import sqlite3
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

import feedparser
import requests
from scraper.db import Database, ROOT
from scraper.grouping import group_articles
from scraper.ingestion import canonical_url, normalize_entry, extract_body, allowed_url, allowed_image, utc_now, iso
from scraper.main import run
from tests.fixtures import entries_for, extracted

SOURCES = json.loads((ROOT / 'shared/sources.json').read_text())


class NormalizationTests(unittest.TestCase):
    def test_rss_and_atom_normalize_different_dates_and_content(self):
        rss = feedparser.parse(b'''<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>A &amp; B</title><link>https://www.bbc.com/news/a</link><content:encoded><![CDATA[<p>Main summary</p><script>bad()</script>]]></content:encoded><pubDate>Mon, 21 Sep 2026 12:00:00 +0530</pubDate></item></channel></rss>''')
        a = normalize_entry(rss.entries[0], SOURCES[0], utc_now() + timedelta(days=500))
        self.assertEqual(a['summary'], 'Main summary')
        self.assertEqual(a['published_at'], '2026-09-21T06:30:00.000Z')
        atom = feedparser.parse(b'''<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom story</title><link href="https://www.bbc.com/news/b"/><updated>2026-09-21T06:30:00Z</updated><summary>Text</summary></entry></feed>''')
        self.assertEqual(normalize_entry(atom.entries[0], SOURCES[0], utc_now() + timedelta(days=500))['published_at'], a['published_at'])

    def test_missing_date_is_explicitly_marked(self):
        entry = {'title': 'A valid story', 'link': 'https://www.bbc.com/news/missing-date'}
        self.assertEqual(normalize_entry(entry, SOURCES[0])['date_estimated'], 1)
        self.assertIsNone(normalize_entry({'title': 'No link'}, SOURCES[0]))

    def test_tracking_parameters_do_not_create_duplicates(self):
        self.assertEqual(canonical_url('https://www.bbc.com/news/a?id=1&utm_source=mail#top'), canonical_url('https://www.bbc.com/news/a?id=1'))
        self.assertNotEqual(canonical_url('https://www.bbc.com/news/a?id=2'), canonical_url('https://www.bbc.com/news/a?id=1'))

    def test_untrusted_urls_are_rejected(self):
        for url in ['http://127.0.0.1/private', 'file:///etc/passwd', 'https://bbc.com.evil.test/', 'https://user:pass@bbc.com/']:
            self.assertFalse(allowed_url(url, SOURCES[0]))

    def test_full_text_failure_preserves_summary(self):
        article = normalize_entry(entries_for(SOURCES[0])[0], SOURCES[0])
        with patch('scraper.ingestion.download', side_effect=requests.Timeout):
            result = extract_body(article, SOURCES[0])
        self.assertEqual(result['content'], result['summary'])
        self.assertEqual(result['extraction_status'], 'summary_only')

    def test_feed_images_use_only_approved_publisher_hosts(self):
        image = 'https://ichef.bbci.co.uk/news/1024/story.jpg?width=1024'
        entry = {**entries_for(SOURCES[0])[0], 'media_thumbnail': [{'url': image}]}
        self.assertEqual(normalize_entry(entry, SOURCES[0])['image_url'], image)
        for candidate in ['http://ichef.bbci.co.uk/story.jpg', 'https://127.0.0.1/a.jpg', 'https://bbc.co.uk.evil.test/a.jpg', 'https://user:secret@bbc.co.uk/a.jpg', 'javascript:alert(1)']:
            self.assertIsNone(allowed_image(candidate, SOURCES[0]))
        guardian_image = 'https://i.guim.co.uk/img/media/photo.jpg'
        guardian = {**entries_for(SOURCES[1])[0], 'summary': f'<p>News</p><img src="{guardian_image}">'}
        self.assertEqual(normalize_entry(guardian, SOURCES[1])['image_url'], guardian_image)
        self.assertEqual(allowed_image('https://npr.brightspotcdn.com/photo.jpg', SOURCES[2]), 'https://npr.brightspotcdn.com/photo.jpg')
        self.assertIsNone(allowed_image('https://other.brightspotcdn.com/photo.jpg', SOURCES[2]))
        self.assertIsNone(allowed_image('https://npr.brightspotcdn.com.evil.test/photo.jpg', SOURCES[2]))

    def test_article_image_prefers_approved_open_graph_image(self):
        article = normalize_entry(entries_for(SOURCES[0])[0], SOURCES[0])
        image = 'https://ichef.bbci.co.uk/news/1024/full.jpg'
        html = f'<html><head><meta property="og:image" content="{image}"></head><body>Story</body></html>'.encode()
        with patch('scraper.ingestion.download', return_value=html), patch('scraper.ingestion.trafilatura.extract', return_value='Article body ' * 30):
            result = extract_body(article, SOURCES[0])
        self.assertEqual(result['image_url'], image)
        self.assertEqual(result['extraction_status'], 'full_text')


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'DB_PATH': str(Path(self.temp.name) / 'test.db'), 'DATABASE_URL': '', 'CLUSTER_SIMILARITY': '0.25'})
        self.env.start()
        self.silence = contextlib.redirect_stdout(io.StringIO())
        self.silence.__enter__()

    def tearDown(self):
        self.silence.__exit__(None, None, None)
        self.env.stop()
        self.temp.cleanup()

    def pipeline(self, feed=entries_for):
        with patch('scraper.main.read_feed', side_effect=feed), patch('scraper.main.extract_body', side_effect=extracted):
            return run()

    def test_repeat_run_is_idempotent_and_groups_cross_source_stories(self):
        first = self.pipeline()
        self.assertEqual(first['total_articles'], 6)
        self.assertEqual(first['total_clusters'], 2)
        second = self.pipeline()
        self.assertEqual(second['new_articles'], 0)
        self.assertEqual(second['skipped_duplicates'], 6)
        self.assertEqual(second['total_articles'], 6)

    def test_repeat_run_backfills_images_without_duplicate_articles(self):
        self.pipeline()
        image = 'https://ichef.bbci.co.uk/news/1024/backfill.jpg'
        def with_images(source, timeout):
            entries = entries_for(source)
            if source['id'] == 'bbc':
                for entry in entries: entry['media_thumbnail'] = [{'url': image}]
            return entries
        second = self.pipeline(with_images)
        self.assertEqual(second['new_articles'], 0)
        db = Database()
        self.assertEqual(len(db.all('SELECT id FROM articles')), 6)
        self.assertEqual(len(db.all('SELECT id FROM articles WHERE image_url=?', (image,))), 2)
        db.close()

    def test_old_sqlite_schema_is_upgraded_without_losing_metadata(self):
        legacy = sqlite3.connect(os.environ['DB_PATH'])
        legacy.executescript((ROOT / 'shared/schema.sql').read_text().replace('  image_url TEXT,\n', ''))
        legacy.execute("INSERT INTO app_meta(key,value) VALUES ('upgrade_test','kept')")
        legacy.commit()
        legacy.close()
        db = Database()
        self.assertIn('image_url', {row['name'] for row in db.all('PRAGMA table_info(articles)')})
        self.assertEqual(db.meta('upgrade_test'), 'kept')
        db.close()

    def test_partial_failure_keeps_other_feeds_and_reports_warning(self):
        def one_fails(source, timeout):
            if source['id'] == 'npr': raise requests.Timeout()
            return entries_for(source)
        result = self.pipeline(one_fails)
        self.assertEqual(result['total_articles'], 4)
        self.assertEqual(result['sources'][-1]['status'], 'error')

    def test_total_failure_leaves_previous_snapshot(self):
        first = self.pipeline()
        with self.assertRaises(RuntimeError): self.pipeline(lambda *args: (_ for _ in ()).throw(requests.Timeout()))
        db = Database()
        self.assertEqual(json.loads(db.meta('last_ingest'))['total_articles'], first['total_articles'])
        self.assertEqual(len(db.all('SELECT id FROM articles')), 6)
        db.close()

    def test_error_during_regrouping_rolls_back(self):
        self.pipeline()
        with patch.dict(os.environ, {'CLUSTER_SIMILARITY': '0'}), self.assertRaises(ValueError): self.pipeline()
        db = Database()
        self.assertEqual(len(db.all('SELECT id FROM clusters')), 2)
        self.assertEqual(len(db.all('SELECT id FROM articles WHERE cluster_id IS NOT NULL')), 6)
        db.close()

    def test_grouping_has_time_boundary_and_stable_ids(self):
        a = normalize_entry(entries_for(SOURCES[0])[0], SOURCES[0])
        b = {**a, 'id': 'other', 'published_at': iso(utc_now() - timedelta(days=10))}
        self.assertEqual(len(group_articles([a, b])), 2)
        self.assertEqual(group_articles([a, b]), group_articles([b, a]))

    def test_matching_headlines_survive_differently_worded_summaries(self):
        a = normalize_entry(entries_for(SOURCES[0])[0], SOURCES[0])
        b = {**a, 'id': 'second-source', 'summary': 'A completely different description about engineers funding institutions technical exploration schedules.'}
        self.assertEqual(len(group_articles([a, b])), 1)


if __name__ == '__main__': unittest.main()
