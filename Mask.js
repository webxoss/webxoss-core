'use strict';

function Mask (source,target,prop,value,forced) {
	this.source = source;
	this.target = target;
	this.prop = prop;
	this.value = value;
	this.forced = forced;

	if ((prop === 'onBurst') && this.value) {
		this.value.isBurst = true;
	}
}

Mask.prototype.set = function (reset) {
	var target = this.target;
	var item = target[this.prop];
	if (item === undefined) {
		debugger;
		console.warn('Mask.set(): target.pid:%s,this.prop:%s,this.value:%s',target.pid,this.prop,this.value);
	} else if (isObj(item) && (item.constructor === Timming)) {
		// item.effects.length = 0;
		if (reset) {
			item.effects.length = 0;
			return;
		}
		var timming = item;
		var effect = this.value;
		var source = effect.source;
		// 不能获得新能力
		if (source.canNotGainAbility || source.player.canNotGainAbility) {
			return;
		}
		if (source.canNotGainAbilityBySelfPlayer) {
			if (this.source && (this.source.player === source.player)) {
				return;
			}
		}
		effect.disabled = false;
		timming.effects.push(effect);
		effect.source.registeredEffects.push(effect);
		return;
	} else if (isArr(item)) {
		target[this.prop] = this.value.slice();
	} else if (this.prop === 'abilityLost') {
		target.abilityLost = this.value;
		if (!target.abilityLost) return;
		Card.abilityProps.forEach(function (prop) {
			target[prop] = false;
		},this);
		target.registeredEffects.forEach(function (effect) {
			effect.disabled = true;
		},this);
	} else {
		if (!reset && target.player && inArr(this.prop,Card.abilityProps)) {
			// 不能获得新能力
			if (target.canNotGainAbility && target.player.canNotGainAbility) {
				return;
			}
			if (target.canNotGainAbilityBySelfPlayer) {
				if (this.source && (this.source === target.player)) {
					return;
				}
			}
		}
		target[this.prop] = this.value;
	}
};

Mask.prototype.add = function (reset) {
	var item = this.target[this.prop];
	if (isArr(item)) {
		var arr = item;
		arr.push(this.value);
		return;
	}
	if (isObj(item) && (item.constructor === Timming)) {
		return;
	}
	this.target[this.prop] += this.value;
};

Mask.prototype.checkFilter = function (source) {
	if (this.forced) return true;
	var target = this.target;
	if (!target.isEffectFiltered) return true;
	return !target.isEffectFiltered(source);
};


global.Mask = Mask;