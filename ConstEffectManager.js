'use strict';

function ConstEffectManager (game) {
	this.game = game;

	this.constEffects = [];

	this.tableBase = {};
}

ConstEffectManager.prototype.addConstEffect = function (constEffect) {
	this.constEffects.unshift(constEffect);
};

ConstEffectManager.prototype.removeConstEffect = function (constEffect) {
	removeFromArr(constEffect,this.constEffects);
};

ConstEffectManager.prototype.setBase = function (target,prop) {
	var hash = target.gid + prop;
	if (hash in this.tableBase) return;
	var value = target[prop];
	if (value === undefined) value = 0;
	// if (isArr(value)) {
	// 	value = [];
	// }
	if (isObj(value) && (value.constructor === Timming)) {
		value = null;
	}
	this.tableBase[hash] = new Mask(null,target,prop,value);
};

ConstEffectManager.prototype.compute = function () {
	// console.log('ConstEffectManager.compute();');

	// <DREI=漆料>
	var signis = concat(this.game.turnPlayer.signis,this.game.turnPlayer.opponent.signis);
	var powers = signis.map(function (signi) {
		return signi.power;
	},this);

	// 预计算
	// 针对卢浮宫,加入重注册机制,重注册的效果在效果队列中移至队头
	var sorted = [];
	this.constEffects.forEach(function (constEffect) {
		constEffect.compute();
		if (constEffect.reregister) {
			constEffect.reregister = false;
			sorted.unshift(constEffect);
		} else {
			sorted.push(constEffect);
		}
	},this);
	this.constEffects = sorted;

	// 恢复原始数值 (并记录 abilityLost)
	var oldAbilityLostMap = {};
	for (var hash in this.tableBase) {
		var mask = this.tableBase[hash];
		if (mask.prop === 'abilityLost') {
			oldAbilityLostMap[mask.target.gid] = mask.target.abilityLost;
		}
		mask.set(true);
	}
	this.game.cards.forEach(function (card) {
		card.registeredEffects.length = 0;
	},this);
	// this.tableBase = {};

	// 设置 effectFilters (具有最高优先级)
	var cardsEffectFilters = [];
	this.constEffects.forEach(function (constEffect) {
		constEffect.masksEffectFilters.forEach(function (mask) {
			mask.add();
			cardsEffectFilters.push(mask.target);
		},this);
	},this);

	// 获得"失去能力"的卡.
	var cardsAbilityLost = [];
	for (var i = 0; i < this.constEffects.length; i++) {
		var constEffect = this.constEffects[i];
		var source = constEffect.source;
		if (inArr(source,cardsAbilityLost)) continue;
		constEffect.masksSet.forEach(function (mask) {
			if (mask.prop !== 'abilityLost') return;
			if (!constEffect.checkFilter(mask)) return;
			cardsAbilityLost.push(mask.target);
		});
	};

	// 清除 effectFilters
	cardsEffectFilters.forEach(function (card) {
		card.effectFilters.length = 0;
	},this);

	// 销毁一次性的,以"失去能力"的卡为对象的 mask.
	// TODO...

	// 过滤 source 为"失去能力"的卡 的效果
	var constEffects = this.constEffects.filter(function (constEffect) {
		if (constEffect.continuous) return true; // "失去能力"仍有效的,如<黑幻虫 蝎>
		if (constEffect.fixed && constEffect.computed) return true;
		return !inArr(constEffect.source,cardsAbilityLost);
	},this);

	// 设置 effectFilters
	constEffects.forEach(function (constEffect) {
		constEffect.masksEffectFilters.forEach(function (mask) {
			if (!constEffect.checkFilter(mask)) return;
			mask.add();
		},this);
	},this);

	constEffects.reverse();

	// 设置变化值
	var hashes = [];
	constEffects.forEach(function (constEffect) {
		constEffect.masksSet.forEach(function (mask) {
			// var hash = mask.target.gid + mask.prop;
			// if (inArr(hash,hashes)) return; // 相当于后来的覆盖先前的
			if (!constEffect.checkFilter(mask)) return;
			// hashes.push(hash);
			mask.set();
		},this);
	},this);

	// 设置增加值
	constEffects.forEach(function (constEffect) {
		constEffect.masksAdd.forEach(function (mask) {
			if (!constEffect.checkFilter(mask)) return;
			mask.add();
		},this);
	},this);

	// 处理一些非负属性
	for (var hash in this.tableBase) {
		var mask = this.tableBase[hash];
		var prop = mask.prop;
		var target = mask.target;
		var nonNegativeProps = [
			'costColorless',
			'costWhite',
			'costBlack',
			'costRed',
			'costBlue',
			'costGreen',
			'limit',
			'level'
		];
		if (inArr(prop,nonNegativeProps)) {
			if (target[prop] < 0) {
				target[prop] = 0;
			}
		}
	}

	// 移除已触发,但效果源"失去能力"的效果
	cardsAbilityLost.forEach(function (card) {
		if (!oldAbilityLostMap[card.gid]) {
			// 从"不失去能力"变为"失去能力"
			this.game.triggeringEffects.forEach(function (effect) {
				if (effect.source === card) {
					effect.disabled = true;
				}
			});
			this.game.effectManager.removeTriggeredEffectBySource(card);
		}
	},this);

	signis.forEach(function (signi,i) {
		var newPower = signi.power
		if (newPower < 0) signi.power = 0;
		if (signi.power !== powers[i]) {
			var event = {
				card: signi,
				oldPower: powers[i],
				newPower: newPower,
				power: signi.power,
			};
			signi.onPowerChange.trigger(event,true);
		}
		// <七草>的处理
		if (signi.cid === 1183) {
			signi.onPowerUpdate.trigger(null,true);
		}
	},this);

	// 向 UI 输出卡片状态(LRIG 和 SIGNI 的力量,冻结,枪兵等)
	// this.game.informPower();
	this.game.outputCardStates();
};

// ConstEffectManager.prototype.computeTimming = function (hash,timming) {
// 	timming.effects.length = 0;
// 	this.constEffects.forEach(function (constEffect) {
// 		if (hash in constEffect.tableAdd) {
// 			var cfg = constEffect.tableAdd[hash].value;
// 			var effect = new Effect(this.game.effectManager,cfg);
// 			timming.effects.push(effect);
// 		}
// 	},this);
// };

ConstEffectManager.prototype.getOriginalValue = function (target,prop) {
	var hash = target.gid + prop;
	if (hash in this.tableBase) {
		return this.tableBase[hash].value;
	} else {
		return target[prop];
	}
};


global.ConstEffectManager = ConstEffectManager;