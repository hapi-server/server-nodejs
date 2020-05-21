$(document).ready(function () {
	$("#verifier").attr("href",$("#verifier").attr("href") + "?url=" + window.location.href);
	$("#viviz").attr("href",$("#viviz").attr("href") + "?server=" + window.location.href + "&format=gallery");

	if (window.location.hostname == 'localhost') {
 		if (!$("#viviz").attr("href").match('localhost')) {
			$('#viviz').after(" <span style='background-color:yellow'>If HAPI server URL domain name is localhost, plot server must be run on localhost. See server startup message for instructions.</span>");
		}
 		if (!$("#verifier").attr("href").match('localhost')) {
			$('#verifier').after(" <span style='background-color:yellow'>If HAPI server URL domain name is localhost, verfifier server must be run on localhost. See server startup message for instructions.</span>");
		}
	}
	$.ajax("./hapi/catalog").done(info);
})

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

	data(json["catalog"][0]["id"]);
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