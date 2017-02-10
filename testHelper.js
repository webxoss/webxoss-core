'use strict'

// browser only

function testHelper() {
  this.cfg = {
    disableAudio: true,
  }
}
testHelper.prototype.disableAudio = function (doc) {
  // disable BGM
  if (!this.cfg.disableAudio) return;
  var bgm = doc.getElementById('checkbox-bgm');
  var sound = doc.getElementById('checkbox-sound-effect');
  if (bgm.checked) bgm.click()
  if (sound.checked) sound.click()
}
testHelper.prototype.initClient = function (win) {
  var doc = win.document;
  var self = this;
  var socket = new FakeSocket(win);
  win.addEventListener('unload',function () {
    socket._doEmit('disconnect');
  });
  win.document.title = 'Client' + socket.id;
  io._handler(socket);

  this.disableAudio(doc);
}
testHelper.prototype.closeAllClient = function () {
  for (var uid in this.clients) {
    this.clients[uid].close();
  }
}
var testHelper = new testHelper();
global.window.newClient = function () {
  var win = window.open('./webxoss-client/?local=true');
  win.addEventListener('load',function () {
    testHelper.initClient(win)
  });
}
var game;
global.window.updateBattle = function () {
  if (roomManager.rooms.length === 0) {
    game = false;
    console.log('no in-play game found')
    return;
  }
  game = roomManager.rooms[0].game;
  console.log('update game infomation successfully')
}
global.window.upgrade = function () {
  var p = game.turnPlayer;
  var cards = p.lrigDeck.cards.concat(p.lrigTrashZone.cards);
  var lrigCards = [];
  cards.forEach(function(card) {
    if (card.type === 'LRIG') {
      lrigCards.push(card);
    }
  });
  game.moveCards(lrigCards, p.lrigZone);
}
global.window.addToHand = function () {
  var cardName = document.getElementById('card-name').value;
  if (game.turnPlayer.getCard(cardName))
    console.log('add ' + cardName + ' to hand');
  else 
    console.log('no matched card')
}
global.window.addToLifeCloth = function () {
  var cardName = document.getElementById('card-name').value;
  if (game.turnPlayer.putCardToLifeCloth(cardName))
    console.log('put ' + cardName + ' to life cloth');
  else 
    console.log('no matched card')
}

// copy from test.js

var io = {
  on: function (name,handler) {
    io._handler = handler;
  },
  use: function () {}
};;
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
  //  next();
  //  return;
  // }
  // if (ip in ipTable) {
  //  if (ipTable[ip] >= MAX_SOCKETS_PER_IP) {
  //    console.log('MAX_SOCKETS_PER_IP: %s',ip);
  //    next(new Error('MAX_SOCKETS_PER_IP'));
  //    return;
  //  } else {
  //    ipTable[ip]++;
  //  }
  // } else {
  //  ipTable[ip] = 1;
  // }
  // socket.on('disconnect',function () {
  //  console.log('disconnect: %s, count: %s',ip,getSocketCount());
  //  if (ip in ipTable) {
  //    if (ipTable[ip] <= 1) {
  //      delete ipTable[ip];
  //    } else {
  //      ipTable[ip]--;
  //    }
  //  }
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
  roomManager.createClient(socket,+query.clientId);

  // test
  // socket.on('force disconnect',function () {
  //  socket.disconnect();
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