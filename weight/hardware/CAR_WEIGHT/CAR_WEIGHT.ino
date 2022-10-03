#include <HX711.h>

#define FL_CAL   26484.0
#define FL_DOUT  2
#define FL_CLK   3

#define RL_CAL   26566.0
#define RL_DOUT  4
#define RL_CLK   5

#define FR_CAL   24403.0
#define FR_DOUT  6
#define FR_CLK   7

#define RR_CAL   28080.0
#define RR_DOUT  8
#define RR_CLK   9

HX711 FL(FL_DOUT, FL_CLK);
HX711 RL(RL_DOUT, RL_CLK);
HX711 FR(FR_DOUT, FR_CLK);
HX711 RR(RR_DOUT, RR_CLK);

void setup() {
  Serial.begin(9600);
  
  FL.set_scale(FL_CAL);
  RL.set_scale(RL_CAL);
  FR.set_scale(FR_CAL);
  RR.set_scale(RR_CAL);
  
  FL.tare();
  RL.tare();
  FR.tare();
  RR.tare();
}

void loop() {
  Serial.print("#FL:");
  Serial.print(FL.get_units(), 1);
  Serial.print("|RL:");
  Serial.print(RL.get_units(), 1);
  Serial.print("|FR:");
  Serial.print(FR.get_units(), 1);
  Serial.print("|RR:");
  Serial.println(RR.get_units(), 1);
}
