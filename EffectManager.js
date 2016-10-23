'use strict';

function EffectManager (game) {
	this.game = game;
	this.player = null;
	this.playerTriggeredEffects = [];
	this.opponentTriggeredEffects = [];
	this.triggeredEffects = []; // 1回合1次的效果

	this.currentEffect = null;
}

// 根据 this.player 返回相应的满足发动条件的 effects .
EffectManager.prototype.getPlayerEffects = function () {
	var effects = (this.player === this.game.turnPlayer)? this.playerTriggeredEffects : this.opponentTriggeredEffects;
	effects = effects.filter(function (effect) {
		return effect.checkCondition();
	},this);
	return effects;
};

EffectManager.prototype.clearPlayerEffects = function () {
	var effects = (this.player === this.game.turnPlayer)? this.playerTriggeredEffects : this.opponentTriggeredEffects;
	this.game.pushEffectSource(null);
	effects.forEach(function (effect) {
		effect.end();
	},this);
	this.game.popEffectSource();
	effects.length = 0;
};

EffectManager.prototype.removePlayerEffect = function (effect) {
	var effects = (this.player === this.game.turnPlayer)? this.playerTriggeredEffects : this.opponentTriggeredEffects;
	removeFromArr(effect,effects);
	// 迸发结束
	var flag = effect.isBurst && effects.every(function (eff) {
		return !eff.isBurst || (eff.source !== effect.source);
	},this);
	if (!flag) return;
	this.game.pushEffectSource(null);
	effect.end();
	this.game.popEffectSource();
};

EffectManager.prototype.addTriggeredEffect = function (effect) {
	if (effect.source.player === this.game.turnPlayer) {
		this.playerTriggeredEffects.push(effect);
	} else {
		this.opponentTriggeredEffects.push(effect);
	}
};

EffectManager.prototype.removeTriggeredEffectBySource = function (source) {
	[this.playerTriggeredEffects,this.opponentTriggeredEffects].forEach(function (effects) {
		for (var i = 0; i < effects.length; i++) {
			var effect = effects[i];
			if (effect.source === source) {
				effects.splice(i,1);
				i--;
			}
		}
	})
};

EffectManager.prototype.handleEffectsAsyn = function () {
	// 过滤不满足条件的效果
	// this.playerTriggeredEffects = this.playerTriggeredEffects.filter(function (effect) {
	// 	return (!effect.condition || effect.condition.call(effect.source,effect.event));
	// },this);
	// this.opponentTriggeredEffects = this.opponentTriggeredEffects.filter(function (effect) {
	// 	return (!effect.condition || effect.condition.call(effect.source,effect.event));
	// },this);

	// 回合玩家具有优先权
	// if (!this.player) {
	// 	this.player = this.game.turnPlayer;
	// }
	this.player = this.game.turnPlayer;

	var effects = this.getPlayerEffects();
	// 若优先玩家无触发效果,移交优先权
	if (!effects.length) {
		this.clearPlayerEffects();
		this.player = this.player.opponent;
		effects = this.getPlayerEffects();
	}
	// 若双方均无触发效果,结束处理
	if (!effects.length) {
		// this.player = null;
		this.clearPlayerEffects();
		return Callback.immediately();
	}
	// 处理优先玩家的触发效果
	var allOptional = effects.every(function (effect) {
		return effect.isOptional();
	},this);
	var needConfirm = true;
	return Callback.immediately().callback(this,function () {
		if (effects.length === 1) return effects[0];
		needConfirm = false;
		if (allOptional) {
			return this.player.selectOptionalAsyn('EFFECTS',effects);
		}
		return this.player.selectAsyn('EFFECTS',effects);
	}).callback(this,function (effect) {
		if (!effect) {
			this.clearPlayerEffects();
			return Callback.immediately();
		}
		// removeFromArr(effect,effects);
		return this.game.blockAsyn(effect.source,this,function () {
			return effect.handleAsyn(needConfirm).callback(this,function () {
				this.removePlayerEffect(effect);
			});
		});
	});
};


global.EffectManager = EffectManager;