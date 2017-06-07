'use strict';

/* 
	Effect 对象注册在 Timming 上,
	触发时以自己为原型创建一个拷贝,
	在拷贝上附加 proto,event,triggerZone 等属性.
	这个拷贝注册到 EffectManager 上.
*/

function Effect (effectManager,cfg) {
	this.effectManager = effectManager;

	this.source           = cfg.source;
	this.description      = cfg.description;
	this.optional         = cfg.optional;
	this.once             = !!cfg.once;  // 1回合只能发动一次.
	this.isBurst          = cfg.isBurst; // 用于"迸发效果发动时"时点.
	                                     // 以及"发动和解决要在相同场所"的规则例外
	this.triggerCondition = cfg.triggerCondition;
	this.costWhite        = cfg.costWhite;
	this.costBlack        = cfg.costBlack;
	this.costRed          = cfg.costRed;
	this.costBlue         = cfg.costBlue;
	this.costGreen        = cfg.costGreen;
	this.costColorless    = cfg.costColorless;
	this.costDown         = cfg.costDown;
	this.costExceed       = cfg.costExceed;
	this.costCoin         = cfg.costCoin;
	this.costCondition    = cfg.costCondition;
	this.costAsyn         = cfg.costAsyn;
	this.costChange       = cfg.costChange;
	this.condition        = cfg.condition;
	this.actionAsyn       = cfg.actionAsyn;
	this.wisdom           = cfg.wisdom || 0;

	this.disabled = false; // 失去能力时设置为 true .
}

Effect.prototype.trigger = function (event) {
	if (this.disabled) return;
	if (this.once && inArr(this,this.effectManager.triggeredEffects)) {
		return;
	}
	if (!this.triggerCondition || this.triggerCondition.call(this.source,event)) {
		this.source.activate();
		var effect = Object.create(this);
		effect.proto = this;
		effect.event = event;
		effect.triggerZone = this.source.zone;
		this.effectManager.addTriggeredEffect(effect);
	}
};

Effect.prototype.triggerAndHandleAsyn = function (event) {
	if (this.disabled) return Callback.immediately();
	if (!this.triggerCondition || this.triggerCondition.call(this.source,event)) {
		// this.source.activate();
		var effect = Object.create(this);
		effect.event = event;
		effect.triggerZone = this.source.zone;
		if (!this.checkCondition()) return Callback.immediately();
		return effect.handleAsyn(false);
	}
	return Callback.immediately();
};

Effect.prototype.checkCondition = function () {
	// "结束这个回合",如<终结之洞>
	var game = this.effectManager.game;
	if (game.getData(game,'endThisTurn')) return false;
	// "1回合1次"
	if (this.once && inArr(this.proto,this.effectManager.triggeredEffects)) {
		return false;
	}
	// wisdom
	if (this.wisdom && !(this.source.player.getWisdom() > this.wisdom)) {
		return false;
	}
	// 隐藏规则之"发动和解决的场所必须一致"
	if (!this.isBurst && this.triggerZone) { // 排除迸发
		if (this.triggerZone.faceup) { // 公开领域
			if (this.triggerZone !== this.source.zone) { // 发动和解决场所不一致
				return false;
			}
		}
	}
	if (this.condition && !this.condition.call(this.source,this.event)) {
		return false;
	}
	return this.source.player.enoughCost(this);
};

Effect.prototype.handleAsyn = function (needConfirm) {
	var player = this.source.player;
	if (!this.isOptional()) {
		return Callback.immediately().callback(this,function () {
			if (this.once) {
				this.effectManager.triggeredEffects.push(this.proto);
			}
			return this.actionAsyn.call(this.source,this.event,{});
		});
	}
	if (player.enoughCost(this)) {
		return Callback.immediately().callback(this,function () {
			if (!needConfirm) return this.source;
			return player.selectOptionalAsyn('LAUNCH',[this.source]);
		}).callback(this,function (card) {
			if (!card) return;
			if (this.once) {
				this.effectManager.triggeredEffects.push(this.proto);
			}
			var costArg;
			return player.payCostAsyn(this).callback(this,function (arg) {
				costArg = arg;
				this.source.activate();
				if (this.isBurst) {
					this.source.player.onBurstTriggered.trigger();
				}
				this.effectManager.currentEffect = this;
				return this.actionAsyn.call(this.source,this.event,costArg);
			}).callback(this,function () {
				if (this.isBurst && this.source.player.burstTwice) {
					// <Burst Rush> 再处理一次.
					this.source.activate();
					this.source.player.onBurstTriggered.trigger();
					return this.actionAsyn.call(this.source,this.event,costArg);
				}
			}).callback(this,function () {
				this.effectManager.currentEffect = null;
			});
		});
	}
	return Callback.immediately();
};

Effect.prototype.end = function () {
	if (!this.isBurst) return;
	var card = this.source;
	card.handleBurstEnd(this.event.crossLifeCloth);
};

Effect.prototype.isOptional = function () {
	return this.optional || this.source.player.needCost(this);
};


global.Effect = Effect;