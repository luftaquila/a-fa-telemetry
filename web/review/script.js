let telemetry = { };
let graphs = { };
let graph_data = { };
let log = [ ];
let graph_time = {
  start: '',
  end: ''
};

loadfile();
async function loadfile() {
  const res = await fetch("https://a-fa.luftaquila.io/telemetry/review/list");
  for (const log of JSON.parse(await res.text()).reverse()) {
    $('#prevlog').append(`<option value="${log}">${log}</option>`);
  }

  const prevfile = new URLSearchParams(window.location.search).get('file');
  if (prevfile) {
    for(graph of Object.keys(graphs)) {
      graphs[graph].destroy();
      delete graphs[graph];
    }
    graphs = { };
    graph_data = { };
    for (const canvas of document.getElementsByTagName('canvas')) graph_data[canvas.id] = [];
    graph_data["graph-motor-torque-commanded"] = [];

    const res = await fetch("https://a-fa.luftaquila.io/telemetry/review/datalogs/" + prevfile);

    const raw = await res.blob();
    processRaw(raw);
  }
}

$("#prevlog").change(function() {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.set('file', $("#prevlog option:selected").text());
  window.location.search = urlParams;
});

$("#file").change(async function() {
  let file = document.getElementById("file").files[0];
  if (file) {
    let reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = function (evt) {
      let raw = new Blob([evt.target.result], { type: 'application/octet-stream' });
      processRaw(raw);
    }

    let form = new FormData();
    form.append('file', file);
    await fetch("https://a-fa.luftaquila.io/telemetry/review/upload", {
      method: "POST",
      body: form
    });

    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('file', file.name);
    window.history.pushState({}, '', '?' + urlParams);
  }
});

async function processRaw(raw) {
  let buffer = await raw.arrayBuffer();
  buffer = new Uint8Array(buffer);

  const log_size = 16;
  let index = 0;
  let count = buffer.length / log_size;

  while (index < buffer.length) {
    log.push(convert(buffer.slice(index, index + log_size)));
    index += 16;
  }

  console.log(log);
  $("#converter").val(JSON.stringify(log));
}


/*

  // {
  //   for(graph of Object.keys(graphs)) {
  //     graphs[graph].destroy();
  //     delete graphs[graph];
  //   }
  //   graphs = { };
  //   graph_data = { };
  //   for (const canvas of document.getElementsByTagName('canvas')) graph_data[canvas.id] = [];
  //   graph_data["graph-motor-torque-commanded"] = [];

  // }

// telemetry handler
function process_telemetry(data) {
  try {
    if(data[0] === '!') {
      data = data.substring(1, data.length).split('\t').filter(o => o).map(o => o.trim().replace(/\[|\]/g, ""));
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

            case "CAN_INV_ANALOG_IN":
              data.data = {
                accelerator: signedParseInt(parseInt(data.bytes[1].concat(data.bytes[0]), 16).toString(2).padStart(16, 0).slice(6), 2, 10) * 0.01 / 5 * 100,
                brake: signedParseInt(parseInt(data.bytes[3].concat(data.bytes[2]), 16).toString(2).padStart(16, 0).slice(2).slice(0, 11), 2, 10) * 0.01 / 5 * 100,
              };
              break;

            case "CAN_INV_MOTOR_POS":
              data.data = {
                rpm: signedParseInt(data.bytes[3].concat(data.bytes[2]), 16, 16),
              };
              data.data.speed = (data.data.rpm / 6) * (Math.PI * 0.2475) * 0.06;
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
      log.push(data);
      process_data(data);
    }
  } catch(e) { console.log(e); }
}

// graph updater
function process_data(data) {
  switch (data.component) {
    case "ECU": {
      switch (data.key) {
        case "TEMPERATURE":
          if ( data.value > 0 && validator(graph_data['graph-core-temperature'], data.value / 10, 10) ) {
            graph_data['graph-core-temperature'].push({
              x: data.datetime,
              y: data.value / 10
            });
          }
          break;
      }
    }
    case "BMS": {
      switch (data.key) {
        case "CAN_BMS_CORE":
          if ( validator(graph_data['graph-battery-percent'], data.data.soc, 20) ) {
            graph_data['graph-battery-current'].push({
              x: data.datetime,
              y: data.data.current
            });
            graph_data['graph-battery-percent'].push({
              x: data.datetime,
              y: data.data.soc
            });
            graph_data['graph-battery-voltage'].push({
              x: data.datetime,
              y: data.data.voltage
            });
          }
          break;

        case "CAN_BMS_TEMP":
          if ( validator(graph_data['graph-battery-temperature-max'], data.data.temperature.max, 10) ) {
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
          }
          break;
      }
    }
    case "INV": {
      switch (data.key) {
        case "CAN_INV_ANALOG_IN":
          if ( data.data.brake < 100 && data.data.accelerator > 0 && validator(graph_data['graph-braking'], data.data.brake, 50) ) {
            graph_data['graph-acceleration'].push({
              x: data.datetime,
              y: data.data.accelerator
            });
            graph_data['graph-braking'].push({
              x: data.datetime,
              y: data.data.brake
            });
          }
          break;

        case "CAN_INV_MOTOR_POS":
          if ( data.data.rpm < 6000 && data.data.rpm > -100 ) {
            graph_data['graph-rpm'].push({
              x: data.datetime,
              y: data.data.rpm
            });
            graph_data['graph-speed'].push({
              x: data.datetime,
              y: data.data.speed
            });
          }
          break;

        case "CAN_INV_TORQUE":
          if ( data.data.feedback < 200 && data.data.feedback > -100 && validator(graph_data['graph-motor-torque'], data.data.feedback, 350) ) {
            graph_data['graph-motor-torque'].push({
              x: data.datetime,
              y: data.data.feedback
            });
            graph_data["graph-motor-torque-commanded"].push({
              x: data.datetime,
              y: data.data.commanded
            });
          }
          break;

        case "CAN_INV_TEMP_1":
          if ( validator(graph_data['graph-motor-igbt-temperature'], data.data.igbt.max.temperature, 10) ) {
            graph_data['graph-motor-igbt-temperature'].push({
              x: data.datetime,
              y: data.data.igbt.max.temperature
            });
            graph_data['graph-inverter-temperature'].push({
              x: data.datetime,
              y: data.data.gatedriver
            });
          }
          break;

        case "CAN_INV_TEMP_3":
          if ( validator(graph_data['graph-motor-temperature'], data.data.motor, 200) ) {
            graph_data['graph-motor-temperature'].push({
              x: data.datetime,
              y: data.data.motor
            });
          }
          break;
      }
    }
  }
}

function validator(array, data, threshold) {
  if (!array.length || Math.abs(array.at(-1).y - data) < threshold) return true;
  return false;
}

// graph configs
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
              },
            },
            min: graph_time.start,
            max: graph_time.end,
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

$('input.enlarge-graph').on('change', e => {
  if ($(e.target).prop('checked')) {
    const target = e.target.id.replace('enlarge-', '');

    Swal.fire({
      html: `<canvas id='enlarge-graph' class="graph" width="100%" height="60vh"></canvas>`,
      customClass: 'swal-wide',
      willOpen: () => {
        let canvas = { id: target };

        new Chart(document.getElementById('enlarge-graph'), {
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
                  },
                },
                min: graph_time.start,
                max: graph_time.end,
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
      },
      willClose: () => e.target.click(),
    });
  }
});

*/