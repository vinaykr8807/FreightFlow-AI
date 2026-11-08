import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient

TOKEN = "test-token"


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("INTERNAL_API_TOKEN", TOKEN)
    from app.main import app

    with TestClient(app) as c:
        c.headers.update({"X-Internal-Token": TOKEN})
        yield c

