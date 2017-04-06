'use strict'

// browser only

function TestHelper() {
  this.deckNames = this.readDeckNames();
  this.hostDeck = '';
  this.ghostDeck = '';

  this.cfg = {
    disableAudio: true,
  }
}
TestHelper.prototype.disableAudio = function(doc) {
  // disable BGM
  if (!this.cfg.disableAudio) {
    return;
  }
  var bgm = doc.getElementById('checkbox-bgm');
  var sound = doc.getElementById('checkbox-sound-effect');
  if (bgm && bgm.checked) {
    bgm.click();
  }
  if (sound && sound.checked) {
    sound.click();
  }
}
TestHelper.prototype.initClient = function(win) {
  var doc = win.document;
  var self = this;
  var socket = new FakeSocket(win);
  win.addEventListener('unload', function() {
    socket._doEmit('disconnect');
  });
  win.document.title = 'Client' + socket.id;
  io._handler(socket);

  this.disableAudio(doc);
}
TestHelper.prototype.readDeckNames = function() {
  return JSON.parse(localStorage.getItem('deck_filenames')) || [];
}
TestHelper.prototype.getDeckPids = function(player) {
  var name;
  if (player === 'host') {
    name = this.hostDeck;
  } else {
    name = this.ghostDeck;
  }
  if (name === '') {
    name = this.deckNames[0]; // use WHITE_HOPE
  }
  return JSON.parse(localStorage.getItem('deck_file_' + name));
}

var helper = new TestHelper();

function startBattle() {
  if (sockets.length) {
    sockets.forEach(function(target) {
      target._win.close();
    })
    location.reload();
    return;
  }
  var win = window.open('../webxoss-client/?local=true');
  win.addEventListener('load', function() {
    var win2 = window.open('../webxoss-client/?local=true');
    win2.addEventListener('load', function() {
      helper.initClient(win2);
      oben();
    });
    helper.initClient(win);
  });
}
function oben() {
  if (sockets.length !== 2) {
    console.log('two client needed');
    return;
  };
  var createRoomMsg = {
    'roomName': 'test',
    'nickname': 'host',
    'password': '',
    'mayusRoom': true,
  }
  sockets[0]._doEmit('createRoom', createRoomMsg);
  var joinRoomMsg = {
    'roomName': 'test',
    'nickname': 'ghost',
    'password': '',
  }
  sockets[1]._doEmit('joinRoom', joinRoomMsg);

  sockets[1]._doEmit('ready', helper.getDeckPids('host'));
  sockets[0]._doEmit('startGame', helper.getDeckPids('ghost'));
  updateBattle();
}

var game; // in-play game
function updateBattle() {
  if (roomManager.rooms.length === 0) {
    console.log('no in-play game found');
    return;
  }
  game = roomManager.rooms[0].game;
  console.log('update game information successfully');
}
function upgrade() {
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
function addToHand() {
  var cardName = document.getElementById('card-name').value;
  if (game.turnPlayer.getCard(cardName))
    console.log('add ' + cardName + ' to hand');
  else
    console.log('no matched card');
}
function addToLifeCloth() {
  var cardName = document.getElementById('card-name').value;
  if (game.turnPlayer.putCardToLifeCloth(cardName))
    console.log('put ' + cardName + ' to life cloth');
  else
    console.log('no matched card');
}
function initDeckSelect() {
  var hostDecks = document.getElementById('host-decks');
  var ghostDecks = document.getElementById('ghost-decks');
  hostDecks.innerHTML = '';
  ghostDecks.innerHTML = '';
  helper.deckNames.forEach(function(name) {
    var deckname = document.createElement('option');
    deckname.setAttribute('value', name);
    deckname.innerHTML = name;
    hostDecks.appendChild(deckname);
    ghostDecks.appendChild(deckname.cloneNode(true));
  })
  helper.hostDeck = hostDecks.value;
  helper.ghostDeck = ghostDecks.value;
  hostDecks.onchange = function() {
    helper.hostDeck = this.value;
  }
  ghostDecks.onchange = function() {
    helper.ghostDeck = this.value;
  }
}
window.onload = function() {
  initDeckSelect();
}