const statusEl = document.querySelector("#status");
const outputEl = document.querySelector("#output");
const deviceListEl = document.querySelector("#deviceList");
const adminTokenEl = document.querySelector("#adminToken");
const desktopLink = document.querySelector("#desktopLink");
const connectBtn = document.querySelector("#connectBtn");
const customCommandEl = document.querySelector("#customCommand");
const sendCustomBtn = document.querySelector("#sendCustom");

let socket;
let devices = [];

adminTokenEl.value = localStorage.getItem("adminToken") || "admin-dev-token";
desktopLink.href = deriveDesktopUrl();

connectBtn.addEventListener("click", connect);
sendCustomBtn.addEventListener("click", () => {
  sendCommand(customCommandEl.value.trim() || "hello");
});

document.querySelectorAll("[data-task]").forEach(button => {
  button.addEventListener("click", () => {
    send({ type: "task", task: button.dataset.task });
  });
});

document.querySelectorAll("[data-command]").forEach(button => {
  button.addEventListener("click", () => {
    sendCommand(button.dataset.command);
  });
});

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }

  const token = adminTokenEl.value.trim();
  localStorage.setItem("adminToken", token);
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}/admin?token=${encodeURIComponent(token)}`);

  statusEl.textContent = "Connecting...";
  statusEl.className = "status pending";

  socket.addEventListener("open", () => {
    statusEl.textContent = "Connected";
    statusEl.className = "status online";
  });

  socket.addEventListener("close", () => {
    statusEl.textContent = "Disconnected";
    statusEl.className = "status offline";
  });

  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (Array.isArray(message.devices)) {
      devices = message.devices.filter(Boolean);
      renderDevices();
    }
    log(message);
  });
}

function sendCommand(command) {
  const deviceId = devices[0]?.id || "esp32-wroom";
  send({
    type: "command",
    deviceId,
    command
  });
}

function send(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    log({ type: "error", error: "Dashboard is not connected." });
    return;
  }
  socket.send(JSON.stringify(payload));
}

function renderDevices() {
  if (!devices.length) {
    deviceListEl.textContent = "No devices online.";
    return;
  }
  deviceListEl.innerHTML = devices.map(device => `
    <div class="device">
      <strong>${escapeHtml(device.id)}</strong>
      <span>Last seen ${escapeHtml(device.lastSeen)}</span>
    </div>
  `).join("");
}

function log(message) {
  const text = JSON.stringify(message, null, 2);
  outputEl.textContent = `${new Date().toLocaleTimeString()} ${text}\n\n${outputEl.textContent}`;
}

function deriveDesktopUrl() {
  const url = new URL(location.href);
  if (url.hostname.includes("-3000.")) {
    url.hostname = url.hostname.replace("-3000.", "-6080.");
  } else {
    url.port = "6080";
  }
  url.pathname = "/vnc.html";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

connect();
