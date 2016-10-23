'use strict';

function Room (name,host,password,mayusRoom) {
	this.name = name;
	this.host = host;
	this.guest = null;

	this.hostSpectatorList = [];  // 列表,client或undefined或null,
	this.guestSpectatorList = []; // undefined表示禁用,null表示空.
	for (var i = 0; i < 5; i++) {
		this.hostSpectatorList.push(undefined);
		this.guestSpectatorList.push(undefined);
	}

	// 直播
	this.live = false;
	this.liveSpectators = [];

	this.game = null;
	this.password = password;
	this.mayusRoom = !!mayusRoom;
	this.reconnecting = false;
	this.activateTime = Date.now();
}

Room.prototype.toInfo = function () {
	var total = 2;
	var count = 1;
	if (this.guest) count++;
	concat(this.hostSpectatorList,this.guestSpectatorList).forEach(function (spectator) {
		if (spectator === undefined) return;
		total++;
		if (spectator) count++;
	},this);
	var info = {
		roomName: this.name,
		passwordRequired: !!this.password,
		total: total,
		count: count,
		live: this.live,
		mayusRoom: this.mayusRoom
	};
	return info;
};

Room.prototype.getAllClients = function () {
	return this.liveSpectators.concat(this.getRoomMembers());
};

Room.prototype.getRoomMembers = function () { // 除了直播观众
	var clients = this.hostSpectatorList.concat(this.guestSpectatorList).filter(function (spectator) {
		return spectator;
	});
	if (this.host) clients.push(this.host);
	if (this.guest) clients.push(this.guest);
	return clients;
};

Room.prototype.emit = function (name,value) {
	var clients = this.getAllClients();
	clients.forEach(function (client) {
		client.socket.emit(name,value);
	},this);
};

Room.prototype.emitTo = function (positions,name,value) {
	var clients = this.getAllClients();
	clients.forEach(function (client) {
		if (!inArr(client.getPosition(),positions)) return;
		client.socket.emit(name,value);
	},this);
};

Room.prototype.removeSpectator = function (client) {
	return this.removeHostSpectator(client) ||
	       this.removeGuestSpectator(client) ||
	       this.removeLiveSpectator(client);
};

Room.prototype.removeHostSpectator = function (client) {
	var i = this.hostSpectatorList.indexOf(client);
	if (i === -1) return false;
	this.hostSpectatorList[i] = null;
	return true;
};

Room.prototype.removeGuestSpectator = function (client) {
	var i = this.guestSpectatorList.indexOf(client);
	if (i === -1) return false;
	this.guestSpectatorList[i] = null;
	return true;
};

Room.prototype.removeClient = function (client) {
	if (client === this.guest) {
		this.guest = null;
		return true;
	}
	return this.removeSpectator(client);
};

Room.prototype.isHostSpectatorsFull = function () {
	return this.hostSpectatorList.every(function (spectator) {
		return (spectator !== null);
	});
};

Room.prototype.isGuestSpectatorsFull = function () {
	return this.guestSpectatorList.every(function (spectator) {
		return (spectator !== null);
	});
};

Room.prototype.isFull = function () {
	if (!this.guest) return false;
	if (!this.isHostSpectatorsFull()) return false;
	if (!this.isGuestSpectatorsFull()) return false;
	return true;
};

Room.prototype.pushHostSpectator = function (client) {
	for (var i = 0; i < this.hostSpectatorList.length; i++) {
		if (this.hostSpectatorList[i] === null) {
			this.hostSpectatorList[i] = client;
			return true;
		}
	}
	return false;
};

Room.prototype.pushGuestSpectator = function (client) {
	for (var i = 0; i < this.guestSpectatorList.length; i++) {
		if (this.guestSpectatorList[i] === null) {
			this.guestSpectatorList[i] = client;
			return true;
		}
	}
	return false;
};

Room.prototype.setHostSpectator = function (client,i) {
	if (this.hostSpectatorList[i] !== null) return false;
	client.cfg = null;
	this.removeClient(client);
	this.hostSpectatorList[i] = client;
	return true;
};

Room.prototype.setGuestSpectator = function (client,i) {
	if (this.guestSpectatorList[i] !== null) return false;
	client.cfg = null;
	this.removeClient(client);
	this.guestSpectatorList[i] = client;
	return true;
};

Room.prototype.update = function () {
	this.getRoomMembers().forEach(function (client) {
		var msgObj = {
			roomName: this.name,
			host: this.host.nickname,
			guest: this.guest? this.guest.nickname : '',
			hostSpectatorList: this.hostSpectatorList.map(function (spectator) {
				if (spectator === null) return '';
				if (spectator === undefined) return null;
				return spectator.nickname;
			}),
			guestSpectatorList: this.guestSpectatorList.map(function (spectator) {
				if (spectator === null) return '';
				if (spectator === undefined) return null;
				return spectator.nickname;
			}),
			guestReady: !!(this.guest && this.guest.cfg),
			me: client.getPosition(),
			mayusRoom: this.mayusRoom
		}
		client.emit('update room',msgObj);
	},this);
};

Room.prototype.getHostSpectators = function () {
	var spaectators = [];
	this.hostSpectatorList.forEach(function (spectator) {
		if (!spectator) return;
		spaectators.push(spectator);
	});
	return spaectators;
};

Room.prototype.getGuestSpectators = function () {
	var spaectators = [];
	this.guestSpectatorList.forEach(function (spectator) {
		if (!spectator) return;
		spaectators.push(spectator);
	});
	return spaectators;
};

Room.prototype.lockHostSpec = function (i) {
	var spectator = this.hostSpectatorList[i];
	this.hostSpectatorList[i] = undefined;
	if (spectator) {
		spectator.reset();
		spectator.emit('kicked');
	}
};

Room.prototype.lockGuestSpec = function (i) {
	var spectator = this.guestSpectatorList[i];
	this.guestSpectatorList[i] = undefined;
	if (spectator) {
		spectator.reset();
		spectator.emit('kicked');
	}
};

Room.prototype.unlockHostSpec = function (i) {
	if (this.hostSpectatorList[i]) return;
	this.hostSpectatorList[i] = null;
};

Room.prototype.unlockGuestSpec = function (i) {
	if (this.guestSpectatorList[i]) return;
	this.guestSpectatorList[i] = null;
};

// 直播
Room.prototype.pushLiveSpectator = function (client) {
	this.liveSpectators.push(client);
};
Room.prototype.removeLiveSpectator = function (client) {
	removeFromArr(client,this.liveSpectators);
};

Room.prototype.gameover = function () {
	this.reconnecting = false;
	if (this.game) this.game.destroy();
	this.game = null;
	this.live = false;
	this.activateTime = Date.now();
	this.getAllClients().forEach(function (client) {
		client.gameover();
	},this);
	this.liveSpectators.length = 0;
	this.update();
};

Room.prototype.createHostIO = function () {
	return new IO(this.host,function () {
		return this.liveSpectators.concat(this.getHostSpectators());
	}.bind(this));
};

Room.prototype.createGuestIO = function () {
	return new IO(this.guest,this.getGuestSpectators.bind(this));
};

global.Room = Room;