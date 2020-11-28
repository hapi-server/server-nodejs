const fs = require('fs');
var path = require('path');
const clc  = require('chalk');
const yargs  = require('yargs');

const argv = yargs
  .option('start', {
    description: 'Start Time',
  })
  .option('stop', {
    description: 'Stop Time',
   })
  .help()
  .alias('help', 'h')
  .default({
    'start': '2001-02-01',
    'stop': '2001-02-05',
  })
  .argv;

  //For generating the /catalog response. FILL_CATALOG will download and decompress each of the /info response files as well.
var com = 'node FILL_CATALOG.js --start ' + argv.start + ' --stop '+ argv.stop ;
let catalog_child;
try {
  catalog_child = require('child_process').spawnSync('sh', ['-c', com], {stdio: 'pipe'});
} catch (ex) {
  console.log(ds() + clc.red("Error when executing: " + com + "."));
  if (ex.stderr) {
    console.log(clc.red(ex.stderr.toString()));
  }
  if (exit_if_fail) {
    process.exit(1);
  } else {
    return false;
  }
}

if (catalog_child.status == 0) {
  console.log("Generated the catalog response Sucessfully!");
} else {
  console.log(clc.red("Failure in Generating the Catalog Response :"+ catalog_child.stderr));
}

moving(parsing);

//This will move all the XML files downloaded into the tmp dir since all the XML files shall be decompressed to a folder called CSA_Dataset_TIMESTAMP
function moving(callback){
  const directoryPath = path.join(__dirname, 'tmp');
  fs.readdir(directoryPath, function (err, files) {
    if (err) {
      return console.log('Unable to scan directory: ' + err);
    }
    files.forEach(function (file) {
      if(file.indexOf('CSA_Dataset') ===0){
  var mv_cmd =  ' cd tmp/'+file+'  && mv * ..';
  let move_child;
  try {
    move_child = require('child_process').spawnSync('sh', ['-c', mv_cmd], {stdio: 'pipe'});
  } catch (ex) {
    console.log(clc.red("Could not execute command: " + mv_cmd + "."));
    if (ex.stderr) {
      console.log(clc.red(ex.stderr.toString()));
    }
    if (exit_if_fail) {
      process.exit(1);
    } else {
      return false;
    }
  }
//If there is no folder with the name CSA_Dataset_TIMESTAMP (Happens when all the requested metadata files are already exisitng and none were downloaded again)
  if (move_child.status != 0) {
    console.log(clc.yellow("No CSA Directory to move files. So Proceeding to Parse"));
  } else {
    //Removes the folder CSA_Dataset_TIMESTAMP and all the downloaded zip files as well (Not needed since we store each info response in JSON files). 
    console.log("Files moved succesfully!");
    var  del_cmd = 'rm -rf tmp/'+file +' && rm -rf tmp/*tar.gz && rm -rf tmp/CSA_Download*';
    try {
      del_child = require('child_process').spawnSync('sh', ['-c', del_cmd], {stdio: 'pipe'});
    }
     catch (ex) {
      console.log(clc.red("Could not execute command: " + mv_cmd + "."));
      if (ex.stderr) {
        console.log(clc.red(ex.stderr.toString()));
      }
      if (exit_if_fail) {
        process.exit(1);
      } else {
        return false;
      }
    }

    if(del_child.status != 0){
      console.log("Deletion Failed : "+ del_child.stderr);
    } else {
      console.log("Files deleted!");
    }
    
    
  }
}
    });
  });
  callback();
}

//For each XML file residing in the tmp directory, parsing will be done inorder to convert the metadata into the HAPI specification
function parsing(){
  const directoryPath = path.join(__dirname, 'tmp');
  fs.readdir(directoryPath, function (err, files) {
    if (err) {
      return console.log('Unable to scan directory: ' + err);
    }
    files.forEach(function (file) {
      const filePath = path.join(__dirname, 'tmp', file);
      //console.log("Filepath :: "+ filePath);
      if (fs.existsSync(filePath)) {
        var parse_cmd = "node CAIO2HAPI.js --file "+ file;
        let parse_child;
        try {
          parse_child = require('child_process').spawnSync('sh', ['-c', parse_cmd], {stdio: 'pipe'});
        } catch (ex) {
          console.log(ds() + clc.red("Error when executing: " + com + "."));
          if (ex.stderr) {
            console.log(clc.red(ex.stderr.toString()));
          }
          if (exit_if_fail) {
            process.exit(1);
          } else {
            return false;
          }
        }

        if (parse_child.status == 0) {
          console.log("Succesfully Parsed : "+ file);
        } else {
          console.log("Parse failed for "+ file + " Error: "+ parse_child.stderr);
        }
      }
    })
 })
}
