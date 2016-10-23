console.log('------debug start------');

function reload (filePath) {
	var path = require('path');
	delete require.cache[path.resolve(filePath)];
	require(filePath);
}

reload('./CardInfo.js');
// reload('./Card.js');
// reload('./Mask.js');
// reload('./ConstEffect.js');
// reload('./ConstEffectManager.js');
// reload('./Player.js');
// reload('./Client.js');

// var test = require('./test.js');
// var roomManager = test.roomManager;
// console.log(JSON.stringify(roomManager.gameCountMap),null,'\t');
// console.log(roomManager.gameCountMap);
// var room = roomManager.roomMap['【周年祭】F组'];
// if (!room) {
// 	console.log('no room');
// 	return;
// }
// console.log('seed:'+room.game.seed);
// console.log('seed:'+room.guest.id);
// var fs = require('fs');
// fs.writeFile('host.txt',JSON.stringify(room.game.hostPlayer.messagePacks),function (err) {
// 	console.log(err? 'host error' : 'host succ');
// });
// fs.writeFile('guest2.txt',JSON.stringify(room.game.guestPlayer.messagePacks),function (err) {
// 	console.log(err? 'guest error' : 'guest succ');
// });

// roomManager.rooms.forEach(function (room) {
// 	console.log(room.name + !!room.game + !!room.live);
// },this);

console.log('------debug end------');