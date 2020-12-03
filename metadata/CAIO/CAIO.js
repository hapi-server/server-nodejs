const fs = require('fs');
const path = require('path');
const clc  = require('chalk');
const yargs  = require('yargs');

const argv = yargs
                .option('update', {
					description: 'Force update the existing metadata',
			    })
			    .help()
                .alias('help', 'h')
                .default({
					'update': false
				})
			    .argv;

//For generating the /catalog response. FILL_CATALOG will download
// and decompress each of the /info response files as well.
var com = 'node FILL_CATALOG.js ' + '--update '+ argv.update ;
let catalog_child;
try {
	console.log("Executing " + com);
    catalog_child = require('child_process').spawnSync('sh', ['-c', com], {stdio: 'pipe'});
    console.log("Executed " + com);
    console.log(catalog_child.stdout.toString());
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
	console.log(clc.green("Generated the catalog response sucessfully."));
    console.log(clc.yellow(catalog_child.stdout));
} else {
    console.log(clc.red("Failed to generate catalog response. Error: "+ catalog_child.stderr));
}

moving(parsing);

// This will move all the XML files downloaded into the tmp dir since all
// the XML files shall be decompressed to a folder called CSA_Dataset_TIMESTAMP
function moving(callback){
	const directoryPath = path.join(__dirname, 'tmp');
    console.log('Scanning ' + directoryPath);
    fs.readdir(directoryPath, function (err, files) {
		if (err) {
			 return console.log('Unable to scan directory. Error message: ' + err);
		}
		files.forEach(function (file) {
			if(file.indexOf('CSA_Dataset') === 0){
				var mv_cmd =  ' cd tmp/' + file + '  && mv * ..';
				let move_child;
				try {  
					console.log('Executing ' + mv_cmd);
					move_child = require('child_process').spawnSync('sh', ['-c', mv_cmd], {stdio: 'pipe'});
					console.log('Executed ' + mv_cmd);
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
				// If there is no folder with the name CSA_Dataset_TIMESTAMP
    		    // (happens when all the requested metadata files are already exisits
				// and none were downloaded again)
				if (move_child.status != 0) {
					console.log(clc.yellow("No CSA Directory. Proceeding to parse."));
				} else {
					// Removes the folder CSA_Dataset_TIMESTAMP and all the downloaded zip
				    // files as well (Not needed since we store each info response in JSON files). 
				    console.log("Files moved out succesfully!");
				    var  del_cmd = 'rm -rf tmp/'+file +' && rm -rf tmp/*tar.gz && rm -rf tmp/CSA_Download*';
				    try {
						console.log("Executing " + del_cmd);
                        del_child = require('child_process').spawnSync('sh', ['-c', del_cmd], {stdio: 'pipe'});
						console.log("Executed " + del_cmd);
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
						console.log("Deletion Failed. Error message: "+ del_child.stderr);
					} else {
						console.log("Extra metadata files deleted.");
						callback();
					}  
				}
			}
		});
	});  
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
					console.log(clc.green("Succesfully parsed "+ file));
					console.log(clc.yellow(parse_child.stdout));
				} else {
					console.log("Parse failed for "+ file + " Error: "+ parse_child.stderr);
				}
			}
		});
	});
}
