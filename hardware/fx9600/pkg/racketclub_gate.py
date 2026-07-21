#!/usr/bin/env python3
"""
Racket Club — User App FX9600.
Lectura RFID + lista local + API REST para la web app.
"""
import json
import os
import re
import signal
import sys
import threading
import time

import pyziotc

from AllowList import AllowList, normalize_tid
from Logger import Logger
from RestAPI import RestAPI
from INIFile import INIFile
from Secrets import Secrets
from UserAppServer import UserAppServer

APP_NAME = "racketclub-gate"
LOCK_PATH = "/tmp/racketclub-gate.lock"
HEARTBEAT_SEC = 25
APP_DIR = os.path.dirname(os.path.abspath(__file__))

if os.environ.get("INI_LOCATION") is not None:
    Ini = INIFile(os.getenv("INI_LOCATION"))
else:
    Ini = INIFile(os.path.join(APP_DIR, "config.ini"))

DEBUG_SERVER = Ini.getStr("General", "DebugServer", "")
DEBUG_PORT = Ini.getInt("General", "DebugPort", 40514)
LOG_ONLY_TO_CONSOLE = Ini.getBool("General", "Log_Only_To_Console", False)
REST_API_RETRY_COUNT = Ini.getInt("General", "Retry", 3)
SEEN_TIMEOUT = Ini.getInt("General", "Seen_Timeout_in_ms", 5000)
INVENTORY_WATCHDOG_SEC = Ini.getInt("General", "Inventory_Watchdog_sec", 0)
REPEAT_READ_LOG_SEC = Ini.getInt("General", "Repeat_Read_Log_sec", 3)
SCAN_TIMEOUT = Ini.getInt("General", "Scan_Timeout_in_ms", 3000)
GPO_GREEN = Ini.getInt("GPO", "GPO_Green", 0)
ALERT_GPO_PIN = Ini.getInt("GPO", "Alert_Gpo_Pin", 1)
GPI_TRIGGER = Ini.getInt("GPI", "GPI_Trigger", 0)
GPI_TRIGGER_LEVEL = Ini.getStr("GPI", "GPI_Trigger_Lvl", "LOW")
GPI_DEBOUNCE = Ini.getInt("General", "GPI_Debounce_in_ms", 0)
TAG_POPULATION = Ini.getInt("General", "Tag_Population", 32)
INVENTORY_INTERVAL = Ini.getInt("General", "Inventory_Interval_sec", 1)
READ_ENVIRONMENT = Ini.getStr("General", "Read_Environment", "LOW_INTERFERENCE")
RF_SESSION = Ini.getStr("General", "Rf_Session", "S0")
RF_TARGET = Ini.getStr("General", "Rf_Target", "A")
FAILED_TID_RETRIES = Ini.getInt("General", "Failed_Tid_Retries", 3)
TID_WORD_COUNT = Ini.getInt("General", "Tid_Word_Count", 6)
API_PORT = Ini.getInt("API", "Port", 8765)
ALERT_VIA_GPO = Ini.getBool("API", "AlertViaGpo", True)
ALERT_GPO_DURATION_MS = Ini.getInt("API", "AlertGpoDurationMs", 5000)
APP_VERSION = os.getenv("VERSION", "1.0.17-fase2")

Stop = False
ShuttingDown = False
LastHeartbeat = 0.0
GPI = ["NA", "Unknown", "Unknown", "Unknown", "Unknown"]
ScanTime = 0
TagField = {}
TagLastReportAt = {}
TagActivityUntil = 0.0
_tag_sight_lock = threading.RLock()
# Solo reportar de nuevo si la antena vio el tag hace menos de esto (sin antena = sin alertas).
TAG_PRESENT_SEC = 5.0
FailedTidLogged = set()
FailedTidAttempts = {}
GpoAlertUntil = 0.0
GpoOffTimer = None
LastTagAt = 0.0
LastInventoryWatchdog = 0.0
LastInventoryKick = 0.0
LastRepeatLogAt = {}

_TID_HEX_RE = re.compile(r"^[0-9A-F]+$")

ziotcObject = pyziotc.Ziotc()
logger = Logger(DEBUG_SERVER, DEBUG_PORT, LOG_ONLY_TO_CONSOLE)
restAPI = RestAPI(logger, REST_API_RETRY_COUNT, ziotcObject)
allowList = AllowList()
secrets = Secrets()
_portal_url_ini = Ini.getStr("API", "PortalWebhookUrl", "").strip()
if _portal_url_ini and not secrets.get_portal_webhook_url():
    secrets.set_portal_webhook_url(_portal_url_ini)


def _remove_lock():
    try:
        if os.path.exists(LOCK_PATH):
            with open(LOCK_PATH, encoding="utf-8") as f:
                if f.read().strip() == str(os.getpid()):
                    os.remove(LOCK_PATH)
    except OSError:
        pass


def _acquire_lock():
    if os.path.exists(LOCK_PATH):
        try:
            with open(LOCK_PATH, encoding="utf-8") as f:
                old_pid = int(f.read().strip())
            os.kill(old_pid, 0)
            logger.info("otra instancia activa pid=%s — saliendo" % old_pid)
            sys.exit(0)
        except (OSError, ValueError):
            pass
    with open(LOCK_PATH, "w", encoding="utf-8") as f:
        f.write(str(os.getpid()))


def send_ctrl_heartbeat(status="running"):
    try:
        payload = bytearray(
            json.dumps(
                {
                    "source": APP_NAME,
                    "app": APP_NAME,
                    "status": status,
                    "pid": os.getpid(),
                    "version": APP_VERSION,
                }
            ).encode("utf-8")
        )
        ziotcObject.send_next_msg(pyziotc.MSG_OUT_CTRL, payload)
    except Exception:
        pass


def sigHandler(signum, frame):
    global Stop, ShuttingDown
    if ShuttingDown:
        _remove_lock()
        os._exit(0)
    request_app_shutdown()


def passthru_callback(msg_in):
    if isinstance(msg_in, (bytes, bytearray)):
        msg_in = msg_in.decode("utf-8", errors="replace")
    cmd = (msg_in or "").strip().lower()
    if cmd in ("", "ping", "status", "health"):
        snap = allowList.snapshot()
        return bytearray(
            json.dumps(
                {
                    "ok": True,
                    "app": APP_NAME,
                    "pid": os.getpid(),
                    "allowListCount": snap["count"],
                    "version": snap["version"],
                }
            ).encode("utf-8")
        )
    return b"unrecognized command"


def new_msg_callback(msg_type, msg_in):
    global LastTagAt
    if msg_type == pyziotc.MSG_IN_GPI:
        process_gpi(msg_in)
    if msg_type == pyziotc.MSG_IN_JSON:
        LastTagAt = time.time()
        process_tag(msg_in)


def process_gpi(msg_in):
    global ScanTime, GPI
    msg = json.loads(msg_in)
    if msg["type"] != "GPI":
        return
    pin = msg["pin"]
    logger.info("GPI State :%s -> %s" % (pin, msg["state"]))
    GPI[int(pin)] = msg["state"]
    if pin == GPI_TRIGGER and msg["state"] == GPI_TRIGGER_LEVEL:
        logger.info("Triggered !!!")
        ScanTime = time.time() + (SCAN_TIMEOUT / 1000)


def _is_valid_tid(tid):
    if not tid:
        return False
    upper = str(tid).upper().strip()
    if any(x in upper for x in ("ERROR", "NOT ATTEMPTED", "ATTEMPTED", " ")):
        return False
    if len(upper) < 8 or len(upper) % 2 != 0:
        return False
    return bool(_TID_HEX_RE.match(upper))


def _tid_failure_transient(raw_tid):
    upper = str(raw_tid or "").upper()
    return "NOT ATTEMPTED" in upper or "DID NOT RESPOND" in upper


def _extract_tid(data):
    raw = None
    for key in ("TID", "tid", "tidHex", "Tid"):
        val = data.get(key)
        if val and str(val).strip():
            raw = str(val).upper().strip()
            break
    if raw is None:
        tid1 = data.get("TID[1]")
        tid26 = data.get("TID[2-6]")
        if tid1 and tid26:
            combined = str(tid1).strip() + str(tid26).strip()
            if _is_valid_tid(combined):
                raw = combined.upper()
    if raw is None:
        tag_data = data.get("tagData")
        if isinstance(tag_data, dict):
            for key in ("TID", "tid", "tidHex"):
                val = tag_data.get(key)
                if val and str(val).strip():
                    raw = str(val).upper().strip()
                    break
    if raw is None:
        return None
    return normalize_tid(raw)


def _schedule_gpo_off(pin, delay_sec):
    global GpoOffTimer

    def _off():
        global GpoOffTimer
        try:
            restAPI.setFastGPO(pin, False)
        except Exception:
            pass
        GpoOffTimer = None

    if GpoOffTimer is not None:
        try:
            GpoOffTimer.cancel()
        except Exception:
            pass
    GpoOffTimer = threading.Timer(delay_sec, _off)
    GpoOffTimer.daemon = True
    GpoOffTimer.start()


def _post_portal_webhook(payload):
    base = secrets.get_portal_webhook_url()
    if not base:
        logger.warn("Portal webhook sin URL — use Reconectar en la web app")
        return
    url = base.rstrip("/") + "/api/portal/alert"
    token = secrets.get_api_token()
    try:
        import urllib.request

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", "Bearer %s" % token)
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
        logger.info("Alerta portal enviada a %s" % url)
    except Exception as exc:
        logger.warn("Portal webhook fallo (%s): %s" % (url, exc))


def _notify_portal_web(entry):
    threading.Thread(
        target=_post_portal_webhook,
        args=(
            {
                "type": "denied",
                "tid": entry.get("tid"),
                "ant": entry.get("ant"),
                "rssi": entry.get("rssi"),
                "eventId": entry.get("id"),
                "ts": entry.get("ts"),
            },
        ),
        daemon=True,
    ).start()


def _trigger_alert(tid, ant, rssi, gpo_pin=None):
    global GpoAlertUntil
    pin = gpo_pin or ALERT_GPO_PIN
    if ALERT_VIA_GPO and pin:
        restAPI.setFastGPO(pin, True)
        GpoAlertUntil = time.time() + (ALERT_GPO_DURATION_MS / 1000.0)
        _schedule_gpo_off(pin, ALERT_GPO_DURATION_MS / 1000.0)
        logger.warn(
            "ALERTA BALIZA GPO %s activada — TID %s ant=%s rssi=%s"
            % (pin, tid, ant, rssi)
        )
    else:
        logger.warn(
            "ALERTA BALIZA (simulado en logs) GPO %s — TID %s ant=%s rssi=%s"
            % (pin, tid, ant, rssi)
        )


def reset_tag_dedup():
    global TagActivityUntil
    TagField.clear()
    TagLastReportAt.clear()
    FailedTidLogged.clear()
    FailedTidAttempts.clear()
    LastRepeatLogAt.clear()
    TagActivityUntil = 0.0


def _dedupe_sec():
    return max(0.0, SEEN_TIMEOUT / 1000.0)


def _mark_tag_reported(tid, now=None):
    global TagActivityUntil, LastTagAt
    now = now if now is not None else time.time()
    TagLastReportAt[tid] = now
    LastTagAt = now
    if SEEN_TIMEOUT > 0:
        until = now + _dedupe_sec()
        if until > TagActivityUntil:
            TagActivityUntil = until


def _handle_tag_sighting(tid, ant, rssi, now=None):
    """Actualiza presencia RFID; emite al instante si venció seenTimeout."""
    global LastTagAt
    now = now if now is not None else time.time()
    with _tag_sight_lock:
        TagField[tid] = {"ant": ant, "rssi": rssi, "last_seen": now}
        LastTagAt = now
        last_report = TagLastReportAt.get(tid, 0)
        if last_report <= 0 or (now - last_report) >= _dedupe_sec():
            _emit_tag_report(tid, ant, rssi, now)


def _tick_tag_reports(now):
    """
    Re-reporta cada seenTimeout solo si la antena sigue viendo el tag
    (last_seen < TAG_PRESENT_SEC). Sin lecturas RFID recientes no hay alertas.
    """
    sec = _dedupe_sec()
    present = TAG_PRESENT_SEC
    for tid in list(TagField.keys()):
        state = TagField.get(tid)
        if not state:
            continue
        age = now - state.get("last_seen", 0)
        if age > present:
            TagField.pop(tid, None)
            TagLastReportAt.pop(tid, None)
            LastRepeatLogAt.pop(tid, None)
            continue
        if sec <= 0:
            continue
        last_report = TagLastReportAt.get(tid, 0)
        if last_report > 0 and (now - last_report) >= sec:
            _emit_tag_report(tid, state.get("ant", ""), state.get("rssi", ""), now)


def _emit_tag_report(tid, ant, rssi, now=None):
    now = now if now is not None else time.time()
    _mark_tag_reported(tid, now)
    snap = allowList.snapshot()
    gpo_pin = ALERT_GPO_PIN if ALERT_VIA_GPO else (snap.get("gpoPin") or 1)

    if snap["count"] == 0:
        logger.info("LECTURA TID=%s ant=%s rssi=%s (lista vacía — sin control)" % (tid, ant, rssi))
        userApp.tag_events.append(
            {"type": "read", "tid": tid, "ant": ant, "rssi": rssi, "authorized": None}
        )
    elif allowList.contains(tid):
        logger.warn(
            "LECTURA denegada TID=%s ant=%s rssi=%s — TAG no autorizado para salir"
            % (tid, ant, rssi)
        )
        _trigger_alert(tid, ant, rssi, gpo_pin)
        entry = userApp.tag_events.append(
            {"type": "denied", "tid": tid, "ant": ant, "rssi": rssi, "authorized": False}
        )
        _notify_portal_web(entry)
    else:
        logger.info("LECTURA autorizada TID=%s ant=%s rssi=%s" % (tid, ant, rssi))
        userApp.tag_events.append(
            {"type": "authorized", "tid": tid, "ant": ant, "rssi": rssi, "authorized": True}
        )


def restart_inventory():
    global LastTagAt, LastInventoryKick
    if restAPI.llrp_blocks_rc:
        return False
    restAPI.stopInventory(fast=True)
    time.sleep(0.4)
    ok = restAPI.startInventory()
    if ok:
        LastTagAt = time.time()
        LastInventoryKick = time.time()
    return ok


def _kick_inventory_for_reread(now):
    """
    El FX9600 deja de reportar tags ya inventariados. Cada seenTimeout
    reinicia el inventario para forzar relectura real de la antena.
    Sin tags en campo, el reinicio no genera eventos.
    """
    global LastInventoryKick
    sec = _dedupe_sec()
    if sec <= 0 or restAPI.llrp_blocks_rc:
        return
    if LastInventoryKick <= 0:
        LastInventoryKick = now
        return
    if now - LastInventoryKick < sec:
        return
    LastInventoryKick = now
    try:
        restAPI.stopInventory(fast=True)
        time.sleep(0.25)
        restAPI.startInventory()
    except Exception as exc:
        logger.warn("Kick inventario fallo: %s" % exc)


INI_PATH = os.environ.get("INI_LOCATION") or os.path.join(APP_DIR, "config.ini")


def _antenna_settings_from_ini():
    out = {}
    for i in range(1, 5):
        default_enabled = i <= 2
        out["antenna%dEnabled" % i] = Ini.getBool("Antenna_%d" % i, "Enabled", default_enabled)
        out["antenna%dPower" % i] = Ini.getFloat("Antenna_%d" % i, "Power", 27.0)
    return out


def get_settings_snapshot():
    snap = {
        "seenTimeoutSec": SEEN_TIMEOUT / 1000.0,
        "repeatReadLogSec": REPEAT_READ_LOG_SEC,
        "tagPopulation": TAG_POPULATION,
        "alertViaGpo": ALERT_VIA_GPO,
        "alertGpoPin": ALERT_GPO_PIN,
        "alertGpoDurationSec": ALERT_GPO_DURATION_MS / 1000.0,
        "rfSession": RF_SESSION,
        "failedTidRetries": FAILED_TID_RETRIES,
        "tidWordCount": TID_WORD_COUNT,
        "readEnvironment": READ_ENVIRONMENT,
    }
    snap.update(_antenna_settings_from_ini())
    return snap


def apply_settings_update(payload):
    global Ini, SEEN_TIMEOUT, REPEAT_READ_LOG_SEC, TAG_POPULATION
    global ALERT_GPO_PIN, ALERT_VIA_GPO, ALERT_GPO_DURATION_MS
    global RF_SESSION, FAILED_TID_RETRIES, TID_WORD_COUNT, READ_ENVIRONMENT

    p = payload if isinstance(payload, dict) else {}

    if p.get("seenTimeoutSec") is not None:
        Ini.set_value("General", "Seen_Timeout_in_ms", max(1000, int(float(p["seenTimeoutSec"]) * 1000)))
    elif p.get("portalDedupeSec") is not None:
        Ini.set_value("General", "Seen_Timeout_in_ms", max(1000, int(float(p["portalDedupeSec"]) * 1000)))
    if p.get("repeatReadLogSec") is not None:
        Ini.set_value("General", "Repeat_Read_Log_sec", max(0, int(p["repeatReadLogSec"])))
    if p.get("tagPopulation") is not None:
        Ini.set_value("General", "Tag_Population", max(1, min(512, int(p["tagPopulation"]))))
    for i in range(1, 5):
        ek = "antenna%dEnabled" % i
        pk = "antenna%dPower" % i
        if p.get(ek) is not None:
            Ini.set_value("Antenna_%d" % i, "Enabled", "True" if p[ek] else "False")
        if p.get(pk) is not None:
            Ini.set_value("Antenna_%d" % i, "Power", float(p[pk]))
    if p.get("alertViaGpo") is not None:
        Ini.set_value("API", "AlertViaGpo", "True" if p["alertViaGpo"] else "False")
    if p.get("alertGpoPin") is not None:
        Ini.set_value("GPO", "Alert_Gpo_Pin", max(1, min(4, int(p["alertGpoPin"]))))
    if p.get("alertGpoDurationSec") is not None:
        Ini.set_value("API", "AlertGpoDurationMs", max(500, int(float(p["alertGpoDurationSec"]) * 1000)))
    if p.get("rfSession") is not None:
        Ini.set_value("General", "Rf_Session", str(p["rfSession"]).upper())
    if p.get("failedTidRetries") is not None:
        Ini.set_value("General", "Failed_Tid_Retries", max(1, int(p["failedTidRetries"])))
    if p.get("tidWordCount") is not None:
        Ini.set_value("General", "Tid_Word_Count", max(1, min(6, int(p["tidWordCount"]))))
    if p.get("readEnvironment") is not None:
        Ini.set_value("General", "Read_Environment", str(p["readEnvironment"]))

    Ini.save()
    Ini = INIFile(INI_PATH)
    SEEN_TIMEOUT = Ini.getInt("General", "Seen_Timeout_in_ms", 5000)
    REPEAT_READ_LOG_SEC = Ini.getInt("General", "Repeat_Read_Log_sec", 3)
    TAG_POPULATION = Ini.getInt("General", "Tag_Population", 32)
    ALERT_GPO_PIN = Ini.getInt("GPO", "Alert_Gpo_Pin", 1)
    ALERT_VIA_GPO = Ini.getBool("API", "AlertViaGpo", True)
    ALERT_GPO_DURATION_MS = Ini.getInt("API", "AlertGpoDurationMs", 5000)
    RF_SESSION = Ini.getStr("General", "Rf_Session", "S0")
    FAILED_TID_RETRIES = Ini.getInt("General", "Failed_Tid_Retries", 3)
    TID_WORD_COUNT = Ini.getInt("General", "Tid_Word_Count", 6)
    READ_ENVIRONMENT = Ini.getStr("General", "Read_Environment", "LOW_INTERFERENCE")

    # No borrar TagLastReportAt: preserve el intervalo seenTimeout entre applies.
    if not restAPI.llrp_blocks_rc:
        configureReader()
        restart_inventory()
    logger.info("Configuración actualizada desde web: %s" % json.dumps(get_settings_snapshot()))
    return get_settings_snapshot()


def on_allowlist_synced(result):
    allowList.load()
    reset_tag_dedup()
    logger.info(
        "Lista recargada v%s (%s TID, +%s -%s) — reevaluando lecturas"
        % (
            result.get("version", 0),
            result.get("count", 0),
            len(result.get("added") or []),
            len(result.get("removed") or []),
        )
    )
    if restart_inventory():
        logger.info("Inventario reiniciado tras sync")
    else:
        logger.warn("No se pudo reiniciar inventario tras sync")


def request_app_shutdown():
    """Apagado inmediato (Zebra Stop / API shutdown)."""
    global Stop, ShuttingDown
    if ShuttingDown:
        return
    ShuttingDown = True
    Stop = True

    def _exit_now():
        try:
            send_ctrl_heartbeat("stopping")
            userApp.stop()
            restAPI.stopInventory(fast=True)
            restAPI.setFastGPO(1, False)
            restAPI.setFastGPO(2, False)
            restAPI.setFastGPO(3, False)
        except Exception:
            pass
        _remove_lock()
        os._exit(0)

    threading.Thread(target=_exit_now, daemon=True).start()


userApp = UserAppServer(
    allowList,
    secrets,
    logger,
    APP_NAME,
    APP_VERSION,
    get_pid=os.getpid,
    on_sync=on_allowlist_synced,
    on_settings_get=get_settings_snapshot,
    on_settings_apply=apply_settings_update,
    on_shutdown=request_app_shutdown,
)


def process_tag(msg_in):
    global LastTagAt, FailedTidAttempts

    tag = json.loads(msg_in)
    data = tag.get("data") or {}
    raw_tid = _extract_tid(data)
    epc = str(data.get("idHex", "") or data.get("epc", "") or "").upper()

    if not _is_valid_tid(raw_tid):
        if epc and raw_tid:
            attempts = FailedTidAttempts.get(epc, 0) + 1
            FailedTidAttempts[epc] = attempts
            transient = _tid_failure_transient(raw_tid)
            limit = FAILED_TID_RETRIES * 5 if transient else FAILED_TID_RETRIES
            if attempts >= limit and epc not in FailedTidLogged:
                FailedTidLogged.add(epc)
                logger.warn(
                    "TID no disponible epc=%s raw=%s (%d intentos — %s)"
                    % (
                        epc,
                        raw_tid,
                        attempts,
                        "colisión/saturación" if transient else "error de acceso",
                    )
                )
            elif attempts == 1 or (transient and attempts % 10 == 0):
                logger.debug(
                    "TID pendiente epc=%s raw=%s intento=%d"
                    % (epc, raw_tid, attempts)
                )
        return

    if epc and epc in FailedTidAttempts:
        prev = FailedTidAttempts.pop(epc, 0)
        if prev > 0:
            logger.debug("TID recuperado epc=%s tras %d intentos" % (epc, prev))

    tid = raw_tid
    ant = data.get("antenna", data.get("antennaId", ""))
    rssi = data.get("peakRssi", data.get("rssi", ""))
    now = time.time()

    _handle_tag_sighting(tid, ant, rssi, now)

    if REPEAT_READ_LOG_SEC > 0:
        last = LastRepeatLogAt.get(tid, 0)
        if now - last >= REPEAT_READ_LOG_SEC:
            LastRepeatLogAt[tid] = now
            logger.info("LECTURA (activa) TID=%s ant=%s rssi=%s" % (tid, ant, rssi))


def _antenna_config():
    antennas = []
    powers = []
    for i in range(1, 5):
        default_enabled = i <= 2
        if Ini.getBool("Antenna_" + str(i), "Enabled", default_enabled):
            antennas.append(i)
            powers.append(Ini.getFloat("Antenna_" + str(i), "Power", 27.0))
    if not antennas:
        logger.warn("Ninguna antena habilitada en config — usando antenas 1 y 2 por defecto")
        return [1, 2], [27.0, 27.0]
    return antennas, powers


def _build_inventory_mode():
    antennas, powers = _antenna_config()
    mode = {
        "type": "INVENTORY",
        "tagMetaData": ["ANTENNA", "RSSI", "SEEN_COUNT", "TID"],
        "modeSpecificSettings": {"inventorySettings": {"interval": INVENTORY_INTERVAL}},
        "environment": READ_ENVIRONMENT,
        "query": {
            "tagpopulation": TAG_POPULATION,
            "session": RF_SESSION,
            "sel": "ALL",
            "target": RF_TARGET,
        },
        "antennas": antennas,
        "transmitPower": powers,
    }
    if GPI_TRIGGER != 0:
        mode["radioStartConditions"] = {
            "type": "GPI",
            "gpis": [
                {
                    "port": GPI_TRIGGER,
                    "signal": GPI_TRIGGER_LEVEL,
                    "debounceTime": GPI_DEBOUNCE,
                }
            ],
        }
    return mode


def _build_custom_mode():
    antennas, powers = _antenna_config()
    mode = {
        "type": "CUSTOM",
        "tagMetaData": ["ANTENNA", "RSSI", "SEEN_COUNT", "TID"],
        "environment": READ_ENVIRONMENT,
        "query": {
            "tagpopulation": TAG_POPULATION,
            "session": RF_SESSION,
            "sel": "ALL",
            "target": RF_TARGET,
        },
        "antennas": antennas,
        "transmitPower": powers,
        "accessOperations": [
            {
                "type": "READ",
                "membank": "TID",
                "wordPointer": 0,
                "wordCount": TID_WORD_COUNT,
            }
        ],
    }
    if GPI_TRIGGER != 0:
        mode["radioStartConditions"] = {
            "type": "GPI",
            "gpis": [
                {
                    "port": GPI_TRIGGER,
                    "signal": GPI_TRIGGER_LEVEL,
                    "debounceTime": GPI_DEBOUNCE,
                }
            ],
        }
    return mode


def configureReader():
    config = {"GPIO-LED": {"GPODefaults": {"1": "LOW", "2": "LOW", "3": "LOW"}}}
    logger.debug("LED Config -> " + json.dumps(config))
    restAPI.setConfig(json.dumps(config))

    for label, builder in (("INVENTORY", _build_inventory_mode), ("CUSTOM", _build_custom_mode)):
        mode = builder()
        logger.debug("Operation Mode (%s) -> %s" % (label, json.dumps(mode)))
        if restAPI.setMode(json.dumps(mode)):
            logger.info("Modo aplicado: " + label)
            return
    logger.err("No se pudo aplicar modo INVENTORY ni CUSTOM con TID")


signal.signal(signal.SIGINT, sigHandler)
signal.signal(signal.SIGTERM, sigHandler)

_acquire_lock()
logger.info("racketclub-gate pid=%s version=%s" % (os.getpid(), APP_VERSION))
logger.debug("Reader Version: " + str(restAPI.getReaderVersion()))
logger.debug("Reader Serial Number: " + str(restAPI.getReaderSerial()))
Ini.dumpConfig(logger)

snap = allowList.snapshot()
logger.info(
    "Lista local: %s TID (v%s, GPO alerta pin=%s)"
    % (snap["count"], snap["version"], snap.get("gpoPin") or 1)
)

userApp.start(port=API_PORT)
if not secrets.token_configured():
    logger.info("API sin token — se configurará en el primer sync desde la web app")

restAPI.setFastGPO(1, False)
restAPI.setFastGPO(2, False)
restAPI.setFastGPO(3, False)
restAPI.stopInventory()
if not restAPI.llrp_blocks_rc:
    configureReader()

ziotcObject.reg_new_msg_callback(new_msg_callback)
ziotcObject.reg_pass_through_callback(passthru_callback)
ziotcObject.enableGPIEvents()
send_ctrl_heartbeat("ready")
LastHeartbeat = time.time()
if restAPI.llrp_blocks_rc:
    logger.err(
        "Sin inventario: corrija IoT Connector (quitar LLRP del interface Data) y reinicie la app."
    )
else:
    restAPI.startInventory()
    LastTagAt = time.time()
    LastInventoryKick = time.time()
    LastInventoryWatchdog = time.time()

while not Stop:
    now = time.time()
    _tick_tag_reports(now)
    _kick_inventory_for_reread(now)
    if now - LastHeartbeat >= HEARTBEAT_SEC:
        send_ctrl_heartbeat("running")
        LastHeartbeat = now
    if (
        INVENTORY_WATCHDOG_SEC > 0
        and not restAPI.llrp_blocks_rc
        and LastTagAt > 0
        and now - LastInventoryWatchdog >= 30
    ):
        LastInventoryWatchdog = now
        idle = now - LastTagAt
        if idle >= INVENTORY_WATCHDOG_SEC:
            logger.warn("Sin lecturas %.0fs — reiniciando inventario" % idle)
            restart_inventory()
    time.sleep(0.2)
    if GPO_GREEN:
        restAPI.setFastGPO(GPO_GREEN, now < TagActivityUntil)

send_ctrl_heartbeat("stopping")
userApp.stop()
restAPI.stopInventory(fast=True)
restAPI.setFastGPO(1, False)
restAPI.setFastGPO(2, False)
restAPI.setFastGPO(3, False)
_remove_lock()
logger.info("Stopped")
