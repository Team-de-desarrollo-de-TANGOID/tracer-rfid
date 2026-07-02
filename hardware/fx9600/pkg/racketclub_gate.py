#!/usr/bin/env python3
"""
Racket Club Fase 1 — copia fiel de Tag-Detection (GEC/Zebra).
Sin configurar IoT Connector ni cloud endpoints en la consola web.
Solo: pyziotc + REST local 127.0.0.1:80 (/cloud/start, /cloud/mode, ...).
"""
import json
import os
import re
import signal
import sys
import time

import pyziotc

from Logger import Logger
from RestAPI import RestAPI
from INIFile import INIFile

APP_NAME = "racketclub-gate"
LOCK_PATH = "/tmp/racketclub-gate.lock"
HEARTBEAT_SEC = 25

if os.environ.get("INI_LOCATION") is not None:
    Ini = INIFile(os.getenv("INI_LOCATION"))
else:
    Ini = INIFile(os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.ini"))

DEBUG_SERVER = Ini.getStr("General", "DebugServer", "")
DEBUG_PORT = Ini.getInt("General", "DebugPort", 40514)
LOG_ONLY_TO_CONSOLE = Ini.getBool("General", "Log_Only_To_Console", False)
REST_API_RETRY_COUNT = Ini.getInt("General", "Retry", 3)
SEEN_TIMEOUT = Ini.getInt("General", "Seen_Timeout_in_ms", 5000)
SCAN_TIMEOUT = Ini.getInt("General", "Scan_Timeout_in_ms", 3000)
GPO_GREEN = Ini.getInt("GPO", "GPO_Green", 0)
GPI_TRIGGER = Ini.getInt("GPI", "GPI_Trigger", 0)
GPI_TRIGGER_LEVEL = Ini.getStr("GPI", "GPI_Trigger_Lvl", "LOW")
GPI_DEBOUNCE = Ini.getInt("General", "GPI_Debounce_in_ms", 0)
TAG_POPULATION = Ini.getInt("General", "Tag_Population", 32)
INVENTORY_INTERVAL = Ini.getInt("General", "Inventory_Interval_sec", 1)
READ_ENVIRONMENT = Ini.getStr("General", "Read_Environment", "LOW_INTERFERENCE")

Stop = False
ShuttingDown = False
LastHeartbeat = 0.0
GPI = ["NA", "Unknown", "Unknown", "Unknown", "Unknown"]
ScanTime = 0
TagTimeout = 0
SeenTags = set()
FailedTidLogged = set()

_TID_HEX_RE = re.compile(r"^[0-9A-F]+$")

ziotcObject = pyziotc.Ziotc()
logger = Logger(DEBUG_SERVER, DEBUG_PORT, LOG_ONLY_TO_CONSOLE)
restAPI = RestAPI(logger, REST_API_RETRY_COUNT, ziotcObject)


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
            logger.info(f"otra instancia activa pid={old_pid} — saliendo")
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
                    "version": os.getenv("VERSION", ""),
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
    ShuttingDown = True
    Stop = True
    logger.info(f"señal {signum} — deteniendo")


def passthru_callback(msg_in):
    if isinstance(msg_in, (bytes, bytearray)):
        msg_in = msg_in.decode("utf-8", errors="replace")
    cmd = (msg_in or "").strip().lower()
    if cmd in ("", "ping", "status", "health"):
        return bytearray(
            json.dumps({"ok": True, "app": APP_NAME, "pid": os.getpid()}).encode("utf-8")
        )
    return b"unrecognized command"


def new_msg_callback(msg_type, msg_in):
    if msg_type == pyziotc.MSG_IN_GPI:
        process_gpi(msg_in)
    if msg_type == pyziotc.MSG_IN_JSON:
        process_tag(msg_in)


def process_gpi(msg_in):
    global ScanTime, GPI
    msg = json.loads(msg_in)
    if msg["type"] != "GPI":
        return
    pin = msg["pin"]
    logger.info(f"GPI State :{pin} -> {msg['state']}")
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


def _extract_tid(data):
    for key in ("TID", "tid", "tidHex", "Tid"):
        val = data.get(key)
        if val and str(val).strip():
            return str(val).upper().strip()
    tag_data = data.get("tagData")
    if isinstance(tag_data, dict):
        for key in ("TID", "tid", "tidHex"):
            val = tag_data.get(key)
            if val and str(val).strip():
                return str(val).upper().strip()
    return None


def process_tag(msg_in):
    global TagTimeout, SeenTags

    if TagTimeout > 0 and TagTimeout < time.time():
        SeenTags.clear()
        FailedTidLogged.clear()

    tag = json.loads(msg_in)
    data = tag.get("data") or {}
    raw_tid = _extract_tid(data)
    epc = str(data.get("idHex", "") or data.get("epc", "") or "").upper()

    if not _is_valid_tid(raw_tid):
        if epc and raw_tid and epc not in FailedTidLogged:
            FailedTidLogged.add(epc)
            logger.debug(f"TID no disponible epc={epc} raw={raw_tid}")
        return

    tid = raw_tid
    if tid in SeenTags:
        return

    SeenTags.add(tid)
    ant = data.get("antenna", data.get("antennaId", ""))
    rssi = data.get("peakRssi", data.get("rssi", ""))
    logger.info(f"LECTURA TID={tid} ant={ant} rssi={rssi}")
    TagTimeout = time.time() + (SEEN_TIMEOUT / 1000)


def _antenna_config():
    antennas = []
    powers = []
    for i in range(1, 3):
        if Ini.getBool("Antenna_" + str(i), "Enabled", False):
            antennas.append(i)
            powers.append(Ini.getFloat("Antenna_" + str(i), "Power", 19.2))
    return antennas, powers


def _build_inventory_mode():
    antennas, powers = _antenna_config()
    mode = {
        "type": "INVENTORY",
        "tagMetaData": ["ANTENNA", "RSSI", "SEEN_COUNT", "TID[1,2-6]"],
        "modeSpecificSettings": {"inventorySettings": {"interval": INVENTORY_INTERVAL}},
        "environment": READ_ENVIRONMENT,
        "query": {
            "tagpopulation": TAG_POPULATION,
            "session": "S1",
            "sel": "ALL",
            "target": "A",
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
        "tagMetaData": ["ANTENNA", "RSSI", "SEEN_COUNT", "TID[1,2-6]"],
        "environment": READ_ENVIRONMENT,
        "query": {
            "tagpopulation": TAG_POPULATION,
            "session": "S1",
            "sel": "ALL",
            "target": "A",
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


def configureReader():
    config = {"GPIO-LED": {"GPODefaults": {"1": "LOW", "2": "LOW", "3": "LOW"}}}
    logger.debug("LED Config -> " + json.dumps(config))
    restAPI.setConfig(json.dumps(config))

    for label, builder in (("INVENTORY", _build_inventory_mode), ("CUSTOM", _build_custom_mode)):
        mode = builder()
        logger.debug("Operation Mode (" + label + ") -> " + json.dumps(mode))
        if restAPI.setMode(json.dumps(mode)):
            logger.info("Modo aplicado: " + label)
            return
    logger.err("No se pudo aplicar modo INVENTORY ni CUSTOM con TID")


signal.signal(signal.SIGINT, sigHandler)
signal.signal(signal.SIGTERM, sigHandler)

_acquire_lock()
logger.info("racketclub-gate pid=" + str(os.getpid()))
logger.debug("Reader Version: " + str(restAPI.getReaderVersion()))
logger.debug("Reader Serial Number: " + str(restAPI.getReaderSerial()))
Ini.dumpConfig(logger)

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

while not Stop:
    now = time.time()
    if now - LastHeartbeat >= HEARTBEAT_SEC:
        send_ctrl_heartbeat("running")
        LastHeartbeat = now
    time.sleep(0.2)
    if GPO_GREEN:
        restAPI.setFastGPO(GPO_GREEN, TagTimeout > time.time())

send_ctrl_heartbeat("stopping")
restAPI.stopInventory(fast=True)
restAPI.setFastGPO(1, False)
restAPI.setFastGPO(2, False)
restAPI.setFastGPO(3, False)
_remove_lock()
logger.info("Stopped")
