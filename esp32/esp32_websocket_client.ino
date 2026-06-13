/*
  ESP32 WROOM client for the Mini Linux Web Computer.

  Arduino IDE libraries:
  - WebSockets by Markus Sattler / Links2004
  - ArduinoJson by Benoit Blanchon

  In GitHub Codespaces, make port 3000 public and use its HTTPS host.
  Example URL:
    https://your-codespace-name-3000.app.github.dev

  Put only the host below:
    your-codespace-name-3000.app.github.dev
*/

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* WS_HOST = "YOUR-CODESPACE-3000.app.github.dev";
const uint16_t WS_PORT = 443;
const char* DEVICE_TOKEN = "device-dev-token";
const char* DEVICE_ID = "esp32-wroom";

const int LED_PIN = 2;

WebSocketsClient webSocket;
unsigned long lastTelemetry = 0;

void sendJson(JsonDocument& doc) {
  String payload;
  serializeJson(doc, payload);
  webSocket.sendTXT(payload);
}

void sendStatus(const char* reason) {
  StaticJsonDocument<256> doc;
  doc["type"] = "status";
  doc["deviceId"] = DEVICE_ID;
  doc["reason"] = reason;
  doc["uptimeMs"] = millis();
  doc["wifiRssi"] = WiFi.RSSI();
  doc["led"] = digitalRead(LED_PIN) == HIGH;
  sendJson(doc);
}

void handleMessage(uint8_t* payload, size_t length) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) {
    return;
  }

  const char* command = doc["command"] | "";

  if (strcmp(command, "led_on") == 0) {
    digitalWrite(LED_PIN, HIGH);
    sendStatus("led_on");
  } else if (strcmp(command, "led_off") == 0) {
    digitalWrite(LED_PIN, LOW);
    sendStatus("led_off");
  } else if (strcmp(command, "ping") == 0) {
    sendStatus("pong");
  } else {
    StaticJsonDocument<192> reply;
    reply["type"] = "unknown_command";
    reply["command"] = command;
    sendJson(reply);
  }
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      sendStatus("connected");
      break;
    case WStype_TEXT:
      handleMessage(payload, length);
      break;
    case WStype_DISCONNECTED:
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected");

  String path = String("/device?token=") + DEVICE_TOKEN + "&deviceId=" + DEVICE_ID;
  webSocket.beginSSL(WS_HOST, WS_PORT, path.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();

  if (millis() - lastTelemetry > 5000) {
    lastTelemetry = millis();
    sendStatus("telemetry");
  }
}
