log = [];
filename = "";

loadfile();
async function loadfile() {
  const res = await fetch("https://a-fa.luftaquila.io/telemetry/review/list");
  for (const log of JSON.parse(await res.text()).reverse()) {
    $('#prevlog').append(`<option value="${log}">${log}</option>`);
  }

  const prevfile = new URLSearchParams(window.location.search).get('file');
  if (prevfile) {
    $("#load_file_first").text("파일 불러오는 중...");
    const res = await fetch("https://a-fa.luftaquila.io/telemetry/review/datalogs/" + prevfile);

    const raw = await res.blob();
    processRaw(raw, prevfile);
  }

  drawGraph();
}

function drawGraph() {
  const canvas = document.getElementById('graph-review');

  chart = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [],
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
      elements: {
        point: {
          hitRadius: 10,
        }
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'second',
            displayFormats: {
              second: 'hh:mm:ss'
            }
          },
        },
      },
      plugins: {
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x',
          }
        },
        tooltip: {
          position: 'bottom',
        },
        crosshair: {
          line: {
            color: 'black',
            width: 1,
          },
          sync: {
            enabled: true,
            group: 1,
            suppressTooltips: false,
          },
          zoom: {
            enabled: true,
            zoomButtonText: '줌 리셋',
            zoomButtonClass: 'reset-zoom btn purple',
          },
          callbacks: {
            beforeZoom: () => function(start, end) {
              return true;
            },
            afterZoom: () => function(start, end) {
            }
          }
        }
      }
    },
    elements: {
      point: {
        borderWidth: 0,
        radius: 2,
        backgroundColor: 'rgba(0, 0, 0, 0)'
      }
    }
  });
}

async function processRaw(raw, file_name) {
  filename = file_name;
  file_date = file_name.replace("A-FA ", "").replace(".log", "").replace(" ", "-").split("-");
  file_date = new Date(file_date[0], file_date[1] - 1, file_date[2], file_date[3], file_date[4], file_date[5]);

  let buffer = await raw.arrayBuffer();
  buffer = new Uint8Array(buffer);

  const log_size = 16;
  let index = 0;
  let error = 0;
  let count = buffer.length / log_size;

  while (index < buffer.length) {
    let converted_log = convert(buffer.slice(index, index + log_size));

    if (converted_log) {
      converted_log.datetime = new Date(file_date.getTime() + converted_log.timestamp).format("yyyy-mm-dd HH:MM:ss.l");
      log.push(converted_log);
    } else {
      error++;
    }

    index += log_size;
  }

  $("#bin_download").attr("href", `datalogs/${filename}`);

  // process finished
  console.log(log);

  let keylist = [];

  for (let data of log) {
    if (!keylist.find(x => x.key == data.key) && data.key && typeof data.parsed == 'object') {
      if (!data.key.includes("GPS") && !data.key.includes("FIRMWARE")) {
        keylist.push({
          key: data.key,
          parsed: data.parsed
        });
      }
    }
  }

  let paramlist = [];
  for (let key of keylist) {
    if (!key.parsed) continue;
    for (let param of Object.keys(key.parsed)) {
      if (typeof param != 'object') {
        paramlist.push(`${key.key} / ${param}`);
      }
    }
  }

  $("#parameter_list").html(`<option value="" disabled selected>그래프에 추가할 데이터를 선택하세요.</option>` + paramlist.map(x => `<option value='${x}'>${x}</option>`).join(''));

  $("#load_file_first").text(`현재 파일: ${filename}`);
  $("#data-count").text(count);
  $("#error-count").text(error);
  $("#converted-count").text(count - error);
  $("#duration").text(((log[log.length - 1].timestamp - log[0].timestamp) / (1000 * 60)).toFixed(0));
  $(".btn_download, #parameter_list, #add_parameter").removeClass("disabled");
}


/*************************************************
 * jquery event listeners
 */
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
      processRaw(raw, file.name);
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

$("#json_download").click(function() {
  let json = JSON.stringify(log);
  saveAs(new File([json], `${filename}.json`, { type: 'text/json;charset=utf-8' }));
  setTimeout()
});

$("#csv_download").click(function() {
  let csv = doCSV(log);
  saveAs(new File([csv], `${filename}.csv`, { type: 'text/csv;charset=utf-8' }));
});

$("#add_parameter").click(function() {
  const val = $("#parameter_list").val();
  const tmp = val.split(' / ')
  const key = tmp[0], param = tmp[1];

  const arr = log.filter(x => x.key == key);
  let target = arr.map(k => { return { x: new Date(k.datetime).getTime(), y: k.parsed[param] } });

  target = target.map(x => { if (key == 'CAN_INV_MOTOR_POS') { return { x: x.x, y: x.y / 100 } } else { return x }  })

  const color = getRandomColor();
  const data = {
    label: val,
    backgroundColor: color,
    borderColor: color,
    data: target,
  };

  chart.data.datasets.push(data);
  chart.update();
});


/**************************************************
 * JSON to CSV from https://github.com/konklone/json
 */
function doCSV(json) {
  // 1) find the primary array to iterate over
  // 2) for each item in that array, recursively flatten it into a tabular object
  // 3) turn that tabular object into a CSV row using jquery-csv
  var inArray = arrayFrom(json);

  var outArray = [];
  for (var row in inArray)
      outArray[outArray.length] = parse_object(inArray[row]);

  return $.csv.fromObjects(outArray, {separator: ','});
}

function arrayFrom(json) {
    var queue = [], next = json;
    while (next !== undefined) {
        if ($.type(next) == "array") {

            // but don't if it's just empty, or an array of scalars
            if (next.length > 0) {

              var type = $.type(next[0]);
              var scalar = (type == "number" || type == "string" || type == "boolean" || type == "null");

              if (!scalar)
                return next;
            }
        } if ($.type(next) == "object") {
          for (var key in next)
             queue.push(next[key]);
        }
        next = queue.shift();
    }
    // none found, consider the whole object a row
    return [json];
}

function parse_object(obj, path) {
    if (path == undefined)
        path = "";

    var type = $.type(obj);
    var scalar = (type == "number" || type == "string" || type == "boolean" || type == "null");

    if (type == "array" || type == "object") {
        var d = {};
        for (var i in obj) {

            var newD = parse_object(obj[i], path + i + "/");
            $.extend(d, newD);
        }

        return d;
    }

    else if (scalar) {
        var d = {};
        var endPath = path.substr(0, path.length-1);
        d[endPath] = obj;
        return d;
    }

    // ?
    else return {};
}


/*********************************************
 * DateFormat
 */
var dateFormat = function () {
  var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
    timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
    timezoneClip = /[^-+\dA-Z]/g,
    pad = function (val, len) {
      val = String(val);
      len = len || 2;
      while (val.length < len) val = "0" + val;
      return val;
    };
  return function (date, mask, utc) {
    var dF = dateFormat;
    if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
      mask = date;
      date = undefined;
    }
    date = date ? new Date(date) : new Date;
    if (isNaN(date)) throw SyntaxError("invalid date");
    mask = String(dF.masks[mask] || mask || dF.masks["default"]);
    if (mask.slice(0, 4) == "UTC:") {
      mask = mask.slice(4);
      utc = true;
    }
    var	_ = utc ? "getUTC" : "get",
      d = date[_ + "Date"](),
      D = date[_ + "Day"](),
      m = date[_ + "Month"](),
      y = date[_ + "FullYear"](),
      H = date[_ + "Hours"](),
      M = date[_ + "Minutes"](),
      s = date[_ + "Seconds"](),
      L = date[_ + "Milliseconds"](),
      o = utc ? 0 : date.getTimezoneOffset(),
      flags = {
        d:    d,
        dd:   pad(d),
        ddd:  dF.i18n.dayNames[D],
        dddd: dF.i18n.dayNames[D + 7],
        m:    m + 1,
        mm:   pad(m + 1),
        mmm:  dF.i18n.monthNames[m],
        mmmm: dF.i18n.monthNames[m + 12],
        yy:   String(y).slice(2),
        yyyy: y,
        h:    H % 12 || 12,
        hh:   pad(H % 12 || 12),
        H:    H,
        HH:   pad(H),
        M:    M,
        MM:   pad(M),
        s:    s,
        ss:   pad(s),
        l:    pad(L, 3),
        L:    pad(L > 99 ? Math.round(L / 10) : L),
        t:    H < 12 ? "a"  : "p",
        tt:   H < 12 ? "am" : "pm",
        T:    H < 12 ? "A"  : "P",
        TT:   H < 12 ? "오전" : "오후",
        Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
        o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
        S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
      };
    return mask.replace(token, function ($0) {
      return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
    });
  };
}();
dateFormat.masks = {"default":"ddd mmm dd yyyy HH:MM:ss"};
dateFormat.i18n = {
  dayNames: [
    "일", "월", "화", "수", "목", "금", "토",
    "일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"
  ],
  monthNames: [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
  ]
};
Date.prototype.format = function (mask, utc) { return dateFormat(this, mask, utc); };

/***************************************
 * chart.js functions
 */
function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

Chart.Tooltip.positioners.bottom = function(items, coord) {
  const pos = Chart.Tooltip.positioners.average(items);

  // Happens when nothing is found
  if (pos === false) {
    return false;
  }

  const chart = this.chart;

  return {
    x: coord.x,
    y: chart.chartArea.top,
    xAlign: 'center',
    yAlign: 'top',
  };
};
