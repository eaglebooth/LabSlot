import os
import pytest


@pytest.fixture(autouse=True)
def windows_lock(monkeypatch):
    real = os.unlink

    def unlink(path, *args, **kwargs):
        try:
            return real(path, *args, **kwargs)
        except PermissionError:
            if str(path).endswith(".py"):
                raise

    monkeypatch.setattr(os, "unlink", unlink)

