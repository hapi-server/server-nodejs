var fs       = require('fs');
var http     = require('http');
var readline = require('readline');
var yargs    = require('yargs');

let argv = yargs
	.default({
		'columns': '',
		'start': '0001-01-01T00:00:00.000000000Z',
		'stop': '9999-12-31T23:59:59.999999999Z',
		'file': '',
		'url': '',
		'format': 'csv'
	})
	.option('columns', {type:'string'})
	.option('start', {type:'string'})
	.option('stop', {type:'string'})
	.argv;

function range(start, end) {
	var arr = [];
	for (var i = start; i <= end; i += 1) {
		arr.push(i);
	}
	return arr;
}

let columnsarr = [];
if (argv.columns !== '') {
	// Convert, e.g, "1,2,4-6" to [1,2,4,5,6] - 1
	let tmp = argv.columns.split(",");
	for (i = 0; i < tmp.length; i++) {
		if (/-/.test(tmp[i])) {
			tmp2 = tmp[i].split("-");
			let expanded = range(parseInt(tmp2[0])-1,parseInt(tmp2[1])-1);
			columnsarr = columnsarr.concat(expanded);
		} else {
			columnsarr.push(tmp[i]-1);
		}
	}
} else {
	columnsarr = null;
}

if (argv.file !== '') {
	if (argv.format !== 'csv') {
		console.log('Only --format=csv is implemented');
		process.exit(1);
	}
	readlines(fs.createReadStream(argv.file));
} else if (argv.url !== '') {
	http.get(argv.url, res => readlines(res));
} else {
	readlines(process.stdin);
}

function readlines(readableStream) {
	var rl = readline.createInterface({
		input: readableStream,
		output: process.stdout,
		terminal: false
	})
	.on('line', function(line){
		let linea = line.split(',');
		let time = linea[0].trim();
		let l = time.length;
		let m = Math.min(l,argv.start.length,argv.stop.length);
		let start = argv.start.slice(0,m);
		let stop = argv.stop.slice(0,m);
		time = time.slice(0,m);
		if (time >= start && time < stop) {
			if (columnsarr == null) {
				console.log(line.trim());
			} else {
				line = "";
				for (let i = 0;i < columnsarr.length;i++) {
					line = line + linea[columnsarr[i]] + ",";
				}
				console.log(line.slice(0,-1).trim());
			}
		}
		if (time >= stop) {
			process.exit(0);
		}
	})
}