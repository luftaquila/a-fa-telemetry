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
  pingTimeout: 3000
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
    temperature: 0,
  },
  motor: {
    rpm: 0,
    temperature: 0,
    temperature_inverter: 0,
  },
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

    socket.on('reset-request', () => {
      if (ECU.telemetry) socket.emit('reset-reply', { icon: 'error', title: '차량 상태 초기화 오류', html: `<code><i class="fa-duotone fa-fw fa-tower-broadcast" style="color: green"></i> 원격 계측</code> 활성화 상태에서는 차량 상태를 초기화할 수 없습니다.`, showCancelButton: true, showConfirmButton: false, cancelButtonText: '확인', cancelButtonColor: '#7066e0' });
      else socket.emit('reset-reply', { icon: 'warning', title: '차량 상태 초기화', html: `<code><i class="fa-duotone fa-fw fa-tower-broadcast" style="color: red"></i> 원격 계측</code> 비활성화 상태에서 남아있는 이전 데이터를 초기화합니다.`, showCancelButton: true, cancelButtonText: '취소', confirmButtonText: '확인', confirmButtonColor: '#d33', customClass: { confirmButton: 'swal2-two-buttons' } });
    });

    socket.on('reset-confirm', () => {
      ECU = JSON.parse(ECU_INIT);
      io.to('client').emit('client_init', { data: null, status: ECU });
    });

    socket.on('log-request', async () => {
      if (!ECU.session) return socket.emit('log-reply', { result: false });
      const db = await pool.getConnection();
      const query = `SELECT * FROM log WHERE datetime >= '${ECU.session}';`;
      const result = await db.query(query);
      await db.end();
      socket.emit('log-reply', { result: true, data: result });
    });
  }
});

// telemetry handler
function process_telemetry(data) {
  if(data.log[0] === '!') {
    ECU.system.lv = true;
    ECU.telemetry = true;

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
        }
        break;

      case "BMS":
        break;

      case "INV":
        break;
    }

    io.to('client').emit('telemetry-repeat', { data: data, status: ECU });
  }
}