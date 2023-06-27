if (typeof io === typeof undefined) Swal.fire({
  icon: 'error',
  title: '서버 응답 없음',
  html: `소켓 서버가 응답하지 않습니다.`
});
else {
  socket = io.connect("/", { query: { client: true } });

  // on socket lost
  socket.on('connect_error', () => {
    $("#server i").css("color", "red");
  });

  // on client connected
  socket.on('client_init', data => {
    $("#server i").css("color", "green");
    process_status(data.status);

    // set telemetry
    telemetry = data.status;
  })

  // on data report update
  socket.on('telemetry-repeat', data => {
    data.data.datetime = new Date();
    $("#uptime").text(data.data.timestamp);

    process_data(data.data);
    process_status(data.status);

    if (isLiveCANTrafficOn && data.data.key.includes("CAN")) {
      let item = liveCANTrafficData.find(x => x.id === data.data.key);
      if (item) {
        item.byte0 = data.data.bytes[0];
        item.byte1 = data.data.bytes[1];
        item.byte2 = data.data.bytes[2];
        item.byte3 = data.data.bytes[3];
        item.byte4 = data.data.bytes[4];
        item.byte5 = data.data.bytes[5];
        item.byte6 = data.data.bytes[6];
        item.byte7 = data.data.bytes[7];
        item.cnt++;
        item.index = item.index;
        item.interval = new Date(data.data.datetime) - new Date(item.timestamp);
        item.timestamp = data.data.datetime;

        $('#can_table').DataTable().row(item.index).data(item);
      }

      else {
        const item = {
          id: data.data.key,
          byte0: data.data.bytes[0],
          byte1: data.data.bytes[1],
          byte2: data.data.bytes[2],
          byte3: data.data.bytes[3],
          byte4: data.data.bytes[4],
          byte5: data.data.bytes[5],
          byte6: data.data.bytes[6],
          byte7: data.data.bytes[7],
          cnt: 0,
          index: CAN_index++,
          timestamp: data.data.datetime,
          interval: 0
        };
        liveCANTrafficData.push(item);
        $('#can_table').DataTable().row.add(item).draw();
      }
    }

    // update telemetry
    telemetry = data.status;
  });

  // button handlers
  $("#reset").on("click", e => {
    socket.emit('reset-request');
  });

  socket.on('reset-reply', data => {
    Swal.fire(data).then(result => {
      if(result.isConfirmed) socket.emit('reset-confirm');
    });
  });
}

let telemetry = { };

// realtime status updater
function process_status(status) {
  $("#telemetry i").css("color", status.telemetry ? "green" : "red");
  $("#lv i").css("color", status.car.system.ESP ? "green" : "red");
  $("#hv i").css("color", status.car.system.HV ? "green" : "red");
  $("#rtd i").css("color", status.car.system.RTD ? "green" : "red");

  $("#sd i").css("color", status.car.system.SD ? "green" : "red");
  $("#can i").css("color", status.car.system.CAN ? "green" : "red");
  $("#acc i").css("color", status.car.system.ACC ? "green" : "red");
  $("#lcd i").css("color", status.car.system.LCD ? "green" : "red");
  $("#gps i").css("color", status.car.system.GPS ? "green" : "red");

  $("#imd i").css("color", status.car.system.IMD ? "green" : "red");
  $("#bms i").css("color", status.car.system.BMS ? "green" : "red");
  $("#bspd i").css("color", status.car.system.BSPD ? "green" : "red");
  $("#hvd i").css("color", status.car.system.HVD ? "green" : "red");

  $("#speed").text(status.car.speed.toFixed(0));
  $("#accel").text(status.car.accel.toFixed(0));
  $("#brake").text(status.car.brake.toFixed(0));
  $("#core-temperature").text((parseFloat(status.temperature) / 10).toFixed(1));

  $("#voltage-failsafe i").css("color", status.bms.failsafe.voltage ? "red" : "green");
  $("#current-failsafe i").css("color", status.bms.failsafe.current ? "red" : "green");
  $("#relay-failsafe i").css("color", status.bms.failsafe.relay ? "red" : "green");
  $("#balancing-active i").css("color", status.bms.failsafe.balancing ? "green" : "red");
  $("#interlock-failsafe i").css("color", status.bms.failsafe.interlock ? "red" : "green");
  $("#thermistor-failsafe i").css("color", status.bms.failsafe.thermistor ? "red" : "green");
  $("#input-power-failsafe i").css("color", status.bms.failsafe.power ? "red" : "green");

  $("#battery-percent").text(parseFloat(status.bms.charge).toFixed(1));
  $("#battery-voltage").text(parseFloat(status.bms.voltage).toFixed(0));
  $("#battery-current").text(parseFloat(status.bms.current).toFixed(1));
  $("#battery-temperature-max").text(parseFloat(status.bms.temperature.max.value).toFixed(0));
  $("#battery-temperature-max-id").text(status.bms.temperature.max.id);
  $("#battery-temperature-min").text(parseFloat(status.bms.temperature.min.value).toFixed(0));
  $("#battery-temperature-min-id").text(status.bms.temperature.min.id);
  $("#battery-adaptive-capacity").text(parseFloat(status.bms.adaptive.capacity).toFixed(1));

  $("#inverter-status-indicator").css('color', status.inverter.fault.post.length + status.inverter.fault.run.length ? "red" : "green");
  $("#inverter-status").text(status.inverter.state.vsm_state);
  $("#rpm").text(status.inverter.motor.speed);
  $("#motor-torque").text(status.inverter.torque.feedback);
  $("#motor-temperature").text(status.inverter.temperature.motor.toFixed(0));
  $("#motor-coolant").text(status.inverter.temperature.rtd.rtd1.toFixed(0));
  $("#motor-igbt-temperature").text(status.inverter.temperature.igbt.max.value.toFixed(0));
  $("#motor-igbt-temperature-id").text(status.inverter.temperature.igbt.max.id);
  $("#inverter-temperature").text(status.inverter.temperature.gatedriver.toFixed(1));
}

// GPS
let map = new kakao.maps.Map(document.getElementById('map'), {
  center: new kakao.maps.LatLng(37.2837709, 127.0434392)
});

let gps_path = [ ];
let gps_marker;
let gps_polyline = new kakao.maps.Polyline({
  path: gps_path,
  strokeWeight: 5,
  strokeColor: '#00C40D',
  strokeOpacity: 0.8,
  strokeStyle: 'solid'
});
gps_polyline.setMap(map);

// graph configs
let graphs = { };
let graph_data = { };
for (const canvas of document.getElementsByTagName('canvas')) graph_data[canvas.id] = [];
graph_data["graph-motor-torque-commanded"] = [];

const graph_config = {
  'graph-speed': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-accel': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-braking': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-core-temperature': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },

  'graph-battery-percent': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-battery-voltage': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-battery-current': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-battery-temperature-max': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-battery-temperature-min': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },

  'graph-rpm': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-motor-torque': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-motor-temperature': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-motor-coolant': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-motor-igbt-temperature': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-inverter-temperature': { delay: 0, grace: 5, color: 'rgb(54, 162, 235)' },
};

// realtime graph updater
function process_data(data) {
  switch (data.source) {
    case "CAN": {
      switch (data.key) {
        case "CAN_INV_TEMP_1":
          graph_data['graph-motor-igbt-temperature'].push({
            x: data.datetime,
            y: data.parsed.igbt.max.temperature
          });
          graph_data['graph-inverter-temperature'].push({
            x: data.datetime,
            y: data.parsed.gatedriver
          });
          break;

        case "CAN_INV_TEMP_2":
          graph_data['graph-motor-coolant'].push({
            x: data.datetime,
            y: data.parsed.RTD1
          });
          break;

        case "CAN_INV_TEMP_3":
          graph_data['graph-motor-temperature'].push({
            x: data.datetime,
            y: data.parsed.motor
          });
          break;

        case "CAN_INV_ANALOG_IN":
          graph_data['graph-accel'].push({
            x: data.datetime,
            y: data.parsed.AIN1
          });
          graph_data['graph-braking'].push({
            x: data.datetime,
            y: data.parsed.AIN3
          });
          break;

        case "CAN_INV_MOTOR_POS":
          graph_data['graph-rpm'].push({
            x: data.datetime,
            y: data.parsed.motor_speed
          });
          graph_data['graph-speed'].push({
            x: data.datetime,
            y: data.parsed.motor_speed // !!!! calc needed
          });
          break;

        case "CAN_INV_TORQUE":
          graph_data['graph-motor-torque'].push({
            x: data.datetime,
            y: data.parsed.torque_feedback
          });
          graph_data["graph-motor-torque-commanded"].push({
            x: data.datetime,
            y: data.parsed.commanded_torque
          });
          break;


        case "CAN_BMS_CORE":
          graph_data['graph-battery-percent'].push({
            x: data.datetime,
            y: data.parsed.soc
          });
          graph_data['graph-battery-voltage'].push({
            x: data.datetime,
            y: data.parsed.voltage
          });
          graph_data['graph-battery-current'].push({
            x: data.datetime,
            y: data.parsed.current
          });
          break;

        case "CAN_BMS_TEMP":
          graph_data['graph-battery-temperature-max'].push({
            x: data.datetime,
            y: data.parsed.temperature.max.value
          });
          graph_data['graph-battery-temperature-min'].push({
            x: data.datetime,
            y: data.parsed.temperature.min.value
          });
          break;
      }
      break;
    }
    case "ADC": {
      switch (data.key) {
        case "ADC_CPU": {
          graph_data['graph-core-temperature'].push({
            x: data.datetime,
            y: data.parsed / 10
          });
          break;
        }
      }
      break;
    }
    case "GPS": {
      switch (data.key) {
        case "GPS_POS": {
          let pos = new kakao.maps.LatLng(data.parsed.lat, data.parsed.lon);

          if (gps_marker) {
            gps_marker.setMap(null);
          }

          gps_marker = new kakao.maps.Marker({
            position: pos
          });
          gps_marker.setMap(map);

          gps_path.push(pos);
          gps_polyline.setPath(gps_path);

          map.panTo(pos);
          break;
        }
      }
      break;
    }
  }
}

// on graph toggle
$('input.toggle-graph').on('change', e => {
  const canvas = document.getElementById(e.target.id.replace('toggle-', ''));

  if ($(e.target).prop('checked')) {
    // init chart.js
    graphs[canvas.id] = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [{
          data: graph_data[canvas.id],
          cubicInterpolationMode: 'monotone',
          tension: 0.2,
          borderColor: graph_config[canvas.id].color
        }, ((canvas.id == "graph-motor-torque") ? {
          data: graph_data["graph-motor-torque-commanded"],
          cubicInterpolationMode: 'monotone',
          tension: 0.2,
          borderColor: 'rgb(255, 159, 64)'
        } : {})
      ]
      },
      options: {
        responsive: true,
        interaction: {
          intersect: false,
        },
        scales: {
          x: {
            type: 'realtime',
            distribution: 'linear',
            time: {
              unit: 'second',
              unitStepSize: 15,
              stepSize: 15,
              displayFormats: {
                hour: 'h:mm:ss',
                minute: 'h:mm:ss',
                second: 'h:mm:ss'
              }
            },
            realtime: {
              duration: 60000,
              refresh: 500,
              delay: graph_config[canvas.id].delay
            }
          },
          y: {
            grace: graph_config[canvas.id].grace
          }
        },
        plugins: {
          legend: {
            display: false
          }
        },
        elements: {
          point: {
            borderWidth: 0,
            radius: 10,
            backgroundColor: 'rgba(0, 0, 0, 0)'
          }
        }
      }
    });
  }

  else { // discard graph
    graphs[canvas.id].destroy();
    delete graphs[canvas.id];
  }
});


// on tooltip toggle
$('input.tooltips').on('change', e => {
  if ($(e.target).prop('checked')) {
    const target = e.target.id.replace('tooltip-', '');

    if (target == "inverter-status") {
      return Swal.fire({
        html: `
        <div class="failsafe-desc" style="line-height: 2rem; font-weight: bold; font-size: 1.2rem;">
          <span style="font-size: 1.1rem; font-weight: initial">VSM 상태:</span> <span style="color: blue">${telemetry.inverter.state.vsm_state}</span><br>
          <span style="font-size: 1.1rem; font-weight: initial">인버터 상태:</span> <span style="color: blue">${telemetry.inverter.state.inverter_state}</span><br>
          <span style="font-size: 1.1rem; font-weight: initial">인버터 모드:</span> <span style="color: blue">${telemetry.inverter.state.mode}</span><br>
          <span style="font-size: 1.1rem; font-weight: initial">방전 모드:</span> <span style="color: blue">${telemetry.inverter.state.discharge}</span><br>
          <span style="font-size: 1.1rem; font-weight: initial">BMS 통신:</span> <span style="color: ${telemetry.inverter.state.bms_comm ? "green" : "red" }">${telemetry.inverter.state.bms_comm ? "ON" : "OFF" }</span><br>
          <span style="font-size: 1.1rem; font-weight: initial">릴레이:</span><br>
          <ul>
            <li>초기충전: <span style="color: ${telemetry.inverter.state.relay.precharge ? "green" : "red" }">${telemetry.inverter.state.relay.precharge ? "ON" : "OFF" }</span></li>
            <li>AIR: <span style="color: ${telemetry.inverter.state.relay.main ? "green" : "red" }">${telemetry.inverter.state.relay.main ? "ON" : "OFF" }</span></li>
            <li>워터펌프: <span style="color: ${telemetry.inverter.state.relay.pump ? "green" : "red" }">${telemetry.inverter.state.relay.pump ? "ON" : "OFF" }</span></li>
            <li>라디에이터 팬: <span style="color: ${telemetry.inverter.state.relay.fan ? "green" : "red" }">${telemetry.inverter.state.relay.fan ? "ON" : "OFF" }</span></li>
          </ul>
          <span style="font-size: 1.1rem; font-weight: initial">출력 제한:</span><br>
          <ul>
            <li>BMS: <span style="color: ${telemetry.inverter.state.limit.bms ? "red" : "green" }">${telemetry.inverter.state.limit.bms ? "ON" : "OFF" }</span></li>
            <li>HIGH SPEED: <span style="color: ${telemetry.inverter.state.limit.speed ? "red" : "green" }">${telemetry.inverter.state.limit.speed ? "ON" : "OFF" }</span></li>
            <li>LOW SPEED: <span style="color: ${telemetry.inverter.state.limit.lowspeed ? "red" : "green" }">${telemetry.inverter.state.limit.lowspeed ? "ON" : "OFF" }</span></li>
          </ul>
          <span style="font-size: 1.1rem; font-weight: initial">POST FAULT</span><br>
            ${fault_toHTML(telemetry.inverter.fault.post)}
          <span style="font-size: 1.1rem; font-weight: initial">RUN FAULT</span><br>
            ${fault_toHTML(telemetry.inverter.fault.run)}
        </div>`,
        willClose: () => e.target.click(),
      });
    }

    Swal.fire({
      icon: 'info',
      title: tooltips[target].title,
      html: tooltips[target].desc,
      willClose: () => e.target.click(),
    });
  }
});

let tooltips = {
  'speed': { title: '차량 속도', desc: '모터 컨트롤러의 RPM 데이터로 계산한 차량의 주행 속도입니다.<br><br><dfn>Velocity(km/h) = (RPM / 6) &times; (π * 0.2475) * 0.06</dfn>' },
  'accel': { title: '가속', desc: '모터 컨트롤러가 보고하는 가속 페달의 아날로그 입력값입니다.'},
  'braking': { title: '제동', desc: '모터 컨트롤러가 보고하는 브레이크 페달의 아날로그 입력값입니다.'},
  'core-temperature': { title: '프로세서 온도', desc: 'ECU 프로세서의 온도입니다.' },
  'uptime': { title: '코어 시간', desc: 'ECU 코어가 부팅한 후 경과된 시간입니다.' },

  'battery-percent': { title: 'HV 배터리 잔량', desc: 'HV 배터리의 잔여 용량입니다.' },
  'battery-voltage': { title: 'HV 배터리 전압', desc: 'HV BUS의 전압입니다.' },
  'battery-current': { title: 'HV 배터리 전류', desc: 'HV BUS의 전류입니다.' },
  'battery-temperature-max': { title: 'HV 배터리 최고 온도', desc: 'HV 배터리에서 최고 온도를 보고하는 온도 센서의 ID와 그 온도입니다.' },
  'battery-temperature-min': { title: 'HV 배터리 최저 온도', desc: 'HV 배터리에서 최저 온도를 보고하는 온도 센서의 ID와 그 온도입니다.' },
  'battery-adaptive-capacity': { title: 'HV Adaptive Capacity', desc: 'BMS가 충방전을 반복하며 학습한 HV 배터리 팩의 실제 용량입니다.' },

  'rpm': { title: 'RPM', desc: '모터 컨트롤러가 측정한 모터의 분당 회전수입니다.' },
  'motor-torque': { title: '모터 토크', desc: '컨트롤러가 모터 설정값에 기반해 추측한 모터의 실제 토크입니다.<br><br>그래프에서는 모터 컨트롤러가 의도한 토크(commanded torque)를 주황색으로 함께 표시합니다.' },
  'motor-temperature': { title: '모터 온도', desc: '모터 온도 센서가 측정한 온도입니다.' },
  'motor-coolant': { title: '냉각수 온도', desc: '인버터의 RTD1 냉각수 온도 센서가 측정한 온도입니다.' },
  'motor-igbt-temperature': { title: 'IGBT 온도', desc: '인버터의 3상 스위칭 IGBT 중 가장 높은 온도를 보고하는 IGBT의 온도와, 해당 IGBT가 담당하는 상(A/B/C)입니다.' },
  'inverter-temperature': { title: 'Gate Driver 온도', desc: '인버터 게이트 드라이버 보드의 온도입니다.' },

  'voltage-failsafe': { title: 'Voltage failsafe mode', desc: '<div class="failsafe-desc">BMS가 셀 또는 배터리 팩 전압을 정확히 측정할 수 없을 때 작동하는 가장 심각한 비상 모드입니다. BMS가 더 이상 셀을 보호할 수 없으므로, BMS는 배터리 팩의 충방전 전류 제한을 서서히 0으로 낮추어 배터리 작동을 정지시킵니다. 이 비상 모드가 발동하면 반드시 배터리 팩을 다시 사용하기 전에 문제 발생 원인을 조사해야 합니다.<br><br>이 문제는 셀 전압이 0.09V 이하이거나 5V 이상일 때 또는 voltage tap 와이어 일부가 분리되었을 때 발생할 수 있습니다.</div>' },
  'current-failsafe': { title: 'Current failsafe mode', desc: '<div class="failsafe-desc">이 문제는 전류 센서가 부정확하거나 분리되었다고 BMS가 판단할 때 발생할 수 있습니다. BMS 프로파일에 전류 센서가 사용 설정되지 않았을 때도 발생합니다.<br><br>이 모드에서 전류 센서는 비활성화되어 측정값은 0A로 고정되며, BMS는 전류 센서를 무시하고 오로지 전압 센서에 의존해서 셀을 보호합니다. 배터리 팩 자체는 계속 작동합니다.<br><br>이 비상 모드는 다음의 기능에 영향을 미칩니다.<ol><li>셀 내부 저항 측정이 비활성화됩니다.</li><li>충전량(%) 측정값이 부정확해집니다.</li><li>충방전 전류 제한이 voltage failsafe mode로 전환되며 실제 값과 다를 수 있습니다.</li><li>과전류 보호 기능이 사실상 작동하지 않습니다.</li></ol></div>' },
  'relay-failsafe': { title: 'Relay failsafe mode', desc: '<div class="failsafe-desc">이 모드는 BMS가 릴레이 제어 출력 신호를 꺼 릴레이를 비활성화했음에도 불구하고 배터리에 500ms 이상 전류 흐름이 측정될 때 발생합니다. 이 모드에서 BMS의 모든 릴레이 제어 출력 신호는 에러 코드를 초기화하기 전까지 비활성화 상태로 유지됩니다.<br><br>이 모드는 BMS 프로파일에서 활성화된 릴레이에 대해서만 작동합니다. 비활성화된 릴레이에서는 무시됩니다.</div>' },
  'balancing-active': { title: 'Cell Balancing Active', desc: '<div class="failsafe-desc">BMS가 셀 밸런싱 중일 때 활성화되어 녹색으로 표시됩니다.</div>' },
  'interlock-failsafe': { title: 'Charge Interlock failsafe mode', desc: '<div class="failsafe-desc">충전 중에 충전기 인터락이 분리되었을 때 활성화됩니다.</div>' },
  'thermistor-invalid': { title: 'Thermistor b-value table invalid', desc: '<div class="failsafe-desc">뭔지 모르겠음</div>' },
  'input-power-failsafe': { title: 'Input Power Supply Failsafe', desc: '<div class="failsafe-desc">BMS에 공급되는 12V 전원의 실제 전압이 너무 낮아 정상 작동을 보장할 수 없을 때 발생하는 비상 모드입니다. 공급 전원이 8초 이상 8V 이하로 유지될 때 발생합니다.<br><br>이 모드에서 charge enable, discharge enable, charger safety 출력은 모두 비활성화됩니다. 또한 모든 디지털 출력은 꺼지며, 충방전 전류 제한은 즉시 0A로 설정됩니다. 5V 아날로그 출력은 동작할 수 있으나 측정값은 신뢰할 수 없습니다.<br><br>이 문제로 인한 에러 코드는 기록에 남지만, 정상 전압이 복구되면 BMS는 즉시 다시 정상 작동합니다.<br><br>한편, BMS는 5초 미만의 시간 동안 발생하는 전압 강하로 전압이 4.5V까지 내려가더라도 이 비상 모드를 활성화하지 않고 정상 작동할 수 있습니다.</div>' },
};

function fault_toHTML(faults) {
  if(faults.length) {
    let str = "<ul style='color: red;'>";
    for(let fault of faults) {
      str += `<li>${fault}</li>`;
    }
    str += "</ul>";
    return str;
  }
  else return "<ul><li>N/A</li></ul>";
}

let isLiveCANTrafficOn = false;
let liveCANTrafficData = [];
$("#livecan").on("click", e => {
  isLiveCANTrafficOn = true;
  Swal.fire({
    html: `<table id="can_table" class="compact cell-border stripe"><thead><tr><th>id</th><th>#0</th><th>#1</th><th>#2</th><th>#3</th><th>#4</th><th>#5</th><th>#6</th><th>#7</th><th>cnt</th><th>int</th></thead></table>`,
    showCloseButton: true,
    willOpen: dom => {
      CAN_index = 0;
      $('#can_table').DataTable({
        data: liveCANTrafficData,
        paging: false,
        columns: [
          { data: 'id' },
          { data: 'byte0' },
          { data: 'byte1' },
          { data: 'byte2' },
          { data: 'byte3' },
          { data: 'byte4' },
          { data: 'byte5' },
          { data: 'byte6' },
          { data: 'byte7' },
          { data: 'cnt' },
          { data: 'interval' }
        ],
        columnDefs: [{
          targets: "_all",
          className: "dt-head-center",
          orderable: false,
        }],
        select: true,
        responsive: true
      });
    },
    willClose: dom => {
      isLiveCANTrafficOn = false;
      liveCANTrafficData = [];
      CAN_index = 0;
      $('#can_table').DataTable().destroy();
    }
  });
});
