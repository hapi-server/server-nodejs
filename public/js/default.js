if (typeof(VERIFIER) == 'undefined') {
	VERIFIER = "http://hapi-server.org/verify";
	console.log('VERIFIER variable is not defined. Using ' + VERIFIER);
}
if (typeof(PLOTSERVER) == 'undefined') {
	PLOTSERVER = "http://hapi-server.org/plot";
	console.log('PLOTSERVER variable is not defined. Using ' + PLOTSERVER);
}

var src = VERIFIER+"?url="+window.location;
var hostname = window.location.hostname;
var link = "<a href='https://github.com/hapi-server/server-nodejs/blob/master/README.md#Installation'>the documentation</a>"

$(document).ready(function () {
	validationlink();
	$.ajax("./hapi/catalog").done(info);
})

function validationlink() {
	if (hostname === 'localhost' && !VERIFIER.match('localhost')) {
		$("#verifierurl").html("If HAPI server is run on localhost, a verifier server must be running on localhost. See " + link + " for instructions on starting a localhost verifier server.");
		$("#showvalidation").click(function () {
			$("#verifierurl").show();
		})
	} else {
		$("#showvalidation").attr("title",src);
		$("#verifierurl").html(src);
		$("#verifierurl").attr("href",src);
		$("#showvalidation").click(function () {
			$("#verifierurl").show();
			$("#validationresults").show();
			$('#iframe').attr("src",src);				
		})
	}
}

function info(json) {
	// Process output of /hapi/catalog
	// Place sample /hapi/info request links
	$("#Ndatasets").text(json["catalog"].length);
	var N = Math.min(5,json["catalog"].length);
	for (var i = 0;i < N;i++) {
		var url = "./hapi/info?id="+json["catalog"][i]["id"];
		var link = $("<a>")
					.attr("href", url)
					.attr("title", url)
					.text(url);
		$("#info").append("<li>");
		$($("#info li")[i]).append(link);
	}

	plotlinks(json);
	data(json["catalog"][0]["id"]);
}

function plotlinks(json) {
	if (false && hostname === 'localhost' && !PLOTSERVER.match('localhost')) {
		$("#plotlinks").html("If HAPI server is run on localhost, a plot server must be running on localhost. See " + link + " for instructions on starting a localhost verifier server.");
	} else {
		var N = Math.min(5,json["catalog"].length);
		$("#plotlinks").html("<ul id='plotul'></ul>")
		for (var i = 0;i < N;i++) {
			var url = PLOTSERVER+"?server="+window.location+"&id="+json["catalog"][i]["id"]+"&format=gallery";
			var link = $("<a>")
						.attr("href", url)
						.attr("title", url)
						.text(url);
			$("#plotul").append("<li>");
			$($("#plotul li")[i]).append(link);
		}
	} 	
}

function data(id) {
	// Get /hapi/info response for first dataset
	var url = "./hapi/info?id=" + id;

	$.ajax(url).done(process);

	function process(json, status) {
		
		if (json["sampleStartDate"] && json["sampleStopDate"]) {
			var start = json["sampleStartDate"];
			var stop  = json["sampleStopDate"];
		} else {
			// Add one day
			// TODO: If json["cadence"], use it to determine
			// reasonable sampleStopDate
			var start = new Date(json["startDate"]);
			var stop  = new Date(start.setDate(start.getDate() + 1)).toISOString()
			start = json["startDate"];
		}
		for (var i = 1; i < json.parameters.length; i++) {
			var url = "./hapi/data?id=" + id + "&parameters=" 
					+ json["parameters"][i]["name"]
					+ "&time.min=" + start + "&time.max=" + stop;
			var link = $("<a>")
						.attr("href", url+"&attach=false")
						.attr("title", url)
						.text(url);
			$("#data").append("<li>")
			$("#data li").last().append(link);
		}
	}
}