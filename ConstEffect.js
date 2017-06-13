'use strict';

function ConstEffect (constEffectManager,cfg) {
	this.constEffectManager = constEffectManager;

	this.source          = cfg.source;
	this.createTimming   = cfg.createTimming;
	this.destroyTimmings = concat(cfg.destroyTimming || []);
	// this.triggerTimmings = concat(cfg.triggerTimming || []);
	this.cross           = cfg.cross;
	this.condition       = cfg.condition;
	this.action          = cfg.action;
	this.fixed           = !!cfg.fixed; // 表示只进行一次计算,此后不发生变化
	this.computed        = false;
	this.continuous      = !!cfg.continuous; // 表示不会因失去能力而无效,如<黑幻虫 蝎>
	this.reregister      = false; // 针对卢浮宫的重注册机制,可改变注册时间(在效果队列中的序号)

	this.masksSet = [];
	this.masksAdd = [];
	this.masksEffectFilters = [];

	if (!this.createTimming) {
		this.create();
	} else {
		this.createTimming.addFunction(this.create.bind(this),cfg.once);
	}
}

// 创建并添加常时效果
ConstEffect.prototype.create = function () {
	this.constEffectManager.addConstEffect(this);
	this.computed = false;
	this.destroyTimmings.forEach(function (timming) {
		timming.addConstEffectDestroy(this);
	},this);
	// this.triggerTimmings.forEach(function (timming) {
	// 	timming.addConstEffect(this);
	// },this);

	// this.trigger();
};

// 销毁并移除常时效果
ConstEffect.prototype.destroy = function () {
	this.clear();
	this.destroyTimmings.forEach(function (timming) {
		timming.removeConstEffectDestroy(this);
	},this);
	// this.triggerTimmings.forEach(function (timming) {
	// 	timming.removeConstEffect(this);
	// },this);
	this.constEffectManager.removeConstEffect(this);
};

// 触发(清除并重新记录数据,但不计算)
// 计算仅在ConstEffectManager.compute()处执行.
// ConstEffect.prototype.trigger = function () {
// 	this.clear();
// };

ConstEffect.prototype.compute = function () {
	if (this.fixed && this.computed) return;
	this.clear();
	if (this.cross && !this.source.crossed) return;
	if (this.wisdom && (this.source.player.getWisdom() !== this.wisdom)) return;
	if (!this.condition || this.condition.call(this.source)) {
		var control = {
			reregister: false
		};
		this.action.call(this.source,this.set.bind(this),this.add.bind(this),control);
		this.reregister = control.reregister;
	}
	this.computed = true;
};

// 清除数据
ConstEffect.prototype.clear = function () {
	this.masksSet.length = 0;
	this.masksAdd.length = 0;
	this.masksEffectFilters.length = 0;
	// [this.tableSet,this.tableAdd].forEach(function (table) {
	// 	for (var hash in table) {
	// 		var mask = table[hash];
	// 		delete table[hash];
	// 		this.constEffectManager.compute(mask.target,mask.prop);
	// 	}
	// },this);
};

// 设置(target 的 prop 属性的值改变为value)
ConstEffect.prototype.set = function (target,prop,value,arg) {
	this._setAdd(this.masksSet,target,prop,value,arg);
};

// 增加(target 的 prop 属性的值增加value, value 可为负数)
ConstEffect.prototype.add = function (target,prop,value,arg) {
	// <幻兽神 狮王> & <幻兽 苍龙>
	if (!arg || !arg.asCost) { // <幻兽 骆驼>
		if (prop === 'power') {
			if (this.source.player.powerChangeBanned) return;
			if (target.powerAddProtected && (this.source.player !== target.player)) return;
		}
	}

	// <VIER=维克斯>
	var flag = this.source.player._VierVX &&
	           (prop === 'power') &&
	           (value > 0) &&
	           // (this.source.type === 'SIGNI') &&
	           (target.type === 'SIGNI') &&
	           (target.player === this.source.player);
	if (flag) {
		value = -value;
	}
	// PR-360
	if ((prop === 'power') && target.powerDecreaseProtected) {
		if ((this.source.player !== target.player) && (value < 0)) {
			return;
		}
	}
	// <暴力飞溅>
	var count = this.source.player._ViolenceSplashCount;
	flag = (count > 0) &&
	       (prop === 'power') &&
	       (value < 0) &&
	       (this.source.type === 'SIGNI') &&
	       (target.type === 'SIGNI') &&
	       (target.player !== this.source.player);
	if (flag) {
		value *= Math.pow(2,count);
	}
	// <DREI=恶英娘>
	count = this.source.player._DreiDioDaughter;
	flag = (count > 0) &&
	       (prop === 'power') &&
	       (value < 0) &&
	       (target.type === 'SIGNI') &&
	       (target.player !== this.source.player);
	if (flag) {
		value *= Math.pow(2,count);
	}

	if (prop === 'effectFilters') {
		this._setAdd(this.masksEffectFilters,target,prop,value,arg)
	} else if (isObj(value) && (value.constructor === Effect)) {
		this._setAdd(this.masksSet,target,prop,value,arg);
	} else {
		this._setAdd(this.masksAdd,target,prop,value,arg);
	}
};

ConstEffect.prototype._setAdd = function (masks,target,prop,value,arg) {
	if (!arg) arg = {};
	var mask = new Mask(this.source,target,prop,value,!!arg.forced);
	if (!mask.checkFilter(this.source)) return;
	this.constEffectManager.setBase(target,prop);
	masks.push(mask);
};

ConstEffect.prototype.checkFilter = function (mask) {
	if (this.fixed && this.computed) return true;
	return mask.checkFilter(this.source);
};


global.ConstEffect = ConstEffect;