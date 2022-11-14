if (!"serial" in navigator) {
  Swal.fire({
    icon: 'error',
    title: 'Web Serial API 없음',
    html: `<br>시리얼 통신 API를 지원하지 않는 브라우저입니다.<br><br>이 서비스는<br><br><a class="btn green" href="https://www.google.com/chrome/"><i class="fa-brands fa-chrome"></i>&ensp;Chrome</a>&emsp;<a class="btn blue" href="https://www.microsoft.com/en-us/edge#evergreen"><i class="fa-brands fa-edge"></i>&ensp;Edge</a>&emsp;<a class="btn red" href="https://www.opera.com/ko"><i class="fa-brands fa-opera"></i>&ensp;Opera</a><br><br>에서만 사용 가능합니다.`
  })
}

listen = true;
$("#connect").click(async function() {
  // stop connection
  if($("#connect").hasClass("connected")) {
    listen = false;
    await reader.releaseLock();
    $("#connect").removeClass("connected").removeClass("red").removeClass("yellow").addClass("green").html('<i class="fa-solid fa-fw fa-plug"></i>&ensp;연결');
  }

  // open connection
  else readFromSerial();
});

async function readFromSerial() {
  // display port prompt
  const port = await navigator.serial.requestPort({
    filters: [{ usbVendorId: 6790, usbProductId: 29987 }]
  });

  $("#connect").addClass("connected").addClass("yellow").removeClass("green").removeClass("red").html('<i class="fa-solid fa-fw fa-plug-circle-exclamation"></i>&ensp;연결 중...');

  // open selected port
  await port.open({ baudRate: 9600 });

  // open stream pipe and lock port
  reader = port.readable
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new TransformStream(new LineBreakTransformer()))
  .getReader();

  while (port.readable) {
    try {
      while (listen) {
        const { value, done } = await reader.read();
        if (done) break;

        stringParser(value);
      }
    }
    catch(e) {
      Swal.fire({
        icon: 'error',
        title: e,
        html: '장치가 분리되었습니다. 다시 연결하려면 페이지를 새로고침하세요.'
      });
      $("#nano .indicator").css("background-color", "red").css("border-color", "red")
      $("#nano .indicator_text").text("OFFLINE");
     }
    finally {
      await reader.releaseLock();
    }
    try {
      await port.close();
    }
    catch(e) {
      Swal.fire({
        icon: 'error',
        title: e,
        html: '포트가 닫히지 않았습니다. 다시 연결하려면 페이지를 새로고침하세요.'
      });
      $("#nano .indicator").css("background-color", "red").css("border-color", "red")
      $("#nano .indicator_text").text("OFFLINE");
    }
  }
}

function stringParser(str) {
  let sum = 0;
  for (let weight of str.slice(1).split('|')) {
    weight = weight.split(':');
    weight[1] = Math.abs(Number(weight[1])) < 0.1 ? Math.abs(Number(weight[1])) : Number(weight[1]);
    $("#" + weight[0] + " .kg").text(weight[1].toFixed(1));
    graph_data[weight[0]].push( { x: new Date(), y: weight[1] } );
    sum += weight[1];
  }
  $("#SUM .kg").text(sum.toFixed(1));

  $("#nano .indicator").css("background-color", "green").css("border-color", "green")
  $("#nano .indicator_text").text("ONLINE");
  $("#connect").addClass("connected").addClass("red").removeClass("green").removeClass("yellow").html('<i class="fa-solid fa-fw fa-plug-circle-xmark"></i>&ensp;해제');
}

let graph_data = {
  FL: [],
  FR: [],
  RL: [],
  RR: []
};

const graph = new Chart(document.getElementById("graph"), {
  type: 'line',
  data: {
    datasets: [{
      label: 'FL',
      data: graph_data.FL,
      cubicInterpolationMode: 'monotone',
      tension: 0.2,
      borderColor: '#ff6384'
    }, {
      label: 'FR',
      data: graph_data.FR,
      cubicInterpolationMode: 'monotone',
      tension: 0.2,
      borderColor: '#36a2eb'
    }, {
      label: 'RL',
      data: graph_data.RL,
      cubicInterpolationMode: 'monotone',
      tension: 0.2,
      borderColor: '#cc65fe'
    }, {
      label: 'RR',
      data: graph_data.RR,
      cubicInterpolationMode: 'monotone',
      tension: 0.2,
      borderColor: '#ffce56'
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
          unitStepSize: 5,
          stepSize: 5,
          displayFormats: {
            hour: 'h:mm:ss',
            minute: 'h:mm:ss',
            second: 'h:mm:ss'
          }
        },
        realtime: {
          duration: 10000,
          refresh: 100,
        }
      },
      y: {
        grace: '10%',
        ticks: {
          count: 5
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom'
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

$("#help").click(function() {
  Swal.fire({
    icon: 'info',
    html: `<div style="text-align: left; font-size: 1rem; line-height: 1.5rem;"><h3>사용법</h3><ol><li>저울의 아두이노를 USB 케이블로 컴퓨터와 연결합니다.</li><li><span class="connect noselect btn green" ><i class="fa-solid fa-fw fa-plug"></i>&ensp;연결</span>을 누르고, 표시되는 시리얼 장치와 연결합니다.</li><li>연결될 때까지 잠시 기다립니다. 10초 이상 기다려도 연결되지 않으면 페이지를 새로고침하고, 연결 상태를 확인한 후 다시 시도하세요.</li></ol><h3>주의사항</h3><ul><li><b>영점 조정</b><br>영점은 아두이노가 처음 켜지는 순간을 기준으로 설정됩니다. 영점이 맞지 않는다면 아두이노 보드에 있는 리셋 버튼을 눌러 새로 영점을 맞추세요.<br><br></li><li><b>몇 가지 버그</b><br>기능이 완전하지 않아 가끔 페이지가 멈추거나 튕깁니다(...)<ul><li>차트가 움직이지 않거나 페이지가 멈춘 것 같다면 멈춘 탭을 닫고, 새 탭에서 재접속해 보세요.</li><li>여러 개러 탭에 이 서비스를 동시에 띄워놓고 사용할 수는 없습니다. 새 탭에서 열었다면, 멈춘 탭은 꼭 닫아 주어야 합니다.</li><li>특히 연결 해제가 정상적으로 작동하지 않습니다. 연결을 해제했다가 다시 연결할 때는 페이지를 새로고침해야 합니다.</li></ul><br></li><li><b>브라우저</b><br>이 서비스는 Web Serial API를 지원하는 Chrome, Edge, Opera 최신 버전 브라우저에서만 작동합니다.</li></ul><div style="text-align: right; margin-top: 1rem">개발: 소프트웨어학과 18학번 <a href="https://luftaquila.io">오병준</a></div></div>`
  });
});

class LineBreakTransformer {
  constructor() {
    this.container = '';
  }

  transform(chunk, controller) {
    this.container += chunk;
    const lines = this.container.split('\r\n');
    this.container = lines.pop();
    lines.forEach(line => controller.enqueue(line));
  }

  flush(controller) {
    controller.enqueue(this.container);
  }
}
