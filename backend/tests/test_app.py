import re

import pytest
from fastapi.testclient import TestClient

from nightlight.main import app


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


def test_dashboard_and_built_assets(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["cache-control"] == "no-cache"
    assert "NightLight Dashboard" in response.text
    assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', response.text)
    assert any(path.endswith(".js") for path in assets)
    assert any(path.endswith(".css") for path in assets)
    for path in assets:
        asset = client.get(path)
        assert asset.status_code == 200
        if path.endswith(".js"):
            assert "javascript" in asset.headers["content-type"]
        else:
            assert asset.headers["content-type"].startswith("text/css")


@pytest.mark.parametrize("path", [
    "/api", "/api/", "/api/missing", "/api/widgets/status",
    "/missing", "/assets/missing.js", "/assets/../index.html",
])
def test_missing_routes_do_not_return_dashboard(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"detail": "Not Found"}


def test_dashboard_rejects_post(client):
    assert client.post("/").status_code == 405
