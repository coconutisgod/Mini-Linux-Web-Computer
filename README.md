# Mini Linux Web Computer for GitHub Codespaces

This project turns a GitHub Codespace into a small Linux computer you can open from a browser.

It includes:

- XFCE Linux desktop through noVNC
- Chromium
- file explorer
- terminal
- Java
- Node.js dashboard
- ESP32 WROOM WebSocket bridge

This is good for learning, ESP32 experiments, browser apps, scripts, and light Linux work. It is not a free gaming PC, and it is not always-on after the Codespace stops.

## Start It On GitHub

1. Create a new GitHub repository.
2. Upload all files from this folder into the repo.
3. Open the repo on GitHub.
4. Click **Code** -> **Codespaces** -> **Create codespace on main**.
5. Wait for the container setup to finish.

The services start automatically:

- Dashboard and ESP32 bridge: port `3000`
- Linux desktop through noVNC: port `6080`

If they do not start, run:

```bash
bash scripts/start-services.sh
```

## Open The Linux Desktop

In the Codespaces **Ports** tab:

1. Open port `6080`.
2. Add `/vnc.html` to the URL if needed.
3. Enter the VNC password.

To see the generated VNC password:

```bash
cat ~/.vnc/generated-password
```

Inside the desktop you should see shortcuts for:

- Chromium
- File Explorer
- Terminal

## Open The Dashboard

Open port `3000`.

Default dashboard token:

```text
admin-dev-token
```

The dashboard can:

- open Chromium in the desktop
- open the file explorer
- open a terminal
- show storage/memory/Java info
- show ESP32 messages
- send commands to the ESP32

## Connect An ESP32 WROOM

In GitHub Codespaces, make port `3000` public so the ESP32 can reach it.

Use this Arduino sketch:

```text
esp32/esp32_websocket_client.ino
```

Install these Arduino IDE libraries:

- `WebSockets` by Markus Sattler / Links2004
- `ArduinoJson` by Benoit Blanchon

Edit these values in the sketch:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* WS_HOST = "YOUR-CODESPACE-3000.app.github.dev";
const char* DEVICE_TOKEN = "device-dev-token";
```

Use only the host name for `WS_HOST`, without `https://`.

## Set Real Tokens

The default tokens are for testing only. For real use, set these Codespaces secrets:

```text
ADMIN_TOKEN
DEVICE_TOKEN
VNC_PASSWORD
```

Then rebuild or restart the Codespace.

## What This Can And Cannot Do

Can do:

- run a Linux desktop in your browser
- browse the web with Chromium
- manage files
- run Java/Node/Python-style projects
- send and receive ESP32 data
- test your cloud-computer idea

Cannot do well:

- stay online forever
- run Windows `.exe` apps directly
- play Call of Duty or heavy games
- act like a powerful cloud gaming PC

For always-free 24/7 use, move the server part to a Google Cloud always-free VM later.
