const LOG_LEVEL = [ "FATAL", "ERROR", "WARN", "INFO", "DEBUG" ];

const LOG_SOURCE = [ "ECU", "ESP", "BMS", "INV", "ADC", "GPIO", "ACC", "GPS", "LCD" ];

const LOG_KEY = {
  "ECU": [ "ECU_BOOT", "ECU_STATE" ],
  "ESP": [ "ESP_INIT", "ESP_REMOTE_CONNECT", "ESP_RTC_SYNC" ],
  "BMS": [ "BMS_CORE", "BMS_TEMP" ],
  "INV": [ "INV_TEMP_1", "INV_TEMP_2", "INV_ANALOG_IN", "INV_MOTOR_POS", "INV_CURRENT", "INV_VOLTAGE", "INV_FLUX", "INV_REF", "INV_STATE", "INV_FAULT", "INV_TORQUE", "INV_FLUX_WEAKING" ],
  "ADC": [ "ADC_TEMP", "ADC_DIST_FL", "ADC_DIST_RL", "ADC_DIST_FR", "ADC_DIST_RR", "ADC_SPD_FL", "ADC_SPD_RL", "ADC_SPD_FR", "ADC_SPD_RR", "ADC_COUNT", "ADC_INIT" ],
  "ACC": [ "ACC_INIT", "ACC_DATA" ],
  "GPS": [ "GPS_INIT", "GPS_DATA" ],
  "LCD": [ "LCD_INIT" ],
};

function convert(raw) {
  const log = {
    timestamp: raw[0] + raw[1] * Math.pow(2, 8) + raw[2] * Math.pow(2, 16) + raw[3] * Math.pow(2, 24),
    level: LOG_LEVEL[raw[4]],
    source: LOG_SOURCE[raw[5]],
    key: LOG_KEY[LOG_SOURCE[raw[5]]][raw[6]],
    value: raw[8] + raw[9] * Math.pow(2, 8) + raw[10] * Math.pow(2, 16) + raw[11] * Math.pow(2, 24) + raw[12] * Math.pow(2, 32) + raw[13] * Math.pow(2, 40) + raw[14] * Math.pow(2, 48) + raw[15] * Math.pow(2, 56),
    raw: raw
  }

  return log;
}

function signedParseInt(value, base, bit) {
  value = parseInt(value, base);
  return value > Math.pow(2, bit - 1) - 1 ? value - Math.pow(2, bit) : value;
}

