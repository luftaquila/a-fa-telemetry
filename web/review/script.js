log = [];

loadfile();
async function loadfile() {
  const res = await fetch("https://a-fa.luftaquila.io/telemetry/review/list");
  for (const log of JSON.parse(await res.text()).reverse()) {
    $('#prevlog').append(`<option value="${log}">${log}</option>`);
  }

  const prevfile = new URLSearchParams(window.location.search).get('file');
  if (prevfile) {
    const res = await fetch("https://a-fa.luftaquila.io/telemetry/review/datalogs/" + prevfile);

    const raw = await res.blob();
    processRaw(raw, prevfile);
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

async function processRaw(raw, filename) {
  let buffer = await raw.arrayBuffer();
  buffer = new Uint8Array(buffer);

  const log_size = 16;
  let index = 0;
  let count = buffer.length / log_size;

  while (index < buffer.length) {
    log.push(convert(buffer.slice(index, index + log_size)));
    index += 16;
  }

  let converted = { };

  converted.json = JSON.stringify(log);
  $("#json").val(converted.json);
  $("#json_download").attr("href", "data:text/json;charset=utf-8," + encodeURIComponent(converted.json)).attr("download", `${filename}.json`);
  delete converted.json;

  converted.csv = doCSV(log);
  $("#csv").val(converted.csv);
  $("#csv_download").attr("href", "data:text/csv;charset=utf-8," + encodeURIComponent(converted.csv)).attr("download", `${filename}.csv`);
  delete converted.csv;

  $("#bin_download").attr("href", `datalogs/${filename}`);
}

/* FROM https://github.com/konklone/json */
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
