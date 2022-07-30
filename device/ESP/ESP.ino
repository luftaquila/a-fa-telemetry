#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Hash.h>

ESP8266WiFiMulti WiFiMulti;
SocketIOclient socketIO;

const char ssid[] = "A-FA ECU";
const char pwd[] = "55555555";

void socketIOEvent(socketIOmessageType_t type, uint8_t* payload, size_t length) {
  switch(type) {
    case sIOtype_DISCONNECT:
      Serial.printf("$ESP SOCKET_DISCONNECTED\n");
      if (WiFiMulti.run() != WL_CONNECTED) WiFi.reconnect();
      break;

    case sIOtype_CONNECT:
      Serial.printf("$ESP SOCKET_CONNECTED\n");
      socketIO.send(sIOtype_CONNECT, "/"); // join default namespace (no auto join in Socket.IO V3)
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


void setup() {
  Serial.begin(74880);
  Serial.setTimeout(10);
  
  // init AP
  if(WiFi.getMode() & WIFI_AP) WiFi.softAPdisconnect(true);
  WiFiMulti.addAP(ssid, pwd);

  // AP connect
  Serial.printf("\n\n$ESP STARTUP\n");
  while(WiFiMulti.run() != WL_CONNECTED) delay(100);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  Serial.printf("$ESP READY: %s\n", WiFi.localIP().toString().c_str());

  // socket attach
  socketIO.begin("a-fa.luftaquila.io", 80, "/socket.io/?EIO=4&device=ECU");
  
  // socket event handler
  socketIO.onEvent(socketIOEvent);
}

void loop() {
  socketIO.loop();

  // read UART
  String rxs = Serial.readStringUntil('\0');
  
  socketIO.loop();

  if(rxs.length()) {
    // Socket.emit
    DynamicJsonDocument payload(250);
    JsonArray array = payload.to<JsonArray>();
    socketIO.loop();
  
    array.add("telemetry");
    JsonObject param = array.createNestedObject();
    param["log"] = rxs;
    socketIO.loop();
  
    String output;
    serializeJson(payload, output);
    socketIO.sendEVENT(output);
  }
}
