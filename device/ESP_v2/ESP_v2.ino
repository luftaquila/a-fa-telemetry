#include <Wire.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <SocketIOclient.h>

#define ALWAYS_ACK false

SocketIOclient socketIO;

char rtc[19];
bool stm_acked = false;
bool rtc_fixed = false;
bool sync_done = false;

const char ssid[] = "A-FA ECU";
const char pwd[] = "55555555";

void setup() {
  Serial.begin(115200);

  Wire.onReceive(rcv);
  Wire.begin(0x71, 22, 21, 400000);

  // init Wi-Fi
  WiFi.disconnect();

  if (WiFi.getMode() & WIFI_AP) {
    WiFi.softAPdisconnect(true);
  }

  WiFi.begin(ssid, pwd);

  while (WiFi.status() != WL_CONNECTED) {
    delay(100);
  }

  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);

  // attach socket
  socketIO.begin("a-fa.luftaquila.io", 80, "/socket.io/?EIO=4&device=ECU");
  socketIO.onEvent(socketIOEvent);
}

void loop() {
  socketIO.loop();

  if (!sync_done && stm_acked && rtc_fixed) {
    Serial.printf("$ESP %.*s\n", 19, rtc);
    sync_done = true;
  }
}

void socketIOEvent(socketIOmessageType_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case sIOtype_CONNECT:
      // join default namespace (no auto join in Socket.IO V3)
      socketIO.send(sIOtype_CONNECT, "/");
      break;

    case sIOtype_EVENT: {
      StaticJsonDocument<64> json;
      DeserializationError jsonError = deserializeJson(json, payload, length);

      if (jsonError) {
        return;
      }

      const char *event = json[0];
      strncpy(rtc, json[1]["datetime"], 19);

      if (strcmp(event, "rtc_fix") == 0) {
        rtc_fixed = true;
      }
      break;
    }

    case sIOtype_DISCONNECT:
      if (WiFi.status() != WL_CONNECTED) {
        WiFi.reconnect();
      }
      break;

    case sIOtype_ACK:
    case sIOtype_ERROR:
    case sIOtype_BINARY_EVENT:
    case sIOtype_BINARY_ACK:
    default:
      break;
  }
}

void rcv(int len) {
  int i = 0;
  char buffer[20];

  while (Wire.available()) {
    if (i < 20) {
      buffer[i++] = Wire.read();
    } else {
      Wire.read(); // just flush buffers
    }
  }

  // STM32 handshake
  if (ALWAYS_ACK || !stm_acked) {
    if (strncmp(buffer, "READY", 5) == 0) {
      stm_acked = true;
      Serial.println("ACK");
    }
  }

  // log received
  else if (i == 16) {
    char payload[36];
    const char *payload_prefix = "[\"tlog\",{\"log\":\"";
    const char *payload_postfix = "\"}]";

    strcat(payload, payload_prefix);
    strncat(payload, buffer, 16);
    strcat(payload, payload_postfix);

    socketIO.sendEVENT(payload);
  }
}
