var request = require('request');
var targz = require('targz');
const clc  = require('chalk');
const yargs  = require('yargs');
const fs = require('fs');
var path = require('path');

const argv = yargs
   .option('update', {
    description: 'Force update the existing metadata',
   })
    .help()
    .alias('help', 'h')
    .argv;

var url = 'https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&RETURN_TYPE=JSON';
//var url = "https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&QUERY=FILE.START_DATE%20<=%20'"+argv.stop+"'%20AND%20FILE.END_DATE%20>=%20'"+argv.start+"'&PAGE_SIZE=100&PAGE=1&RETURN_TYPE=CSV"
//var url = "https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&QUERY=(DATASET.DATASET_ID%20like%20'C1_CP_EDI_EGD'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_EFW_L3_P'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_FGM_FULL')%20AND%20FILE.START_DATE%20<=%20'"+argv.start+"'%20AND%20FILE.END_DATE%20>=%20'"+argv.stop+"'&PAGE_SIZE=100&PAGE=1&RETURN_TYPE=CSV"
//var url = "https://csa.esac.esa.int/csa/aio/metadata-action?SELECTED_FIELDS=DATASET.DATASET_ID,DATASET.START_DATE,DATASET.END_DATE,DATASET.TITLE&RESOURCE_CLASS=DATASET&QUERY=(DATASET.DATASET_ID%20like%20'C1_CP_EDI_EGD'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_EFW_L3_P'%20OR%20DATASET.DATASET_ID%20like%20'C1_CP_FGM_FULL')%20AND%20FILE.START_DATE%20<=%20'"+argv.stop+"'%20AND%20FILE.END_DATE%20>=%20'"+argv.start+"'&PAGE_SIZE=100&PAGE=1&RETURN_TYPE=CSV"

var catalog = [];
var id_arr = [];

function fill_catalog(callback1){

  request(url, function (error, response, body) {

    if (error) {
      console.log("Request to url :"+ url+ "Failed due to :"+ error);
      process.exit(1);
    }   

    if (response && response.statusCode != 200) {
      process.exit(1);
    }
    //Loads the JSON response into a file for the extraction of start_time and stop_time while parsing the XML's
    fs.writeFile(path.join(__dirname, "json_response.json"), body, function(err) {
      if(err) {
      return console.log(err);
      }
    });

    var array = JSON.parse(body);
    for (item in array) {
      for (subItem in array[item]) {
         var catalog_obj = '{"id":'+ array[item][subItem]['DATASET.DATASET_ID'] +',"title":'+ array[item][subItem]['DATASET.TITLE']+'}'; //extracts title
           id_arr.push(array[item][subItem]['DATASET.DATASET_ID'] );
          catalog.push(catalog_obj);
         }
      }
    callback1();
  });
}

fill_catalog(download_decompress);

function download_decompress(){
//loading the /catalog response to a file
  fs.writeFile(path.join(__dirname, "catalog_response.json"), catalog, function(err) {
    if(err) {
      return console.log(err);
    }
  });

  for(var i=1;i<5;i++){
    id_arr[i] = id_arr[i].replace(/"/g, "");
    const filePath = path.join(__dirname, 'tmp', id_arr[i].toString()+ ".CEF.XML");
    //Downloads only if there is no exisitng metadata in the meta folder. Force downloads the metadata upon --update true
    if(!fs.existsSync(filePath) || argv.update){
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
        });
      }
    }
    else {
      console.log("Metadata already existing for "+ id_arr[i]+ " So not downloading again.");
    }
  } 
}
