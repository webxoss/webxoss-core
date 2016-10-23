'use strict';

/*
	服务器 -> 客户端:
	msg = {
		buffer: [{
			id: id,
			data: []
		}]
	}
	客户端 -> 服务器
	msg = {
		id: id,
		data: {
			label: label,
			input: []
		}
	}
*/

function IO (client,getSpectators) {
	this.client = client;
	this.getSpectators = getSpectators || function () {
		return [];
	};
	this.listener = null;
	this.lastId = 0;
	this.id = 0;
	this.buffer = [];
	this.setSocketListener();
	client.onSocketUpdate = function () {
		this.setSocketListener();
		this.resend();
	}.bind(this);
};

IO.prototype.setSocketListener = function () {
	this.client.socket.removeAllListeners('gameMessage');
	this.client.socket.on('gameMessage',function (msg) {
		if (this.lastId === msg.id) {
			// console.log('same id.');
			return;
		};
		this.buffer.length = 0;
		if (this.listener) {
			this.listener(msg.data);
		}
	}.bind(this));
};

IO.prototype.send = function (data) {
	var obj = {
		id: this.id,
		data: data
	};
	this.id++;
	// 将要发送的数据缓存,以便重新连接时重发.
	this.buffer.push(obj);
	// 现在发送的信息不包括缓存的数据.
	var msg = {buffer: [obj]};
	this.client.emit('gameMessage',msg);
	this.getSpectators().forEach(function (spectator) {
		spectator.emit('gameMessage',msg);
	},this);
};

IO.prototype.resend = function () {
	var msg = {buffer: this.buffer};
	// console.log(msg);
	this.client.emit('gameMessage',msg);
};

global.IO = IO;