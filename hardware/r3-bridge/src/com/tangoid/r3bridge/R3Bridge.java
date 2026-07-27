package com.tangoid.r3bridge;

import com.rscja.deviceapi.ConnectionState;
import com.rscja.deviceapi.RFIDWithUHFUsb;
import com.rscja.deviceapi.entity.AntennaNameEnum;
import com.rscja.deviceapi.entity.UHFTAGInfo;
import com.rscja.deviceapi.interfaces.ConnectionStateCallback;
import com.rscja.deviceapi.interfaces.IUHF;
import com.rscja.deviceapi.interfaces.IUHFInventoryCallback;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * HTTP bridge for Chainway R3 USB UHF reader (RFIDWithUHFUsb).
 */
public final class R3Bridge {
    private static final int DEFAULT_PORT = 3848;

    private final RFIDWithUHFUsb uhf = RFIDWithUHFUsb.getInstance();
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean inventory = new AtomicBoolean(false);
    private final AtomicBoolean releasing = new AtomicBoolean(false);
    private final AtomicLong tagSeq = new AtomicLong(0);
    private final Map<String, TagHit> recentTags = new ConcurrentHashMap<>();
    private final Object lock = new Object();
    private volatile String lastError = null;
    private volatile int[] powerLevels = new int[]{15, 15, 15, 15};
    /** True when firmware accepts setEPCAndTIDMode (getTid in inventory callback). */
    private volatile boolean epcTidModeActive = false;
    private volatile boolean strategyConfigured = false;
    private final ConcurrentLinkedQueue<PendingTid> tidQueue = new ConcurrentLinkedQueue<>();
    private final Set<String> tidQueuedEpcs = ConcurrentHashMap.newKeySet();
    /** EPCs already resolved to TID this session (until /tags/clear). */
    private final Set<String> resolvedEpcs = ConcurrentHashMap.newKeySet();
    /** TIDs already pushed to clients this session. */
    private final Set<String> reportedTids = ConcurrentHashMap.newKeySet();
    private final AtomicBoolean tidResolveBusy = new AtomicBoolean(false);
    private final ExecutorService tidResolveExec = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "r3-tid-resolve");
        t.setDaemon(true);
        return t;
    });
    /** Serializes USB I/O without blocking HTTP /status during long readData. */
    private final Object usbLock = new Object();
    /** Min gap between accepted tag reads (ms). */
    private static final long READ_MIN_INTERVAL_MS = 500;
    private final AtomicLong lastAcceptedReadAt = new AtomicLong(0);
    private final ExecutorService beepExec = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "r3-hw-beep");
        t.setDaemon(true);
        return t;
    });
    private final AtomicBoolean beepBusy = new AtomicBoolean(false);

    public static void main(String[] args) throws Exception {
        int port = DEFAULT_PORT;
        String nativesDir = null;
        for (int i = 0; i < args.length; i++) {
            if ("--port".equals(args[i]) && i + 1 < args.length) {
                port = Integer.parseInt(args[++i]);
            } else if ("--natives".equals(args[i]) && i + 1 < args.length) {
                nativesDir = args[++i];
            }
        }

        R3Bridge bridge = new R3Bridge();
        bridge.configureNatives(nativesDir);
        bridge.startServer(port);
    }

    private void configureNatives(String nativesDir) {
        Path dir;
        if (nativesDir != null && !nativesDir.isBlank()) {
            dir = Paths.get(nativesDir).toAbsolutePath().normalize();
        } else {
            dir = Paths.get("").toAbsolutePath().normalize();
            Path sibling = dir.resolve("natives");
            if (Files.isDirectory(sibling)) {
                dir = sibling;
            }
        }
        String dll = System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win")
                ? "UHFAPI.dll"
                : "libTagReader.so";
        System.out.println("[R3Bridge] natives dir=" + dir + " file=" + dll);
        try {
            uhf.setDllOrSOFilePath(dir.toString(), dll);
        } catch (Throwable t) {
            System.err.println("[R3Bridge] setDllOrSOFilePath warning: " + t.getMessage());
        }
        String path = System.getProperty("java.library.path", "");
        System.setProperty("java.library.path", dir + java.io.File.pathSeparator + path);
    }

    private void startServer(int port) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/health", this::handleHealth);
        server.createContext("/status", this::handleStatus);
        server.createContext("/connect", this::handleConnect);
        server.createContext("/disconnect", this::handleDisconnect);
        server.createContext("/inventory/start", this::handleInventoryStart);
        server.createContext("/inventory/stop", this::handleInventoryStop);
        server.createContext("/tags", this::handleTags);
        server.createContext("/tags/clear", this::handleTagsClear);
        server.createContext("/tags/forget", this::handleTagsForget);
        server.createContext("/power", this::handlePower);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        System.out.println("[R3Bridge] listening on http://127.0.0.1:" + port);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                synchronized (lock) {
                    disconnectInternal(true);
                }
            } catch (Exception ignored) {
            }
            server.stop(0);
        }));
    }

    private void handleHealth(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        sendJson(ex, 200, "{\"ok\":true,\"service\":\"r3-bridge\"}");
    }

    private void handleStatus(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        sendJson(ex, 200, statusJson());
    }

    private void handleConnect(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        synchronized (lock) {
            try {
                if (connected.get()) {
                    sendJson(ex, 200, statusJson());
                    return;
                }

                // Only free if the SDK still thinks a session is open.
                try {
                    ConnectionState st = uhf.getConnectStatus();
                    if (st == ConnectionState.CONNECTED || st == ConnectionState.CONNTCTING) {
                        hardRelease();
                        sleepQuiet(400);
                    }
                } catch (Exception ignored) {
                    /* ignore */
                }

                boolean ok = uhf.init("");
                if (!ok) {
                    sleepQuiet(800);
                    ok = uhf.init("");
                }
                if (!ok) {
                    lastError = "No se pudo conectar al lector R3 por USB";
                    connected.set(false);
                    sendJson(ex, 500, "{\"ok\":false,\"error\":\"" + escape(lastError) + "\"}");
                    return;
                }

                final long connectedAt = System.currentTimeMillis();
                uhf.setConnectionStateCallback(new ConnectionStateCallback() {
                    @Override
                    public void getState(ConnectionState connectionState, Object o) {
                        System.out.println("[R3Bridge] connectionState=" + connectionState);
                        if (connectionState == ConnectionState.DISCONNECTED) {
                            if (releasing.get()) return;
                            // Ignore spurious disconnects in the settle window after init.
                            if (System.currentTimeMillis() - connectedAt < 2500) {
                                System.out.println("[R3Bridge] ignoring early DISCONNECTED");
                                return;
                            }
                            synchronized (lock) {
                                inventory.set(false);
                                connected.set(false);
                                try {
                                    uhf.setConnectionStateCallback(null);
                                } catch (Exception ignored) {
                                }
                                try {
                                    uhf.setInventoryCallback(null);
                                } catch (Exception ignored) {
                                }
                                try {
                                    uhf.free();
                                } catch (Exception ignored) {
                                }
                            }
                        }
                    }
                });

                // R3 USB often rejects setEPCAndTIDMode; configure once after init.
                configureTidStrategy(true);
                lastError = null;

                connected.set(true);
                sendJson(ex, 200, statusJson());
            } catch (Throwable t) {
                lastError = t.getMessage() != null ? t.getMessage() : t.toString();
                connected.set(false);
                try {
                    hardRelease();
                } catch (Exception ignored) {
                }
                sendJson(ex, 500, "{\"ok\":false,\"error\":\"" + escape(lastError) + "\"}");
            }
        }
    }

    private void handleDisconnect(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        synchronized (lock) {
            disconnectInternal(true);
            lastError = null;
            sendJson(ex, 200, statusJson());
        }
    }

    private void handleInventoryStart(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        synchronized (lock) {
            if (!connected.get()) {
                sendJson(ex, 400, "{\"ok\":false,\"error\":\"Lector no conectado\"}");
                return;
            }
            // If already inventoring, keep reading (power was applied by /power if needed).
            if (inventory.get()) {
                lastError = null;
                sendJson(ex, 200, statusJson());
                return;
            }
            // Docs: while inventoring the module only accepts stopInventory().
            sleepQuiet(200);
            applyPowerSafe(powerLevels[0]);
            sleepQuiet(80);
            // Mode/beep already set on connect — do not reconfigure (can drop USB).
            boolean ok = startInventoryInternal();
            if (!ok) {
                lastError = "No se pudo iniciar el inventario";
                sendJson(ex, 500, "{\"ok\":false,\"error\":\"" + escape(lastError) + "\"}");
                return;
            }
            lastError = null;
            sendJson(ex, 200, statusJson());
        }
    }

    private void handleInventoryStop(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        synchronized (lock) {
            stopInventoryInternal();
            sendJson(ex, 200, statusJson());
        }
    }

    private void handleTags(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        long since = 0;
        String q = ex.getRequestURI().getRawQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                String[] kv = part.split("=", 2);
                if (kv.length == 2 && "since".equals(kv[0])) {
                    try {
                        since = Long.parseLong(kv[1]);
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        List<TagHit> list = new ArrayList<>();
        for (TagHit t : recentTags.values()) {
            if (t.seq > since) list.add(t);
        }
        list.sort((a, b) -> Long.compare(a.seq, b.seq));
        StringBuilder sb = new StringBuilder();
        sb.append("{\"ok\":true,\"tags\":[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(',');
            TagHit t = list.get(i);
            sb.append("{\"tid\":\"").append(escape(t.tid)).append("\"")
                    .append(",\"epc\":\"").append(escape(t.epc == null ? "" : t.epc)).append("\"")
                    .append(",\"seq\":").append(t.seq)
                    .append(",\"ts\":").append(t.ts)
                    .append(",\"count\":").append(t.count)
                    .append(",\"rssi\":").append(jsonNum(t.rssi))
                    .append('}');
        }
        sb.append("],\"cursor\":").append(tagSeq.get()).append('}');
        sendJson(ex, 200, sb.toString());
    }

    private void handleTagsClear(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        recentTags.clear();
        tidQueue.clear();
        tidQueuedEpcs.clear();
        resolvedEpcs.clear();
        reportedTids.clear();
        lastAcceptedReadAt.set(0);
        sendJson(ex, 200, "{\"ok\":true}");
    }

    /**
     * Allow a previously reported TID to be read again (e.g. user removed it from the UI list).
     * Body: {"tid":"ABC..."} or {"tids":["A","B"]}
     */
    private void handleTagsForget(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        String body = readBody(ex);
        List<String> tids = parseTidListBody(body);
        if (tids.isEmpty()) {
            sendJson(ex, 400, "{\"ok\":false,\"error\":\"tid requerido\"}");
            return;
        }
        int forgotten = 0;
        for (String raw : tids) {
            String tid = cleanHex(raw);
            if (tid.isEmpty()) continue;
            TagHit hit = recentTags.remove(tid);
            reportedTids.remove(tid);
            if (hit != null && hit.epc != null && !hit.epc.isEmpty()) {
                resolvedEpcs.remove(hit.epc);
                tidQueuedEpcs.remove(hit.epc);
            }
            // Also allow forgetting by EPC value if UI stored that by mistake.
            resolvedEpcs.remove(tid);
            tidQueuedEpcs.remove(tid);
            forgotten++;
            System.out.println("[R3Bridge] FORGET tid=" + tid + " (can be re-read)");
        }
        sendJson(ex, 200, "{\"ok\":true,\"forgotten\":" + forgotten + "}");
    }

    /** Parses {"tid":"X"} or {"tids":["X","Y"]}. */
    private static List<String> parseTidListBody(String body) {
        List<String> out = new ArrayList<>();
        if (body == null || body.isBlank()) return out;
        String single = extractJsonString(body, "tid");
        if (single != null && !single.isBlank()) out.add(single);
        // Simple array extract for "tids":["A","B"]
        int arr = body.indexOf("\"tids\"");
        if (arr >= 0) {
            int lb = body.indexOf('[', arr);
            int rb = body.indexOf(']', lb);
            if (lb >= 0 && rb > lb) {
                String inner = body.substring(lb + 1, rb);
                for (String part : inner.split(",")) {
                    String p = part.trim();
                    if (p.startsWith("\"") && p.endsWith("\"") && p.length() >= 2) {
                        out.add(p.substring(1, p.length() - 1));
                    }
                }
            }
        }
        return out;
    }

    private static String extractJsonString(String json, String key) {
        String pattern = "\"" + key + "\"";
        int found = json.indexOf(pattern);
        if (found < 0) return null;
        int colon = json.indexOf(':', found + pattern.length());
        if (colon < 0) return null;
        int q1 = json.indexOf('"', colon + 1);
        if (q1 < 0) return null;
        int q2 = json.indexOf('"', q1 + 1);
        if (q2 < 0) return null;
        return json.substring(q1 + 1, q2);
    }

    private void handlePower(HttpExchange ex) throws IOException {
        String method = ex.getRequestMethod();
        if ("GET".equalsIgnoreCase(method)) {
            if (connected.get()) {
                int p = safeGetPower(AntennaNameEnum.ANT1);
                if (p > 0) {
                    powerLevels = new int[]{p, p, p, p};
                }
            }
            sendJson(ex, 200, powerJson(true, null));
            return;
        }
        if (!"POST".equalsIgnoreCase(method)) {
            sendJson(ex, 405, "{\"ok\":false,\"error\":\"method\"}");
            return;
        }
        String body = readBody(ex);
        int[] next = parsePowerBody(body, powerLevels);
        if (next == null) {
            sendJson(ex, 400, "{\"ok\":false,\"error\":\"Potencia inválida (1-30)\"}");
            return;
        }
        synchronized (lock) {
            int target = clampPower(next[0]);
            powerLevels = new int[]{target, target, target, target};

            if (!connected.get()) {
                // Saved for next connect / inventory start.
                lastError = null;
                sendJson(ex, 200, powerJson(true, null));
                return;
            }

            // Vendor demo applies power while inventory is STOPPED.
            boolean wasInventory = inventory.get();
            if (wasInventory) {
                stopInventoryInternal();
                sleepQuiet(200);
            }

            boolean ok = applyPowerSafe(target);

            if (wasInventory) {
                boolean invOk = startInventoryInternal();
                if (!invOk) {
                    lastError = "Potencia aplicada pero no se pudo reiniciar el inventario";
                    sendJson(ex, 200, powerJson(ok, lastError));
                    return;
                }
            }

            // Always clear sticky warning on a completed power cycle.
            lastError = null;
            if (!ok) {
                // Memory level is set; hardware may report false on some firmware.
                // Do not fail the API (avoids UI "Conectado (con aviso)").
                System.out.println("[R3Bridge] setPower returned false; keeping level=" + target);
            }
            sendJson(ex, 200, powerJson(true, null));
        }
    }

    /**
     * Apply RF power while inventory is stopped.
     * RFIDWithUHFUsb implements IMultipleAntenna → setPower(AntennaNameEnum, int).
     * R3 USB: only ANT1 succeeds (ANT2–4 return false — expected).
     */
    private boolean applyPowerSafe(int level) {
        int target = clampPower(level);
        powerLevels = new int[]{target, target, target, target};

        boolean okAnt1 = false;
        try {
            okAnt1 = uhf.setPower(AntennaNameEnum.ANT1, target);
            System.out.println("[R3Bridge] setPower ANT1=" + target + " -> " + okAnt1);
        } catch (Exception e) {
            System.err.println("[R3Bridge] setPower ANT1 error: " + e.getMessage());
        }

        if (!okAnt1) {
            sleepQuiet(200);
            try {
                okAnt1 = uhf.setPower(AntennaNameEnum.ANT1, target);
                System.out.println("[R3Bridge] setPower ANT1 retry=" + target + " -> " + okAnt1);
            } catch (Exception e) {
                System.err.println("[R3Bridge] setPower ANT1 retry error: " + e.getMessage());
            }
        }

        if (okAnt1) {
            sleepQuiet(80);
            int read = safeGetPower(AntennaNameEnum.ANT1);
            if (read > 0) {
                powerLevels = new int[]{read, read, read, read};
                System.out.println("[R3Bridge] getPower ANT1=" + read);
            }
        }
        return okAnt1;
    }

    /**
     * Prefer EPC+TID inventory mode. On R3 USB the native call often fails;
     * then inventorio EPC and resolve TID with a short readData(Bank_TID).
     * @param force re-run even if already configured (only after fresh init)
     */
    private void configureTidStrategy(boolean force) {
        if (strategyConfigured && !force) return;

        // Hardware buzzer: 0=off, 1=on. Off avoids continuous noise.
        try {
            boolean beepOff = uhf.setBeep(0);
            System.out.println("[R3Bridge] setBeep(0) -> " + beepOff);
        } catch (Exception e) {
            System.out.println("[R3Bridge] setBeep skipped: " + e.getMessage());
        }

        epcTidModeActive = false;
        try {
            boolean modeOk = uhf.setEPCAndTIDMode();
            System.out.println("[R3Bridge] setEPCAndTIDMode -> " + modeOk);
            epcTidModeActive = modeOk;
        } catch (Exception e) {
            System.err.println("[R3Bridge] setEPCAndTIDMode error: " + e.getMessage());
        }

        // Do NOT call setEPCMode/setFastID after a failed EPC+TID — on this R3 they
        // also return false and can leave the USB session unstable.

        strategyConfigured = true;
        System.out.println("[R3Bridge] TID strategy="
                + (epcTidModeActive ? "inventory getTid()" : "readData(Bank_TID) fallback"));
    }

    private boolean startInventoryInternal() {
        if (inventory.get()) return true;

        uhf.setInventoryCallback(new IUHFInventoryCallback() {
            @Override
            public void callback(UHFTAGInfo info) {
                if (info == null) return;

                String tid = cleanHex(info.getTid());
                String epc = cleanHex(info.getEPC());
                String rssi = safeRssi(info);

                // Duplicates must NOT consume the 500 ms slot — otherwise the same
                // 2–3 strong tags monopolize the rate limit and weaker ones never report.
                if (!tid.isEmpty()) {
                    if (reportedTids.contains(tid)) {
                        return; // duplicate — silent (very frequent)
                    }
                    if (!tryAcceptReadSlot()) {
                        System.out.println("[R3Bridge] rate-limit drop NEW tid=" + tid + " epc=" + epc);
                        return;
                    }
                    if (reportedTids.add(tid)) {
                        recordTag(tid, epc, rssi);
                        System.out.println("[R3Bridge] ACCEPTED tid=" + tid
                                + " epc=" + epc
                                + " rssi=" + rssi
                                + " unique=" + reportedTids.size());
                    }
                    if (!epc.isEmpty()) resolvedEpcs.add(epc);
                    return;
                }

                if (epc.isEmpty()) {
                    System.out.println("[R3Bridge] skip empty tid+epc rssi=" + rssi);
                    return;
                }
                if (resolvedEpcs.contains(epc) || tidQueuedEpcs.contains(epc)) {
                    return; // already handled / pending
                }
                if (!tryAcceptReadSlot()) {
                    System.out.println("[R3Bridge] rate-limit drop NEW epc=" + epc);
                    return;
                }
                if (tidQueuedEpcs.add(epc)) {
                    tidQueue.offer(new PendingTid(epc, rssi));
                    System.out.println("[R3Bridge] QUEUE tid-resolve epc=" + epc
                            + " rssi=" + rssi
                            + " pending=" + tidQueue.size());
                    scheduleTidResolve();
                }
            }
        });
        boolean ok;
        try {
            ok = uhf.startInventoryTag();
        } catch (Exception e) {
            System.err.println("[R3Bridge] startInventoryTag error: " + e.getMessage());
            ok = false;
        }
        inventory.set(ok);
        System.out.println("[R3Bridge] startInventoryTag -> " + ok
                + " epcTidMode=" + epcTidModeActive);
        return ok;
    }

    /** Reserve a 500 ms slot only for a NEW tag (duplicates never call this). */
    private boolean tryAcceptReadSlot() {
        long now = System.currentTimeMillis();
        while (true) {
            long prev = lastAcceptedReadAt.get();
            if (now - prev < READ_MIN_INTERVAL_MS) return false;
            if (lastAcceptedReadAt.compareAndSet(prev, now)) return true;
        }
    }

    private void scheduleTidResolve() {
        if (!tidResolveBusy.compareAndSet(false, true)) return;
        tidResolveExec.execute(() -> {
            try {
                drainTidQueue();
            } finally {
                tidResolveBusy.set(false);
                if (!tidQueue.isEmpty()) scheduleTidResolve();
            }
        });
    }

    /** One pause → resolve all pending EPCs → resume (avoids reconnect storms). */
    private void drainTidQueue() {
        List<PendingTid> batch = new ArrayList<>();
        PendingTid p;
        while ((p = tidQueue.poll()) != null) {
            batch.add(p);
        }
        if (batch.isEmpty()) return;

        boolean wasInv;
        synchronized (lock) {
            if (!connected.get()) {
                for (PendingTid x : batch) tidQueuedEpcs.remove(x.epc);
                return;
            }
            wasInv = inventory.get();
            if (wasInv) {
                stopInventoryInternal();
            }
        }

        // USB I/O outside HTTP lock so /status and /connect stay responsive.
        synchronized (usbLock) {
            sleepQuiet(100);
            for (PendingTid pending : batch) {
                try {
                    String tid = readTidMemory(pending.epc);
                    if (tid != null && !tid.isEmpty()) {
                        System.out.println("[R3Bridge] TID via readData epc=" + pending.epc + " tid=" + tid
                                + " unique=" + (reportedTids.size() + (reportedTids.contains(tid) ? 0 : 1)));
                        resolvedEpcs.add(pending.epc);
                        if (reportedTids.add(tid)) {
                            recordTag(tid, pending.epc, pending.rssi);
                            System.out.println("[R3Bridge] ACCEPTED (readData) tid=" + tid
                                    + " epc=" + pending.epc
                                    + " unique=" + reportedTids.size());
                        }
                    } else {
                        resolvedEpcs.add(pending.epc);
                        System.err.println("[R3Bridge] TID readData failed for epc=" + pending.epc);
                    }
                } finally {
                    tidQueuedEpcs.remove(pending.epc);
                }
            }
        }

        synchronized (lock) {
            if (wasInv && connected.get() && !releasing.get() && !inventory.get()) {
                sleepQuiet(80);
                startInventoryInternal();
            }
        }
    }

    /**
     * Read TID bank for a tag identified by EPC. Keep attempts few — long loops
     * blocked the reader session and froze the UI on "Conectar".
     */
    private String readTidMemory(String epc) {
        String pwd = "00000000";
        int epcBits = Math.max(epc.length() * 4, 1);

        try {
            String data = uhf.readData(
                    pwd,
                    IUHF.Bank_EPC,
                    32,
                    epcBits,
                    epc,
                    IUHF.Bank_TID,
                    0,
                    6);
            String tid = cleanHex(data);
            if (!tid.isEmpty()) return tid;
        } catch (Exception e) {
            System.err.println("[R3Bridge] readData filter error: " + e.getMessage());
        }

        try {
            String data = uhf.readData(pwd, IUHF.Bank_TID, 0, 6);
            String tid = cleanHex(data);
            if (!tid.isEmpty()) return tid;
        } catch (Exception e) {
            System.err.println("[R3Bridge] readData TID error: " + e.getMessage());
        }
        return null;
    }

    private void recordTag(String tid, String epc, String rssi) {
        if (recentTags.containsKey(tid)) return;
        long seq = tagSeq.incrementAndGet();
        recentTags.put(tid, new TagHit(tid, epc, seq, System.currentTimeMillis(), 1, rssi));
        System.out.println("[R3Bridge] REPORT tagCount=" + recentTags.size()
                + " cursor=" + seq
                + " tids=" + recentTags.keySet());
        // One hardware beep on the R3 for each newly accepted tag.
        scheduleHardwareBeep();
    }

    /**
     * R3 API only has setBeep on/off for inventory (no one-shot).
     * Pattern: pause inventory → beep ON → inventorySingleTag (one chirp) → beep OFF → resume.
     */
    private void scheduleHardwareBeep() {
        if (!beepBusy.compareAndSet(false, true)) {
            // Queue a second beep after the current one finishes.
            beepExec.execute(() -> {
                sleepQuiet(200);
                if (beepBusy.compareAndSet(false, true)) {
                    try {
                        doHardwareBeep();
                    } finally {
                        beepBusy.set(false);
                    }
                }
            });
            return;
        }
        beepExec.execute(() -> {
            try {
                doHardwareBeep();
            } finally {
                beepBusy.set(false);
            }
        });
    }

    private void doHardwareBeep() {
        synchronized (usbLock) {
            if (!connected.get() || releasing.get()) return;

            boolean wasInv;
            synchronized (lock) {
                wasInv = inventory.get();
                if (wasInv) {
                    stopInventoryInternal();
                }
            }

            try {
                boolean on = uhf.setBeep(1);
                System.out.println("[R3Bridge] hardware beep setBeep(1) -> " + on);
                sleepQuiet(40);
                try {
                    // With buzzer ON, a single inventory cycle produces one chirp.
                    UHFTAGInfo hit = uhf.inventorySingleTag();
                    System.out.println("[R3Bridge] inventorySingleTag for beep -> "
                            + (hit != null ? "tag" : "null"));
                } catch (Exception e) {
                    System.out.println("[R3Bridge] inventorySingleTag beep: " + e.getMessage());
                }
                sleepQuiet(60);
            } catch (Exception e) {
                System.err.println("[R3Bridge] hardware beep error: " + e.getMessage());
            } finally {
                try {
                    uhf.setBeep(0);
                } catch (Exception ignored) {
                }
            }

            synchronized (lock) {
                if (wasInv && connected.get() && !releasing.get() && !inventory.get()) {
                    sleepQuiet(50);
                    startInventoryInternal();
                }
            }
        }
    }

    /** Trim + uppercase only. */
    private static String cleanHex(String raw) {
        if (raw == null) return "";
        return raw.trim().toUpperCase(Locale.ROOT);
    }

    private static final class PendingTid {
        final String epc;
        final String rssi;

        PendingTid(String epc, String rssi) {
            this.epc = epc;
            this.rssi = rssi;
        }
    }

    private int safeGetPower(AntennaNameEnum ant) {
        try {
            return uhf.getPower(ant);
        } catch (Exception e) {
            return -1;
        }
    }

    private void stopInventoryInternal() {
        try {
            uhf.stopInventory();
        } catch (Exception ignored) {
        }
        inventory.set(false);
        sleepQuiet(150);
    }

    /** Full USB release matching vendor demo: clear callbacks, then free(). */
    private void hardRelease() {
        releasing.set(true);
        try {
            stopInventoryInternal();
            try {
                uhf.setConnectionStateCallback(null);
            } catch (Exception ignored) {
            }
            try {
                uhf.setInventoryCallback(null);
            } catch (Exception ignored) {
            }
            try {
                uhf.free();
            } catch (Exception ignored) {
            }
        } finally {
            connected.set(false);
            inventory.set(false);
            strategyConfigured = false;
            epcTidModeActive = false;
            releasing.set(false);
        }
    }

    private void disconnectInternal(boolean settle) {
        hardRelease();
        if (settle) sleepQuiet(400);
    }

    private static void sleepQuiet(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String statusJson() {
        String state = connected.get() ? "CONNECTED" : "DISCONNECTED";
        try {
            ConnectionState st = uhf.getConnectStatus();
            if (connected.get() && st != null) state = st.name();
        } catch (Exception ignored) {
        }
        return "{"
                + "\"ok\":true"
                + ",\"connected\":" + connected.get()
                + ",\"inventory\":" + inventory.get()
                + ",\"state\":\"" + escape(state) + "\""
                + ",\"lastError\":" + (lastError == null ? "null" : "\"" + escape(lastError) + "\"")
                + ",\"power\":" + powerArrayJson()
                + ",\"tagCount\":" + recentTags.size()
                + ",\"cursor\":" + tagSeq.get()
                + "}";
    }

    private String powerJson(boolean ok, String error) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        sb.append("\"ok\":").append(ok);
        sb.append(",\"connected\":").append(connected.get());
        sb.append(",\"power\":").append(powerArrayJson());
        sb.append(",\"min\":1,\"max\":30");
        if (error != null) sb.append(",\"error\":\"").append(escape(error)).append("\"");
        sb.append('}');
        return sb.toString();
    }

    private String powerArrayJson() {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"ant1\":").append(powerLevels[0]).append(',');
        sb.append("\"ant2\":").append(powerLevels[1]).append(',');
        sb.append("\"ant3\":").append(powerLevels[2]).append(',');
        sb.append("\"ant4\":").append(powerLevels[3]);
        sb.append('}');
        return sb.toString();
    }

    private static int[] parsePowerBody(String body, int[] current) {
        if (body == null || body.isBlank()) return null;
        int[] next = current.clone();
        // Prefer explicit "power" key only when it is a top-level field (not part of antN).
        Integer all = extractIntKey(body, "power");
        if (all != null) {
            int p = clampPower(all);
            for (int i = 0; i < next.length; i++) next[i] = p;
            return next;
        }
        Integer a1 = extractIntKey(body, "ant1");
        Integer a2 = extractIntKey(body, "ant2");
        Integer a3 = extractIntKey(body, "ant3");
        Integer a4 = extractIntKey(body, "ant4");
        if (a1 == null && a2 == null && a3 == null && a4 == null) return null;
        if (a1 != null) next[0] = clampPower(a1);
        if (a2 != null) next[1] = clampPower(a2);
        if (a3 != null) next[2] = clampPower(a3);
        if (a4 != null) next[3] = clampPower(a4);
        return next;
    }

    /** Extracts {"key": 12} without matching longer keys. */
    private static Integer extractIntKey(String json, String key) {
        String pattern = "\"" + key + "\"";
        int i = 0;
        while (i < json.length()) {
            int found = json.indexOf(pattern, i);
            if (found < 0) return null;
            int after = found + pattern.length();
            // Ensure it's not a prefix of a longer key like "powerX"
            if (after < json.length()) {
                char c = json.charAt(after);
                if (c != '"' && Character.isLetterOrDigit(c)) {
                    i = after;
                    continue;
                }
            }
            int colon = json.indexOf(':', after);
            if (colon < 0) return null;
            int j = colon + 1;
            while (j < json.length() && Character.isWhitespace(json.charAt(j))) j++;
            int k = j;
            if (k < json.length() && json.charAt(k) == '-') k++;
            while (k < json.length() && Character.isDigit(json.charAt(k))) k++;
            if (k == j || (k == j + 1 && json.charAt(j) == '-')) return null;
            try {
                return Integer.parseInt(json.substring(j, k));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static int clampPower(int p) {
        if (p < 1) return 1;
        if (p > 30) return 30;
        return p;
    }

    private static String safeRssi(UHFTAGInfo info) {
        try {
            return info.getRssi();
        } catch (Exception e) {
            return null;
        }
    }

    private static String jsonNum(String rssi) {
        if (rssi == null || rssi.isBlank()) return "null";
        try {
            Double.parseDouble(rssi.trim());
            return rssi.trim();
        } catch (Exception e) {
            return "\"" + escape(rssi) + "\"";
        }
    }

    private static String readBody(HttpExchange ex) throws IOException {
        try (InputStream in = ex.getRequestBody(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) >= 0) bos.write(buf, 0, n);
            return bos.toString(StandardCharsets.UTF_8);
        }
    }

    private static void sendJson(HttpExchange ex, int code, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        Headers h = ex.getResponseHeaders();
        h.set("Content-Type", "application/json; charset=utf-8");
        h.set("Access-Control-Allow-Origin", "*");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ");
    }

    private static final class TagHit {
        final String tid;
        final String epc;
        final long seq;
        final long ts;
        final int count;
        final String rssi;

        TagHit(String tid, String epc, long seq, long ts, int count, String rssi) {
            this.tid = tid;
            this.epc = epc;
            this.seq = seq;
            this.ts = ts;
            this.count = count;
            this.rssi = rssi;
        }
    }
}
