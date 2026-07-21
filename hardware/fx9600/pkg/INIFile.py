class INIFile:

    def __init__(self, file):
        self.parse = {}
        self.file = file
        self.open = open(file, "r")
        self.f_read = self.open.read()
        split_content = self.f_read.split("\n")
        section = ""

        for i in range(len(split_content)):
            if split_content[i].find("[") != -1:
                section = split_content[i]
                section = section[section.find("[") + 1 : section.rfind("]")]
                self.parse.update({section: {}})
            elif split_content[i].find("[") == -1 and split_content[i].find("=") != -1:
                pairs = split_content[i]
                split_pairs = pairs.split("=")
                key = split_pairs[0].strip()
                value = split_pairs[1].strip()
                self.parse[section].update({key: value})

    def dumpConfig(self, logger):
        for s in self.parse:
            logger.debug("Section : [" + s + "]")
            for k, v in self.parse[s].items():
                logger.debug(k + "=" + v)

    def getStr(self, section, key, default):
        try:
            return self.parse[section][key]
        except Exception:
            return default

    def getInt(self, section, key, default):
        try:
            return int(self.parse[section][key])
        except Exception:
            return default

    def getFloat(self, section, key, default):
        try:
            return float(self.parse[section][key])
        except Exception:
            return default

    def getBool(self, section, key, default):
        try:
            v = self.parse[section][key]
            if v[0] == "T" or v[0] == "t":
                return True
            return False
        except Exception:
            return default

    def set_value(self, section, key, value):
        if section not in self.parse:
            self.parse[section] = {}
        self.parse[section][key] = str(value)

    def save(self):
        lines = []
        for section, pairs in self.parse.items():
            lines.append("[" + section + "]")
            for key, value in pairs.items():
                lines.append(key + "=" + value)
            lines.append("")
        with open(self.file, "w", encoding="utf-8") as out:
            out.write("\n".join(lines).rstrip() + "\n")
        self.open = open(self.file, "r")
        self.f_read = self.open.read()
