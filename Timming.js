'use strict';

// Timming 拼写错误...
// 应该是 Timing ...
// 嘛,改起来挺麻烦,不改了喵

function Timming (game) {
	this.game = game;
	// this.subTimmings = [];
	// this.conditions = [];
	this.funcs = [];
	this.onceFlags = [];
	this.effects = [];
	this.constEffects = [];
	this.constEffectsDestroy = [];
}

// Timming.prototype.if = function (condition) {
// 	var timming = new Timming();
// 	this.subTimmings.push(timming);
// 	this.conditions.push(condition);
// 	return timming;
// };

Timming.prototype.addFunction = function (func,once) {
	this.funcs.push(func);
	this.onceFlags.push(!!once);
};

Timming.prototype.addConstEffect = function (constEffect) {
	this.constEffects.push(constEffect);
};

Timming.prototype.removeConstEffect = function (constEffect) {
	removeFromArr(constEffect,this.constEffects);
};

Timming.prototype.addConstEffectDestroy = function (constEffect) {
	this.constEffectsDestroy.push(constEffect);
};

Timming.prototype.removeConstEffectDestroy = function (constEffect) {
	removeFromArr(constEffect,this.constEffectsDestroy);
};

Timming.prototype.trigger = function (event,dontHandleFrameEnd) {
	for (var i = 0; i < this.funcs.length; i++) {
		var func = this.funcs[i];
		var once = this.onceFlags[i];
		func();
		if (once) {
			this.funcs.splice(i,1);
			this.onceFlags.splice(i,1);
			i--;
		}
	}
	// this.funcs.forEach(function (func) {
	// 	func();
	// },this);
	this.constEffectsDestroy.slice().forEach(function (constEffect) {
		constEffect.destroy();
	},this);
	// this.constEffects.forEach(function (constEffect) {
	// 	constEffect.trigger();
	// },this);
	// 注:
	//   关于创建/销毁常时效果和触发触发效果的顺序:
	//   某时点触发时,会创建/销毁常时效果,但此时不计算,
	//   效果触发之后,才计算常时效果.
	//   这与WIXOSS中"場から移動したことによって発動する常時能力は、
	//   移動する直前の状態を参照して発動の有無を確認します."的规则相符.
	this.effects.forEach(function (effect) {
		this.game.pushTriggeringEffect(effect,event);
	},this);
	// this.subTimmings.forEach(function (timming,idx) {
	// 	if (this.conditions[idx](event)) {
	// 		timming.trigger(event);
	// 	}
	// },this);
	if (!dontHandleFrameEnd) {
		this.game.handleFrameEnd();
	}
};


global.Timming = Timming;