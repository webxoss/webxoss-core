'use strict';

// browser only

var $ = document.getElementById.bind(document);

function TestHelper() {
  this.noBGM = true;
}
TestHelper.prototype.disableAudio = function(doc) {
  // disable BGM
  if (!this.noBGM) {
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
};
TestHelper.prototype.initClient = function(win) {
  var doc = win.document;
  var socket = new FakeSocket(win);
  win.addEventListener('unload', function() {
    socket._doEmit('disconnect');
  });
  win.document.title = 'Client' + socket.id;
  io._handler(socket);

  this.disableAudio(doc);
  log(win.document.title + ' added.');
};

var helper = new TestHelper();

// prepare and start game
function startBattle() {
  if (sockets.length) {
    sockets.forEach(function(target) {
      target._win.close();
    });
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
    log('two client needed');
    return;
  }
  var createRoomMsg = {
    'roomName': 'test',
    'nickname': 'host',
    'password': '',
    'mayusRoom': true,
  }
  sockets[0]._doEmit('createRoom', createRoomMsg);
  log('Client<1> create room.');

  var joinRoomMsg = {
    'roomName': 'test',
    'nickname': 'ghost',
    'password': '',
  }
  sockets[1]._doEmit('joinRoom', joinRoomMsg);
  log('Client<2> join room.');

  sockets[1]._doEmit('ready', getDeckPids('host'));
  log('Client<2> is ready.');
  sockets[0]._doEmit('startGame', getDeckPids('ghost'));
  log('oben!');

  updateBattle();
}

var game; // in-play game
function updateBattle() {
  if (roomManager.rooms.length === 0) {
    log('no in-play game found.');
    return;
  }
  game = roomManager.rooms[0].game;
  log('Handle game successfully.');
  log('Now you can use helper function.');
}

// helper function
function grow() {
  var p = game.turnPlayer;
  var cards = p.lrigDeck.cards.concat(p.lrigTrashZone.cards);
  var lrigCards = [];
  cards.forEach(function(card) {
    if (card.type === 'LRIG') {
      lrigCards.push(card);
    }
  });
  game.moveCards(lrigCards, p.lrigZone);
  log('grow lrig to level max.');
}
function draw(num) {
  if (!num) {
    num = 5;
  }
  var p = game.turnPlayer;
  p.draw(num);
  log('draw ' + num + ' cards.');
}
function charge(num) {
  if (!num) {
    num = 5;
  }
  var p = game.turnPlayer;
  p.enerCharge(num);
  log('ener charge ' + num + '.');
}

function matchCard(arg) {
  if (arg) {
    arg = arg.toUpperCase();
  } else {
    return;
  }
  var cid = 0;
  game.cards.forEach(function(card) {
    var info = CardInfo[card.cid];
    var matched = info.pid === arg ||
      info.cid === arg ||
      info.wxid === arg;
    if (matched) {
      cid = card.cid;
      return;
    }
  });
  if (!cid) return null;
  var player = game.turnPlayer;
  var cards = concat(player.mainDeck.cards,
    player.trashZone.cards,
    player.enerZone.cards,
    player.lifeClothZone.cards);

  cards.forEach(function(card) {
    if (card.cid === cid) {
      return card;
    }
  });
  return null;
}

var zones = [
  'handZone',
  'enerZone',
  'trashZone',
  'lifeClothZone',
];
function addTo(zone) {
  if (zones.indexOf(zone) === -1) {
    log('no such zone: ' + zone);
    return;
  }
  var input = $('card-name').value;
  if (input && matchCard(input)) {
    var matchedCard = matchCard(input);
    if (!matchedCard) {
      log('no matched card');
      return;
    }
    matchedCard.moveTo(game.turnPlayer[zone]);
    log('add <' + matchedCard.name + '> to ' + zone + '.');
  }
}

function resetLrigDeck() {
  game.moveCards(game.turnPlayer.lrigTrashZone.cards, game.turnPlayer.lrigDeck);
  log('reset lrig deck.');
}
// log
function log(text) {
  var logger = $('log');
  logger.innerHTML += text;
  logger.innerHTML += '\n';
}
// dom
function getDeckPids(player) {
  var name = {
    'host': $('host-decks').value || '',
    'ghost': $('host-decks').value || '',
  }[player];
  if (!name) {
    log('error in deck select');
  }
  return JSON.parse(localStorage.getItem('deck_file_' + name));
}
var deckNames = [];
function readDeckNames() {
  return JSON.parse(localStorage.getItem('deck_filenames')) || [];
}
function initDeckSelect() {
  deckNames = readDeckNames();
  var hostDeckSelect = $('host-decks');
  var ghostDeckSelect = $('ghost-decks');
  hostDeckSelect.innerHTML = '';
  ghostDeckSelect.innerHTML = '';
  deckNames.forEach(function(name) {
    var deckName = document.createElement('option');
    deckName.setAttribute('value', name);
    deckName.innerHTML = name;
    hostDeckSelect.appendChild(deckName);
    ghostDeckSelect.appendChild(deckName.cloneNode(true));
  });
}
function changeLanguage() {
  var lang = $('select-language').value;
  localStorage.setItem('language', lang);
  log('set language to ' + lang + '.');
  location.reload();
}

window.onload = function() {
  $('select-language').value = localStorage.getItem('language');
  initDeckSelect();
};
