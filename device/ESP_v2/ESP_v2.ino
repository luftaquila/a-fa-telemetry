#include <Wire.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <SocketIOclient.h>

SocketIOclient socketIO;

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
}

void socketIOEvent(socketIOmessageType_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case sIOtype_DISCONNECT:
      Serial.printf("$ESP SOCKET_DISCONNECTED\n");

      if (WiFi.status() != WL_CONNECTED) {
        WiFi.reconnect();
      }
      break;

    case sIOtype_CONNECT:
      // join default namespace (no auto join in Socket.IO V3)
      socketIO.send(sIOtype_CONNECT, "/");
      break;

    case sIOtype_EVENT: {
      DynamicJsonDocument content(100);
      DeserializationError contentError = deserializeJson(content, payload, length);
      if(contentError) return;
      socketIO.loop();
      
      String event = content[0];
      String data = content[1]["datetime"];
      socketIO.loop();

      if(event == String("rtc_fix")) Serial.printf("$ESP RTC_FIX %s\n", data.c_str());
      break;
    }

    case sIOtype_ACK:
      Serial.printf("$ESP SOCKET_ACT\n");
      break;

    case sIOtype_ERROR:
      Serial.printf("$ESP SOCKET_ERROR\n");
      break;

    case sIOtype_BINARY_EVENT:
      Serial.printf("$ESP SOCKET_BINARY\n");
      break;

    case sIOtype_BINARY_ACK:
      Serial.printf("$ESP SOCKET_BINARY_ACK\n");
      break;
  }
}

void rcv(int len) {
  int i = 0;
  char buffer[10];

  while (Wire.available()) {
    buffer[i++] = Wire.read();
    if (i > 16) {
      return;
    }
  }
  buffer[i] = '\0';

  if (strncmp(buffer, "READY", 5) == 0) {
    Serial.println("ACK");
  }
}