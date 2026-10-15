/*
  BUBOSOFT SHIELD - ESP32-WROVER 30-pin sample-data simulator
  TEST ONLY: sends simulated data to Firebase Realtime Database using REST.
  Replace WIFI_SSID and WIFI_PASSWORD on your local computer.
  Do NOT commit real Wi-Fi credentials to GitHub.
  This sketch does not control motors, relays, heaters, or the Nextion HMI.
  
  Arduino IDE libraries: ESP32 board package (WiFi.h and HTTPClient.h are included).
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* FIREBASE_HOST = "https://bubosoft-shield-default-rtdb.firebaseio.com";

unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 5000;
unsigned long demoTick = 0;

bool putJson(const String& path, const String& payload) {
  WiFiClientSecure client;
  client.setInsecure(); // Demo convenience only; use certificate validation for production.
  HTTPClient http;
  String url = String(FIREBASE_HOST) + path + ".json";
  if (!http.begin(client, url)) {
    Serial.println("Could not start HTTPS request.");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  int code = http.PUT(payload);
  String response = http.getString();
  Serial.printf("PUT %s -> HTTP %d\n", path.c_str(), code);
  if (code < 200 || code >= 300) Serial.println(response);
  http.end();
  return code >= 200 && code < 300;
}

bool postJson(const String& path, const String& payload) {
  WiFiClientSecure client;
  client.setInsecure(); // Demo convenience only; use certificate validation for production.
  HTTPClient http;
  String url = String(FIREBASE_HOST) + path + ".json";
  if (!http.begin(client, url)) return false;
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);
  String response = http.getString();
  Serial.printf("POST %s -> HTTP %d\n", path.c_str(), code);
  if (code < 200 || code >= 300) Serial.println(response);
  http.end();
  return code >= 200 && code < 300;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 25000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection timed out. Check SSID/password.");
  }
}

void sendDemoData() {
  // Cycle through demo states so the website can be tested.
  const char* machineState;
  const char* currentStage;
  bool middleBlocked;
  bool bottomBlocked;
  bool halfLiquid;
  bool fullLiquid;
  int phase = (demoTick / 6) % 4;

  if (phase == 0) {
    machineState = "standby"; currentStage = "none";
    middleBlocked = true; bottomBlocked = true;
    halfLiquid = true; fullLiquid = true;
  } else if (phase == 1) {
    machineState = "running"; currentStage = "separation";
    middleBlocked = true; bottomBlocked = false;
    halfLiquid = true; fullLiquid = false;
  } else if (phase == 2) {
    machineState = "running"; currentStage = "repellentMixing";
    middleBlocked = false; bottomBlocked = true;
    halfLiquid = true; fullLiquid = false;
  } else {
    machineState = "completed"; currentStage = "cottonFilling";
    middleBlocked = true; bottomBlocked = false;
    halfLiquid = true; fullLiquid = true;
  }

  String latest = "{";
  latest += "\"demoMode\":true,";
  latest += "\"machineStatus\":\"" + String(machineState) + "\",";
  latest += "\"currentStage\":\"" + String(currentStage) + "\",";
  latest += "\"updatedAt\":" + String((unsigned long)(millis() / 1000)) + ",";
  latest += "\"sensors\":{";
  latest += "\"middleCottonLaser\":\"" + String(middleBlocked ? "BLOCKED" : "CLEAR") + "\",";
  latest += "\"bottomCottonLaser\":\"" + String(bottomBlocked ? "BLOCKED" : "CLEAR") + "\",";
  latest += "\"halfLiquidSensor\":" + String(halfLiquid ? "true" : "false") + ",";
  latest += "\"fullLiquidSensor\":" + String(fullLiquid ? "true" : "false");
  latest += "}}";

  bool latestOk = putJson("/machine/latest", latest);

  // Demo production totals. These are simulated counters, not real production.
  int simulatedPillows = (int)(demoTick / 4);
  int simulatedRepellentMl = (int)(demoTick * 125);
  String summary = "{";
  summary += "\"demoMode\":true,";
  summary += "\"repellentProducedMl\":" + String(simulatedRepellentMl) + ",";
  summary += "\"pillowsProduced\":" + String(simulatedPillows) + ",";
  summary += "\"completedBatches\":" + String((int)(demoTick / 12)) + ",";
  summary += "\"interruptedBatches\":0";
  summary += "}";
  bool summaryOk = putJson("/production/summary", summary);

  // Add an event only on the first tick of a new phase, avoiding an event every 5 seconds.
  if (demoTick % 6 == 0) {
    String eventType = phase == 0 ? "demo_standby" :
                       phase == 1 ? "process_started" :
                       phase == 2 ? "repellent_mixing" : "process_completed";
    String event = "{";
    event += "\"type\":\"" + eventType + "\",";
    event += "\"details\":\"SIMULATED DATA - NOT A REAL MACHINE EVENT\",";
    event += "\"demoMode\":true,";
    event += "\"elapsedSeconds\":" + String((unsigned long)(millis() / 1000));
    event += "}";
    postJson("/production/history", event);

    if (phase == 3) {
      String notification = "{";
      notification += "\"type\":\"Process completed\",";
      notification += "\"message\":\"Demo process completed (simulated data)\",";
      notification += "\"demoMode\":true,";
      notification += "\"elapsedSeconds\":" + String((unsigned long)(millis() / 1000));
      notification += "}";
      postJson("/notifications", notification);
    }
  }

  Serial.println(latestOk && summaryOk ? "Demo data sent." : "One or more Firebase writes failed.");
  demoTick++;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(500);
    return;
  }
  if (millis() - lastSend >= SEND_INTERVAL_MS) {
    lastSend = millis();
    sendDemoData();
  }
}
