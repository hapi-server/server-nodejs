const fs = require('fs');
var path = require('path');
const xml2js = require('xml2js');
const yargs  = require('yargs');
const clc  = require('chalk');

const argv = yargs
  .option('file', {
    description: 'File to Parse',
   })
  .help()
  .alias('help', 'h')
  .argv;

var file_to_parse = path.join(__dirname, 'tmp', argv.file);
var start_time = "";
var stop_time = "";

//Gets the start_time and stop_time for the metadata from the JSON repsonse
function extract_start_stop(callback){
  let json_response= fs.readFileSync('json_response.json');
  let array = JSON.parse(json_response);

  for (item in array) {
    for (subItem in array[item]) {
      if( array[item][subItem]['DATASET.DATASET_ID'] === argv.file.replace('.CEF.XML','')) {
          start_time = array[item][subItem]['DATASET.START_DATE'];
          stop_time = array[item][subItem]['DATASET.END_DATE'];      
          break;    
      }
    }
  }
  callback();
}


//Will parse each file sent as a argument and converts the XML into HAPI metadata format
function parsing(){
  if (fs.existsSync(file_to_parse)) {
    fs.readFile(file_to_parse, (err, data) => {
	    xml2js.parseString(data, (err, result) => { 
        if(err) {
          throw err;
        }
        res = JSON.stringify(result, null, 4);
      });
      const obj = JSON.parse(res);
      var resobj = {
      };

    resobj.parameters = [];
    var paramarray = obj.DATASETS.DATASET_METADATA;

    if( paramarray[paramarray.length-1].PARAMETERS != undefined ){
      paramarray[paramarray.length-1].PARAMETERS[0].PARAMETER.forEach(element => {

       if(element.PARAMETER_ID === undefined || element.FIELDNAM ===  undefined || element.UNITS === undefined || element.FILLVAL === undefined || element.VALUE_TYPE === undefined ) {
          console.log("Missing elements for "+ argv.file + " :");
          if(element.PARAMETER_ID === undefined ){
            console.log(clc.yellow("name"));
          } 
          if(element.UNITS === undefined ){
            console.log(clc.yellow("units"));
          } 
          if(element.FIELDNAM === undefined ){
            console.log(clc.yellow("description"));
          } 
          if(element.FILLVAL === undefined ){
            console.log(clc.yellow("fill"));
          } 
          if(element.VALUE_TYPE === undefined ){
            console.log(clc.yellow("type"));
          } 
          
       }

        var paramobj = {
          name :element.PARAMETER_ID === undefined ? "" : element.PARAMETER_ID.toString(),
          description: element.FIELDNAM ===  undefined ? "" : element.FIELDNAM.toString(),
          units :  element.UNITS === undefined ? "" : element.UNITS.toString(),
          fill : element.FILLVAL === undefined ? "" : element.FILLVAL.toString(),
          type : element.VALUE_TYPE === undefined ? "" : element.VALUE_TYPE.toString()
        };

      resobj.parameters.push(paramobj);

      });
    } else {
      console.log(clc.yellow("Warning: "+ argv.file + " does not have parameters!"))
    }

    var buildobj = {
      startDate : start_time,
      stopDate : stop_time,
      cadence : paramarray[paramarray.length-1].TIME_RESOLUTION.toString(),
      description: paramarray[paramarray.length-1].DATASET_DESCRIPTION.toString(),
      resourceURL : "https://csa.esac.esa.int/csa/aio/product-action?RETRIEVALTYPE=HEADER&DATASET_ID="+argv.file.replace('.CEF.XML',''),
      contact : paramarray[paramarray.length-1].CONTACT_COORDINATES.toString(),
      x_original_metadata: res,
      parameters: resobj.parameters
    }

    var dir = './meta';

    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }

    //Stores the resulting metadata created into the meta folder.
    fs.writeFile (path.join(__dirname,"meta", argv.file.replace('.CEF.XML','.JSON')), JSON.stringify(buildobj), function(err) {
      if (err) throw err;
    });

	 });
  }
	else {
		console.log(clc.red("XML File not found to parse for "+argv.file.replace('.CEF.XML','')));
  } 
}
extract_start_stop(parsing);