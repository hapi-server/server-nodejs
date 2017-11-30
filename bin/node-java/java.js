var java = require("java");

java.classpath.push('autoplot.jar');

java.options.push('-Djava.awt.headless=true');
java.options.push('-Xmx1024m');

var list = java.newInstanceSync("java.util.ArrayList");

java.newInstance("java.util.ArrayList", function(err, list2) {
  	list2.addSync("item1");
  	list2.addSync("item2");
  	console.log(list2.getSync(1)); // item1
});

java.newInstance("java.util.ArrayList", function(err, list) {
  if(err) { console.error(err); return; }
  console.log(list)
});

if (0) {
	//java -Djava.awt.headless=true -jar autoplot.jar org.virbo.autoplot.AutoplotUI --script dumpMetadata.jyds	
	var strArray = java.newArray('java.lang.String',['--script','dumpMetadata.jyds']);
	var result = java.callStaticMethodSync("org.virbo.autoplot.AutoplotUI", "main", strArray);
	console.log(result) // null
}
if (0) {
	//java -Djava.awt.headless=true -jar autoplot.jar org.virbo.autoplot.AutoplotUI --script dumpMetadata.jy	
	var strArray = java.newArray('java.lang.String',['--script','dumpMetadata.jy']);
	var result = java.callStaticMethodSync("org.virbo.autoplot.AutoplotUI", "main", strArray);
	console.log(result) // null
}

if (0) {
	// Works
	// java -jar bin/autoplot.jar "vap+cdaweb:ds=AC_H0_MFI&id=BGSEc&timerange=2014-08-27+through+2014-08-28"
	var uri = 'vap+cdaweb:ds=AC_H0_MFI&id=BGSEc&timerange=2014-08-27+through+2014-08-28'
	var strArray = java.newArray('java.lang.String',['--uri',uri,'--format','dat']);
	var result = java.callStaticMethodSync("org.virbo.autoplot.AutoplotDataServer", "main", strArray);
}


if (0) {
	var strArray = java.newArray('java.lang.String',['--script','getFillValue.jy']);
	var result = java.callStaticMethodSync("org.virbo.autoplot.AutoplotUI", "main", strArray);
	console.log(result)
}



if (0) {
	// Gives error. See command line display for error.
	// java -Djava.awt.headless=true -cp autoplot.jar org.virbo.autoplot.AutoplotDataServer --uri "vap+jyds:file:/home/weigel/git/js-rsw/node-java/dumpMetadata.jyds" --format dat
	var uri = 'vap+cdaweb:ds=AC_H0_MFI&id=BGSEc&timerange=2014-08-27+through+2014-08-28'
	var strArray = java.newArray('java.lang.String',['--uri',uri,'--format','dat']);
	var result = java.callStaticMethodSync("org.virbo.autoplot.AutoplotDataServer", "main", strArray);
}


if (0) {
	// Error: only rank 1 and rank 2 data are supported
	// java -Djava.awt.headless=true -jar autoplot.jar "vap+jyds:file:/home/weigel/git/js-rsw/node-java/getFillValue.jy"
	var uri = 'vap+jyds:file:/home/weigel/git/js-rsw/node-java/getFillValue.jy'
	var strArray = java.newArray('java.lang.String',['--uri',uri,'--format','dat']);
	var result = java.callStaticMethodSync("org.virbo.autoplot.AutoplotDataServer", "main", strArray);
	console.log(result)
}