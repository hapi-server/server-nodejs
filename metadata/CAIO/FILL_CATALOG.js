const request = require('request');
const targz = require('targz');
const clc  = require('chalk');
const yargs  = require('yargs');
const fs = require('fs');
const path = require('path');

const argv = yargs
				.option('update', {
					description: 'Force update the existing metadata'
				})
                .help()
                .alias('help', 'h')
                .argv;

//var url = "https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=TASET&RETURN_TYPE=JSON&QUERY=(DATASET.IS_CEF='true')"
var url = 'https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&RETURN_TYPE=JSON';
//var url = 'https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&RETURN_TYPE=JSON&QUERY=(DATASET.IS_CEF=true)';
//var url = "https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&QUERY=FILE.START_DATE%20<=%20'"+argv.stop+"'%20AND%20FILE.END_DATE%20>=%20'"+argv.start+"'&PAGE_SIZE=100&PAGE=1&RETURN_TYPE=CSV"
//var url = "https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&QUERY=(DATASET.DATASET_ID%20like%20'C1_CP_EDI_EGD'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_EFW_L3_P'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_FGM_FULL')%20AND%20FILE.START_DATE%20<=%20'"+argv.start+"'%20AND%20FILE.END_DATE%20>=%20'"+argv.stop+"'&PAGE_SIZE=100&PAGE=1&RETURN_TYPE=CSV"
//var url = "https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&QUERY=(DATASET.DATASET_ID%20like%20'C1_CP_EDI_EGD'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_EFW_L3_P'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_FGM_FULL')%20AND%20FILE.START_DATE%20<=%20'"+argv.stop+"'%20AND%20FILE.END_DATE%20>=%20'"+argv.start+"'&PAGE_SIZE=100&PAGE=1&RETURN_TYPE=CSV"

var catalog = [];
var id_arr = [];

function fill_catalog(callback1){
	console.log("Requesting " + url);
	request(url, function (error, response, body) {
		console.log("Received " + url);
		if (error) {
			console.log("Request to url :"+ url+ "Failed due to :"+ error);
			process.exit(1);
		}   
		if (response && response.statusCode != 200) {
			console.log("Request to url :" 
                            + url
							+ "Failed due to no response or non-200 status code.");
			process.exit(1);
		}
		
		body = JSON.stringify(JSON.parse(body), null, 4);
		// Saves the JSON response into a file for later extraction of start_time
		// and stop_time while parsing the XML's
		console.log("Writing json_response.json");
		fs.writeFile(path.join(__dirname, "json_response.json"), body,
		function(err) {
			console.log("Wrote json_response.json");
			if(err) {
				return console.log(err);
			}
		});
		
		console.log("Building catalog.")
		var array = JSON.parse(body);
		for (item in array) {
			for (subItem in array[item]) {
				var catalog_obj = {
					"id": array[item][subItem]['DATASET.DATASET_ID'],
					"title": array[item][subItem]['DATASET.TITLE']
				}; 
				id_arr.push(array[item][subItem]['DATASET.DATASET_ID'] );
				catalog.push(catalog_obj);
			}
		}
		callback1();
		console.log("Built catalog.")
	});
}

fill_catalog(download_decompress);

function download_decompress(){
	// Save the /catalog response content to a file.
	console.log("Writing catalog_response.json");
	fs.writeFile(path.join(__dirname, "catalog_response.json"), JSON.stringify(catalog, null, 4),
	function(err) {
		console.log("Wrote catalog_response.json");
		if(err) {
			return console.log(err);
		}
	});
	
	//for(var i=1;i<id_arr.length;i++){
	for(var i=1;i<100;i++){
		id_arr[i] = id_arr[i].replace(/"/g, "");
		const filePath = path.join(__dirname, 'tmp', id_arr[i].toString()+ ".CEF.XML");
		// Downloads only if there is no exisitng metadata in the meta folder.
		// Force downloads the metadata of --update argument passed on command line.
		if(!fs.existsSync(filePath) || argv.update){
			var url  = "curl 'https://csa.esac.esa.int/csa/aio/product-action?RETRIEVALTYPE=HEADER&DATASET_ID=" + id_arr[i] + "'";
			var dir = './tmp';
			
			if (!fs.existsSync(dir)){
				fs.mkdirSync(dir);
			}	
			var path1 = "'"+ __dirname + "/tmp/" +id_arr[i] + ".tar.gz'";
			var cmd = url + ' > ' + path1.toString();
			let child;
			console.log("Executing " + url);
			try {
				child = require('child_process').spawnSync('sh', ['-c', cmd], {stdio: 'pipe'});
				console.log("Executed " + cmd);
			} catch (ex) {
				console.log(ds() + clc.red("Could not execute command: " + cmd + "."));
				if (ex.stderr) {
					console.log(clc.red(ex.stderr.toString()));
				}
				if (exit_if_fail) {
					process.exit(1);
				} else {  
					return false;
				}
			}
			
			// Decompresses tar.gz content into the tmp folder
			if (child.status == 0) {
				var tgz_tmp = __dirname + "/tmp/";
				var tgz = tgz_tmp+id_arr[i] +".tar.gz";
				console.log("Extracting " + tgz + " to " + tgz_tmp);
				targz.decompress({
					src: tgz,
					dest: tgz_tmp
				}, function(err){
					if (err) {
						console.log(clc.red("Error in Decompressing "+id_arr[i] + err));
					} 
					console.log("Extracted " + tgz + " to " + tgz_tmp);
				});
			}
		}
		else {
			console.log("Metadata file already exists for " + id_arr[i] + ". Will not redownload.");
		}
	} 
}
