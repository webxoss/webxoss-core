'use strict';

function RoomManager (cfg) {
	this.VERSION              = 63;

	this.MAX_ROOMS            = cfg.MAX_ROOMS;
	this.MAX_CLIENTS          = cfg.MAX_CLIENTS;
	this.MAX_ROOM_NAME_LENGTH = cfg.MAX_ROOM_NAME_LENGTH;
	this.MAX_NICKNAME_LENGTH  = cfg.MAX_NICKNAME_LENGTH;
	this.MAX_PASSWORD_LENGTH  = cfg.MAX_PASSWORD_LENGTH;

	this.clients   = [];
	this.rooms     = [];
	this.roomMap   = {};

	this.replayList = [];
	this.MAX_REPLAY_LENGTH = 20;

	this.maxClientsCount = 0;
	this.maxGamesCount = 0;

	setInterval(this.cleanUp.bind(this),60*1000);
}

RoomManager.prototype.createClient = function (socket,id) {
	if (this.clients.length >= this.MAX_CLIENTS) {
		socket.disconnect();
		return;
	}

	var client;
	if (id) {
		var room;
		for (var i = 0; i < this.rooms.length; i++) {
			room = this.rooms[i];
			// if (!room.reconnecting) continue; // 服务器可能还不知道掉线,所以注释掉.
			// console.log('host:%s\nguest:%s\nyou:%s',room.host.id,room.guest.id,id);
			if (room.host.id === id) {
				client = room.host;
				client.updateSocket(socket);
				break;
			}
			if (room.guest && room.guest.id === id) {
				client = room.guest;
				client.updateSocket(socket);
				break;
			}
		}
		if (client) {
			room.reconnecting = false;
			socket.emit('game reconnect');
			room.emit('opponent reconnect');
		} else {
			socket.emit('game reconnect failed');
		}
	}
	if (!client) {
		client = new Client(this,socket);
	}
	this.clients.push(client);

	// if (this.clients.length > this.maxClientsCount) {
	// 	this.maxClientsCount = this.clients.length;
	// 	console.log(new Date().toISOString().replace('T',' ').substr(0,19)+' Max clients count: %s',this.clients.length);
	// }

	socket.on('error',this.handleError.bind(this,client));
	socket.on('disconnect',this.disconnect.bind(this,client));
	socket.on('createRoom',this.createRoom.bind(this,client));
	socket.on('joinRoom',this.joinRoom.bind(this,client));
	socket.on('leaveRoom',this.leaveRoom.bind(this,client));
	socket.on('lockSpec',this.lockSpec.bind(this,client));
	socket.on('unlockSpec',this.unlockSpec.bind(this,client));
	socket.on('changePosition',this.changePosition.bind(this,client));
	socket.on('getReplayList',this.getReplayList.bind(this,client));
	socket.on('getReplayContent',this.getReplayContent.bind(this,client));
	socket.on('watchLive',this.watchLive.bind(this,client));

	socket.on('ready',client.ready.bind(client));
	socket.on('unready',client.unready.bind(client));
	socket.on('startGame',client.startGame.bind(client));
	socket.on('chat',client.chat.bind(client));
	socket.on('surrender',client.surrender.bind(client));
	socket.on('drop',client.drop.bind(client));
	socket.on('tick',client.tick.bind(client));

	// socket.on('reloadCardInfo',this.reloadCardInfo.bind(this));

	socket.emit('version',this.VERSION);
	this.updateRoomList();
};

RoomManager.prototype.handleError = function (client,err) {
	console.error(err);
	console.error(err.stack);
	// console.trace();
	var errMsg = 'SERVER_ERROR';
	var room = client.room;
	if (room) {
		// if (room.host) {
		// 	room.host.socket.emit('error message',errMsg);
		// }
		// if (room.guest) {
		// 	room.guest.socket.emit('error message',errMsg);
		// }
		room.emit('error message',errMsg);
		this.removeRoom(client.room);
	}
};

RoomManager.prototype.disconnect = function (client) {
	removeFromArr(client,this.clients);

	var room = client.room;
	if (!room) return;
	// --- 重新连接开始 ---
	if (room.game && !room.reconnecting) {
		if ((client === room.host) || (client === room.guest)) {
			room.reconnecting = true;
			// !here
			// room.emit('wait for reconnect');
			room.getAllClients().forEach(function (c) {
				if (c === client) return;
				c.emit('wait for reconnect');
			},this);
			return;
		}
	}
	// --- 重新连接结束 ---
	room.reconnecting = false;
	if (client === room.host) {
		// 主机掉线
		room.emit('host disconnected');
		this.removeRoom(room);
	} else if (client === room.guest) {
		// 客机掉线
		if (room.game) {
			room.emit('guest disconnected');
			this.removeRoom(room);
		} else {
			room.guest = null;
			room.update();
			this.updateRoomList();
		}
	} else {
		// 观众掉线
		room.removeSpectator(client);
		room.update();
		this.updateRoomList();
	}
};

RoomManager.prototype.removeRoom = function (room) {
	if (!room) return;
	if (room.game) room.game.destroy();
	room.getAllClients().forEach(function (client) {
		client.reset();
	},this);

	delete this.roomMap[room.name];
	removeFromArr(room,this.rooms);

	this.updateRoomList();
};

RoomManager.prototype.updateRoomList = function () {
	this.clients.forEach(function (client) {
		var list = [];
		this.rooms.forEach(function (room) {
			var flag = (room.live && room.game && !this.checkLiveIP(client,room)) ||
			           (!room.game && !room.isFull());
			if (flag) {
				list.push(room.toInfo());
			}
		},this);
		if (client.room) return;
		client.socket.emit('update room list',list);
		client.socket.emit('update online counter',this.clients.length);
	},this);
};

RoomManager.prototype.checkRoomName = function (roomName) {
	// TODO: 过滤敏感字词
	if (!isStr(roomName) || !roomName || roomName.length > this.MAX_ROOM_NAME_LENGTH) {
		return 'INVALID_ROOM_NAME';
	}
};

RoomManager.prototype.checkNickname = function (nickname) {
	// TODO: 过滤敏感字词
	if (!isStr(nickname) || !nickname || nickname.length > this.MAX_NICKNAME_LENGTH) {
		return 'INVALID_NICKNAME';
	}
};

RoomManager.prototype.checkPassword = function (password) {
	if (!isStr(password) || password.length > this.MAX_PASSWORD_LENGTH) {
		return 'INVALID_PASSWORD';
	}
};

RoomManager.prototype.checkClientInRoom = function (client) {
	if (client.room) return 'ALREADY_IN_A_ROOM';
};

RoomManager.prototype.checkLiveIP = function (client,room) {
	if (!client.socket.handshake) return '';
	if (!room.guest) return '';
	var address = client.socket.handshake.address;
	var guestAddress = room.guest.socket.handshake.address;
	if (address === guestAddress) return 'IP_BANNED';
};

RoomManager.prototype.createRoom = function (client,cfg) {
	var errMsg;
	if (!isObj(cfg) || !isStr(cfg.roomName) || !isStr(cfg.nickname)) {
		errMsg = 'INVALID_CONFIG';
	}
	var roomName = cfg.roomName;
	var nickname = cfg.nickname;
	var password = cfg.password;
	if (!errMsg) {
		errMsg =
			this.checkRoomName(roomName) ||
			this.checkNickname(nickname) ||
			this.checkPassword(password) ||
			this.checkClientInRoom(client);
	}
	if (!errMsg) {
		if (roomName in this.roomMap) {
			errMsg = 'ROOM_ALREADY_EXISTS';
		} else if (this.rooms.length >= this.MAX_ROOMS) {
			errMsg = 'MAX_ROOMS';
		}
	}

	if (errMsg) {
		client.socket.emit('error message',errMsg);
		return;
	}

	// console.log('%s creates room: %s',client.socket.id,roomName);
	if (password) {
		console.log('nickname: %s, roomName: %s, password: %s',nickname,roomName,password);
	}
	// 双向绑定
	var room = new Room(roomName,client,password,!!cfg.mayusRoom);
	client.room = room;
	this.roomMap[roomName] = room;
	this.rooms.push(room);
	client.nickname = nickname;

	// client.socket.emit('host room',{
	// 	roomName: room.name,
	// 	host: nickname,
	// 	guest: ''
	// });
	room.update();
	this.updateRoomList();
};

RoomManager.prototype.joinRoom = function (client,cfg) {
	var errMsg;
	if (!isObj(cfg) || !isStr(cfg.roomName) || !isStr(cfg.nickname)) {
		errMsg = 'INVALID_CONFIG';
	}
	var roomName = cfg.roomName;
	var nickname = cfg.nickname;
	var password = cfg.password;
	if (!errMsg) {
		errMsg =
			this.checkRoomName(roomName) ||
			this.checkNickname(nickname) ||
			this.checkPassword(password) ||
			this.checkClientInRoom(client);
	}
	var room;
	if (!errMsg) {
		room = this.roomMap[roomName];
		if (!room) {
			errMsg = 'ROOM_DOES_NOT_EXIST';
		} else if (room.game) {
			errMsg = 'GAME_ALREADY_STARTED';
		} else if (room.isFull()) {
			errMsg = 'ROOM_IS_FULL';
		}
	}

	if (errMsg) {
		client.socket.emit('error message',errMsg);
		return;
	}

	if (room.password && (password !== room.password)) {
		client.socket.emit('wrong password');
		return;
	}

	client.nickname = nickname;
	client.room = room;

	if (!room.guest) {
		room.guest = client;
	} else if (!room.isHostSpectatorsFull()) {
		room.pushHostSpectator(client);
	} else {
		room.pushGuestSpectator(client);
	}
	room.update();
	this.updateRoomList();
};

// RoomManager.prototype.toGuest = function (client,room) {
// 	room.removeClient(client);
// 	room.guest = client;
// 	room.update();
// };

// RoomManager.prototype.toHostSpectator = function (client,room,i) {
// 	room.removeClient(client);
// 	room.setHostSpectator(client,i);
// 	room.update();
// };

// RoomManager.prototype.toGuestSpectator = function (client,room,i) {
// 	room.removeClient(client);
// 	room.setGuestSpectator(client,i);
// 	room.update();
// };

RoomManager.prototype.leaveRoom = function (client) {
	var errMsg;
	if (!client.room) {
		errMsg = 'YOU_ARE_NOT_IN_ANY_ROOM';
	} else if (client.room.game && ((client === client.room.host) || (client === client.room.guest))) {
		errMsg = 'GAME_ALREADY_STARTED';
	}

	if (errMsg) {
		client.socket.emit('error message',errMsg);
		return;
	}

	var room = client.room;
	if (client === room.host) {
		room.emit('host left');
		this.removeRoom(room);
	} else {
		room.removeClient(client);
		client.reset();
		room.update();
	}

	// var host = client.room.host;
	// var guest = client.room.guest;
	// if (client === host) {
	// 	if (guest) {
	// 		guest.socket.emit('host left');
	// 	}
	// 	this.removeRoom(client.room);
	// } else {
	// 	host.socket.emit('guest left');
	// 	client.room.guest = null;
	// 	client.reset();
	// }
	this.updateRoomList();
};

function checkSpectatorIndex (i) {
	if (!((i >= 0) && (i < 5))) {
		return 'INVALID_INDEX';
	}
}

RoomManager.prototype.lockSpec = function (client,i) {
	i >>>= 0;
	var errMsg;
	var room = client.room;
	if (!room) {
		errMsg = 'YOU_ARE_NOT_IN_ANY_ROOM';
	} else if (client.room.game) {
		errMsg = 'GAME_ALREADY_STARTED';
	} else if ((client !== room.host) && (client !== room.guest)) {
		errMsg = 'NO_PERMISSION';
	} else {
		errMsg = checkSpectatorIndex(i);
	}

	if (errMsg) {
		client.socket.emit('error message',errMsg);
		return;
	}

	if (client === room.host) {
		room.lockHostSpec(i);
	} else {
		room.lockGuestSpec(i);
	}
	room.update();
	this.updateRoomList();
};

RoomManager.prototype.unlockSpec = function (client,i) {
	i >>>= 0;
	var errMsg;
	var room = client.room;
	if (!room) {
		errMsg = 'YOU_ARE_NOT_IN_ANY_ROOM';
	} else if (room.game) {
		errMsg = 'GAME_ALREADY_STARTED';
	} else if ((client !== room.host) && (client !== room.guest)) {
		errMsg = 'NO_PERMISSION';
	} else {
		errMsg = checkSpectatorIndex(i);
	}

	if (errMsg) {
		client.socket.emit('error message',errMsg);
		return;
	}

	if (client === room.host) {
		room.unlockHostSpec(i);
	} else {
		room.unlockGuestSpec(i);
	}
	room.update();
	this.updateRoomList();
};

RoomManager.prototype.changePosition = function (client,cfg) {
	var errMsg;
	var room = client.room;
	if (!room) {
		errMsg = 'YOU_ARE_NOT_IN_ANY_ROOM';
	} else if (room.game) {
		errMsg = 'GAME_ALREADY_STARTED';
	} else if (client === room.host) {
		errMsg = 'NO_PERMISSION';
	} else if (!isObj(cfg)) {
		errMsg = 'INVALID_CONFIG';
	}

	if (errMsg) {
		client.socket.emit('error message',errMsg);
		return;
	}

	if (cfg.position === 'guest') {
		if (room.guest) return room.update();
		room.removeClient(client);
		room.guest = client;
		return room.update();
	}

	var i = cfg.i >>> 0;
	if (checkSpectatorIndex(i)) return;
	if (cfg.position === 'host-spectator') {
		room.setHostSpectator(client,i);
	} else if (cfg.position === 'guest-spectator') {
		room.setGuestSpectator(client,i);
	}
	room.update();
};

RoomManager.prototype.gameover = function (room,replay) {
	// console.log('%s gameovered',room.name);
	if (room) {
		room.gameover();
	}
	if (replay) {
		this.pushReplay(replay);
	}
	this.updateRoomList();
};

RoomManager.prototype.pushReplay = function (replay) {
	// if (replay.messagePacks.length < 20) return;
	replay.id = Math.random();
	this.replayList.unshift(replay);
	if (this.replayList.length > this.MAX_REPLAY_LENGTH) {
		this.replayList.pop();
	}
};

RoomManager.prototype.getReplayList = function (client) {
	var list = this.replayList.map(function (replay) {
		return {
			id: replay.id,
			win: replay.win,
			surrender: replay.surrender,
			selfLrig: replay.selfLrig,
			opponentLrig: replay.opponentLrig
		};
	},this);
	client.socket.emit('replayList',list);
};

RoomManager.prototype.getReplayContent = function (client,id) {
	if (!isNum(id)) return;
	for (var i = 0; i < this.replayList.length; i++) {
		var replay = this.replayList[i];
		if (replay.id === id) {
			client.socket.emit('replayContent',{
				clientVersion: this.version,
				win: replay.win,
				surrender: replay.surrender,
				messagePacks: replay.messagePacks
			});
			return;
		}
	}
	client.socket.emit('replayContent',null);
};

RoomManager.prototype.watchLive = function (client,cfg) {
	var errMsg;
	if (!isObj(cfg) || !isStr(cfg.roomName)) {
		errMsg = 'INVALID_CONFIG';
	}
	var roomName = cfg.roomName;
	if (!errMsg) {
		errMsg = this.checkClientInRoom(client);
	}
	var room;
	if (!errMsg) {
		room = this.roomMap[roomName];
		if (!room) {
			errMsg = 'ROOM_DOES_NOT_EXIST';
		} else if (!room.live) {
			errMsg = 'NOT_IN_LIVE_MODE';
		} else if (!room.game) {
			errMsg = 'GAME_NOT_IN_PROGRESS';
		} else {
			errMsg = this.checkLiveIP(client,room);
		}
	}

	if (errMsg) {
		client.socket.emit('error message',errMsg);
		return;
	}

	client.room = room;
	room.pushLiveSpectator(client);
	client.emit('liveData',room.game.getLiveMessagePacks());
};

RoomManager.prototype.cleanUp = function () {
	var clients = this.clients.slice();
	clients.forEach(function (client) {
		var socket = client.socket;
		if (socket.disconnected) {
			this.disconnect(client);
			console.error('cleanUp');
		}
	},this);
	var rooms = this.rooms.slice();
	var now = Date.now();
	rooms.forEach(function (room) {
		var flag =
			((now - room.activateTime) >= 3*60*60*1000) ||
			(!room.reconnecting && room.host && room.host.socket.disconnected) ||
			(!room.reconnecting && room.guest && room.guest.socket.disconnected);
		if (!flag) return;
		console.log('clean up: ' + room.name);
		this.removeRoom(room);
	},this);
};

// RoomManager.prototype.reloadCardInfo = function (password) {
// 	if (password !== 'WEBXOSS') return;
// 	var path = require('path');
// 	var filePath = './CardInfo.js';
// 	delete require.cache[path.resolve(filePath)];
// 	require(filePath);
// };

global.RoomManager = RoomManager;