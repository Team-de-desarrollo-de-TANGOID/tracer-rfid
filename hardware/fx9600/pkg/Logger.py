import socket
import time
import logging
from logging.handlers import RotatingFileHandler


class Logger:
    LOG_DEBUG = 7
    LOG_INFO = 6
    LOG_WARN = 4
    LOG_ERROR = 3

    def __init__(self, Server, Port, console_only=False):
        self.console_only = console_only
        self.Server = Server
        self.Port = Port
        if not self.console_only:
            self.log_level = Logger.LOG_INFO
            logging.basicConfig(
                handlers=[RotatingFileHandler("/tmp/racketclub-gate.log", maxBytes=2000000, backupCount=5)],
                level=self.log_level,
                format="[%(asctime)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
                force=True,
            )
            self.logger = logging.getLogger()

    def debug(self, message):
        self.__sendLogMsg(Logger.LOG_DEBUG, message)

    def warn(self, message):
        self.__sendLogMsg(Logger.LOG_WARN, message)

    def err(self, message):
        self.__sendLogMsg(Logger.LOG_ERROR, message)

    def info(self, message):
        self.__sendLogMsg(Logger.LOG_INFO, message)

    def __sendLogMsg(self, level, message):
        if level == Logger.LOG_DEBUG:
            logging_level = logging.getLevelName("DEBUG")
        if level == Logger.LOG_INFO:
            logging_level = logging.getLevelName("INFO")
        if level == Logger.LOG_WARN:
            logging_level = logging.getLevelName("WARN")
        if level == Logger.LOG_ERROR:
            logging_level = logging.getLevelName("ERROR")

        local_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time()))
        print(f"{local_time}: {message}")

        if self.Server:
            server_msg = "<" + str(8 + level) + ">" + socket.gethostname() + " racketclub-gate: " + message
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.sendto(bytes(server_msg, "utf-8"), (self.Server, self.Port))
            except Exception:
                pass

        if not self.console_only:
            self.logger.log(logging_level, message)
