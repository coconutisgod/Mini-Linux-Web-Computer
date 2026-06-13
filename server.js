const express = require("express");
const http = require("http");
const { spawn } = require("child_process");
const { WebSocket, WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin-dev-token";
const DEVICE_TOKEN = process.env.DEVICE_TOKEN || "device-dev-token";
const MAX_OUTPUT = 12000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const admins = new Set();
const devices = new Map();
const recentMessages = [];

app.use(express.static("public"));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    devices: [...devices.keys()],
    desktopPort: 6080
  });
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token") || "";
  const isAdmin = url.pathname === "/admin" && token === ADMIN_TOKEN;
  const isDevice = url.pathname === "/device" && token === DEVICE_TOKEN;

  if (!isAdmin && !isDevice) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, ws => {
    ws.role = isAdmin ? "admin" : "device";
    ws.deviceId = url.searchParams.get("deviceId") || "esp32-wroom";
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", ws => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  if (ws.role === "admin") {
    admins.add(ws);
    send(ws, {
      type: "hello",
      role: "admin",
      devices: deviceList(),
      recentMessages
    });
  } else {
    devices.set(ws.deviceId, {
      id: ws.deviceId,
      connectedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      socket: ws
    });
    broadcastAdmins({
      type: "device_online",
      device: publicDevice(ws.deviceId)
    });
  }

  ws.on("message", raw => {
    const message = parseMessage(raw);
    if (!message) {
      send(ws, { type: "error", error: "Message must be valid JSON." });
      return;
    }

    if (ws.role === "device") {
      const device = devices.get(ws.deviceId);
      if (device) {
        device.lastSeen = new Date().toISOString();
      }
      record({
        direction: "device_to_server",
        deviceId: ws.deviceId,
        payload: message
      });
      broadcastAdmins({
        type: "device_message",
        deviceId: ws.deviceId,
        payload: message
      });
      return;
    }

    handleAdminMessage(ws, message);
  });

  ws.on("close", () => {
    if (ws.role === "admin") {
      admins.delete(ws);
      return;
    }
    devices.delete(ws.deviceId);
    broadcastAdmins({
      type: "device_offline",
      deviceId: ws.deviceId,
      devices: deviceList()
    });
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

function handleAdminMessage(ws, message) {
  if (message.type === "command") {
    const deviceId = message.deviceId || "esp32-wroom";
    const target = devices.get(deviceId);
    if (!target) {
      send(ws, { type: "error", error: `Device is not online: ${deviceId}` });
      return;
    }
    const payload = {
      type: "command",
      command: String(message.command || ""),
      value: message.value ?? null,
      sentAt: new Date().toISOString()
    };
    send(target.socket, payload);
    record({ direction: "server_to_device", deviceId, payload });
    broadcastAdmins({ type: "command_sent", deviceId, payload });
    return;
  }

  if (message.type === "task") {
    runTask(message.task, ws);
    return;
  }

  send(ws, { type: "error", error: "Unknown admin message type." });
}

const tasks = {
  date: {
    title: "System date",
    command: "date",
    args: []
  },
  storage: {
    title: "Storage",
    command: "df",
    args: ["-h", "."]
  },
  memory: {
    title: "Memory",
    command: "free",
    args: ["-h"]
  },
  node: {
    title: "Node.js version",
    command: "node",
    args: ["--version"]
  },
  java: {
    title: "Java version",
    command: "java",
    args: ["-version"]
  },
  list_home: {
    title: "Home folder",
    command: "ls",
    args: ["-la", process.env.HOME || "/home/vscode"]
  },
  open_chromium: {
    title: "Open Chromium in desktop",
    command: "chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "https://www.google.com"],
    gui: true,
    detached: true
  },
  open_files: {
    title: "Open file explorer in desktop",
    command: "thunar",
    args: [process.env.HOME || "/home/vscode"],
    gui: true,
    detached: true
  },
  open_terminal: {
    title: "Open terminal in desktop",
    command: "xfce4-terminal",
    args: [],
    gui: true,
    detached: true
  }
};

function runTask(name, ws) {
  const task = tasks[name];
  if (!task) {
    send(ws, { type: "task_result", task: name, ok: false, output: "Unknown task." });
    return;
  }

  const child = spawn(task.command, task.args, {
    env: {
      ...process.env,
      DISPLAY: task.gui ? ":1" : process.env.DISPLAY || ":1"
    },
    detached: Boolean(task.detached),
    stdio: task.detached ? "ignore" : ["ignore", "pipe", "pipe"]
  });

  if (task.detached) {
    child.unref();
    send(ws, {
      type: "task_result",
      task: name,
      ok: true,
      output: `${task.title} launched in the noVNC desktop.`
    });
    return;
  }

  let output = "";
  const timer = setTimeout(() => {
    child.kill("SIGTERM");
  }, 8000);

  child.stdout.on("data", chunk => {
    output = trimOutput(output + chunk.toString());
  });

  child.stderr.on("data", chunk => {
    output = trimOutput(output + chunk.toString());
  });

  child.on("close", code => {
    clearTimeout(timer);
    send(ws, {
      type: "task_result",
      task: name,
      ok: code === 0,
      output: output || `(exited with code ${code})`
    });
  });

  child.on("error", error => {
    clearTimeout(timer);
    send(ws, {
      type: "task_result",
      task: name,
      ok: false,
      output: error.message
    });
  });
}

function parseMessage(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastAdmins(payload) {
  for (const ws of admins) {
    send(ws, { ...payload, devices: deviceList() });
  }
}

function record(entry) {
  recentMessages.unshift({
    ...entry,
    at: new Date().toISOString()
  });
  recentMessages.splice(50);
}

function deviceList() {
  return [...devices.keys()].map(publicDevice);
}

function publicDevice(id) {
  const device = devices.get(id);
  if (!device) {
    return null;
  }
  return {
    id,
    connectedAt: device.connectedAt,
    lastSeen: device.lastSeen
  };
}

function trimOutput(value) {
  if (value.length <= MAX_OUTPUT) {
    return value;
  }
  return value.slice(value.length - MAX_OUTPUT);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Mini computer dashboard listening on http://0.0.0.0:${PORT}`);
  console.log("Default admin token: admin-dev-token");
  console.log("Default device token: device-dev-token");
});
