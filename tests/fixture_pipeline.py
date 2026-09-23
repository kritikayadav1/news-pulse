"""Actual Python pipeline with in-memory news inputs, for the Node job integration test."""
import sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scraper.main import run
from tests.fixtures import entries_for, extracted
with patch('scraper.main.read_feed', side_effect=entries_for), patch('scraper.main.extract_body', side_effect=extracted):
    run()
