'use strict';

window.FakeSocket = (function () {


var sockets = [];

window.addEventListener('message',function (event) {
	var win = event.source;
	var name = event.data.name;
	var data = event.data.data;
	if ((name !== 'tick') && (name !== 'tock')) console.log(JSON.stringify(event.data));
	for (var i = 0; i < sockets.length; i++) {
		var socket = sockets[i];
		if (socket._win === win) {
			socket._doEmit(name,data);
			return;
		}
	}
});

function FakeSocket (win) {
	this._win = win;
	this._listeners = {};
	this.id = '<' + sockets.push(this) + '>';
	this.io = {
		reconnection: function () {},
		opts: {
			query: ''
		}
	}
}

FakeSocket.prototype.on = function (name,handler) {
	if (!this._listeners[name]) this._listeners[name] = [];
	this._listeners[name].push(handler);
};

FakeSocket.prototype.emit = function (name,data) {
	this._win.postMessage({
		name: name,
		data: data
	},'*');
};

FakeSocket.prototype._doEmit = function (name,data) {
	var listeners = this._listeners[name];
	if (listeners) {
		listeners.forEach(function (listener) {
			listener(data);
		});
	}
};

FakeSocket.prototype.disconnect = function () {
	this.emit('disconnect');
};

FakeSocket.prototype.removeAllListeners = function (name) {
	var listeners = this._listeners[name];
	if (listeners) {
		listeners.length = 0;
	}
};

return FakeSocket;





















})();