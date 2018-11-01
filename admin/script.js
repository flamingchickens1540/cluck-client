// Time Clock Admin
// Written by Dylan Smith

window.$ = window.jQuery = require("jquery");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Package for alerts
var dialogs = require("dialogs")(opts={})
// Package that allows me to contact the server
var https = require("https");

var fs = require("fs");

var addUserName = "Flaming Chicken";
var addUserID = "1540";
var addUserEmail = "1540photo@gmail.com"

var serverAddress = "localhost";
var serverPort = 8443;

var users = []

var sort = "name";

// admin credentials
var credentials = JSON.parse(fs.readFileSync("credentials.json"));

var options = {
	hostname: serverAddress,
	port: serverPort,
	path: "",
	method: 'GET',
	headers: { // just some basic authorization code I found online
		'Authorization': 'Basic ' + new Buffer(credentials['username']+':'+credentials['password']).toString('base64')
	}
}

////////////////////////
/* PINGING THE SERVER */
////////////////////////

// Whether or not you can connect to the server.
// If you have lost wifi, or the server is down, this will be false.
var connected = true;

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

// Pings the server
function ping() {
	configureOptions("/ping", "GET");
	https.get(options, (res) => {
		if (!connected) {
			$(".home").show();
			$(".errorScreen").hide();
			$("body").css("background-color", "white");
			connected = true;
		}
	}).on('error', (e) => {
		if (connected) {
			$(".home").hide();
			$(".errorScreen").show();
			$("body").css("background-color", "red");
			connected = false;
		}
	});
}

function setSort(value) {
	sort = value;
	$(".sort").removeClass("highlight");
	$(".sort-" + value).addClass("highlight");
	refresh();
}

function sortUsersBy(users, value) {
	users.sort(function(a, b) {
		if (value == "name") {
			if (a[value] > b[value]) { return 1; }
			else { return -1; }
		} else {
			return b[value] - a[value];
		}
	});
	return users;
}

function clock(id, clockingIn) {
	configureOptions("/clockapi/clock?user=" + id + "&clockingIn=" + clockingIn, 'POST');
	https.get(options, (res) => {
		console.log(res.statusCode);
		if (res.statusCode != 200) {
			dialogs.alert("Something went wrong.");
		}
		refresh();
	});
}

/* Clocks out a user without adding hours to their total */
function nullify(name, id) {
	dialogs.confirm("Are you sure you want to clock out " + name + " (" + id + ") without incrementing their hour total?", function(ok) {
		if (ok) {
			configureOptions("/admin/voidclock?id=" + id, "POST");
			https.get(options, (res) => {
				console.log(res.statusCode);
				if (res.statusCode != 200) {
					dialogs.alert("Something went wrong.");
				}
				refresh();
			});
		}
	});
}

function deleteUser(name, id) {
	dialogs.prompt("To confirm, please type in the full name of the user you want to delete.", function(inputName) {
		if (inputName == name) {
			dialogs.confirm("Are you sure you want to delete " + name + " from the system?", function(ok) {
				if (ok) {
					configureOptions("/admin/removeuser?id=" + id, "POST");
					https.get(options, (res) => {
						console.log(res.statusCode);
						if (res.statusCode != 200) {
							dialogs.alert("Something went wrong.");
						}
						refresh();
					});
				}
			});
		}
	});
}

function changeInfo(oldName, oldID, oldEmail) {
	numChanges = 0;
	confirmationText = "Confirm that the following changes are correct:";
	urlChanges = "";
	dialogs.confirm("Are you sure you want to edit " + oldName + "'s information?" , function(ok) {
		if (ok) {
			dialogs.prompt("Enter a new name. Leave this field blank to leave the name unchanged.", oldName, function(name) {
				if (name == undefined) {
					return;
				} else if (name != "" && name != oldName) {
					numChanges++;
					confirmationText = confirmationText + " '" + oldName + "' is being changed to '" + name + "'.";
					urlChanges = urlChanges + "&newName=" + encodeURIComponent(name);
				}
				dialogs.prompt("Enter a new ID. Leave this field blank to leave the ID unchanged.", oldID, function(id) {
					if (id == undefined) {
						return;
					} else if (id != "" && id != oldID) {
						valid = true;
						for (var i = 0; i < id.length; i++) {
							if (isNaN(id.charAt(i))) { valid = false; }
						}
						if (valid) {
							numChanges++;
							confirmationText = confirmationText + " '" + oldID + "' is being changed to '" + id + "'.";
							urlChanges = urlChanges + "&newId=" + id;
						} else {
							return;
						}
					}
					dialogs.prompt("Enter a new email. Leave this field blank to leave the email unchanged.", oldEmail, function(email) {
						if (email == undefined) {
							return;
						} else if (email != "" && email != oldEmail) {
							if (validateEmail(email)) {
								numChanges++;
								confirmationText = confirmationText + " '" + oldEmail + "' is being changed to '" + email + "'.";
								urlChanges = urlChanges + "&newEmail=" + encodeURIComponent(email);
							} else {
								return;
							}
						}
						if (numChanges == 0) {
							dialogs.alert("You changed no user information!");
							return;
						}
						dialogs.confirm(confirmationText, function(ok) {
							if (ok) {
								configureOptions("/admin/edituser?id=" + oldID + urlChanges, "POST");
								https.get(options, (res) => {
									if (res.statusCode != 200) {
										dialogs.alert("Something went wrong.");
									}
									refresh();
								});
							}
						});
					});
				});
			});
		}
	});
}

function userDisplay(user) {
	style = "";
	clockedIn = "out"
	clockButton = "<button onclick='clock(`" + user["id"] + "`, true)' class='btn btn-primary'>Clock In</button>";
	disableButton = "<button class='btn' disabled>Void</button>"
	if (user["clockedIn"]) {
		style += "background-color:#b2ffa3;"
		clockedIn = "in"
		clockButton = "<button onclick='clock(`" + user["id"] + "`, false)' class='btn btn-primary'>Clock Out</button>";
		disableButton = "<button class='btn btn-warning' onclick='nullify(`" + user["name"] + "`,`" + user["id"] + "`)'>Void</button>"
	}
	$(".table-body").append(
		`<tr style="` + style + `">
			<td>` + user["name"] + `</td>
			<td>` + user["id"] + `</td>
			<td>` + user["email"] + `</td>
			<td>` + clockedIn + `</td>
			<td>` + clockButton + `</td>
			<td>` + disableButton + `</td>
			<td><button class="btn btn-info" onclick="changeInfo('` + user["name"] + "','" + user["id"] + `', '` + user["email"] + `')">Edit</button></td>
			<td><button class="btn btn-danger" onclick="deleteUser('` + user["name"] + "','" + user["id"] + `')">Remove</button></td>
		</tr>`);
}

function refresh() {
	configureOptions("/admin/allusers", "GET")
	https.get(options, (res) => {
		if (res.statusCode == 200) {
			$(".table-body").html("");
			res.on('data', (d) => {
				users = sortUsersBy(JSON.parse(d)["users"], sort);
				for (u in users) {
					user = users[u];
					if (sort!="lastEventTime" || user["clockedIn"]) {
						userDisplay(user);
					}
				}
				for (u in users) {
					user = users[u];
					if (sort=="lastEventTime" && !user["clockedIn"]) {
						userDisplay(user);
					}
				}
			});
		}
	});
}

// https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript
function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

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
	$(".errorScreen").hide();
	refresh();
	$(".refresh").click(function(){
		refresh();
	});
	$(".addUser").click(function(){
		dialogs.prompt("Enter a name.", function(name){
			if (name != undefined && name != "") {
				addUserName = name;
				dialogs.prompt("Enter an ID.", function(id) {
					if (id != undefined && id.length >= 1 && id.length <= 4) {
						valid = true;
						for (var i = 0; i < id.length; i++) {
							if (isNaN(id.charAt(i))) { valid = false; }
						}
						if (valid) {
							addUserID = id;
							dialogs.prompt("Enter an email.", function(email) {
								if (email != undefined && validateEmail(email)) {
									addUserEmail = email;
									dialogs.confirm("Add '" + addUserName + "' with ID '" + addUserID + "' and email '" + addUserEmail + "'?", function(ok) {
										if (ok) {
											addUserName = encodeURIComponent(addUserName);
											addUserEmail = encodeURIComponent(addUserEmail);
											configureOptions("/admin/adduser?id=" + addUserID + "&name=" + addUserName + "&email=" + addUserEmail, "POST");
											https.get(options, (res) => {
												console.log(res.statusCode);
												// if the status is 404, we alert 'Invalid ID', clear the timer thread, and return
												if (res.statusCode == 400) {
													console.log("YOU GOOFY DOG!");
												} else if (res.statusCode == 401) {
													console.log("YOU GOT BAD CREDS");
												} else if (res.statusCode == 200) {
													console.log("GOOD BOI");
													refresh();
												}
											});
										}
									});
								}
							});
						}
					}
				});
			}
		});
	});
});
