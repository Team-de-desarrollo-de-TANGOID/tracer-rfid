import json
import os
import socket
import threading
import time
import urllib.parse

LOG_PATH = "/tmp/racketclub-gate.log"
MAX_TAG_EVENTS = 500


class TagEventBuffer:
    def __init__(self, max_size=MAX_TAG_EVENTS):
        self._lock = threading.RLock()
        self._events = []
        self._seq = 0
        self._max = max_size

    def append(self, event):
        with self._lock:
            self._seq += 1
            entry = {"id": self._seq, "ts": time.time(), **event}
            self._events.append(entry)
            if len(self._events) > self._max:
                self._events = self._events[-self._max :]
            return entry

    def since(self, since_id):
        with self._lock:
            latest = self._seq
            events = [e for e in self._events if e["id"] > int(since_id or 0)]
            return since_id, latest, events


class UserAppServer:
  """Servidor HTTP mínimo (sin http.server — no disponible en FX9600)."""

  def __init__(
    self,
    allow_list,
    secrets,
    logger,
    app_name,
    app_version,
    get_pid,
    on_sync=None,
    on_settings_get=None,
    on_settings_apply=None,
    on_shutdown=None,
  ):
    self.allow_list = allow_list
    self.secrets = secrets
    self.logger = logger
    self.app_name = app_name
    self.app_version = app_version
    self.get_pid = get_pid
    self.tag_events = TagEventBuffer()
    self._on_sync = on_sync
    self._on_settings_get = on_settings_get
    self._on_settings_apply = on_settings_apply
    self._on_shutdown = on_shutdown
    self._sock = None
    self._thread = None
    self._stop = threading.Event()
    self._port = 8765

  def _json_response(self, code, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    reason = {200: "OK", 400: "Bad Request", 401: "Unauthorized", 404: "Not Found"}.get(
      code, "Error"
    )
    header = (
      "HTTP/1.1 %s %s\r\n"
      "Content-Type: application/json; charset=utf-8\r\n"
      "Content-Length: %d\r\n"
      "Connection: close\r\n"
      "Access-Control-Allow-Origin: *\r\n"
      "\r\n"
    ) % (code, reason, len(body))
    return header.encode("utf-8") + body

  def _parse_request(self, raw):
    try:
      head, body = raw.split(b"\r\n\r\n", 1)
    except ValueError:
      head, body = raw, b""
    lines = head.decode("utf-8", errors="replace").split("\r\n")
    if not lines:
      return None
    parts = lines[0].split(" ")
    if len(parts) < 2:
      return None
    method, path = parts[0], parts[1]
    headers = {}
    for line in lines[1:]:
      if ":" in line:
        k, v = line.split(":", 1)
        headers[k.strip().lower()] = v.strip()
    parsed = urllib.parse.urlparse(path)
    return {
      "method": method.upper(),
      "path": parsed.path,
      "qs": urllib.parse.parse_qs(parsed.query),
      "headers": headers,
      "body": body,
    }

  def _read_body(self, req, conn):
    body = req.get("body") or b""
    length = int(req["headers"].get("content-length") or 0)
    while len(body) < length:
      chunk = conn.recv(min(4096, length - len(body)))
      if not chunk:
        break
      body += chunk
    return body

  def _token_header(self, headers):
    return headers.get("x-racketclub-token")

  def _auth_ok(self, path, headers, body_obj=None, allow_bootstrap=False):
    if path == "/api/health":
      return True
    header_token = self._token_header(headers)

    # La web app es autoridad en sync/credentials: apiToken en body re-empareja.
    if allow_bootstrap and body_obj:
      body_token = str(body_obj.get("apiToken") or "").strip()
      if body_token:
        self.secrets.set_api_token(body_token)
        return True
      if not self.secrets.token_configured():
        if header_token:
          self.secrets.set_api_token(header_token)
          return True
        return True

    if self.secrets.token_configured():
      return self.secrets.check_token(header_token)

    if allow_bootstrap:
      return True
    return not self.secrets.token_configured()

  def _handle(self, req):
    path = req["path"]
    method = req["method"]
    headers = req["headers"]
    qs = req["qs"]

    if method == "OPTIONS":
      return (
        "HTTP/1.1 204 No Content\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type, X-RacketClub-Token\r\n"
        "Content-Length: 0\r\n\r\n"
      ).encode("utf-8")

    body_obj = None
    if method in ("POST", "PUT"):
      try:
        body_obj = json.loads((req.get("body") or b"").decode("utf-8") or "{}")
      except json.JSONDecodeError:
        return self._json_response(400, {"ok": False, "error": "JSON invalido"})

    bootstrap = path in ("/api/sync", "/api/credentials")
    if not self._auth_ok(path, headers, body_obj, allow_bootstrap=bootstrap):
      return self._json_response(401, {"ok": False, "error": "Token API invalido o ausente"})

    if method == "GET" and path == "/api/health":
      return self._json_response(
        200,
        {"ok": True, "app": self.app_name, "version": self.app_version, "pid": self.get_pid()},
      )

    if method == "GET" and path == "/api/status":
      snap = self.allow_list.snapshot()
      return self._json_response(
        200,
        {
          "ok": True,
          "app": self.app_name,
          "appVersion": self.app_version,
          "pid": self.get_pid(),
          "count": snap["count"],
          "version": snap["version"],
          "gpoPin": snap["gpoPin"],
          "updatedAt": snap.get("updatedAt"),
          "tokenConfigured": self.secrets.token_configured(),
        },
      )

    if method == "GET" and path == "/api/allowlist":
      snap = self.allow_list.snapshot()
      return self._json_response(200, {"ok": True, **snap})

    if method == "GET" and path == "/api/logs":
      offset = int((qs.get("offset") or ["0"])[0])
      max_bytes = min(int((qs.get("maxBytes") or ["65536"])[0]), 256 * 1024)
      lines = ""
      new_offset = offset
      if os.path.exists(LOG_PATH):
        with open(LOG_PATH, "rb") as f:
          f.seek(0, os.SEEK_END)
          file_size = f.tell()
          start = 0 if offset > file_size else offset
          to_read = min(max_bytes, max(0, file_size - start))
          f.seek(start)
          chunk = f.read(to_read)
          new_offset = start + len(chunk)
        lines = chunk.decode("utf-8", errors="replace")
      return self._json_response(200, {"ok": True, "size": new_offset, "lines": lines})

    if method == "GET" and path == "/api/tag-events":
      since = int((qs.get("since") or ["0"])[0])
      since_out, latest, events = self.tag_events.since(since)
      return self._json_response(
        200, {"ok": True, "since": since_out, "latest": latest, "events": events}
      )

    if method == "GET" and path == "/api/settings":
      if not self._on_settings_get:
        return self._json_response(501, {"ok": False, "error": "Settings no disponibles"})
      return self._json_response(200, {"ok": True, "settings": self._on_settings_get()})

    if method == "PUT" and path == "/api/settings":
      if not self._on_settings_apply:
        return self._json_response(501, {"ok": False, "error": "Settings no disponibles"})
      try:
        settings = self._on_settings_apply(body_obj or {})
        return self._json_response(200, {"ok": True, "settings": settings})
      except Exception as exc:
        return self._json_response(400, {"ok": False, "error": str(exc)})

    if method == "POST" and path == "/api/sync":
      result = self.allow_list.sync(
        body_obj.get("tids") or [],
        body_obj.get("version") or 0,
        body_obj.get("gpoPin"),
      )
      if body_obj.get("apiToken"):
        self.secrets.set_api_token(body_obj["apiToken"])
      if body_obj.get("portalWebhookUrl"):
        self.secrets.set_portal_webhook_url(body_obj["portalWebhookUrl"])
      self.logger.info(
        "Sync lista v%s: %s TID (+ %s - %s)"
        % (result["version"], result["count"], len(result["added"]), len(result["removed"]))
      )
      if self._on_sync:
        try:
          self._on_sync(result)
        except Exception as exc:
          self.logger.err("Error post-sync: %s" % exc)
      return self._json_response(200, {"ok": True, **result})

    if method == "POST" and path == "/api/credentials":
      self.secrets.set_credentials(body_obj.get("readerUser"), body_obj.get("readerPassword"))
      if body_obj.get("apiToken"):
        self.secrets.set_api_token(body_obj["apiToken"])
      if body_obj.get("portalWebhookUrl"):
        self.secrets.set_portal_webhook_url(body_obj["portalWebhookUrl"])
      return self._json_response(200, {"ok": True, "stored": True})

    if method == "POST" and path == "/api/iot-tag-events":
      events = body_obj if isinstance(body_obj, list) else [body_obj]
      for ev in events[:50]:
        self.tag_events.append({"source": "iot", "raw": ev})
      return self._json_response(200, {"ok": True, "received": len(events)})

    if method == "POST" and path == "/api/shutdown":
      if self._on_shutdown:
        threading.Thread(target=self._on_shutdown, daemon=True).start()
        return self._json_response(200, {"ok": True, "stopping": True})
      return self._json_response(501, {"ok": False, "error": "Shutdown no disponible"})

    return self._json_response(404, {"ok": False, "error": "Not found"})

  def _sse_chunk(self, event, data):
    payload = json.dumps(data, ensure_ascii=False)
    return ("event: %s\ndata: %s\n\n" % (event, payload)).encode("utf-8")

  def _stream_logs(self, conn, qs):
    tail_lines = min(int((qs.get("tail") or ["150"])[0]), 500)
    header = (
      "HTTP/1.1 200 OK\r\n"
      "Content-Type: text/event-stream; charset=utf-8\r\n"
      "Cache-Control: no-cache\r\n"
      "Connection: close\r\n"
      "Access-Control-Allow-Origin: *\r\n"
      "\r\n"
    ).encode("utf-8")
    conn.sendall(header)

    offset = 0
    if os.path.exists(LOG_PATH):
      try:
        with open(LOG_PATH, "rb") as f:
          data = f.read()
          offset = len(data)
          text = data.decode("utf-8", errors="replace")
          lines = text.splitlines()
          tail = "\n".join(lines[-tail_lines:])
          if tail:
            conn.sendall(self._sse_chunk("log", {"lines": tail, "offset": offset, "tail": True}))
      except OSError:
        pass

    conn.sendall(
      self._sse_chunk(
        "meta",
        {"source": "user-app", "path": LOG_PATH, "mode": "tail -f", "offset": offset},
      )
    )

    conn.settimeout(1.2)
    while not self._stop.is_set():
      try:
        if os.path.exists(LOG_PATH):
          with open(LOG_PATH, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            if size > offset:
              f.seek(offset)
              chunk = f.read(size - offset)
              offset = size
              text = chunk.decode("utf-8", errors="replace")
              if text:
                conn.sendall(self._sse_chunk("log", {"lines": text, "offset": offset}))
        conn.sendall(self._sse_chunk("ping", {"ts": time.time()}))
        time.sleep(0.3)
      except socket.timeout:
        continue
      except OSError:
        break

  def _client_loop(self, conn):
    try:
      conn.settimeout(10.0)
      chunks = []
      while True:
        part = conn.recv(8192)
        if not part:
          break
        chunks.append(part)
        if len(part) < 8192 or b"\r\n\r\n" in b"".join(chunks):
          raw = b"".join(chunks)
          if b"\r\n\r\n" in raw:
            req = self._parse_request(raw)
            if not req:
              break
            body = self._read_body(req, conn)
            req["body"] = body
            if req["method"] == "GET" and req["path"] == "/api/logs/stream":
              if not self._auth_ok(req["path"], req["headers"], allow_bootstrap=False):
                conn.sendall(self._json_response(401, {"ok": False, "error": "Token API invalido o ausente"}))
              else:
                self._stream_logs(conn, req["qs"])
              return
            resp = self._handle(req)
            conn.sendall(resp)
            break
    except Exception:
      pass
    finally:
      try:
        conn.close()
      except Exception:
        pass

  def _serve(self):
    while not self._stop.is_set():
      try:
        self._sock.settimeout(1.0)
        conn, _addr = self._sock.accept()
      except socket.timeout:
        continue
      except OSError:
        if self._stop.is_set():
          break
        continue
      threading.Thread(target=self._client_loop, args=(conn,), daemon=True).start()

  def start(self, host="0.0.0.0", port=8765):
    self._port = port
    self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    self._sock.bind((host, port))
    self._sock.listen(8)
    self._stop.clear()
    self._thread = threading.Thread(target=self._serve, name="user-app-http", daemon=True)
    self._thread.start()
    self.logger.info("User App API escuchando en 0.0.0.0:%s" % port)

  def stop(self):
    self._stop.set()
    if self._sock:
      try:
        self._sock.close()
      except OSError:
        pass
      self._sock = None
