'use strict';

if (!global.window) {
	global.Random = require("random-js");
	require("./util.js");
	require("./Callback.js");
	require("./Game.js");
	require("./Phase.js");
	require("./IO.js");
	require("./Player.js");
	require("./Card.js");
	require("./Zone.js");
	require("./CardInfo.js");
	require("./Timming.js");
	require("./Mask.js");
	require("./ConstEffect.js");
	require("./ConstEffectManager.js");
	require("./Effect.js");
	require("./EffectManager.js");
	require("./Client.js");
	require("./Room.js");
	require("./RoomManager.js");
}

var io;
if (global.window) {
	io = {
		on: function (name,handler) {
			io._handler = handler;
		},
		use: function () {}
	};
	global.window.newClient = function () {
		var win = window.open('./webxoss-client/?local=true');
		win.addEventListener('load',function () {
			var socket = new FakeSocket(win);
			win.addEventListener('unload',function () {
				socket._doEmit('disconnect');
			});
			win.document.title = 'Client' + socket.id;
			io._handler(socket);
		});
	}
} else {
	var noStaticServe = process.argv.slice(2).some(function (arg) {
		return arg === 'no-static-server';
	});
	// static server
	if (!noStaticServe) {
		var express = require('express');
		var compression = require('compression');
		var app = express();
		var server = require('http').Server(app);
		app.use(compression());
		app.use('/background',express.static(__dirname + '/webxoss-client/images',{
			maxAge: '2h'
		}));
		app.use('/images',express.static(__dirname + '/webxoss-client/images',{
			maxAge: '30d'
		}));
		app.use(express.static(__dirname + '/webxoss-client'));
		var port = 80;
		process.argv.slice(2).forEach(function (arg) {
			var match = arg.match(/^port=(\d+)/)
			if (match) {
				port = +match[1];
			}
		});
		server.listen(port);
	}
	// game server
	var getArg = function (key) {
		var value = '';
		process.argv.slice(2).forEach(function (arg) {
			if (arg.indexOf(key + '=') === 0) {
				value = arg.replace(key + '=', '');
			}
		});
		return value;
	};
	var gameServer
	if (getArg('key')) {
		var fs = require('fs');
		gameServer = require('https').createServer({
			key: fs.readFileSync(getArg('key')),
			cert: fs.readFileSync(getArg('cert')),
			ca: fs.readFileSync(getArg('ca')),
		});
	} else {
		gameServer = require('http').createServer();
	}
	io = require('socket.io')(gameServer,{
		pingTimeout: 30000,
		maxHttpBufferSize: 1024*1024,
	});
	gameServer.listen(2015);
}

var cfg = {
	MAX_ROOMS: 100,
	MAX_CLIENTS: 500,
	MAX_ROOM_NAME_LENGTH: 15,
	MAX_NICKNAME_LENGTH: 10,
	MAX_PASSWORD_LENGTH: 15
};
var roomManager = new RoomManager(cfg);
var MAX_SOCKETS = 500;
// var MAX_SOCKETS_PER_IP = 50;
// var ipTable = {};
function getSocketCount () {
	if (!io.sockets) return 0;
	return Object.keys(io.sockets.connected).length;
}
io.use(function (socket,next) {
	if (getSocketCount() >= MAX_SOCKETS) {
		next(new Error('MAX_SOCKETS'));
		return;
	}
	// var handshake = socket.request;
	// var ip = handshake.connection.remoteAddress;
	// if (!ip) {
	// 	next();
	// 	return;
	// }
	// if (ip in ipTable) {
	// 	if (ipTable[ip] >= MAX_SOCKETS_PER_IP) {
	// 		console.log('MAX_SOCKETS_PER_IP: %s',ip);
	// 		next(new Error('MAX_SOCKETS_PER_IP'));
	// 		return;
	// 	} else {
	// 		ipTable[ip]++;
	// 	}
	// } else {
	// 	ipTable[ip] = 1;
	// }
	// socket.on('disconnect',function () {
	// 	console.log('disconnect: %s, count: %s',ip,getSocketCount());
	// 	if (ip in ipTable) {
	// 		if (ipTable[ip] <= 1) {
	// 			delete ipTable[ip];
	// 		} else {
	// 			ipTable[ip]--;
	// 		}
	// 	}
	// });
	next();
});
io.on('connect',function (socket) {
	if (global.window) {
		return roomManager.createClient(socket);
	}
	var req = socket.request;
	if (req.connection.destroyed) {
		console.log('req.connection.destroyed');
		return;
	}
	var query = require('url').parse(req.url,true).query;
	// console.log('connect: %s, count: %s',req.connection.remoteAddress,getSocketCount());
	// console.log(query.clientId);
	roomManager.createClient(socket,query.clientId,+query.reconnect);
	// test
	// socket.on('force disconnect',function () {
	// 	socket.disconnect();
	// });

	// for debug
	if (typeof process === 'undefined') return;
	var password = '';
	process.argv.slice(2).forEach(function (arg) {
		var match = arg.match(/^debug_password=(\S+)/)
		if (match) {
			password = match[1];
		}
	});
	if (!password) return;
	socket.on('debug',function (psw) {
		if (psw !== password) return;
		try {
			var path = require('path');
			var filePath = './debug.js';
			delete require.cache[path.resolve(filePath)];
			require(filePath);
		} catch (e) {
			console.log(e);
		}
	});
});

if (!global.window) {
	exports.roomManager = roomManager;
}