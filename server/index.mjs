import { Server } from 'socket.io'
import mariadb from 'mariadb'
import dateFormat from 'dateformat'

import dotenv from 'dotenv'
dotenv.config();

// db config
const pool = mariadb.createPool({
  host: process.env.db_host,
  user: process.env.db_user,
  password: process.env.db_pwd,
  database: process.env.db_name,
  idleTimeout: 0
});

// log function
async function log(data) {
  const db = await pool.getConnection();
  const query = `INSERT INTO \`log\` (\`level\`, \`datetime\`, \`component\`, \`key\`, \`value\`)
                 VALUES(${db.escape(data.level)}, ${db.escape(data.datetime)}, ${db.escape(data.component)},
                 ${db.escape(data.key)}, ${db.escape(data.value)});`;
  const result = await db.query(query);
  await db.end();
  console.log(data);
}

// start socket server
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
console.log('Server startup: ' + new Date());

// initial system status
let ECU = {
  telemetry: false,
  session: null,
  system: {
    lv: false,
    rtd: false,
    gps: false,
    gpio: {
      hv: false,
      rtd: false,
      brake: false,
      imd: false,
      bms: false,
      bspd: false,
      hvd: false,
    },
    temperature: 0,
    sd: false,
    can: false,
  },
  car: {
    speed: 0,
    accelerator: 0,
    brake: 0
  },
  battery: {
    percent: 0,
    voltage: 0,
    current: 0,
    temperature: {
      max: 0,
      max_id: 0,
      min: 0,
      min_id: 0,
      internal: 0
    },
    adaptive: {
      soc: 0,
      capacity: 0,
    },
    failsafe: {
      voltage: false,
      current: false,
      relay: false,
      balancing: false,
      interlock: false,
      thermistor: false,
      power: false,
    },
  },
  motor: {
    rpm: 0,
    torque: {
      feedback: 0,
      commanded: 0,
    },
    temperature: {
      motor: 0,
      igbt: {
        temperature: 0,
        id: "X",
      },
      gatedriver: 0,
    },
    state: {
      vsm: "N/A",
      inverter: "N/A",
      relay: {
        precharge: false,
        pump: false,
        fan: false,
      },
    },
    fault: {
      post: [],
      run: [],
    },
  },
  reference: {
    v1p5: 0,
    v2p5: 0,
    v5: 0,
    v12: 0
  }
}
const ECU_INIT = JSON.stringify(ECU);

// socket handler
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
    socket.on('telemetry', data => {
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
      if (ECU.telemetry) socket.emit('reset-reply', { icon: 'error', title: '차량 상태 초기화 오류', html: `<code><i class="fa-duotone fa-fw fa-tower-broadcast" style="color: green"></i> 원격 계측</code> 활성화 상태에서는 차량 상태를 초기화할 수 없습니다.`, showCancelButton: true, showConfirmButton: false, cancelButtonText: '확인', cancelButtonColor: '#7066e0' });
      else socket.emit('reset-reply', { icon: 'warning', title: '차량 상태 초기화', html: `<code><i class="fa-duotone fa-fw fa-tower-broadcast" style="color: red"></i> 원격 계측</code> 비활성화 상태에서 남아있는 이전 데이터를 초기화합니다.`, showCancelButton: true, cancelButtonText: '취소', confirmButtonText: '확인', confirmButtonColor: '#d33', customClass: { confirmButton: 'swal2-two-buttons' } });
    });

    socket.on('reset-confirm', () => {
      ECU = JSON.parse(ECU_INIT);
      io.to('client').emit('client_init', { data: null, status: ECU });
    });
  }
});

// telemetry handler
function process_telemetry(data) {
  try {
    if(data.log[0] === '!') {
      ECU.telemetry = true;
      ECU.system.lv = true;
      ECU.system.sd = true;

      data = data.log.substring(1, data.log.length - 1).split('\t').filter(o => o).map(o => o.trim().replace(/\[|\]/g, ""));
      if(data.length != 5) return;

      data = {
        level: data[0],
        datetime: new Date(data[1]),
        component: data[2],
        key: data[3],
        value: data[4]
      };

      log(data);

      switch (data.component) {
        case "ECU":
          switch (data.key) {
            case "STARTUP":
              ECU = JSON.parse(ECU_INIT);
              ECU.session = data.datetime;
              ECU.system.rtd = false;
              break;
            
            case "RTD":
              if(Number(data.value)) ECU.system.rtd = true;
              break;

            case "GPIO":
              data.data = data.value.split(' ');
              ECU.system.gpio[data.data[0].toLowerCase()] = data.data[1] === '1' ? true : false;
              break;

            case "WIFI":
              break;

            case "TEMPERATURE":
              ECU.system.temperature = data.value / 10;
              break;

            case "SD":
              ECU.system.sd = data.level === "INFO" ? true : false;
              break;

            case "CAN":
              ECU.system.can = data.level === "ERRR" ? false : true;
              break;
          }
          break;

        case "BMS":
        case "INV":
          ECU.system.can = true;
          data.bytes = data.value.split(' ').map(x => x.replace('0x', ''));
          
          switch (data.key) {
            case "CAN_BMS_CORE":
              const failsafe = parseInt(data.bytes[5].concat(data.bytes[6]), 16);
              data.data = {
                soc: parseInt(data.bytes[0], 16) * 0.5,
                voltage: parseInt(data.bytes[1].concat(data.bytes[2]), 16) * 0.1,
                current: signedParseInt(data.bytes[3].concat(data.bytes[4]), 16, 16) * 0.1,
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
              
              ECU.battery.percent = data.data.soc;
              ECU.battery.voltage = data.data.voltage;
              ECU.battery.current = data.data.current;
              ECU.battery.failsafe = data.data.failsafe;
              break;

            case "CAN_BMS_TEMP":
              data.data = {
                temperature: {
                  max: signedParseInt(data.bytes[0], 16, 8),
                  max_id: parseInt(data.bytes[1], 16),
                  min: signedParseInt(data.bytes[2], 16, 8),
                  min_id: parseInt(data.bytes[3], 16),
                  internal: signedParseInt(data.bytes[7], 16, 8),
                },
                adapdtive: {
                  soc: parseInt(data.bytes[4], 16) * 0.5,
                  capacity: parseInt(data.bytes[5].concat(data.bytes[6]), 16) * 0.1,
                }
              };
              ECU.battery.temperature = data.data.temperature;
              ECU.battery.adapdtive = data.data.adapdtive;
              break;

            case "CAN_INV_TEMP_1":
              data.data = {
                igbt: {
                  a: signedParseInt(data.bytes[1].concat(data.bytes[0]), 16, 16) * 0.1,
                  b: signedParseInt(data.bytes[3].concat(data.bytes[2]), 16, 16) * 0.1,
                  c: signedParseInt(data.bytes[5].concat(data.bytes[4]), 16, 16) * 0.1,
                },
                gatedriver: signedParseInt(data.bytes[7].concat(data.bytes[6]), 16, 16) * 0.1,
              };
              data.data.igbt.max = data.data.igbt.a > data.data.igbt.b ? (data.data.igbt.a > data.data.igbt.c ? { temperature: data.data.igbt.a, id: "A" } : { temperature: data.data.igbt.c, id: "C" }) : (data.data.igbt.b > data.data.igbt.c ? { temperature: data.data.igbt.b, id: "B" } : { temperature: data.data.igbt.c, id: "C" });

              ECU.motor.temperature.igbt = data.data.igbt.max;
              ECU.motor.temperature.gatedriver = data.data.gatedriver;
              break;

            case "CAN_INV_TEMP_3":
              data.data = {
                motor: signedParseInt(data.bytes[5].concat(data.bytes[4]), 16, 16) * 0.1,
              };

              ECU.motor.temperature.motor = data.data.motor;
              break;

            case "CAN_INV_ANALOG_IN":
              data.data = {
                accelerator: signedParseInt(parseInt(data.bytes[1].concat(data.bytes[0]), 16).toString(2).padStart(16, 0).slice(6), 2, 10) * 0.01 / (ECU.reference.v5 ? ECU.reference.v5 : 5) * 100,
                brake: signedParseInt(parseInt(data.bytes[3].concat(data.bytes[2]), 16).toString(2).padStart(16, 0).slice(2).slice(0, 11), 2, 10) * 0.01 / (ECU.reference.v5 ? ECU.reference.v5 : 5) * 100,
              };
              
              ECU.car.accelerator = data.data.accelerator;
              ECU.car.brake = data.data.brake;
              break;

            case "CAN_INV_MOTOR_POS":
              data.data = {
                rpm: signedParseInt(data.bytes[3].concat(data.bytes[2]), 16, 16),
              };
              data.data.speed = (data.data.rpm / 6) * (Math.PI * 0.495) * 0.06;

              ECU.motor.rpm = data.data.rpm;
              ECU.car.speed = data.data.speed;
              break;

            case "CAN_INV_STATE":
              const relay = parseInt(data.bytes[3], 16);
              data.data = {
                vsm: state.vsm[parseInt(data.bytes[0], 16)] ? state.vsm[parseInt(data.bytes[0], 16)] : "N/A",
                inverter: state.inverter[parseInt(data.bytes[2], 16)] ? state.inverter[parseInt(data.bytes[2], 16)] : "N/A",
                relay: {
                  precharge: relay & 1 << 0 ? true : false,
                  pump: relay & 1 << 4 ? true : false,
                  fan: relay & 1 << 5 ? true : false,
                },
              };

              ECU.motor.state = data.data;
              break;

            case "CAN_INV_FAULT":
              const post = parseInt(data.bytes[3].concat(data.bytes[2]).concat(data.bytes[1]).concat(data.bytes[0]), 16);
              const run = parseInt(data.bytes[7].concat(data.bytes[6]).concat(data.bytes[5]).concat(data.bytes[4]), 16);
              data.data = { post: [], run: [] };
              for (let i = 0; i < 32; i++) {
                if(post & 1 << i) data.data.post.push(fault.post[i]);
                if(run & 1 << i) data.data.run.push(fault.run[i + 32]);
              }
              ECU.motor.fault = data.data;
              break;

            case "CAN_INV_TORQUE":
              data.data = {
                feedback: signedParseInt(data.bytes[3].concat(data.bytes[2]), 16, 16) * 0.1,
                commanded: signedParseInt(data.bytes[1].concat(data.bytes[0]), 16, 16) * 0.1,
              }
              break;

            case "CAN_INV_REF":
              data.data = {
                v1p5: signedParseInt(data.bytes[1].concat(data.bytes[0]), 16, 16) * 0.01,
                v2p5: signedParseInt(data.bytes[3].concat(data.bytes[2]), 16, 16) * 0.01,
                v5: signedParseInt(data.bytes[5].concat(data.bytes[4]), 16, 16) * 0.01,
                v12: signedParseInt(data.bytes[7].concat(data.bytes[6]), 16, 16) * 0.01
              };
              ECU.reference = data.data;
              break;

            case "CAN_INV_CURRENT":
            case "CAN_INV_VOLTAGE":
            case "CAN_INV_FLUX":
            case "CAN_INV_FLUX_WEAKING":
              break;
          }
          break;
      }
      io.to('client').emit('telemetry-repeat', { data: data, status: ECU });
    }
  } catch(e) { }
}

function signedParseInt(value, base, bit) {
  value = parseInt(value, base);
  return value > Math.pow(2, bit - 1) - 1 ? value - Math.pow(2, bit) : value;
}

const state = {
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
  }
}

const fault = {
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