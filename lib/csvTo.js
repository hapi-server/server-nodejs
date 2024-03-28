const log = require('log');

module.exports = csvTo;
function csvTo(records, first, last, header, includeHeader) {
  // Convert CSV to JSON or binary

  function prod(arr) {
    // Multiply all elements in array
    return arr.reduce(function(a,b){return a*b;});
  }

  function append(str, arr, N) {
    for (let i = 0;i < N;i++) {
      arr.push(str);
    }
    return arr;
  }

  // TODO: Do this on first call only.
  var size    = [];
  var sizes   = [];
  var name    = "";
  var names   = []; // Name associated with number in each column
  var type    = "";
  var types   = []; // Type associated with number in each column
  var length  = -1;
  var lengths = [];
  var po      = {}; // Parameter object

  for (var i = 0;i < header.parameters.length; i++) {
    size  = header.parameters[i]["size"] || [1];
    sizes = append(size,sizes,prod(size));
    name  = header.parameters[i]["name"];
    names = append(name,names,prod(size));
    type  = header.parameters[i]["type"];
    types = append(type,types,prod(size));
    length  = header.parameters[i]["length"] || -1;
    lengths = append(length,lengths,prod(size));
    po[header.parameters[i].name] = {};
    po[header.parameters[i].name]["type"] = header.parameters[i].type;
    po[header.parameters[i].name]["size"] = header.parameters[i].size || [1];
    if (po[header.parameters[i].name]["size"].length > 1) {
      if (header["format"] === "json") {
        log.warn("Warning. JSON for parameter "
                + name
                + " will be 1-D array instead of "
                + po[header.parameters[i].name]["size"].length
                + "-D");
      }
      po[header.parameters[i].name]["size"] =
        prod(po[header.parameters[i].name]["size"]);
    }
  }

  if (header["format"] === "json") {
    return csv2json(records, po, names, first, last, header, includeHeader);
  }

  if (header["format"] === "binary") {
    return csv2bin(records, types, lengths, sizes);
  }

  function csv2bin(records, types, lengths) {

    // TODO: Only handles integer and double.
    // TODO: Make this a command line program.

    // Does not use length info for Time variable - it is inferred
    // from input (so no padding).

    records = records.trim();
    var recordsarr = records.split("\n");
    var Nr = recordsarr.length; // Number of rows

    // Regex that handles quoted commas
    // from: https://stackoverflow.com/a/23582323
    var re = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/g;
    var record1 = recordsarr[0].split(re);
    var Nd = record1.length - 1; // Number of data columns

    var Nb = 0;
    for (let i = 0;i < types.length;i++) {
      if (types[i] === 'double') {
        Nb = Nb + 8;
      }
      if (types[i] === 'integer') {
        Nb = Nb + 4;
      }
      if (types[i] === 'string' || types[i] === 'isotime') {
        Nb = Nb + lengths[i];
      }
    }
    var recordbuff = new Buffer.alloc(Nr*Nb);
    var pos = 0;
    var truncated = 0;
    for (let i = 0; i < Nr; i++) {
      var record = recordsarr[i].split(re);
      for (var j = 0;j < Nd+1;j++) {
        //log.debug(`record ${i}, column ${j}: ${record[j]}`);
        if (types[j] === 'double') {
          recordbuff.writeDoubleLE(record[j],pos);
          pos = pos + 8;
        }
        if (types[j] === 'integer') {
          recordbuff.writeInt32LE(record[j],pos);
          pos = pos + 4;
        }
        if (types[j] === 'string' || types[j] === 'isotime') {
          let buffer = Buffer.from(record[j],'utf8');
          if (buffer.length > lengths[j]) {
            log.error(`${record[j]} was truncated: `,record[j],buffer.length,"bytes");
            truncated = truncated + 1;
          }
          recordbuff.write(record[j],pos,'utf8')
          pos = pos + lengths[j];
        }
      }
    }
    if (truncated > 0) {
      log.error(truncated
                + " string(s) were truncated because they"
                + " were longer than length given in metadata");
    }
    log.debug("Returning binary data of length " + Buffer.byteLength(recordbuff, 'utf8') + " bytes.");
    return recordbuff;
  }

  function csv2json(records, po, names, first, last, header, includeHeader) {

    // Only handles 1-D arrays, e.g., size = [N], N integer.

    let recordsarr = records.split("\n");
    if (recordsarr[recordsarr.length-1] === '') {
      // Empty element due to trailing newline.
      recordsarr.pop();
    }

    records = "";
    var cols    = [];
    var open    = "";
    var close   = "";
    var nw      = 0;
    for (var i = 0;i < recordsarr.length;i++) {
      cols    = recordsarr[i].split(",");
      let record  = "";
      nw      = 0;
      for (var j = 0;j < cols.length;j++) {
        if (j == 0) {
          record = "[";
        }
        open  = "";
        close = "";
        if (po[names[j]].size[0] > 1) {
          if (open.length == 0 && nw == 0) {open = "["}
          nw = nw + 1;
        }
        if (po[names[j]].size[0] > 1 && nw == po[names[j]].size[0]) {
          close = "]";
          open = "";
          nw = 0;
        }
        if (types[j] === "integer") {
          record = record + open + parseInt(cols[j])   + close + ",";
        } else if (types[j] === "double") {
          record = record + open + parseFloat(cols[j]) + close + ",";
        } else {
          record = record + open + '"' + cols[j] + '"' + close + ",";
        }
      }
      if (i > 0) {
        records = records + "\n" + record.slice(0,-1) + "],";
      } else {
        records = record.slice(0,-1) + "],";
      }
    }
    open = "";close = "";
    if (first == true) {
      if (includeHeader) {
        // Remove closing } and replace with new element.
        open = JSON
        .stringify(header,null,4)
        .replace(/}\s*$/,"") + ',\n"data":\n[\n';
      } else {
        open = '[\n';
      }
    }
    if (last == true) {
      if (includeHeader) {
        close = "\n]\n}\n";
      } else {
        close = "\n]\n";
      }
    }
    return open + records.slice(0,-1) + close;
  }
}