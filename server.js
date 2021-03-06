var express = require('express')
, app = express()
, server = require('http').createServer(app)
, io = require("socket.io").listen(server)
, uuid = require('node-uuid')
, Room = require('./room.js')
, _ = require('underscore')._;

app.configure(function() {
	app.set('port', process.env.OPENSHIFT_NODEJS_PORT || 3000);
  	app.set('ipaddr', process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1");
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(__dirname + '/public'));
	app.use('/components', express.static(__dirname + '/components'));
	app.use('/js', express.static(__dirname + '/js'));
	app.use('/icons', express.static(__dirname + '/icons'));
	app.set('views', __dirname + '/views');
	app.engine('html', require('ejs').renderFile);
});

app.get('/', function(req, res) {
  res.render('index.html');
});

server.listen(app.get('port'), app.get('ipaddr'), function(){
	console.log('Express server listening on  IP: ' + app.get('ipaddr') + ' and port ' + app.get('port'));
});

io.set("log level", 1);
var people = {};
var doctors = {};
var rooms = {};
var sockets = [];
var chatHistory = {};

function purge(s, action) {
	/*
	The action will determine how we deal with the room/user removal.
	These are the following scenarios:
	if the user is the owner and (s)he:
		1) disconnects (i.e. leaves the whole server)
			- advise users
		 	- delete user from people object
			- delete room from rooms object
			- delete chat history
			- remove all users from room that is owned by disconnecting user
		2) removes the room
			- same as above except except not removing user from the people object
		3) leaves the room
			- same as above
	if the user is not an owner and (s)he's in a room:
		1) disconnects
			- delete user from people object
			- remove user from room.people object
		2) removes the room
			- produce error message (only owners can remove rooms)
		3) leaves the room
			- same as point 1 except not removing user from the people object
	if the user is not an owner and not in a room:
		1) disconnects
			- same as above except not removing user from room.people object
		2) removes the room
			- produce error message (only owners can remove rooms)
		3) leaves the room
			- n/a
	*/
	
	if ((typeof people[s.id] !== "undefined") && (people[s.id].type == "people")){ //user is in a room
		if (people[s.id].inroom) {
			var room = rooms[people[s.id].inroom]; //check which room user is in.

			if (s.id === room.owner) { //user in room and owns room
				if (action === "disconnect") {
					io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has left the server. The room is removed and you have been disconnected from it as well.");
					var socketids = [];
					for (var i=0; i<sockets.length; i++) {
						socketids.push(sockets[i].id);
						if(_.contains((socketids)), room.people) {
							sockets[i].leave(room.name);
						}
					}

					if(_.contains((room.people)), s.id) {
						for (var i=0; i<room.people.length; i++) {
							people[room.people[i]].inroom = null;
						}
						for (var i=0; i<room.doctors.length; i++) {
							doctors[room.doctors[i]].inroom = null;
						}
					}
					room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
					room.doctors = _.without(room.doctors, s.id); 
					delete rooms[people[s.id].owns]; //delete the room
					delete people[s.id]; //delete user from people collection
					delete chatHistory[room.name]; //delete the chat history
					sizePeople = _.size(people);
					sizeDoctors = _.size(doctors);
					sizeRooms = _.size(rooms);
					io.sockets.emit("update-doctors", {doctors: doctors, count: sizeDoctors});
					io.sockets.emit("update-people", {people: people, count: sizePeople});
					io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms});
					var o = _.findWhere(sockets, {'id': s.id});
					sockets = _.without(sockets, o);
				} else if (action === "removeRoom") { //room owner removes room
					io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has removed the room. The room is removed and you have been disconnected from it as well.");
					var socketids = [];
					for (var i=0; i<sockets.length; i++) {
						socketids.push(sockets[i].id);
						if(_.contains((socketids)), room.people) {
							sockets[i].leave(room.name);
						}
					}

					if(_.contains((room.people)), s.id) {
						for (var i=0; i<room.people.length; i++) {
							people[room.people[i]].inroom = null;
						}
						for (var i=0; i<room.doctors.length; i++) {
							doctors[room.doctors[i]].inroom = null;
						}
					}
					delete rooms[people[s.id].owns];
					people[s.id].owns = null;
					room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
					room.doctors = _.without(room.doctors, s.id);
					delete chatHistory[room.name]; //delete the chat history
					sizeRooms = _.size(rooms);
					io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms});
				} else if (action === "leaveRoom") { //room owner leaves room
					io.sockets.in(s.room).emit("update", "The owner (" +people[s.id].name + ") has left the room. The room is removed and you have been disconnected from it as well.");
					var socketids = [];
					for (var i=0; i<sockets.length; i++) {
						socketids.push(sockets[i].id);
						if(_.contains((socketids)), room.people) {
							sockets[i].leave(room.name);
						}
					}

					if(_.contains((room.people)), s.id) {
						for (var i=0; i<room.people.length; i++) {
							people[room.people[i]].inroom = null;
						}
						for (var i=0; i<room.doctors.length; i++) {
							doctors[room.doctors[i]].inroom = null;
						}
					}
					delete rooms[people[s.id].owns];
					people[s.id].owns = null;
					room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
					room.doctors = _.without(room.doctors, s.id);
					delete chatHistory[room.name]; //delete the chat history
					sizeRooms = _.size(rooms);
					io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms});
				}
			} else {//user in room but does not own room
				if (action === "disconnect") {
					io.sockets.emit("update", people[s.id].name + " has disconnected from the server.");
					if (_.contains((room.people), s.id)) {
						var personIndex = room.people.indexOf(s.id);
						room.people.splice(personIndex, 1);
						s.leave(room.name);
					}
					delete people[s.id];
					sizeDoctors = _.size(doctors);				
					sizePeople = _.size(people);
					io.sockets.emit("update-people", {people: people, count: sizePeople });
					io.sockets.emit("update-doctors", {doctors: doctors, count: sizeDoctors });
					var o = _.findWhere(sockets, {'id': s.id});
					sockets = _.without(sockets, o);
	//  Start here

				} else if (action === "removeRoom") {
					s.emit("update", "Only the owner can remove a room.");
				} else if (action === "leaveRoom") {
					if (_.contains((room.people), s.id)) {
						var personIndex = room.people.indexOf(s.id);
						room.people.splice(personIndex, 1);
						people[s.id].inroom = null;
						io.sockets.emit("update", people[s.id].name + " has left the room.");
						s.leave(room.name);
					}
				}
			}	
		}
	} else if ((typeof doctors[s.id] !== "undefined") && (doctors[s.id].type == "doctors")) { 
		if  (doctors[s.id].inroom) {
			
			var room = rooms[doctors[s.id].inroom]; //check which room user is in.

				if (s.id === room.owner) { //user in room and owns room
					if (action === "disconnect") {
						io.sockets.in(s.room).emit("update", "The owner (" + doctors[s.id].name + ") has left the server. The room is removed and you have been disconnected from it as well.");
						var socketids = [];
						for (var i=0; i<sockets.length; i++) {
							socketids.push(sockets[i].id);
							if(_.contains((socketids)), room.doctors) {
								sockets[i].leave(room.name);
							}
						}

						if(_.contains((room.doctors)), s.id) {
							for (var i=0; i<room.people.length; i++) {
								people[room.people[i]].inroom = null;
							}
							for (var i=0; i<room.doctors.length; i++) {
								doctors[room.doctors[i]].inroom = null;
							}
						}
						room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
						room.doctors = _.without(room.doctors, s.id); 
						delete rooms[doctors[s.id].owns]; //delete the room
						delete doctors[s.id]; //delete user from people collection
						delete chatHistory[room.name]; //delete the chat history
						sizePeople = _.size(people);
						sizeDoctors = _.size(doctors);
						sizeRooms = _.size(rooms);
						io.sockets.emit("update-doctors", {doctors: doctors, count: sizeDoctors});
						io.sockets.emit("update-people", {people: people, count: sizePeople});
						io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms});
						var o = _.findWhere(sockets, {'id': s.id});
						sockets = _.without(sockets, o);
					} else if (action === "removeRoom") { //room owner removes room
						io.sockets.in(s.room).emit("update", "The owner (" + doctors[s.id].name + ") has removed the room. The room is removed and you have been disconnected from it as well.");
						var socketids = [];
						for (var i=0; i<sockets.length; i++) {
							socketids.push(sockets[i].id);
							if(_.contains((socketids)), room.doctors) {
								sockets[i].leave(room.name);
							}
						}

						if(_.contains((room.doctors)), s.id) {
							for (var i=0; i<room.people.length; i++) {
								people[room.people[i]].inroom = null;
							}
							for (var i=0; i<room.doctors.length; i++) {
								doctors[room.doctors[i]].inroom = null;
							}
						}
						delete rooms[doctors[s.id].owns];
						doctors[s.id].owns = null;
						room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
						room.doctors = _.without(room.doctors, s.id);
						delete chatHistory[room.name]; //delete the chat history
						sizeRooms = _.size(rooms);
						io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms});
					} else if (action === "leaveRoom") { //room owner leaves room
						io.sockets.in(s.room).emit("update", "The owner (" + doctors[s.id].name + ") has left the room. The room is removed and you have been disconnected from it as well.");
						var socketids = [];
						for (var i=0; i<sockets.length; i++) {
							socketids.push(sockets[i].id);
							if(_.contains((socketids)), room.doctors) {
								sockets[i].leave(room.name);
							}
						}

						if(_.contains((room.doctors)), s.id) {
							for (var i=0; i<room.people.length; i++) {
								people[room.people[i]].inroom = null;
							}
							for (var i=0; i<room.doctors.length; i++) {
								doctors[room.doctors[i]].inroom = null;
							}
						}
						delete rooms[doctors[s.id].owns];
						doctors[s.id].owns = null;
						room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
						room.doctors = _.without(room.doctors, s.id);
						delete chatHistory[room.name]; //delete the chat history
						sizeRooms = _.size(rooms);
						io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms});
					}
				} else {//user in room but does not own room
					if (action === "disconnect") {
						io.sockets.emit("update", doctors[s.id].name + " has disconnected from the server.");
						if (_.contains((room.doctors), s.id)) {
							var doctorIndex = room.doctors.indexOf(s.id);
							room.doctors.splice(doctorIndex, 1);
							s.leave(room.name);
						}
						delete doctors[s.id];
						sizeDoctors = _.size(doctors);				
						sizePeople = _.size(people);
						io.sockets.emit("update-people", {people: people, count: sizePeople });
						io.sockets.emit("update-doctors", {doctors: doctors, count: sizeDoctors });
						var o = _.findWhere(sockets, {'id': s.id});
						sockets = _.without(sockets, o);
		//  Start here

					} else if (action === "removeRoom") {
						s.emit("update", "Only the owner can remove a room.");
					} else if (action === "leaveRoom") {
						if (_.contains((room.doctors), s.id)) {
							var doctorIndex = room.doctors.indexOf(s.id);
							room.doctors.splice(doctorIndex, 1);
							doctors[s.id].inroom = null;
							io.sockets.emit("update", doctors[s.id].name + " has left the room.");
							s.leave(room.name);
						}
					}
				}	
			} 
		}
	else {
		//The user isn't in a room, but maybe he just disconnected, handle the scenario:
		if (action === "disconnect") {
			if (people[s.id].type == "people") {
				io.sockets.emit("update", people[s.id].name + " has disconnected from the server.");
				delete people[s.id];
				sizePeople = _.size(people);
				io.sockets.emit("update-people", {people: people, count: sizePeople});
			} else if (doctors[s.id].type == "doctors") {
				io.sockets.emit("update", doctors[s.id].name + " has disconnected from the server.");
				delete doctors[s.id];				
				sizeDoctors = _.size(doctors);
				io.sockets.emit("update-doctors", {doctors: doctors, count: sizeDoctors});	
			}
			var o = _.findWhere(sockets, {'id': s.id});
			sockets = _.without(sockets, o);
		}		
	}

}




io.sockets.on("connection", function (socket) {

	function updateRealTime() {
		sizedoctors = _.size(doctors);
		sizePeople = _.size(people);
		sizeRooms = _.size(rooms);
		socket.emit("roomList", {rooms: rooms, count: sizeRooms});
		io.sockets.emit("update-people", {people: people, count: sizePeople});
		io.sockets.emit("update-doctors", {doctors: doctors, count: sizedoctors});	
	}

	socket.on("joinserver", function(name, symptoms, device) {
		var exists = false;
		var ownerRoomID = inRoomID = null;
		var type = "people";

		_.find(people, function(key,value) {
			if (key.name.toLowerCase() === name.toLowerCase())
				return exists = true;
		});
		if (exists) {//provide unique username:
			var randomNumber=Math.floor(Math.random()*1001)
			do {
				proposedName = name+randomNumber;
				_.find(people, function(key,value) {
					if (key.name.toLowerCase() === proposedName.toLowerCase())
						return exists = true;
				});
			} while (!exists);
			socket.emit("exists", {msg: "The username already exists, please pick another one.", proposedName: proposedName});
		} else {
			people[socket.id] = {"name" : name, "symptoms": symptoms, "owns": ownerRoomID, "inroom": inRoomID, "device": device, "type": type };
			socket.emit("update", "You have connected to the server.");
			io.sockets.emit("update", people[socket.id].name + " is online.");
			updateRealTime();
			sockets.push(socket);
		}		
		console.log(people[socket.id].type);
	});


	socket.on("doctorjoinserver", function(drs, speciality, device) {
		var exists = false;
		var ownerRoomID = inRoomID = null;
		var type = "doctors";
		
		_.find(doctors, function(key,value) {
			if (key.drs.toLowerCase() === drs.toLowerCase())
				return exists = true;
		});
		if (exists) {//provide unique username:
			var randomNumber=Math.floor(Math.random()*1001)
			do {
				proposedName = drs+randomNumber;
				_.find(doctors, function(key,value) {
					if (key.drs.toLowerCase() === proposedName.toLowerCase())
						return exists = true;
				});
			} while (!exists);
			socket.emit("exists", {msg: "The username already exists, please pick another one.", proposedName: proposedName});
		} else {
			doctors[socket.id] = {"drs" : drs, "speciality": speciality, "owns" : ownerRoomID, "inroom": inRoomID, "device": device, "type": type };
			socket.emit("update", "You have connected to the server.");
			io.sockets.emit("update", doctors[socket.id].drs + " is online.")
			updateRealTime();
			sockets.push(socket);
		}
		console.log(doctors[socket.id].type);
	});



	socket.on("getOnlinePeople", function(fn) {
                fn({people: people});
                fn({doctors: doctors});
        });

/*	socket.on("countryUpdate", function(data) { //we know which country the user is from
		country = data.country.toLowerCase();
		people[socket.id].country = country;
		io.sockets.emit("update-people", {people: people, count: sizePeople});
//		doctors[socket.id].country = country;
//		io.sockets.emit("update-doctors", {doctors: doctors, count: sizedoctors});
	}); */

	socket.on("typing", function(data) {
		if (typeof people[socket.id] !== "undefined")
			io.sockets.in(socket.room).emit("isTyping", {isTyping: data, person: people[socket.id].name});
	});
	
	socket.on("send", function(msg) {
		//process.exit(1);
		var re = /^[w]:.*:/;
		var whisper = re.test(msg);
		var whisperStr = msg.split(":");
		var found = false;
		if (whisper) {
			var whisperTo = whisperStr[1];
			var keys = Object.keys(people);
			if (keys.length != 0) {
				for (var i = 0; i<keys.length; i++) {
					if (people[keys[i]].name === whisperTo) {
						var whisperId = keys[i];
						found = true;
						if (socket.id === whisperId) { //can't whisper to ourselves
							socket.emit("update", "You can't whisper to yourself.");
						}
						break;
					} 
				}
			}
			if (found && socket.id !== whisperId) {
				var whisperTo = whisperStr[1];
				var whisperMsg = whisperStr[2];
				socket.emit("whisper", {name: "You"}, whisperMsg);
				io.sockets.socket(whisperId).emit("whisper", people[socket.id], whisperMsg);
			} else {
				socket.emit("update", "Can't find " + whisperTo);
			}
		} else {
			if (io.sockets.manager.roomClients[socket.id]['/'+socket.room] !== undefined ) {

				var clientType;
				if(typeof doctors[socket.id] !== "undefined"){
					clientType = doctors[socket.id];
		    	}else{
		    		clientType = people[socket.id];
		    	}

	    		io.sockets.in(socket.room).emit("chat", clientType, msg);
				socket.emit("isTyping", false);
				if (_.size(chatHistory[socket.room]) > 10) {
					chatHistory[socket.room].splice(0,1);
				} else {
					chatHistory[socket.room].push(clientType.name + ": " + msg);
				}
		    	} else {
				socket.emit("update", "Please connect to a room.");
		    	}
		}
	});

	socket.on("disconnect", function() {
		if (typeof people[socket.id] !== "undefined") { //this handles the refresh of the name screen
			purge(socket, "disconnect");
		}
	});

	//Room functions
	socket.on("createRoom", function(name) {	
		if ((typeof people[socket.id] !== "undefined") && (people[socket.id].type == "people")) {
			if (people[socket.id].inroom) {
				socket.emit("update", "You are in a room. Please leave it first to create your own.");
			} else if (!people[socket.id].owns) {
				var id = uuid.v4();
				var room = new Room(name, id, socket.id);
				rooms[id] = room;
				sizeRooms = _.size(rooms);
				io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms});
				//add room to socket, and auto join the creator of the room
				socket.room = name;
				socket.join(socket.room);
				people[socket.id].owns = id;
				people[socket.id].inroom = id;
				room.addPerson(socket.id);
				socket.emit("update", "Welcome to " + room.name + ".");
				socket.emit("sendRoomID", {id: id});
				chatHistory[socket.room] = [];
			} else {
				socket.emit("update", "You have already created a room.");
			}
		} else if ((typeof doctors[socket.id] !== "undefined") && (doctors[socket.id].type == "doctors")) {	
			if (doctors[socket.id].inroom) {
				socket.emit("update", "You are in a room. Please leave it first to create your own.");
			} else if (!doctors[socket.id].owns) {
				var id = uuid.v4();
				var room = new Room(name, id, socket.id);
				rooms[id] = room;
				sizeRooms = _.size(rooms);
				io.sockets.emit("roomList", {rooms: rooms, count: sizeRooms});
				//add room to socket, and auto join the creator of the room
				socket.room = name;
				socket.join(socket.room);
				doctors[socket.id].owns = id;
				doctors[socket.id].inroom = id;
				room.addDoctor(socket.id);
				socket.emit("update", "Welcome to " + room.name + ".");
				socket.emit("sendRoomID", {id: id});
				chatHistory[socket.room] = [];
			} else {
				socket.emit("update", "You have already created a room.");
			}
		} else {
			socket.emit("update", "You have already created a room.");
		}
	});

	socket.on("check", function(name, fn) {
		var match = false;
		_.find(rooms, function(key,value) {
			if (key.name === name)
				return match = true;
		});
		fn({result: match});
	});

	socket.on("removeRoom", function(id) {
		 var room = rooms[id];
		 if (socket.id === room.owner) {
			purge(socket, "removeRoom");
		} else {
                	socket.emit("update", "Only the owner can remove a room.");
		}
	});

	socket.on("joinRoom", function(id) {
		if ((typeof people[socket.id] !== "undefined") && (people[socket.id].type == "people")) {
			if (typeof people[socket.id] !== "undefined") {
				var room = rooms[id];
				if (socket.id === room.owner) {
					socket.emit("update", "You are the owner of this room and you have already been joined.");
				} else {
					if (_.contains((room.people), socket.id)) {
						socket.emit("update", "You have already joined this room.");
					} else {
						if (people[socket.id].inroom !== null) {
								socket.emit("update", "You are already in a room ("+rooms[people[socket.id].inroom].name+"), please leave it first to join another room.");
							} else {
							room.addPerson(socket.id);
							people[socket.id].inroom = id;
							socket.room = room.name;
							socket.join(socket.room);
							user = people[socket.id];
							io.sockets.in(socket.room).emit("update", user.name + " has connected to " + room.name + " room.");
							socket.emit("update", "Welcome to " + room.name + ".");
							socket.emit("sendRoomID", {id: id});
							var keys = _.keys(chatHistory);
							if (_.contains(keys, socket.room)) {
								socket.emit("history", chatHistory[socket.room]);
							}
						}
					}
				}
			}
		} else if ((typeof doctors[socket.id] !== "undefined") && (doctors[socket.id].type == "doctors")) {
			if (typeof doctors[socket.id] !== "undefined") {
				var room = rooms[id];
				if (socket.id === room.owner) {
					socket.emit("update", "You are the owner of this room and you have already been joined.");
				} else {
					if (_.contains((room.doctors), socket.id)) {
						socket.emit("update", "You have already joined this room.");
					} else {
						if (doctors[socket.id].inroom !== null) {
								socket.emit("update", "You are already in a room ("+rooms[doctors[socket.id].inroom].name+"), please leave it first to join another room.");
							} else {
							room.addDoctor(socket.id);
							doctors[socket.id].inroom = id;
							socket.room = room.name;
							socket.join(socket.room);
							user = doctors[socket.id];
							io.sockets.in(socket.room).emit("update", user.drs + " has connected to " + room.name + " room.");
							socket.emit("update", "Welcome to " + room.name + ".");
							socket.emit("sendRoomID", {id: id});
							var keys = _.keys(chatHistory);
							if (_.contains(keys, socket.room)) {
								socket.emit("history", chatHistory[socket.room]);
							}
						}
					}
				}
			}	
		}  else {
			socket.emit("update", "Please enter a valid name first.");
		}
	});

	socket.on("leaveRoom", function(id) {
		var room = rooms[id];
		if (room)
			purge(socket, "leaveRoom");
	});
});
