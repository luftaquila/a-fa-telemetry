import { Server } from 'socket.io'
import dateFormat from 'dateformat'

import dotenv from 'dotenv'
dotenv.config();

/*****************************************************************************
 * logger configurations
 ****************************************************************************/
async function log(data) {
  console.log(data);
}

/*****************************************************************************
 * socket server
 ****************************************************************************/
const io = new Server(process.env.port, {
  pingInterval: 5000,
  pingTimeout: 5000
});

log({
  level: "INFO",
  datetime: new Date(),
  component: "SERVER",
  key: "STARTUP",
  value: "SERVER STARTUP"
});

/*****************************************************************************
 * socket handler
 ****************************************************************************/
io.sockets.on('connection', socket => {
  if(socket.handshake.query.device === "ECU") {
    socket.join('device');

    setTimeout(() => socket.emit('rtc_fix', { datetime: dateFormat(new Date(), 'yyyy-mm-dd-HH-MM-ss')}), 1000);

    log({
      level: "INFO",
      datetime: new Date(),
      component: "SERVER",
      key: "SOCKET",
      value: "SOCKET CONNECTED"
    });

    // on SOCKET_DISCONNECTED
    socket.on('disconnect', reason => {
      ECU.telemetry = false;
      ECU.car.system.ESP = false;

      let data = {
        level: "INFO",
        datetime: new Date(),
        component: "SERVER",
        key: "SOCKET",
        value: 'SOCKET LOST: ' + reason
      }

      log(data);
      io.to('client').emit('telemetry-repeat', { data: data, status: ECU });
    });

    // on ECU TELEMETRY
    socket.on('tlog', data => {
      ECU.telemetry = true;
      ECU.car.system.ESP = true;
      process_telemetry(data);
    });
  }

  // on CLIENT connected
  else if(socket.handshake.query.client) {
    socket.join('client');
    socket.emit('client_init', { data: null, status: ECU });
    log({
      level: "INFO",
      datetime: new Date(),
      component: "SERVER",
      key: "SOCKET",
      value: "CLIENT CONNECTED"
    });

    socket.on('reset-request', () => {
      if (ECU.telemetry) {
        socket.emit('reset-reply', {
          icon: 'error',
          title: '차량 상태 초기화 오류',
          html: `<code><i class="fa-duotone fa-fw fa-tower-broadcast" style="color: green"></i> 원격 계측</code> 활성화 상태에서는 차량 상태를 초기화할 수 없습니다.`,
          showCancelButton: true, showConfirmButton: false, cancelButtonText: '확인', cancelButtonColor: '#7066e0'
        });
      } else {
        socket.emit('reset-reply', {
          icon: 'warning',
          title: '차량 상태 초기화',
          html: `<code><i class="fa-duotone fa-fw fa-tower-broadcast" style="color: red"></i> 원격 계측</code> 비활성화 상태에서 남아있는 이전 데이터를 초기화합니다.`,
          showCancelButton: true, cancelButtonText: '취소', confirmButtonText: '확인', confirmButtonColor: '#d33',
          customClass: { confirmButton: 'swal2-two-buttons' }
        });
      }
    });

    socket.on('reset-confirm', () => {
      ECU = JSON.parse(ECU_INIT);
      io.to('client').emit('client_init', { data: null, status: ECU });
    });
  }
});


/*****************************************************************************
 * telemetry handler
 ****************************************************************************/
function process_telemetry(data) {
  data = convert(data.log.match(/.{2}/g).map(x => parseInt(x, 16)));

  if (data != null) {
    switch (data.source) {
      case "ECU": {
        switch (data.key) {
          case "ECU_STATE": {
            ECU.car.system = data.parsed;
            break;
          }
          case "ECU_BOOT":
          case "ECU_READY":
          case "SD_INIT":
          default:
            break;
        }
        break;
      }
      case "ESP": break;
      case "CAN": {
        switch (data.key) {
          case "CAN_INV_TEMP_1": {
            ECU.inverter.temperature.igbt.max = data.parsed.igbt.max;
            ECU.inverter.temperature.gatedriver = data.parsed.gatedriver;
            break;
          }
          case "CAN_INV_TEMP_2": {
            ECU.inverter.temperature.controlboard = data.parsed.controlboard;
            break;
          }
          case "CAN_INV_TEMP_3": {
            ECU.inverter.temperature.coolant = data.parsed.coolant;
            ECU.inverter.temperature.hotspot = data.parsed.hotspot;
            ECU.inverter.temperature.motor = data.parsed.motor;
            break;
          }
          case "CAN_INV_ANALOG_IN": {
            ECU.car.accel = data.parsed.AIN1;
            ECU.car.brake = data.parsed.AIN3;
            break;
          }
          case "CAN_INV_MOTOR_POS": {
            ECU.inverter.motor.angle = data.parsed.motor_angle;
            ECU.inverter.motor.speed = data.parsed.motor_speed;
            break;
          }
          case "CAN_INV_CURRENT": {
            ECU.inverter.current.dc_bus = data.parsed.dc_bus_current;
            break;
          }
          case "CAN_INV_VOLTAGE": {
            ECU.inverter.voltage.dc_bus = data.parsed.dc_bus_voltage;
            ECU.inverter.voltage.output = data.parsed.output_voltage;
            break;
          }
          case "CAN_INV_STATE": {
            ECU.inverter.state.vsm_state = state.vsm[data.parsed.vsm_state];
            ECU.inverter.state.inverter_state = state.inverter[data.parsed.inverter_state];
            ECU.inverter.state.relay.precharge = (data.parsed.relay_state & (1 << 0)) ? true : false;
            ECU.inverter.state.relay.main = (data.parsed.relay_state & (1 << 1)) ? true : false;
            ECU.inverter.state.relay.pump = (data.parsed.relay_state & (1 << 4)) ? true : false;
            ECU.inverter.state.relay.fan = (data.parsed.relay_state & (1 << 5)) ? true : false;
            ECU.inverter.state.mode = state.inverter_mode[data.parsed.inverter_run_mode];
            ECU.inverter.state.discharge = state.discharge_state[data.parsed.inverter_active_discharge_state];
            ECU.inverter.state.enabled = data.parsed.inverter_enable_state ? true : false;
            ECU.inverter.state.bms_comm = data.parsed.bms_active ? true : false;
            ECU.inverter.state.limit.bms = data.parsed.bms_limiting_torque ? true : false;
            ECU.inverter.state.limit.speed = data.parsed.limit_max_speed ? true : false;
            ECU.inverter.state.limit.hotspot = data.parsed.limit_hot_spot ? true : false;
            ECU.inverter.state.limit.lowspeed = data.parsed.low_speed_limiting ? true : false;
            ECU.inverter.state.limit.coolant = data.parsed.coolant_temperature_limiting ? true : false;
            break;
          }
          case "CAN_INV_FAULT": {
            for (let i = 0; i < 32; i++) {
              if (data.parsed.POST & (1 << i)) {
                ECU.inverter.fault.post.push(fault.post[i]);
              }
              if (data.parsed.RUN & (1 << i)) {
                ECU.inverter.fault.post.run(fault.run[i]);
              }
            }
            break;
          }
          case "CAN_INV_TORQUE": {
            ECU.inverter.torque.feedback = data.parsed.torque_feedback;
            ECU.inverter.torque.commanded = data.parsed.commanded_torque;
            break;
          }
          case "CAN_BMS_CORE": {
            ECU.bms.charge = data.parsed.soc;
            ECU.bms.voltage = data.parsed.voltage;
            ECU.bms.current = data.parsed.current;
            ECU.bms.failsafe = data.parsed.failsafe;
            break;
          }
          case "CAN_BMS_TEMP": {
            ECU.bms.temperature = data.parsed.temperature;
            ECU.bms.adaptive = data.parsed.adaptive;
            break;
          }
          case "CAN_INV_DIGITAL_IN":
          case "CAN_INV_FLUX":
          case "CAN_INV_REF":
          case "CAN_INV_FLUX_WEAKING":
          case "CAN_INV_FIRMWARE_VER":
          case "CAN_INV_DIAGNOSTIC":
          case "CAN_INV_HIGH_SPD_MSG":
          default:
            break;
        }
        break;
      }
      case "ADC": {
        switch (data.key) {
          case "ADC_CPU": {
            ECU.temperature = data.parsed;
            break;
          }
          case "ADC_DIST": {
            ECU.car.position.FL = data.parsed.DIST_FL;
            ECU.car.position.RL = data.parsed.DIST_RL;
            ECU.car.position.FR = data.parsed.DIST_FR;
            ECU.car.position.RR = data.parsed.DIST_RR;
            break;
          }
          case "ADC_INIT":
          default:
            break;
        }
        break;
      }
      case "DGT": break;
      case "ACC": {
        switch (data.key) {
          case "ACC_DATA": {
            ECU.car.acceleration = data.parsed;
            break;
          }
          case "ACC_INIT":
          default:
            break;
        }
        break;
      }
      case "LCD": break;
      case "GPS": {
        switch (data.key) {
          case "GPS_POS": {
            ECU.car.gps.lat = data.parsed.lat;
            ECU.car.gps.lon = data.parsed.lon;
            break;
          }
          case "GPS_VEC": {
            ECU.car.gps.speed = data.parsed.speed;
            ECU.car.gps.course = data.parsed.course;
            break;
          }
          case "GPS_INIT":
          case "GPS_TIME":
          default:
            break;
        }
        break;
      }
    }

    io.to('client').emit('telemetry-repeat', { data: data, status: ECU });
  }
}


/*****************************************************************************
 * system state
 ****************************************************************************/
let ECU = {          // initial system status
  telemetry: false,
  session: null,
  temperature: 0,
  car: {
    system: {
      HV: false,
      RTD: false,
      BMS: false,
      IMD: false,
      BSPD: false,

      SD: false,
      CAN: false,
      ESP: false,
      ACC: false,
      LCD: false,
      GPS: false,
    },
    position: {
      FL: 0,
      RL: 0,
      FR: 0,
      RR: 0,
    },
    wheel_speed: {
      FL: 0,
      RL: 0,
      FR: 0,
      RR: 0,
    },
    acceleration: {
      x: 0,
      y: 0,
      z: 0,
    },
    gps: {
      lat: 0,
      lon: 0,
      speed: 0,
      course: 0,
    },
    speed: 0,
    accel: 0,
    brake: 0,
  },
  inverter: {
    temperature: {
      igbt: {
        max: {
          value: 0,
          id: "X",
        }
      },
      gatedriver: 0,
      controlboard: 0,
      coolant: 0,
      hotspot: 0,
      motor: 0,
    },
    motor: {
      angle: 0,
      speed: 0,
    },
    current: {
      dc_bus: 0,
    },
    voltage: {
      dc_bus: 0,
      output: 0,
    },
    state: {
      vsm_state: "N/A",
      inverter_state: "N/A",
      relay: {
        precharge: false,
        main: false,
        pump: false,
        fan: false,
      },
      mode: "N/A",
      discharge: "N/A",
      enabled: false,
      bms_comm: false,
      limit: {
        bms: false,
        speed: false,
        hotspot: false,
        lowspeed: false,
        coolant: false
      }
    },
    fault: {
      post: [],
      run: [],
    },
    torque: {
      feedback: 0,
      commanded: 0,
    },
  },
  bms: {
    charge: 0,
    voltage: 0,
    current: 0,
    failsafe: {
      voltage: false,
      current: false,
      relay: false,
      balancing: false,
      interlock: false,
      thermister: false,
      power: false,
    },
    temperature: {
      max: {
        value: 0,
        id: 0,
      },
      min: {
        value: 0,
        id: 0,
      },
      internal: 0,
    },
    adaptive: {
      soc: 0,
      capacity: 0,
    }
  },
}
const ECU_INIT = JSON.stringify(ECU);

const state = { // motor controller properties
  vsm: {
    0: "VSM 시작",
    1: "초기충전 준비",
    2: "초기충전",
    3: "초기충전 완료",
    4: "VSM 대기",
    5: "VSM 준비 완료",
    6: "모터 작동",
    7: "FAULT",
    14: "Shutdown",
    15: "Recycle Power"
  },
  inverter: {
    0: "Power On",
    1: "Stop",
    2: "Open Loop", 
    3: "Closed Loop", 
    4: "Wait",
    5: "Internal",
    6: "Internal", 
    7: "Internal",
    8: "Idle Run",
    9: "Idle Stop",
    10: "Internal",
    11: "Internal",
    12: "Internal"
  },
  discharge_state: {
    0: "방전 비활성화",
    1: "방전 대기",
    2: "속도 검사 중",
    3: "방전 중",
    4: "방전 완료",
  },
  inverter_mode: {
    0: "토크 모드",
    1: "속도 모드"
  }
}

const fault = { // motor controller fault properties
  post: {
    0: "Hardware Gate/Desaturation Fault",
    1: "HW Over-current Fault",
    2: "Accelerator Shorted",
    3: "Accelerator Open",
    4: "Current Sensor Low",
    5: "Current Sensor High",
    6: "Module Temperature Low",
    7: "Module Temperature High",
    8: "Control PCB Temperature Low",
    9: "Control PCB Temperature High",
    10: "Gate Drive PCB Temperature Low",
    11: "Gate Drive PCB Temperature High",
    12: "5V Sense Voltage Low",
    13: "5V Sense Voltage High",
    14: "12V Sense Voltage Low",
    15: "12V Sense Voltage High",
    16: "2.5V Sense Voltage Low",
    17: "2.5V Sense Voltage High",
    18: "1.5V Sense Voltage Low",
    19: "1.5V Sense Voltage High",
    20: "DC Bus Voltage High",
    21: "DC Bus Voltage Low",
    22: "Pre-charge Timeout",
    23: "Pre-charge Voltage Failure",
    24: "EEPROM Checksum Invalid",
    25: "EEPROM Data Out of Range",
    26: "EEPROM Update Required",
    27: "Hardware DC Bus Over-Voltage during initialization",
    28: "Reserved",
    29: "Reserved",
    30: "Brake Shorted",
    31: "Brake Open",
  },
  run: {
    32: "Motor Over-speed Fault",
    33: "Over-current Fault",
    34: "Over-voltage Fault",
    35: "Inverter Over-temperature Fault",
    36: "Accelerator Input Shorted Fault",
    37: "Accelerator Input Open Fault",
    38: "Direction Command Fault",
    39: "Inverter Response Time-out Fault",
    40: "Hardware Gate/Desaturation Fault",
    41: "Hardware Over-current Fault",
    42: "Under-voltage Fault",
    43: "CAN Command Message Lost Fault",
    44: "Motor Over-temperature Fault",
    45: "Reserved",
    46: "Reserved",
    47: "Reserved",
    48: "Brake Input Shorted Fault",
    49: "Brake Input Open Fault",
    50: "Module A Over-temperature Fault",
    51: "Module B Over-temperature Fault",
    52: "Module C Over-temperature Fault",
    53: "PCB Over-temperature Fault",
    54: "Gate Drive Board 1 Over-temperature Faul",
    55: "Gate Drive Board 2 Over-temperature Fault",
    56: "Gate Drive Board 3 Over-temperature Fault",
    57: "Current Sensor Fault",
    58: "Reserved",
    59: "Hardware DC Bus Over-Voltage Fault",
    60: "Reserved",
    61: "Reserved",
    62: "Resolver Not Connected",
    63: "Reserved",
  }
}


/*****************************************************************************
 * log reviewer file uploader
 ****************************************************************************/
import http from 'http'
import formidable from 'formidable'
import fs from 'fs'

http.createServer(function (req, res) {
  if (req.method == 'GET') {
    fs.readdir('../web/review/datalogs', function (err, files) {
      res.write(JSON.stringify(files));
      res.end()
    });
  }
  else if (req.method == 'POST') {
    let form = new formidable.IncomingForm();
    form.parse(req, function (error, fields, file) {
      fs.rename(file.file.filepath, '../web/review/datalogs/' + file.file.originalFilename, function () {
        res.write('OK');
        res.end();
      });
    });
  }
}).listen(process.env.upload_port);


/*****************************************************************************
 * types.js
 ****************************************************************************/
const LOG_LEVEL = [ "FATAL", "ERROR", "WARN", "INFO", "DEBUG" ];

const LOG_SOURCE = [ "ECU", "ESP", "CAN", "ADC", "DGT", "ACC", "LCD", "GPS" ];

const LOG_KEY = {
  "ECU": [ "ECU_BOOT", "ECU_STATE", "ECU_READY", "SD_INIT" ],
  "ESP": [ "ESP_INIT", "ESP_REMOTE", "ESP_RTC_FIX" ],
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
  "ADC": [ "ADC_INIT", "ADC_CPU", "ADC_DIST" ],
  "DGT": [ "TIMER_IC_INIT", "TIMER_IC_LEFT", "TIMER_IC_RIGHT" ],
  "ACC": [ "ACC_INIT", "ACC_DATA" ],
  "LCD": [ "LCD_INIT", "LCD_UPDATED" ],
  "GPS": [ "GPS_INIT", "GPS_POS", "GPS_VEC", "GPS_TIME" ],
};

function convert(raw) {
  try {
    let log = {
      timestamp: raw[0] + raw[1] * Math.pow(2, 8) + raw[2] * Math.pow(2, 16) + raw[3] * Math.pow(2, 24),
      level: LOG_LEVEL[raw[4]],
      source: LOG_SOURCE[raw[5]],
      key: LOG_KEY[LOG_SOURCE[raw[5]]][raw[6]],
      value: raw[8] + raw[9] * Math.pow(2, 8) + raw[10] * Math.pow(2, 16) + raw[11] * Math.pow(2, 24) + raw[12] * Math.pow(2, 32) + raw[13] * Math.pow(2, 40) + raw[14] * Math.pow(2, 48) + raw[15] * Math.pow(2, 56),
      raw: raw.slice(8)
    };
    log.parsed = parse(log.source, log.key, log.value, log.raw);

    return log;
  } catch(e) {
    console.error(raw);
    console.error(e);
    return null;
  }
}

function parse(source, key, value, raw) {
  let parsed;

  switch (source) {
    case "ECU": {
      switch (key) {
        case "ECU_BOOT": {
          parsed = value ? true : false;
          break;
        }

        case "ECU_STATE": {
          parsed = {
            HV: value & 1 << 0 ? true : false,
            RTD: value & 1 << 1 ? true : false,
            BMS: value & 1 << 2 ? true : false,
            IMD: value & 1 << 3 ? true : false,
            BSPD: value & 1 << 4 ? true : false,

            SD: value & 1 << 5 ? true : false,
            CAN: value & 1 << 6 ? true : false,
            ESP: value & 1 << 7 ? true : false,
            ACC: value & 1 << 8 ? true : false,
            LCD: value & 1 << 9 ? true : false,
            GPS: value & 1 << 10 ? true : false
          };
          break;
        }

        case "ECU_READY": {
          parsed = true;
          break;
        }

        case "SD_INIT": {
          parsed = value ? true : false;
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
          parsed = value ? true : false;
          break;
        }

        case "ESP_REMOTE": {
          parsed = value ? true : false;
          break;
        }

        case "ESP_RTC_FIX": {
          parsed = value ? true : false;
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
          parsed = value ? true : false;
          break;
        }

        case "CAN_ERR": {
          parsed = value;
          break;
        }

        case "CAN_INV_TEMP_1": {
          parsed = {
            igbt: {
              a: signed(value & 0xffff, 16) * 0.1,
              b: signed((value / Math.pow(2, 16)) & 0xffff, 16) * 0.1,
              c: signed((value / Math.pow(2, 32)) & 0xffff, 16) * 0.1,
            },
            gatedriver: signed((value / Math.pow(2, 48)) & 0xffff, 16) * 0.1,
          };
          parsed.igbt.max = parsed.igbt.a > parsed.igbt.b ? (parsed.igbt.a > parsed.igbt.c ? { temperature: parsed.igbt.a, id: "A" } : { temperature: parsed.igbt.c, id: "C" }) : (parsed.igbt.b > parsed.igbt.c ? { temperature: parsed.igbt.b, id: "B" } : { temperature: parsed.igbt.c, id: "C" });
          break;
        }

        case "CAN_INV_TEMP_2": {
          parsed = {
            controlboard: signed(value & 0xffff, 16) * 0.1,
            RTD1: signed((value / Math.pow(2, 16)) & 0xffff, 16) * 0.1,
            RTD2: signed((value / Math.pow(2, 32)) & 0xffff, 16) * 0.1,
            RTD3: signed((value / Math.pow(2, 48)) & 0xffff, 16) * 0.1,
          };
          break;
        }

        case "CAN_INV_TEMP_3": {
          parsed = {
            coolant: signed(value & 0xffff, 16) * 0.1,
            hotspot: signed((value / Math.pow(2, 16)) & 0xffff, 16) * 0.1,
            motor: signed((value / Math.pow(2, 32)) & 0xffff, 16) * 0.1,
            torque_shudder: signed((value / Math.pow(2, 48)) & 0xffff, 16) * 0.1,
          };
          break;
        }

        case "CAN_INV_ANALOG_IN": {
          parsed = {
            AIN1: signed(value & 0x3ff, 10) * 0.01,
            AIN2: signed((value / Math.pow(2, 10)) & 0x3ff, 10) * 0.01,
            AIN3: signed((value / Math.pow(2, 20)) & 0x3ff, 10) * 0.01,
            AIN4: signed((value / Math.pow(2, 30)) & 0x3ff, 10) * 0.01,
            AIN5: signed((value / Math.pow(2, 40)) & 0x3ff, 10) * 0.01,
            AIN6: signed((value / Math.pow(2, 50)) & 0x3ff, 10) * 0.01,
          };
          break;
        }

        case "CAN_INV_DIGITAL_IN": {
          parsed = {
            DIN1: (value & 0xff) ? true : false,
            DIN2: ((value / Math.pow(2, 8)) & 0xff) ? true : false,
            DIN3: ((value / Math.pow(2, 16)) & 0xff) ? true : false,
            DIN4: ((value / Math.pow(2, 24)) & 0xff) ? true : false,
            DIN5: ((value / Math.pow(2, 32)) & 0xff) ? true : false,
            DIN6: ((value / Math.pow(2, 40)) & 0xff) ? true : false,
            DIN7: ((value / Math.pow(2, 48)) & 0xff) ? true : false,
            DIN8: ((value / Math.pow(2, 56)) & 0xff) ? true : false,
          };
          break;
        }

        case "CAN_INV_MOTOR_POS": {
          parsed = {
            motor_angle: signed(value & 0xffff, 16) * 0.1,
            motor_speed: signed((value / Math.pow(2, 16)) & 0xffff, 16),
            electrical_output_freq: signed((value / Math.pow(2, 32)) & 0xffff, 16) * 0.1,
            delta_resolver_filtered: signed((value / Math.pow(2, 48)) & 0xffff, 16) * 0.1,
          };
          break;
        }

        case "CAN_INV_CURRENT": {
          parsed = {
            phaseA: signed(value & 0xffff, 16) * 0.1,
            phaseB: signed((value / Math.pow(2, 16)) & 0xffff, 16) * 0.1,
            phaseC: signed((value / Math.pow(2, 32)) & 0xffff, 16) * 0.1,
            dc_bus_current: signed((value / Math.pow(2, 48)) & 0xffff, 16) * 0.1,
          };
          break;
        }

        case "CAN_INV_VOLTAGE": {
          parsed = {
            dc_bus_voltage: signed(value & 0xffff, 16) * 0.1,
            output_voltage: signed((value / Math.pow(2, 16)) & 0xffff, 16) * 0.1,
            VAB_Vd_voltage: signed((value / Math.pow(2, 32)) & 0xffff, 16) * 0.1,
            VBC_Vq_voltage: signed((value / Math.pow(2, 48)) & 0xffff, 16) * 0.1,
          };
          break;
        }

        case "CAN_INV_FLUX": {
          parsed = {
            flux_command: signed(value & 0xffff, 16) * 0.001,
            flux_feedback: signed((value / Math.pow(2, 16)) & 0xffff, 16) * 0.001,
            Id_feedback: signed((value / Math.pow(2, 32)) & 0xffff, 16) * 0.1,
            Iq_feedback: signed((value / Math.pow(2, 48)) & 0xffff, 16) * 0.1,
          };
          break;
        }

        case "CAN_INV_REF": {
          parsed = {
            ref_1v5: signed(value & 0xffff, 16) * 0.01,
            ref_2v5: signed((value / Math.pow(2, 16)) & 0xffff, 16) * 0.01,
            ref_5v: signed((value / Math.pow(2, 32)) & 0xffff, 16) * 0.01,
            ref_12v: signed((value / Math.pow(2, 48)) & 0xffff, 16) * 0.01,
          };
          break;
        }

        case "CAN_INV_STATE": {
          parsed = {
            vsm_state: raw[0],
            pwm_freq: raw[1],
            inverter_state: raw[2],
            relay_state:raw[3],
            inverter_run_mode: raw[4] & 0x1,
            inverter_active_discharge_state: (raw[4] / Math.pow(2, 5)) & 0b111,
            inverter_command_mode: raw[5] & 0x1,
            inverter_enable_state: raw[6] & 0x1,
            inverter_start_mode_active: (raw[6] / Math.pow(2, 6)) & 0x1,
            inverter_enable_lockout: (raw[6] / Math.pow(2, 7)) & 0x1,
            direction_command: raw[7] & 0x1,
            bms_active: (raw[7] / Math.pow(2, 1)) & 0x1,
            bms_limiting_torque: (raw[7] / Math.pow(2, 2)) & 0x1,
            limit_max_speed: (raw[7] / Math.pow(2, 3)) & 0x1,
            limit_hot_spot: (raw[7] / Math.pow(2, 4)) & 0x1,
            low_speed_limiting: (raw[7] / Math.pow(2, 5)) & 0x1,
            coolant_temperature_limiting: (raw[7] / Math.pow(2, 6)) & 0x1,
          };
          break;
        }

        case "CAN_INV_FAULT": {
          parsed = {
            POST: value & 0xffffffff,
            RUN: (value / Math.pow(2, 32)) & 0xffffffff,
            POST_FAULT_LO: value & 0xffff,
            POST_FAULT_HI: (value / Math.pow(2, 16)) & 0xffff,
            RUN_FAULT_LO: (value / Math.pow(2, 32)) & 0xffff,
            RUN_FAULT_HI: (value / Math.pow(2, 48)) & 0xffff,
          };
          break;
        }

        case "CAN_INV_TORQUE": {
          parsed = {
            commanded_torque: signed(value & 0xffff, 16) * 0.1,
            torque_feedback: signed((value / Math.pow(2, 16)) & 0xffff, 16) * 0.1,
            power_on_timer: value / Math.pow(2, 32)
          };
          break;
        }

        case "CAN_INV_FLUX_WEAKING": {
          parsed = {
            modulation_index: (value & 0xffff) * 0.01,
            flux_weakening_output: signed((value / Math.pow(2, 16)) & 0xffff, 16) * 0.1,
            Id_command: signed((value / Math.pow(2, 32)) & 0xffff, 16) * 0.1,
            Iq_command: signed((value / Math.pow(2, 48)) & 0xffff, 16) * 0.1,
          };
          break;
        }

        case "CAN_INV_FIRMWARE_VER": {
          parsed = {
            EEPROM_version: value & 0xffff,
            software_version: (value / Math.pow(2, 16)) & 0xfff,
            date_code: (value / Math.pow(2, 32)) & 0xffff,
            date_code_year: (value / Math.pow(2, 48)) & 0xffff,
          };
          break;
        }

        case "CAN_INV_DIAGNOSTIC": {
          parsed = null;
          break;
        }

        case "CAN_INV_HIGH_SPD_MSG": {
          parsed = null;
          break;
        }

        case "CAN_BMS_CORE": {
          const failsafe = raw[5] + raw[6] * Math.pow(2, 8);
          parsed = {
            soc: raw[0] * 0.5,
            voltage: (raw[1] + raw[2] * Math.pow(2, 8)) * 0.1,
            current: signed(raw[3] + raw[4] * Math.pow(2, 8), 16) * 0.1,
            failsafe: {
              voltage: failsafe & 1 << 0 ? true : false,
              current: failsafe & 1 << 1 ? true : false,
              relay: failsafe & 1 << 2 ? true : false,
              balancing: failsafe & 1 << 3 ? true : false,
              interlock: failsafe & 1 << 4 ? true : false,
              thermistor: failsafe & 1 << 5 ? true : false,
              power: failsafe & 1 << 6 ? true : false,
            }
          };
          break;
        }

        case "CAN_BMS_TEMP": {
          parsed = {
            temperature: {
              max: {
                value: signed(raw[0], 8),
                id: raw[1],
              },
              min: {
                value: signed(raw[2], 8),
                id: raw[3],
              },
              internal: signed(raw[7], 8),
            },
            adapdtive: {
              soc: raw[4] * 0.5,
              capacity: (raw[5] + raw[6] * Math.pow(2, 8)) * 0.1,
            }
          };
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
          parsed = value ? true : false;
          break;
        }

        case "ADC_CPU": {
          parsed = value;
          break;
        }

        case "ADC_DIST": {
          parsed = {
            DIST_FL: raw[0] + raw[1] * Math.pow(2, 8),
            DIST_RL: raw[2] + raw[3] * Math.pow(2, 8),
            DIST_FR: raw[4] + raw[5] * Math.pow(2, 8),
            DIST_RR: raw[6] + raw[7] * Math.pow(2, 8),
          };
          break;
        }

        default: {
          parsed = null;
          break;
        }
      }
      break;
    }

    case "DGT": {
      parsed = null;
      break;
    }

    case "ACC": {
      switch (key) {
        case "ACC_INIT": {
          parsed = value ? true : false;
          break;
        }

        case "ACC_DATA": {
          parsed = {
            x: signed(raw[0] + raw[1] * Math.pow(2, 8), 16),
            y: signed(raw[2] + raw[3] * Math.pow(2, 8), 16),
            z: signed(raw[4] + raw[5] * Math.pow(2, 8), 16),
          }
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
          parsed = value ? true : false;
          break;
        }

        case "LCD_UPDATED": {
          parsed = null;
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
          parsed = value ? true : false;
          break;
        }

        case "GPS_POS": {
          parsed = {
            lat: (raw[0] + raw[1] * Math.pow(2, 8) + raw[2] * Math.pow(2, 16) + raw[3] * Math.pow(2, 24)) * 0.0000001,
            lon: (raw[4] + raw[5] * Math.pow(2, 8) + raw[6] * Math.pow(2, 16) + raw[7] * Math.pow(2, 24)) * 0.0000001
          }
          break;
        }

        case "GPS_VEC": {
          parsed = {
            speed: (raw[0] + raw[1] * Math.pow(2, 8) + raw[2] * Math.pow(2, 16) + raw[3] * Math.pow(2, 24)) * 0.01,
            course: (raw[4] + raw[5] * Math.pow(2, 8) + raw[6] * Math.pow(2, 16) + raw[7] * Math.pow(2, 24))
          }
          break;
        }

        case "GPS_TIME": {
          parsed = {
            utc_date: (raw[0] + raw[1] * Math.pow(2, 8) + raw[2] * Math.pow(2, 16) + raw[3] * Math.pow(2, 24)),
            utc_time: (raw[4] + raw[5] * Math.pow(2, 8) + raw[6] * Math.pow(2, 16) + raw[7] * Math.pow(2, 24))
          }
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

function signed(value, bit) {
  return value > Math.pow(2, bit - 1) - 1 ? value - Math.pow(2, bit) : value;
}
