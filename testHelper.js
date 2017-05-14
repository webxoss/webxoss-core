'use strict';

// browser only

// server
var io = {
  on: function (name,handler) {
    io._handler = handler;
  },
  use: function () {}
};
var cfg = {
  MAX_ROOMS: 100,
  MAX_CLIENTS: 500,
  MAX_ROOM_NAME_LENGTH: 15,
  MAX_NICKNAME_LENGTH: 10,
  MAX_PASSWORD_LENGTH: 15
};
var roomManager = new RoomManager(cfg);
var MAX_SOCKETS = 500;
function getSocketCount () {
  if (!io.sockets) return 0;
  return Object.keys(io.sockets.connected).length;
}
io.use(function (socket,next) {
  if (getSocketCount() >= MAX_SOCKETS) {
    next(new Error('MAX_SOCKETS'));
    return;
  }
  next();
});
io.on('connect',function (socket) {
  return roomManager.createClient(socket);
});

// client
var noBGM = true;
function disableAudio(doc) {
  // disable BGM
  if (!noBGM) {
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
function initClient(win) {
  var doc = win.document;
  var socket = new FakeSocket(win);
  win.addEventListener('unload', function() {
    socket._doEmit('disconnect');
  });
  win.document.title = 'Client' + socket.id;
  io._handler(socket);

  disableAudio(doc);
  log(win.document.title + ' added.');
}

// prepare and start game
function startBattle() {
  if (sockets.length) {
    sockets.forEach(function(target) {
      target._win.close();
    });
    location.reload();
    return;
  }
  var relativePath = './webxoss-client/?local=true';
  var link = document.createElement('a');
  link.href = relativePath;
  var absolutePath = link.href;
  var win = window.open(absolutePath);
  win.addEventListener('load', function() {
    var win2 = window.open(absolutePath);
    win2.addEventListener('load', function() {
      initClient(win2);
      skipDiscards();
      oben();
    });
    initClient(win);
  });
}
function oben() {
  if (sockets.length !== 2) {
    log('two client needed.');
    return;
  }
  var createRoomMsg = {
    'roomName': 'test',
    'nickname': 'host',
    'password': '',
    'mayusRoom': true,
  };
  sockets[0]._doEmit('createRoom', createRoomMsg);
  log('Client<1> create room.');

  var joinRoomMsg = {
    'roomName': 'test',
    'nickname': 'guest',
    'password': '',
  };
  sockets[1]._doEmit('joinRoom', joinRoomMsg);
  log('Client<2> join room.');

  sockets[1]._doEmit('ready', getDeckPids('host'));
  log('Client<2> is ready.');
  sockets[0]._doEmit('startGame', getDeckPids('guest'));
  log('oben!');

  handleBattle();
}

var game; // in-play game
function handleBattle() {
  if (roomManager.rooms.length === 0) {
    log('no in-play game found.');
    return;
  }
  game = roomManager.rooms[0].game;
  enableButtons();
  log('Handle game successfully.');
  log('Now you can use helper function.');
}
function skipDiscards() {
  Player.prototype.redrawAsyn = function() {
    return new Callback.immediately();
  }
}
// helper function
function grow() {
  var p = game.turnPlayer;
  var cards = p.lrigDeck.cards.concat(p.lrigTrashZone.cards);
  var lrigCards = [];
  var maxLevel = 0;
  cards.forEach(function(card) {
    if (card.type === 'LRIG') {
      if (maxLevel < card.level) {
        lrigCards.push(card);
        maxLevel = card.level;
      } else {
        lrigCards.unshift(card);
      }
    }
  });
  lrigCards.pop().moveTo(p.lrigZone);
  game.moveCards(lrigCards, p.lrigZone, { bottom: true });
  log('grow lrig to max level.');
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
  for (var i = 0; i < game.cards.length; i++) {
    var card = game.cards[i];
    var info = CardInfo[card.cid];
    var matched = info.name === arg ||
      info.name_zh_CN === arg ||
      info.cid === arg ||
      info.wxid === arg;
    if (matched) {
      cid = card.cid;
      break;
    }
  }
  if (!cid) return null;
  var p = selectPlayer();
  var cards = concat(p.mainDeck.cards, p.trashZone.cards, p.enerZone.cards, p.lifeClothZone.cards);
  for (var j = 0; j < cards.length; j++) {
    var card = cards[j];
    if (card.cid === cid) {
      return card;
    }
  }
  return null;
}

var $ = document.getElementById.bind(document);

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
  if (input) {
    var matchedCard = matchCard(input);
    if (!matchedCard) {
      log('no matched card');
      return;
    }
    var p = selectPlayer();
    matchedCard.moveTo(p[zone]);
    log('add <' + matchedCard.name + '> to ' + zone + '.');
  } else {
    log('card\'s wxid / pid / cid needed.');
  }
}
function resetArts() {
  var p = selectPlayer();
  game.moveCards(p.lrigTrashZone.cards, p.lrigDeck);
  log('reset lrig deck.');
}
function ignoreLimiting() {
  var p = selectPlayer();
  // conflict with <虚无阎魔 乌莉丝>
  p.ignoreLimitingOfArtsAndSpell = true;
  log('ignore limiting of arts and spell');
}
// log
function log(text) {
  var logger = $('log');
  logger.textContent += text;
  logger.textContent += '\n';
}
// dom
function selectPlayer() {
  return $('target-player').value === 'opponent' ?
    game.turnPlayer.opponent :
    game.turnPlayer;
}

function getDeckPids(player) {
  var name = {
    'host': $('host-decks').value || '',
    'guest': $('guest-decks').value || '',
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

function updateDeckSelect() {
  deckNames = readDeckNames();
  var hostDeckSelect = $('host-decks');
  var guestDeckSelect = $('guest-decks');
  hostDeckSelect.innerHTML = '';
  guestDeckSelect.innerHTML = '';
  deckNames.forEach(function(name) {
    var deckName = document.createElement('option');
    deckName.setAttribute('value', name);
    deckName.textContent = name;
    hostDeckSelect.appendChild(deckName);
    guestDeckSelect.appendChild(deckName.cloneNode(true));
  });
}

function changeLanguage() {
  var lang = $('select-language').value;
  localStorage.setItem('language', lang);
  log('set language to ' + lang + '.');
  location.reload();
}
function handleDeckEditor() {
  var iFrame = $('deck-editor');

  //resizeIFrameToFitContent
  iFrame.width = iFrame.contentWindow.document.body.scrollWidth;
  iFrame.height = iFrame.contentWindow.document.body.scrollHeight;

  // disable deck-editor return
  iFrame.contentDocument
    .getElementById('link-back-to-webxoss').href = "#"

  // auto update deck names when change in deckEditor
  window.addEventListener('storage', function(e) {
    if (e.key === 'deck_filenames') {
      updateDeckSelect();
    }
  });
}
function enableButtons() {
  var buttons = document.getElementsByTagName('button');
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].id !== 'oben') {
      buttons[i].disabled = false;
    }
  }
}
function disableButtons() {
  var buttons = document.getElementsByTagName('button');
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].id !== 'oben') {
      buttons[i].disabled = true;
    }
  }
}

window.onload = function() {
  $('select-language').value = localStorage.getItem('language');
  updateDeckSelect();
  handleDeckEditor();
  disableButtons();
};

window.onunload = function() {
  sockets.forEach(function(socket) {
    socket._win.close();
  });
};
