socket = io.connect("/", { query: { client: true } });

// on socket lost
socket.on('connect_error', () => {
  $("#server i").css("color", "red");
});

// on client connected
socket.on('client_init', data => {
  $("#server i").css("color", "green");
  process_status(data.status);
})

// on data report update
let telemetry = { };
socket.on('telemetry-repeat', data => {
  process_data(data.data);
  process_status(data.status);
  
  if (data.status.session && graphs.length) {
    // on session generated
    if(!telemetry.session ) {
      for(const graph of $('#graph-car:checked, #graph-hv_batt:checked, #graph-motor:checked')) {
        socket.emit('graph-request', { target: graph.id.split('-')[1] });
      }
    }
  }

  // update telemetry
  telemetry = data.status;
});


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

  $("#core-temperature").text(parseFloat(status.system.temperature).toFixed(1));
}


// graph configs
let graphs = { };
let graph_data = { };
for (const canvas of document.getElementsByTagName('canvas')) graph_data[canvas.id] = [];

const graph_config = {
  'graph-core-temperature': { delay: 5000, grace: 5, color: 'rgb(54, 162, 235)' },
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
      }
    }
    case "BMS": {

    }
    case "INV": {

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
        }]
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
    Swal.fire({
      icon: 'info',
      title: tooltips[target].title,
      html: tooltips[target].desc,
      willClose: () => e.target.click(),
    });
  }
});

let tooltips = {
  'speed': { title: '차량 속도', desc: '모터 컨트롤러의 RPM 데이터에 기반한 차량의 주행 속도입니다.' },
  'acceleration': { title: '가속', desc: '가속 페달의 작동 정도입니다.'},
  'braking': { title: '제동', desc: '브레이크 페달의 작동 정도입니다.'},
  'core-temperature': { title: '프로세서 온도', desc: 'ECU 프로세서의 온도입니다.' },
  'battery-percent': { title: 'HV 배터리 잔량', desc: 'HV 배터리의 잔여 용량입니다.' },
  'battery-voltage': { title: 'HV 배터리 전압', desc: 'HV BUS의 전압입니다.' },
  'battery-current': { title: 'HV 배터리 전류', desc: 'HV BUS의 전류입니다.' },
  'battery-temperature': { title: 'HV 배터리 온도', desc: 'HV 배터리 팩의 온도입니다.' },
  'rpm': { title: 'RPM', desc: '모터의 분당 회전수입니다.' },
  'motor-temperature': { title: '모터 온도', desc: '모터의 온도입니다.' },
  'inverter-temperature': { title: '모터 컨트롤러 온도', desc: '모터 컨트롤러의 온도입니다.' },
};


// button handlers
$("#reset").on("click", e => {
  socket.emit('reset-request');
});

socket.on('reset-reply', data => {
  Swal.fire(data).then(result => {
    if(result.isConfirmed) socket.emit('reset-confirm');
  });
});

$("#log").on("click", e => {
  socket.emit('log-request');
});

socket.on('log-reply', data => {
  if (data.result) {
    Swal.fire({
      html: `<table id="log_table" class="compact cell-border stripe"><thead><tr><th>timestamp</th><th>level</th><th>device</th><th>key</th><th>value</th></tr></thead></table>`,
      showCloseButton: true,
      willOpen: dom => {
        $('#log_table').DataTable({
          data: data.data,
          paging: false,
          order: [[ 0, 'desc' ]],
          columns: [
            { data: 'datetime' },
            { data: 'level' },
            { data: 'component' },
            { data: 'key' },
            { data: 'value' }
          ],
          columnDefs: [{
            targets: 0,
            render: (data, type, row, meta) => {
              const date = new Date(data);
              return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`;
            } 
          }, {
            targets: "_all",
            className: "dt-head-center",
            orderable: false,
          }],
        });
      }
    });
  }
  else Swal.fire({
    icon: 'error',
    title: 'ECU 부트 로그 없음',
    html: `ECU가 부팅한 기록이 없습니다.`
  });
});


// GPS map handler
let map = new kakao.maps.Map(document.getElementById('map'), {
  center: new kakao.maps.LatLng(37.2837709, 127.0434392)
});