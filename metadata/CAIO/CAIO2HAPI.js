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
        var paramobj = {
          name :element.PARAMETER_ID === undefined ? "" : element.PARAMETER_ID.toString(),
          description: element.FIELDNAM ===  undefined ? "" : element.FIELDNAM.toString(),
          units :  element.UNITS === undefined ? "" : element.UNITS.toString(),
          fill : element.FILLVAL === undefined ? "" : element.FILLVAL.toString(),
          type : element.VALUE_TYPE === undefined ? "" : element.VALUE_TYPE.toString()
        };

      resobj.parameters.push(paramobj);

      });
    }

    let start_stop_rawdata = fs.readFileSync('start_stop_map.json');
    let start_stop_map = JSON.parse(start_stop_rawdata);
    var start_date = start_stop_map[argv.file.replace('.CEF.XML','')+ "_start"];
    var stop_date = start_stop_map[argv.file.replace('.CEF.XML','')+ "_stop"];

    var buildobj = {
      startDate : start_date,
      stopDate : stop_date,
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
parsing();
