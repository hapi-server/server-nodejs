var request = require('request');
var targz = require('targz');
const clc  = require('chalk');
const yargs  = require('yargs');
const fs = require('fs');
var path = require('path');

const argv = yargs
    .option('start', {
      description: 'Start Time',
    })
    .option('stop', {
    description: 'Stop Time',
   })
    .help()
    .alias('help', 'h')
    .argv;

//var url = 'https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&RETURN_TYPE=CSV';
var url = "https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&QUERY=FILE.START_DATE%20<=%20'"+argv.stop+"'%20AND%20FILE.END_DATE%20>=%20'"+argv.start+"'&PAGE_SIZE=100&PAGE=1&RETURN_TYPE=CSV"
//var url = "https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&QUERY=(DATASET.DATASET_ID%20like%20'C1_CP_EDI_EGD'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_EFW_L3_P'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_FGM_FULL')%20AND%20FILE.START_DATE%20<=%20'"+argv.start+"'%20AND%20FILE.END_DATE%20>=%20'"+argv.stop+"'&PAGE_SIZE=100&PAGE=1&RETURN_TYPE=CSV"

console.log("The url is "+ url);

var catalog = [];
var id_arr = [];
//Since the JSON file requires the start and stop time from the CSV response, a JSON object shall be created storing these values
var start_stop_map = {};

function fill_catalog(callback1){

  request(url, function (error, response, body) {

    if (error) {
      console.log("Request to url :"+ url+ "Failed due to :"+ error);
      process.exit(1);
    }   

    if (response && response.statusCode != 200) {
      process.exit(1);
    }
//Just splitting each line using "," won't work since the title may contain additional commas(","). So repeated substrings are extracted using the first 
//occurrence of comma "," each time. 


    var array = body.split("\n"); 
    array.forEach(function(line) {
     if(line.length > 0){
      var init_point = 0;
      var n = line.indexOf(",");
      var id = line.substring(init_point, n); //Extracts id
      line = line.substring(n+1, line.length);
      init_point = 0;
      for(var i=1;i<3;i++){   
        var n = line.indexOf(",");
        if(i ==1){
          start_stop_map[id.replace(/"/g, "")+"_start"] = line.substring(0, n).replace(/"/g, ""); //extracts start_time
        }   
        if(i==2){
          start_stop_map[id.replace(/"/g, "")+"_stop"] = line.substring(0, n).replace(/"/g, ""); //extracts stop_time
        }
        line =  line.substring(n+1, line.length);    
      }
      var catalog_obj = '{"id":'+ id +',"title":'+ line+'}'; //extracts title
      id_arr.push(id);
      catalog.push(catalog_obj);
    }
    })
  callback1();
  })
}

fill_catalog(download_decompress);

function download_decompress(){

  //stores the start and stop times of each /info object in a json array.
  fs.writeFile(path.join(__dirname, "start_stop_map.json"), JSON.stringify(start_stop_map), function(err) {
    if(err) {
      return console.log(err);
    }
  });
//loading the /catalog response to a file
  fs.writeFile(path.join(__dirname, "catalog_response.json"), JSON.stringify(catalog), function(err) {
    if(err) {
      return console.log(err);
    }
  });

  for(var i=1;i<3;i++){
    id_arr[i] = id_arr[i].replace(/"/g, "");
    const filePath = path.join(__dirname, 'meta', id_arr[i].toString()+ ".JSON");
    //Downloads only if there is no exisitng metadata in the meta folder.
    if(!fs.existsSync(filePath)){
      var url  = "curl 'https://csa.esac.esa.int/csa/aio/product-action?RETRIEVALTYPE=HEADER&DATASET_ID="+ id_arr[i]+"'";
      var dir = './tmp';

      if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
      }

      var path1 = "'"+ __dirname + "/tmp/" +id_arr[i] + ".tar.gz'";
      var cmd = url + ' > ' + path1.toString();
      let child;
      try {
        child = require('child_process').spawnSync('sh', ['-c', cmd], {stdio: 'pipe'});
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
//Decompresses each of the file content into the tmp folder
      if (child.status == 0) {
        targz.decompress({
        src: __dirname + "/tmp/"+id_arr[i] +".tar.gz",
        dest: __dirname + "/tmp/"
        }, function(err){
          if(err) {
            console.log(clc.red("Error in Decompressing "+id_arr[i] + err));
          } 
        })
      }
    }
    else {
      console.log(clc.yellow("Metadata already existing for "+ id_arr[i]+ " So not downloading again."));
    }
  } 
}
