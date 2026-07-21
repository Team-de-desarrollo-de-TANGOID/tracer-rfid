import json
import os
import random
import string
import threading


class Secrets:
    """Token API, credenciales del lector y URL webhook portal (persistidos en /apps)."""

    def __init__(self, path=None):
        self._path = path or os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "racketclub_secrets.json"
        )
        self._lock = threading.RLock()
        self._api_token = ""
        self._reader_user = ""
        self._reader_password = ""
        self._portal_webhook_url = ""
        self.load()

    def load(self):
        with self._lock:
            if not os.path.exists(self._path):
                return
            try:
                with open(self._path, encoding="utf-8") as f:
                    data = json.load(f)
            except (OSError, json.JSONDecodeError):
                return
            self._api_token = str(data.get("apiToken") or "")
            self._reader_user = str(data.get("readerUser") or "")
            self._reader_password = str(data.get("readerPassword") or "")
            self._portal_webhook_url = str(data.get("portalWebhookUrl") or "")

    def _save_unlocked(self):
        payload = {
            "apiToken": self._api_token,
            "readerUser": self._reader_user,
            "readerPassword": self._reader_password,
            "portalWebhookUrl": self._portal_webhook_url,
        }
        tmp = self._path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        os.replace(tmp, self._path)
        try:
            os.chmod(self._path, 0o600)
        except OSError:
            pass

    def get_api_token(self):
        with self._lock:
            return self._api_token

    def get_portal_webhook_url(self):
        with self._lock:
            return self._portal_webhook_url

    def token_configured(self):
        with self._lock:
            return bool(self._api_token)

    def set_api_token(self, token):
        token = str(token or "").strip()
        if not token:
            return False
        with self._lock:
            self._api_token = token
            self._save_unlocked()
        return True

    def set_portal_webhook_url(self, url):
        url = str(url or "").strip().rstrip("/")
        with self._lock:
            self._portal_webhook_url = url
            self._save_unlocked()
        return bool(url)

    def ensure_api_token(self):
        with self._lock:
            if self._api_token:
                return self._api_token
            alphabet = string.ascii_letters + string.digits + "-_"
            self._api_token = "".join(random.SystemRandom().choice(alphabet) for _ in range(48))
            self._save_unlocked()
            return self._api_token

    def set_credentials(self, reader_user, reader_password):
        with self._lock:
            if reader_user:
                self._reader_user = str(reader_user)
            if reader_password:
                self._reader_password = str(reader_password)
            self._save_unlocked()

    def check_token(self, header_value):
        with self._lock:
            if not self._api_token:
                return True
            return header_value == self._api_token
