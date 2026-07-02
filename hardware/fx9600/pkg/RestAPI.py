import pyziotc
import http.client
import json


class RestAPI:
    conn = None
    invState = False
    llrp_blocks_rc = False

    def __init__(self, logger, retry_count, ziotc):
        self.logger = logger
        self.retry_count = retry_count
        self.ziotcObject = ziotc
        self.GPOState = [None, None, None, None, None, None, None, None, None]
        self.__get_jwt()

    def __is_llrp_data_endpoint_block(self, status, data):
        if status != 422:
            return False
        try:
            body = json.loads(data.decode("utf-8"))
            msg = str(body.get("message", ""))
        except Exception:
            msg = data.decode("utf-8", errors="replace")
        return "LLRP" in msg and "data endpoint" in msg

    def __note_llrp_block(self, action, status, data):
        if self.__is_llrp_data_endpoint_block(status, data):
            if not self.llrp_blocks_rc:
                self.llrp_blocks_rc = True
                self.logger.err(
                    "LLRP esta configurado como data endpoint en IoT Connector. "
                    "Las llamadas /cloud/* quedan bloqueadas hasta corregir el mapping "
                    "(ver hardware/fx9600/README.md)."
                )
            return True
        self.logger.err(action + " Failed :" + str(status) + " -> " + data.decode("utf-8"))
        return False

    def __get_jwt(self):
        self.conn = http.client.HTTPConnection("127.0.0.1", 80, timeout=5)

    def __makeRequest(self, verb, url, payload, headers):
        try:
            self.conn.connect()
            self.conn.request(verb, url, payload, headers)
            res = self.conn.getresponse()
            data = res.read()
            status = res.status
            self.conn.close()
            return status, data
        except Exception:
            return 0, b"Non-returned value"

    def startInventory(self):
        if self.llrp_blocks_rc:
            return False
        retry = 0
        payload = '{ "doNotPersistState": true }'
        while retry < self.retry_count:
            headers = {}
            status, data = self.__makeRequest("PUT", "/cloud/start", payload, headers)
            if status == 200:
                self.logger.info("Inventory Started")
                self.invState = True
                return True
            if self.__note_llrp_block("Inventory Start", status, data):
                return False
            self.__get_jwt()
            retry = retry + 1
        self.logger.err("Inventory Start Failed :" + str(status) + " -> " + data.decode("utf-8"))
        return False

    def stopInventory(self, fast=False):
        if self.llrp_blocks_rc:
            return False
        retry = 0
        max_retry = 1 if fast else self.retry_count
        while retry < max_retry:
            headers = {}
            status, data = self.__makeRequest("PUT", "/cloud/stop", "", headers)
            if status == 200:
                self.logger.info("Inventory Stopped")
                self.invState = False
                return True
            if self.__note_llrp_block("Inventory Stop", status, data):
                return False
            self.__get_jwt()
            retry = retry + 1
        self.logger.err("Inventory Stop Failed :" + str(status) + " -> " + data.decode("utf-8"))
        return False

    def setFastGPO(self, port, state):
        if self.GPOState[port] == state:
            return
        var = {"type": "GPO", "pin": port, "state": "HIGH" if state else "LOW"}
        self.ziotcObject.send_next_msg(
            pyziotc.MSG_OUT_GPO, bytearray(json.dumps(var).encode("utf-8"))
        )
        self.GPOState[port] = state
        self.logger.info("Set GPO " + str(port) + " -> " + var["state"])

    def setConfig(self, payload):
        if self.llrp_blocks_rc:
            return False
        retry = 0
        while retry < self.retry_count:
            headers = {"Content-Type": "application/json"}
            status, data = self.__makeRequest("PUT", "/cloud/config", payload, headers)
            if status == 200:
                return True
            if self.__note_llrp_block("LED Config", status, data):
                return False
            self.__get_jwt()
            retry = retry + 1
        self.logger.err("failed to set configuration :" + str(status) + " -> " + data.decode("utf-8"))
        return False

    def setMode(self, payload):
        if self.llrp_blocks_rc:
            return False
        retry = 0
        while retry < self.retry_count:
            headers = {"Content-Type": "application/json"}
            status, data = self.__makeRequest("PUT", "/cloud/mode", payload, headers)
            if status == 200:
                return True
            if self.__note_llrp_block("Operation Mode", status, data):
                return False
            self.__get_jwt()
            retry = retry + 1
        self.logger.err("failed to operation mode :" + str(status) + " -> " + data.decode("utf-8"))
        return False

    def getReaderVersion(self):
        retry = 0
        while retry < self.retry_count:
            headers = {"Content-Type": "application/json"}
            status, data = self.__makeRequest("GET", "/cloud/version", "", headers)
            if status != 200:
                self.logger.err(
                    "Unable to retrieve reader version :" + str(status) + " -> " + data.decode("utf-8")
                )
            else:
                response = json.loads(data.decode("utf-8"))
                return response["readerApplication"]
            retry = retry + 1
        self.logger.err("failed to get version number :" + str(status) + " -> " + data.decode("utf-8"))

    def getReaderSerial(self):
        retry = 0
        while retry < self.retry_count:
            headers = {"Content-Type": "application/json"}
            status, data = self.__makeRequest("GET", "/cloud/version", "", headers)
            if status != 200:
                self.logger.err(
                    "Unable to retrieve reader serial :" + str(status) + " -> " + data.decode("utf-8")
                )
            else:
                response = json.loads(data.decode("utf-8"))
                return response["serialNumber"]
            retry = retry + 1
        self.logger.err("failed to get serial number:" + str(status) + " -> " + data.decode("utf-8"))
