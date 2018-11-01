// Time Clock Client - JavaScript Backend
// Written by Dylan Smith

window.$ = window.jQuery = require("jquery");

// STACKOVERFLOW thread about process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// https://stackoverflow.com/questions/35633829/node-js-error-process-env-node-tls-reject-unauthorized-what-does-this-mean
// TLDR: If you remove this code, the server will consider any request unauthorized
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Package for alerts
var dialogs = require("dialogs")(opts={})
// Package for reading from files
var fs = require("fs");
// Package that allows me to run bash (i.e. command line)
var exec = require("child_process").exec;
// Package that allows me to contact the server
var https = require("https");
// Allows for text-to-speech (on Mac OS, I have yet to test on Windows, but it should work.)
var say = require('say');

// Whether or not you can connect to the server.
// If you have lost wifi, or the server is down, this will be false.
var connected = true;

// logging in OR logging out
var clockingIn = null;

// current ID that the user is typing in.
var userID = "";

// whether or not we want the cpu to speak whenever someone clocks in/out
var speak = true;

// Sets credentials
var credentials = JSON.parse(fs.readFileSync("credentials.json"));

var concurrentPinger;

// Default options
var options = {
	hostname: serverAddress,
	port: serverPort,
	path: "",
	method: 'GET',
	headers: { // just some basic authorization code I found online
		'Authorization': 'Basic ' + new Buffer(credentials['username']+':'+credentials['password']).toString('base64')
	}
}

// HTTPS relevant information
var serverAddress = "localhost";
var serverPort = 8443;

var processingTime = 0; // time it takes to connect to server
var messageTime = 0; // how long message has been displayed
var messageTimer; // the thread that updates messageTime

var timer; // secondly pinging until connects to server after sending request

////////////////////////
/* PINGING THE SERVER */
////////////////////////

// Pings the server
function ping() {
	configureOptions("/ping", "GET");
	https.get(options, (res) => {
		if (!connected) {
			$(".home").show();
			$(".error").hide();
			$("body").css("background-color", "white");
			connected = true;
		}
	}).on('error', (e) => {
		if (connected) {
			returnHome();
			$(".home").hide();
			$(".input").hide();
			$(".error").show();
			$("body").css("background-color", "red");
			connected = false;
		}
	});
}

///////////////////////////////////////
/* MISCELLANEOUS THREADING FUNCTIONS */
///////////////////////////////////////

function checkTime() {
	if (processingTime == 5) {
		dialogs.alert("It appears the server is taking longer than usual. It may be offline.");
		console.log("It appears the server is taking longer than usual. It may be offline.");
	}
	processingTime += 1;
}

// This function checks to see if messageTime has surpassed 3, in which the home screen message should disappear.
function checkMessageTime() {
	if (messageTime > 3) {
		$("#userMessage").text("");
	}
	messageTime += 1;
}

/////////////////////////////////
/* ADDITIONAL HELPER FUNCTIONS */
/////////////////////////////////

function returnHome() {
	$(".home").show();
	$(".input").hide();
	$(".numDisplay").text("");
	clockingIn = null;
	userID = "";
	timer = null;
}

function playSound(src) {
	effect = document.createElement("audio");
	effect.src = src;
	effect.play();
}

// Configures options for https request
function configureOptions(path, method) {
	options['path'] = path;
	options['method'] = method;
}

// Checks credentials
function checkCredentials() {
	configureOptions("/authtest", "GET");
	https.get(options, (res) => {
		if (res.statusCode != 200) {
			dialogs.alert("Invalid credentials");
		}
	});
}

//////////////////////////////
/* BUTTON ONCLICK FUNCTIONS */
//////////////////////////////

$(document).ready(function(){
	if (fs.existsSync("server.json")) {
		var serverInfo = JSON.parse(fs.readFileSync("server.json"));
		serverAddress = serverInfo["address"];
		serverPort = serverInfo["port"];
		options["hostname"] = serverAddress;
		options["port"] = serverPort;
		checkCredentials();
		concurrentPinger = setInterval(ping, 3000);
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
						concurrentPinger = setInterval(ping, 3000);
						fs.writeFileSync("server.json", JSON.stringify(serverInfo));
					}
				});
			}
		});
	}
	// btn-large are the two home-screen buttons.
	// when either button is pressed, the home screen disappears and the keypad appears
	$(".btn-large").click(function(){
		$(".home").hide();
		$(".input").show();
		$("#userMessage").text(""); // sets the home screen message to false
		clearTimeout(messageTimer); // stops the thread for checking when the message should disappear
	});
	// home screen button for clocking in
	$(".login").click(function(){
		clockingIn = true;
		$(".ok").val("In");
	});
	// home screen button for clocking in
	$(".logout").click(function(){
		clockingIn = false;
		$(".ok").val("Out");
	});
	// num refers to any keypad button
	$(".num").click(function(){
		// requires that the ID is below 5 digits (as 4 is the maximum number of digits for an ID)
		if (userID.length < 4) {
			userID = userID + $(this).val(); // adds one to userID
			$(".numDisplay").text(userID);
		}
	});
	// the backspace key on the keypad
	$(".del").click(function(){
		// confirms that the ID is not blank
		if (userID.length > 0) {
			// slices off the last character of the ID
			userID = userID.slice(0,-1);
			$(".numDisplay").text(userID);
		}
	});
	// the CANCEL button on the keypad
	$(".cancel").click(function(){
		returnHome();
	});

	///////////////////////////////
	/* SUBMITTING INFO TO SERVER */
	///////////////////////////////
	// PLEASE READ THE NOTE BEFORE LOOKING AT CODE

	// NOTE:
	// the OKAY button on the keypad
	// below, we connect to the server and tell it who clocks in/out.
	// the server handles managing the time the request is made
	// the server throws a 404 in the case of an invalid ID, or if the user's request is invalid (clocking in when you already are clocked in)
	// to begin, we request the user's name, giving it their ID
	// if the ID is invalid, a 404 is thrown, and we exit
	// otherwise, we continue and request to clock in/out the user
	// if someone has already clocked in / never clocked in in the first place, a 404 is thrown, and we exit
	// otherwise, we are good to go!

	$(".ok").click(function(){
		// confirms that ID is at least 1 digit
		// if not, reports this to the user, and then returns
		if (userID.length == 0) {
			dialogs.alert("ID must be at least 1 digit.")
			return;
		}

		// processingTime and timer are used to determine how long our request is taking
		// the function checkTime will alert us if the request takes longer than 5 seconds
		processingTime = 0;
		timer = setInterval(checkTime, 1000);
		// https.get is ran to check to make sure it is a valid ID
		var name; // the name of the user

		/////////////////
		/* REQUEST ONE */
		/////////////////

		// sets the inputs to the first request (requesting the name of a user from their ID)
		configureOptions("/clockapi/name?id=" + userID, "GET");
		https.get(options, (res) => {
			// if the status is 404, we alert 'Invalid ID', clear the timer thread, and return
			if (res.statusCode == 404) {
				dialogs.alert("Invalid ID");
				clearTimeout(timer);
				return;
			}
			// otherwise, we continue
			res.on('data', (d) => {
				// converting the data we obtain from the server from a JSON into useful JavaScript data types
  			name = JSON.parse(d).name;

				/////////////////
				/* REQUEST TWO */
				/////////////////

				// https.request will try to log you in or out
				// the inputs to the second request (requesting to clock in or out)
				configureOptions("/clockapi/clock?user=" + userID + "&clockingIn=" + clockingIn, "POST");
				https.get(options, (res) => {
					// if the status is a 404, we check to see if you are clocking in or out, alert the appropriate message, then return
					if (res.statusCode == 404) {
						if (clockingIn) {
							dialogs.alert("You are already clocked in!");
						} else {
							dialogs.alert("You are not clocked in!");
						}
						clearTimeout(timer);
						return;
					}

					var firstName = name.split(" ")[0]; // e.g. dean
					var nameAddress = name.replace(" ", ""); // e.g. deankamen

					////////////////////
					/* SPEAKING (TTS) */
					////////////////////

					/*// speak is a boolean of whether or not we want to the cpu to speak
					if (speak) {

						var introduction = "Goodbye, ";
						if (clockingIn) { introduction = "Hello, " }

						// searches for .mp3 or .wav files in the SOUNDS folder.
						// a file will be here (e.g. deankamen.mp3)
						// this file will be of someone saying Dean Kamen's name.
						// this is for if people don't like how the Text-To-Speech pronounces their name
						var sound = null;
						if (fs.existsSync("sounds/" + nameAddress + ".wav")) {
							sound = "sounds/" + nameAddress + ".wav";
						} else if (fs.existsSync("sounds/" + nameAddress + ".mp3")) {
							sound = "sounds/" + nameAddress + ".mp3";
						}

						// if sound is null, they have not submitted a sound file, and the TTS will attempt to pronounce their name
						// Samantha is the voice we use
						if (sound != null) {
							// speaks the introduction, and then plays the sound file as a callback
							say.speak(introduction, "Samantha", 1.0, playSound(sound));
						} else {
							// speaks the introduction, and then the person's first name
							say.speak(introduction + firstName, "Samantha");
						}
					}*/

					// DISPLAYING THE MESSAGE on the HOME SCREEN

					if (clockingIn) {
						$("#userMessage").text(firstName + " clocked in.")
					} else {
						$("#userMessage").text(firstName + " clocked out.")
					}

					// Now, it returns and everything is great!
					clearTimeout(timer);
					messageTimer = setInterval(checkMessageTime, 1000); // Creates a timer that will make the message on the front screen disappear
					returnHome();

				});
			});
		});
	});
});
