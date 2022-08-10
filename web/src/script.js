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
    console.log(data.status.system.sd)
    process_data(data.data);
    process_status(data.status);

    if (isLiveCANTrafficOn && data.data.key.includes("CAN")) {
      const item = liveCANTrafficData.find(x => x.id === data.data.key);
      if (item) item = {
        id: data.data.key,
        byte0: data.data.bytes[0],
        byte1: data.data.bytes[1],
        byte2: data.data.bytes[2],
        byte3: data.data.bytes[3],
        byte4: data.data.bytes[4],
        byte5: data.data.bytes[5],
        byte6: data.data.bytes[6],
        byte7: data.data.bytes[7],
        cnt: item.cnt++
      };

      else liveCANTrafficData.push({
        id: data.data.key,
        byte0: data.data.bytes[0],
        byte1: data.data.bytes[1],
        byte2: data.data.bytes[2],
        byte3: data.data.bytes[3],
        byte4: data.data.bytes[4],
        byte5: data.data.bytes[5],
        byte6: data.data.bytes[6],
        byte7: data.data.bytes[7],
        cnt: 0
      });
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
  $("#lv i").css("color", status.system.lv ? "green" : "red");
  $("#hv i").css("color", status.system.gpio.hv ? "green" : "red");
  $("#rtd i").css("color", status.system.rtd ? "green" : "red");
  $("#imd i").css("color", status.system.gpio.imd ? "green" : "red");
  $("#bms i").css("color", status.system.gpio.bms ? "green" : "red");
  $("#bspd i").css("color", status.system.gpio.bspd ? "green" : "red");
  $("#hvd i").css("color", status.system.gpio.hvd ? "green" : "red");
  $("#sd i").css("color", status.system.sd ? "green" : "red");
  $("#can i").css("color", status.system.can ? "green" : "red");

  $("#speed").text(status.car.speed.toFixed(0));
  $("#acceleration").text(status.car.accelerator.toFixed(0));
  $("#brake").text(status.car.brake.toFixed(0));

  $("#voltage-failsafe i").css("color", status.battery.failsafe.voltage ? "red" : "green");
  $("#current-failsafe i").css("color", status.battery.failsafe.current ? "red" : "green");
  $("#relay-failsafe i").css("color", status.battery.failsafe.relay ? "red" : "green");
  $("#balancing-active i").css("color", status.battery.failsafe.balancing ? "green" : "red");
  $("#interlock-failsafe i").css("color", status.battery.failsafe.interlock ? "red" : "green");
  $("#thermistor-failsafe i").css("color", status.battery.failsafe.thermistor ? "red" : "green");
  $("#input-power-failsafe i").css("color", status.battery.failsafe.power ? "red" : "green");

  $("#core-temperature").text(parseFloat(status.system.temperature).toFixed(1));

  $("#battery-percent").text(parseFloat(status.battery.percent).toFixed(1));
  $("#battery-voltage").text(parseFloat(status.battery.voltage).toFixed(0));
  $("#battery-current").text(Math.abs(parseFloat(status.battery.current)) >= 100 ? parseFloat(status.battery.current).toFixed(0) : parseFloat(status.battery.current).toFixed(1));

  $("#battery-temperature-max").text(parseFloat(status.battery.temperature.max).toFixed(0));
  $("#battery-temperature-max-id").text(status.battery.temperature.max_id);
  $("#battery-temperature-min").text(parseFloat(status.battery.temperature.min).toFixed(0));
  $("#battery-temperature-min-id").text(status.battery.temperature.max_id);
  $("#battery-temperature-internal").text(parseFloat(status.battery.temperature.internal).toFixed(0));
  $("#battery-adaptive-capacity").text(parseFloat(status.battery.adaptive.capacity).toFixed(1));

  $("#inverter-status-indicator").css('color', status.motor.fault.post.length + status.motor.fault.run.length ? "red" : "green");
  $("#inverter-status").text(status.motor.state.vsm);
  $("#rpm").text(status.motor.rpm);
  $("#motor-torque").text(status.motor.torque.feedback);
  $("#motor-torque-percent").text((status.motor.torque.feedback / status.motor.torque.commanded * 100).toFixed(0));
  $("#motor-temperature").text(status.motor.temperature.motor.toFixed(0));
  $("#motor-igbt-temperature").text(status.motor.temperature.igbt.temperature.toFixed(0));
  $("#motor-igbt-temperature-id").text(status.motor.temperature.igbt.id);
  $("#inverter-temperature").text(status.motor.temperature.gatedriver.toFixed(1));
}


// graph configs
let graphs = { };
let graph_data = { };
for (const canvas of document.getElementsByTagName('canvas')) graph_data[canvas.id] = [];
graph_data["graph-motor-torque-commanded"] = [];

const graph_config = {
  'graph-speed': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-acceleration': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-braking': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-core-temperature': { delay: 5000, grace: 5, color: 'rgb(54, 162, 235)' },

  'graph-battery-percent': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-battery-voltage': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-battery-current': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-battery-temperature-max': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-battery-temperature-min': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-battery-temperature-internal': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },

  'graph-rpm': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-motor-torque': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-motor-temperature': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-motor-igbt-temperature': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
  'graph-inverter-temperature': { delay: 1000, grace: 5, color: 'rgb(54, 162, 235)' },
}

// realtime graph updater
function process_data(data) {
  switch (data.component) {
    case "ECU": {
      switch (data.key) {
        case "TEMPERATURE":
          graph_data['graph-core-temperature'].push({
            x: data.datetime,
            y: data.value / 10
          });
          break;
      }
    }
    case "BMS": {
      switch (data.key) {
        case "CAN_BMS_CORE":
          graph_data['graph-battery-percent'].push({
            x: data.datetime,
            y: data.data.soc
          });
          graph_data['graph-battery-voltage'].push({
            x: data.datetime,
            y: data.data.voltage
          });
          graph_data['graph-battery-current'].push({
            x: data.datetime,
            y: data.data.current
          });
          break;

        case "CAN_BMS_TEMP":
          graph_data['graph-battery-temperature-max'].push({
            x: data.datetime,
            y: data.data.temperature.max
          });
          graph_data['graph-battery-temperature-min'].push({
            x: data.datetime,
            y: data.data.temperature.min
          });
          graph_data['graph-battery-temperature-internal'].push({
            x: data.datetime,
            y: data.data.temperature.internal
          });
          break;
      }
    }
    case "INV": {
      switch (data.key) {
        case "CAN_INV_ANALOG_IN":
          graph_data['graph-acceleration'].push({
            x: data.datetime,
            y: data.data.accelerator
          });
          graph_data['graph-braking'].push({
            x: data.datetime,
            y: data.data.brake
          });
          break;

        case "CAN_INV_MOTOR_POS":
          graph_data['graph-rpm'].push({
            x: data.datetime,
            y: data.data.rpm
          });
          graph_data['graph-speed'].push({
            x: data.datetime,
            y: data.data.speed
          });
          break;

        case "CAN_INV_TORQUE":
          graph_data['graph-motor-torque'].push({
            x: data.datetime,
            y: data.data.feedback
          });
          graph_data["graph-motor-torque-commanded"].push({
            x: data.datetime,
            y: data.data.commanded
          });
          break;

        case "CAN_INV_TEMP_1":
          graph_data['graph-motor-igbt-temperature'].push({
            x: data.datetime,
            y: data.data.igbt.max.temperature
          });
          graph_data['graph-inverter-temperature'].push({
            x: data.datetime,
            y: data.data.gatedriver
          });
          break;

        case "CAN_INV_TEMP_3":
          graph_data['graph-motor-temperature'].push({
            x: data.datetime,
            y: data.data.motor
          });
          break;
      }
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
        icon: 'info',
        title: '시스템 세부 정보',
        html: `<div class="failsafe-desc" style="line-height: 2rem; font-weight: bold; font-size: 1.2rem;"><span style="font-size: 1.1rem; font-weight: initial">VSM 상태:</span> <span style="color: blue">${telemetry.motor.state.vsm}</span><br><span style="font-size: 1.1rem; font-weight: initial">인버터 상태:</span> <span style="color: blue">${telemetry.motor.state.inverter}</span><br><span style="font-size: 1.1rem; font-weight: initial">릴레이:</span><br><ul><li>초기충전: <span style="color: ${telemetry.motor.state.relay.precharge ? "green" : "red" }">${telemetry.motor.state.relay.precharge ? "ON" : "OFF" }</span></li><li>워터펌프: <span style="color: ${telemetry.motor.state.relay.pump ? "green" : "red" }">${telemetry.motor.state.relay.pump ? "ON" : "OFF" }</span></li><li>라디에이터 팬: <span style="color: ${telemetry.motor.state.relay.fan ? "green" : "red" }">${telemetry.motor.state.relay.fan ? "ON" : "OFF" }</span></li></ul><span style="font-size: 1.1rem; font-weight: initial">POST FAULT</span><br>${fault_toHTML(telemetry.motor.fault.post)}<span style="font-size: 1.1rem; font-weight: initial">RUN FAULT</span><br>${fault_toHTML(telemetry.motor.fault.run)}</div>`,
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
  'speed': { title: '차량 속도', desc: '모터 컨트롤러의 RPM 데이터로 계산한 차량의 주행 속도입니다.<br><br><dfn>Velocity(km/h) = (RPM / 6) &times; (π * 0.495) * 0.06</dfn>' },
  'acceleration': { title: '가속', desc: '모터 컨트롤러가 보고하는 가속 페달의 아날로그 입력값입니다.'},
  'braking': { title: '제동', desc: '모터 컨트롤러가 보고하는 브레이크 페달의 아날로그 입력값입니다.'},
  'core-temperature': { title: '프로세서 온도', desc: 'ECU 프로세서의 온도입니다.' },

  'battery-percent': { title: 'HV 배터리 잔량', desc: 'HV 배터리의 잔여 용량입니다.' },
  'battery-voltage': { title: 'HV 배터리 전압', desc: 'HV BUS의 전압입니다.' },
  'battery-current': { title: 'HV 배터리 전류', desc: 'HV BUS의 전류입니다.' },
  'battery-temperature-max': { title: 'HV 배터리 최고 온도', desc: 'HV 배터리에서 최고 온도를 보고하는 온도 센서의 ID와 그 온도입니다.' },
  'battery-temperature-min': { title: 'HV 배터리 최저 온도', desc: 'HV 배터리에서 최저 온도를 보고하는 온도 센서의 ID와 그 온도입니다.' },
  'battery-temperature-internal': { title: 'BMS 온도', desc: 'BMS 히트싱크의 온도입니다.' },
  'battery-adaptive-capacity': { title: 'HV Adaptive Capacity', desc: 'BMS가 충방전을 반복하며 학습한 HV 배터리 팩의 실제 용량입니다.' },

  'rpm': { title: 'RPM', desc: '모터 컨트롤러가 측정한 모터의 분당 회전수입니다.' },
  'motor-torque': { title: '모터 토크', desc: '컨트롤러가 모터 설정값에 기반해 추측한 모터의 실제 토크입니다.<br><br>그래프에서는 모터 컨트롤러가 의도한 토크(commanded torque)를 주황색으로 함께 표시합니다.' },
  'motor-temperature': { title: '모터 온도', desc: '모터 온도 센서가 측정한 온도입니다.' },
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
    html: `<table id="can_table" class="compact cell-border stripe"><thead><tr><th>id</th><th>#0</th><th>#1</th><th>#2</th><th>#3</th><th>#4</th><th>#5</th><th>#6</th><th>#7</th><th>cnt</th></thead></table>`,
    showCloseButton: true,
    willOpen: dom => {
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
          { data: 'count' }
        ],
        columnDefs: [{
          targets: "_all",
          className: "dt-head-center",
          orderable: false,
        }],
      });
    },
    willClose: dom => {
      isLiveCANTrafficOn = false;
      liveCANTrafficData = [];
    }
  });
});


// GPS map handler
let map = new kakao.maps.Map(document.getElementById('map'), {
  center: new kakao.maps.LatLng(37.2837709, 127.0434392)
});