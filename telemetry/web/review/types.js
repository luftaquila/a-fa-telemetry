const LOG_LEVEL = [ "FATAL", "ERROR", "WARN", "INFO", "DEBUG" ];

const LOG_SOURCE = [ "ECU", "ESP", "CAN", "ADC", "ACC", "LCD", "GPS" ];

const LOG_KEY = {
  "ECU": [ "ECU_BOOT", "ECU_STATE", "ECU_READY" ],
  "ESP": [ "ESP_INIT", "ESP_REMOTE_CONNECT", "ESP_RTC_FIX" ],
  "CAN": {
    0: "CAN_INIT",
    1: "CAN_ERR",

    0xA0: "CAN_INV_TEMP_1",
    0xA1: "CAN_INV_TEMP_2",
    0xA2: "CAN_INV_TEMP_3",
    0xA3: "CAN_INV_ANALOG_IN",
    0xA4: "CAN_INV_DIGITAL_IN",
    0xA5: "CAN_INV_MOTOR_POS",
    0xA6: "CAN_INV_CURRENT",
    0xA7: "CAN_INV_VOLTAGE",
    0xA8: "CAN_INV_FLUX",
    0xA9: "CAN_INV_REF",
    0xAA: "CAN_INV_STATE",
    0xAB: "CAN_INV_FAULT",
    0xAC: "CAN_INV_TORQUE",
    0xAD: "CAN_INV_FLUX_WEAKING",

    0xAE: "CAN_INV_FIRMWARE_VER",
    0xAF: "CAN_INV_DIAGNOSTIC",

    0xB0: "CAN_INV_HIGH_SPD_MSG",

    0x80: "CAN_BMS_CORE",
    0x81: "CAN_BMS_TEMP"
  },
  "ADC": [ "ADC_INIT", "ADC_CPU", "ADC_DIST", "ADC_SPD" ],
  "ACC": [ "ACC_INIT", "ACC_DATA" ],
  "LCD": [ "LCD_INIT", "LCD_UPDATED" ],
  "GPS": [ "GPS_INIT", "GPS_POS", "GPS_SPD" ],
};

function convert(raw) {
  let log = {
    timestamp: raw[0] + raw[1] * Math.pow(2, 8) + raw[2] * Math.pow(2, 16) + raw[3] * Math.pow(2, 24),
    level: LOG_LEVEL[raw[4]],
    source: LOG_SOURCE[raw[5]],
    key: LOG_KEY[LOG_SOURCE[raw[5]]][raw[6]],
    value: raw[8] + raw[9] * Math.pow(2, 8) + raw[10] * Math.pow(2, 16) + raw[11] * Math.pow(2, 24) + raw[12] * Math.pow(2, 32) + raw[13] * Math.pow(2, 40) + raw[14] * Math.pow(2, 48) + raw[15] * Math.pow(2, 56),
    raw: raw
  };
  log.parsed = parse(log.source, log.key, log.value, log.raw);

  return log;
}

function parse(source, key, value, raw) {
  let parsed;

  switch (source) {
    case "ECU": {
      switch (key) {
        case "ECU_BOOT": {

          break;
        }

        case "ECU_STATE": {

          break;
        }

        case "ECU_READY": {

          break;
        }

        default: {
          parsed = null;
          break;
        }
      }
      break;
    }
    
    case "ESP": {
      switch (key) {
        case "ESP_INIT": {

          break;
        }

        case "ESP_REMOTE_CONNECT": {

          break;
        }

        case "ESP_RTC_FIX": {

          break;
        }

        default: {
          parsed = null;
          break;
        }
      }
      break;
    }

    case "CAN": {
      switch (key) {
        case "CAN_INIT": {

          break;
        }

        case "CAN_ERR": {

          break;
        }

        case "CAN_INV_TEMP_1": {

          break;
        }

        case "CAN_INV_TEMP_2": {

          break;
        }

        case "CAN_INV_TEMP_3": {

          break;
        }

        case "CAN_INV_ANALOG_IN": {

          break;
        }

        case "CAN_INV_DIGITAL_IN": {

          break;
        }

        case "CAN_INV_MOTOR_POS": {

          break;
        }

        case "CAN_INV_CURRENT": {

          break;
        }

        case "CAN_INV_VOLTAGE": {

          break;
        }

        case "CAN_INV_FLUX": {

          break;
        }

        case "CAN_INV_REF": {

          break;
        }

        case "CAN_INV_STATE": {

          break;
        }

        case "CAN_INV_FAULT": {

          break;
        }

        case "CAN_INV_TORQUE": {

          break;
        }

        case "CAN_INV_FLUX_WEAKING": {

          break;
        }

        case "CAN_INV_FIRMWARE_VER": {

          break;
        }

        case "CAN_INV_DIAGNOSTIC": {

          break;
        }

        case "CAN_BMS_CORE": {

          break;
        }

        case "CAN_BMS_TEMP": {

          break;
        }

        default: {
          parsed = null;
          break;
        }
      }
      break;
    }
    
    case "ADC": {
      switch (key) {
        case "ADC_INIT": {

          break;
        }

        case "ADC_CPU": {

          break;
        }

        case "ADC_DIST": {

          break;
        }

        case "ADC_SPD": {

          break;
        }

        default: {
          parsed = null;
          break;
        }
      }
      break;
    }

    case "ACC": {
      switch (key) {
        case "ACC_INIT": {

          break;
        }

        case "ACC_DATA": {

          break;
        }

        default: {
          parsed = null;
          break;
        }
      }
      break;
    }
    
    case "LCD": {
      switch (key) {
        case "LCD_INIT": {

          break;
        }

        case "LCD_UPDATED": {

          break;
        }

        default: {
          parsed = null;
          break;
        }
      }
      break;
    }
    
    case "GPS": {
      switch (key) {
        case "GPS_INIT": {

          break;
        }

        case "GPS_POS": {

          break;
        }

        case "GPS_SPD": {

          break;
        }

        default: {
          parsed = null;
          break;
        }
      }
      break;
    }

    default: {
      parsed = null;
      break;
    }
  }

  return parsed;
}

function signedParseInt(value, base, bit) {
  value = parseInt(value, base);
  return value > Math.pow(2, bit - 1) - 1 ? value - Math.pow(2, bit) : value;
}

