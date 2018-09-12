// Lab Attendance Display - Time Clock
// Written by Dylan Smith

// Ping server every 10 seconds for update

// jQuery
window.jQuery = window.$ = require('jquery');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Package that allows me to contact the server
var https = require("https");

// Package for alerts
var dialogs = require("dialogs")(opts={})

// https information
var serverAddress = "localhost";
var serverPort = 8443;

// File system reader
var fs = require("fs");

// Credentials
var credentials = JSON.parse(fs.readFileSync("credentials.json"));

// Number of clocked in members
var numMembers = 0;

// Default options for request
var options = {
	hostname: serverAddress,
	port: serverPort,
	path: "",
	method: 'GET',
	headers: { // just some basic authorization code I found online
		'Authorization': 'Basic ' + new Buffer(credentials['username']+':'+credentials['password']).toString('base64')
	}
}

// Timer for re-checking data
var pinger;

// Checks credentials
function checkCredentials() {
	configureOptions("/authtest", "GET");
	https.get(options, (res) => {
		if (res.statusCode != 200) {
			dialogs.alert("Invalid credentials");
		}
	});
}

// Configures options for https request
function configureOptions(path, method) {
	options['path'] = path;
	options['method'] = method;
}

// Gets all data from server
function getData() {
	// Clears all previous data
	numMembers = 0;

	configureOptions("/timesheet/loggedin", "GET");

	https.get(options, (res) => {
		if (res.statusCode == 404) {
			return;
		}
		res.on('data', (d) => {
			data = JSON.parse(d);
			var keys = Object.keys(data);
			keys.sort();
			$(".names-1").html("");
			$(".times-1").html("");
			$(".names-2").html("");
			$(".times-2").html("");
			for (key in keys) {
				var person = keys[key];
				var timeInMilliseconds = data[person];
				var date = new Date(parseInt(timeInMilliseconds));
				var hours = date.getHours();
				if (hours > 12) {
					hours -= 12;
				}
				var time = hours + ":";
				var minutes = date.getMinutes();
				if (minutes < 10) {
					time += "0";
				}
				time += minutes;
				numMembers += 1;
				var num = 1; // which column we are in
				if (numMembers > 36) {
					num = 2 - numMembers % 2;
				} else if (numMembers > 18) {
					num = 2;
				}
				$(".names-" + num).append(`<span style="font-size:20px;font-family:Norwester">` + person + `</span><br>`)
				$(".times-" + num).append(`<span style="font-size:20px;font-family:Norwester">` + time + `</span><br>`)
			}
		});
	});
}

// Checks every 10 seconds to run getData()
function checkTime() {
	console.log($(".names-1").html());
}

$(document).ready(function(){
	if (fs.existsSync("server.json")) {
		var serverInfo = JSON.parse(fs.readFileSync("server.json"));
		serverAddress = serverInfo["address"];
		serverPort = serverInfo["port"];
		options["hostname"] = serverAddress;
		options["port"] = serverPort;
		checkCredentials();
		getData();
		pinger = setInterval(getData, 10000);
	} else {
		var serverInfo = {"address":"localhost","port":8443};
		dialogs.prompt("What is the name of the server?", "", function(address) {
			if (address != undefined && address != null) {
				serverAddress = address;
				serverInfo["address"] = address;
				options["hostname"] = address;
				dialogs.prompt("What port is the server?", "", function(port) {
					if (port != undefined && port != null) {
						serverPort = port;
						serverInfo["port"] = port;
						options["port"] = port;
						checkCredentials();
						getData();
						pinger = setInterval(getData, 10000);
						fs.writeFileSync("server.json", JSON.stringify(serverInfo));
					}
				});
			}
		});
	}
});
