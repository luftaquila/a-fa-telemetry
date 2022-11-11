let telemetry = { };

$("#file").change(function() {
  let file = document.getElementById("file").files[0];
  if (file) {
      var reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = function (evt) {
          telemetry = evt.target.result;
          for (let line of telemetry.split('\n')) {
            process_telemetry(line);
          }
          drawGraph();
      }
  }
});

// telemetry handler
function process_telemetry(data) {
  try {
    if(data[0] === '!') {
      data = data.substring(1, data.length - 1).split('\t').filter(o => o).map(o => o.trim().replace(/\[|\]/g, ""));
      if(data.length != 5) return;

      data = {
        level: data[0],
        datetime: new Date(data[1]),
        component: data[2],
        key: data[3],
        value: data[4]
      };

      switch (data.component) {
        case "ECU":
          switch (data.key) {
            case "STARTUP":
            case "RTD":
            case "WIFI":
            case "TEMPERATURE":
            case "SD":
            case "CAN":
            case "ACC":
              break;

            case "GPIO":
              data.data = data.value.split(' ');
              break;
          }
          break;

        case "BMS":
        case "INV":
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
              break;

            case "CAN_INV_TEMP_3":
              data.data = {
                motor: signedParseInt(data.bytes[5].concat(data.bytes[4]), 16, 16) * 0.1,
              };
              break;

            case "CAN_INV_MOTOR_POS":
              data.data = {
                rpm: signedParseInt(data.bytes[3].concat(data.bytes[2]), 16, 16),
              };
              data.data.speed = (data.data.rpm / 6) * (Math.PI * 0.495) * 0.06;
              break;

            case "CAN_INV_FAULT":
              const post = parseInt(data.bytes[3].concat(data.bytes[2]).concat(data.bytes[1]).concat(data.bytes[0]), 16);
              const run = parseInt(data.bytes[7].concat(data.bytes[6]).concat(data.bytes[5]).concat(data.bytes[4]), 16);
              data.data = { post: [], run: [] };
              for (let i = 0; i < 32; i++) {
                if(post & 1 << i) data.data.post.push(fault.post[i]);
                if(run & 1 << i) data.data.run.push(fault.run[i + 32]);
              }
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
              break;

            case "CAN_INV_CURRENT":
            case "CAN_INV_VOLTAGE":
            case "CAN_INV_FLUX":
            case "CAN_INV_FLUX_WEAKING":
              break;
          }
          break;
      }
      process_data(data);
    }
  } catch(e) { console.log(e); }
}

function signedParseInt(value, base, bit) {
  value = parseInt(value, base);
  return value > Math.pow(2, bit - 1) - 1 ? value - Math.pow(2, bit) : value;
}

// graph updater
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

function drawGraph() {
  // activate graphs
  for(let e of $('input.toggle-graph')) {
    e.target = e;
  
    const canvas = document.getElementById(e.target.id.replace('toggle-', ''));
    $(e.target).prop('checked', 'true');
  
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
            type: 'time',
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
}

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