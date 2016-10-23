'use strict';

function IO_Socket (socket) {
	this.socket = socket;
	this.listener = null;
	this.socket.on('gameMessage',function (data) {
		// TODO:
		//   check data
		if (this.listener) {
			this.listener.call(null,data);
		}
	}.bind(this));
};

IO_Socket.prototype.send = function (data) {
	this.socket.emit('gameMessage',data);
};

global.IO = IO;