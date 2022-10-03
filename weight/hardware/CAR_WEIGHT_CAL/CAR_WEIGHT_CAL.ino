#include <HX711.h>

#define CAL
#define DOUT  6
#define CLK   7

#define SAMPLING_COUNT 100

HX711 SCALE(DOUT, CLK);

void setup() {
  Serial.begin(9600);
  
  SCALE.set_scale();
  SCALE.tare();

  Serial.println("Calibration start");
}

void loop() {
  static int count = 1;
  Serial.print("#");
  Serial.print(count++);
  Serial.print(": ");
  Serial.println(SCALE.get_units(SAMPLING_COUNT), 1);
}
