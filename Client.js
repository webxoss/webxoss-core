'use strict';

function Client (manager,socket) {
	this.manager = manager;
	this.socket = socket;
	this.room = null;
	this.cfg = null;
	this.nickname = '';
	this.id = Math.random();
	// this.ip = '';
	this.onSocketUpdate = null;

	socket.emit('client id',this.id);
}

Client.prototype.emit = function () {
	return this.socket.emit.apply(this.socket,arguments);
};

Client.prototype.reset = function () {
	this.room = null;
	this.cfg = null;
	this.nickname = '';
};

Client.prototype.updateSocket = function (socket) {
	this.socket = socket;
	if (this.onSocketUpdate) {
		this.onSocketUpdate();
	}
};

// Client.prototype.createRoom = function (roomName) {
// 	this.manager.createRoom(this,roomName);
// };

// Client.prototype.joinRoom = function (roomName) {
// 	this.manager.joinRoom(this,roomName);
// };

Client.prototype.ready = function (cfg) {
	var errMsg;
	if (!this.room) {
		errMsg = 'YOU_ARE_NOT_IN_ANY_ROOM';
	} else if (this !== this.room.guest) {
		errMsg = 'YOU_ARE_NOT_THE_GUEST';
	} else if (this.cfg) {
		errMsg = 'YOU_ARE_READY';
	} else if (this.room.game) {
		errMsg = 'GAME_ALREADY_STARTED';
	} else if (!Game.checkDeck(cfg,this.room.mayusRoom)) {
		errMsg = 'INVALID_CONFIG';
	}

	if (errMsg) {
		this.socket.emit('error message',errMsg);
		return;
	}

	this.cfg = cfg;
	// this.room.host.socket.emit('ready');
	this.room.update();
};

Client.prototype.unready = function () {
	var errMsg;
	if (!this.room) {
		errMsg = 'YOU_ARE_NOT_IN_ANY_ROOM';
	} else if (this !== this.room.guest) {
		errMsg = 'YOU_ARE_NOT_THE_GUEST';
	} else if (!this.cfg) {
		errMsg = 'YOU_ARE_NOT_READY';
	} else if (this.room.game) {
		errMsg = 'GAME_ALREADY_STARTED';
	}

	if (errMsg) {
		this.socket.emit('error message',errMsg);
		return;
	}

	this.cfg = null;
	// this.room.host.socket.emit('unready');
	this.room.update();
};

Client.prototype.startGame = function (cfg) {
	var errMsg;
	if (!this.room) {
		errMsg = 'YOU_ARE_NOT_IN_ANY_ROOM';
	} else if (this !== this.room.host) {
		errMsg = 'YOU_ARE_NOT_THE_HOST';
	} else if (!this.room.guest || !this.room.guest.cfg) {
		errMsg = 'YOUR_OPPONENT_IS_NOT_READY';
	} else if (this.cfg || this.room.game) {
		errMsg = 'GAME_ALREADY_STARTED';
	} else if (!Game.checkDeck(cfg,this.room.mayusRoom)) {
		errMsg = 'INVALID_CONFIG';
	}

	if (errMsg) {
		this.socket.emit('error message',errMsg);
		return;
	}


	this.cfg = cfg;
	var room = this.room;
	room.live = !!cfg.live;
	var cfg = {
		seed: Math.random() * 0xFFFFFFFF >>> 0,
		hostMainDeck: room.host.cfg.mainDeck,
		hostLrigDeck: room.host.cfg.lrigDeck,
		guestMainDeck: room.guest.cfg.mainDeck,
		guestLrigDeck: room.guest.cfg.lrigDeck,
		hostIO: room.createHostIO(),
		guestIO: room.createGuestIO(),
		onGameover: this.manager.gameover.bind(this.manager,room)
	};
	room.game = new Game(cfg);
	room.emit('game start');

	// 统计数据
	var date = new Date();
	var day = date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
	if (!this.manager.gameCountMap) this.manager.gameCountMap = {};
	if (!this.manager.gameCountMap[day]) this.manager.gameCountMap[day] = 0;
	this.manager.gameCountMap[day]++;
	// console.log(day);
	// var time = new Date().toISOString().replace('T',' ').substr(0,19);
	// var count = this.manager.rooms.filter(function (room) {
	// 	return room.game;
	// }).length;
	// console.log('%s "%s" starts. Count: %s',time,room.name,count);
	room.game.start();

	this.manager.updateRoomList();
};

Client.prototype.chat = function (msg) {
	if (!msg) return;
	if (!isStr(msg)) return;
	if (msg.length > 256) return;
	var room = this.room;
	if (!room) return;
	if (this.getPosition() === 'live-spectator') {
		return;
	}
	// if (!room.host || !room.guest) return;
	// this.socket.emit('chat feedback',msg);
	// if (this === room.host) {
	// 	room.guest.socket.emit('chat',msg);
	// } else {
	// 	room.host.socket.emit('chat',msg);
	// }
	var msgObj = {
		nickname: this.nickname,
		position: this.getPosition(),
		content: msg
	};
	// room.emit('chat',msgObj);
	room.getRoomMembers().forEach(function (client) {
		client.emit('chat',msgObj);
	},this);
};

Client.prototype.surrender = function () {
	var errMsg;
	var room = this.room;
	if (!room) {
		errMsg = 'YOU_ARE_NOT_IN_ANY_ROOM';
	} else if (!room.game || ((this !== room.host) && (this !== room.guest))) {
		errMsg = 'YOU_ARE_NOT_BATTLING';
	} else if (room.reconnecting) {
		errMsg = 'WAITING_FOR_RECONNECT';
	}

	if (errMsg) {
		this.socket.emit('error message',errMsg);
		return;
	}

	if (this === room.host) {
		room.emitTo(['guest','guest-spectator'],'opponent surrendered');
		room.emitTo(['host','host-spectator','live-spectator'],'surrendered');
	} else {
		room.emitTo(['host','host-spectator','live-spectator'],'opponent surrendered');
		room.emitTo(['guest','guest-spectator'],'surrendered');
	}
	var arg = {
		surrender: (this === room.host)? 'host' : 'guest'
	};
	room.game.gameover(arg);
};

Client.prototype.drop = function () {
	var errMsg;
	var room = this.room;
	if (!room) {
		errMsg = 'YOU_ARE_NOT_IN_ANY_ROOM';
	} else if (!room.game || ((this !== room.host) && (this !== room.guest))) {
		errMsg = 'YOU_ARE_NOT_BATTLING';
	}

	if (errMsg) {
		this.socket.emit('error message',errMsg);
		return;
	}

	if (!room.reconnecting) {
		// 发送drop请求后,服务器收到之前,
		// 对方可能已经重连,故不发送错误信息.
		return;
	}

	if (this === room.host) {
		room.emit('guest disconnected');
	} else {
		room.emit('host disconnected');
	}
	this.manager.removeRoom(room);
};

Client.prototype.getPosition = function () {
	if (!this.room) return 'none';
	if (this.room.host === this) return 'host';
	if (this.room.guest === this) return 'guest';
	if (inArr(this,this.room.hostSpectatorList)) return 'host-spectator';
	if (inArr(this,this.room.guestSpectatorList)) return 'guest-spectator';
	return 'live-spectator';
};

Client.prototype.gameover = function () {
	this.cfg = null;
	if (this.getPosition() === 'live-spectator') {
		this.reset();
	}
};

Client.prototype.tick = function () {
	this.socket.emit('tock');
	// var socket = this.socket;
	// setTimeout(function() {
	// 	socket.emit('tock');
	// }, 300);
};

global.Client = Client;