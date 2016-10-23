'use strict';

var player,opponent;

function setup () {
	player = game.hostPlayer;
	opponent = game.guestPlayer;
	
	player.shuffle();
	opponent.shuffle();

	player.setupLrigAsyn().callback(function () {
		return opponent.setupLrigAsyn();
	}).callback(function () {
		return game.decideFirstPlayerAsyn();
	}).callback(function () {
		player.setupHands();
		opponent.setupHands();
		return player.redrawAsyn();
	}).callback(function () {
		return opponent.redrawAsyn();
	}).callback(function () {
		player.setupLifeCloth();
		opponent.setupLifeCloth();
		player.open();
		opponent.open();
		upPhase();
	});

	game.sendMsgQueue();
}

function upPhase () {
	player.up();
	drawPhase();
}
function drawPhase () {
	player.draw(2);
	enerPhase();
}
function enerPhase () {
	player.chargeAsyn().callback(growPhase);
	player.endEnerPhaseAsyn().callback(growPhase);
}
function growPhase () {
	player.growAsyn().callback(mainPhase);
	player.endGrowPhaseAsyn().callback(mainPhase);
}
function mainPhase () {
	function loop () {
		player.summonSigniAsyn().callback(loop);
		player.trashSigniAsyn().callback(loop);
		player.useSpellAsyn().callback(loop);
		player.useMainPhaseArtsAsyn().callback(loop);
		player.useActionEffectAsyn().callback(loop);
		player.endMainPhaseAsyn().callback(attackPhase);
	}
	loop();
}
function attackPhase () {
	artsStep();
}
function artsStep () {
	function playerLoop () {
		player.useAttackPhaseArtsAsyn().callback(playerLoop);
		player.endArtsStepAsyn().callback(opponentLoop);
	}
	function opponentLoop () {
		opponent.useAttackPhaseArtsAsyn().callback(opponentLoop);
		opponent.endArtsStepAsyn().callback(signiAttackStep);
	}
	playerLoop();
}
function signiAttackStep () {
	function loop () {
		player.signiAttackAsyn().callback(loop);
		player.endSigniAttackStepAsyn().callback(lrigAttackStep);
	}
	loop();
}
function lrigAttackStep () {
	function loop () {
		player.lrigAttackAsyn().callback(loop);
		player.endLrigAttackStepAsyn().callback(endPhase);
	}
	loop();
}
function endPhase () {
	var n = player.hands.length - 7;
	if (n > 0) {
		player.discardAsyn(n).callback(wixoss);
	} else {
		wixoss();
	}
}
function wixoss () {
	var tmp = player;
	player = opponent;
	opponent = tmp;
	upPhase();
}


