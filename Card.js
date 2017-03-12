'use strict';

function Card (game,player,zone,pid,side) {
	// 引用
	this.game   = game;
	this.player = player;
	this.owner  = player;
	this.zone   = zone;

	// 状态
	this.isFaceup = false;
	this.isUp     = true;

	// 注册
	this.game.register(this);
	this.game.cards.push(this);

	var cid = CardInfo[pid].cid;
	var info = CardInfo[cid];
	// 基本数据
	this.pid            = pid;
	this._info          = info;
	this.cid            = info.cid;
	this.name           = info.name;
	this.resona         = (info.cardType === 'RESONA');
	this.type           = this.resona? 'SIGNI' : info.cardType;
	this.color          = info.color.split('/')[0];
	this.otherColors    = info.color.split('/').slice(1);
	this.limitings      = info.limiting? info.limiting.split('/') : [];
	this.limit          = info.limit;
	this.level          = info.level;
	this.power          = info.power;
	this.classes        = info.classes;
	this.guardFlag      = info.guardFlag;
	this.costWhite      = info.costWhite;
	this.costBlack      = info.costBlack;
	this.costRed        = info.costRed;
	this.costBlue       = info.costBlue;
	this.costGreen      = info.costGreen;
	this.costColorless  = info.costColorless;
	this.costCoin       = info.costCoin;
	this.costAsyn       = info.costAsyn;
	this.costChange     = info.costChange;
	this.costChangeAsyn = info.costChangeAsyn;
	this.costChangeAfterChoose = info.costChangeAfterChoose;
	this.multiEner      = info.multiEner;
	this.burstIcon      = !!info.burstEffect;

	this.useCondition   = info.useCondition;
	this.growCondition  = info.growCondition;
	this.growActionAsyn = info.growActionAsyn;

	// 效果相关的数据
	this.getMinEffectCount = info.getMinEffectCount;
	this.getMaxEffectCount = info.getMaxEffectCount;
	// 魔法效果
	this.spellEffects   = this.cookEffect(info.spellEffect,'spell',1);
	// 技艺效果
	this.timmings       = info.timmings || [];
	this.artsEffects    = this.cookEffect(info.artsEffect,'arts',1);
	this.encore         = info.encore || null;
	this.chain          = info.chain || null;
	// 生命迸发效果
	this.burstEffects   = this.cookEffect(info.burstEffect,'burst');
	// 常时效果
	this.constEffects   = info.constEffects || [];
	// 出场效果
	this.startUpEffects = this.cookEffect(info.startUpEffects,'startup');
	// 起动效果
	this.actionEffects  = this.cookEffect(info.actionEffects,'action');
	// 是否白板
	this.withAbility    = !!(this.burstEffects.length ||
	                         this.constEffects.length ||
	                         this.startUpEffects.length ||
	                         this.actionEffects.length ||
	                         this.multiEner ||
	                         this.guardFlag);

	// 共鸣相关
	this.resonaPhases    = concat(info.resonaPhase || []);
	this.resonaCondition = info.resonaCondition;
	this.resonaAsyn      = null;

	// CROSS相关
	this.crossLeft  = info.crossLeft || null;
	this.crossRight = info.crossRight || null;
	this.crossIcon  = !!(info.crossLeft || info.crossRight);
	this.crossed    = null;

	// 双面
	if (side) {
		this.sideA = info.sideA? side : null;
		this.sideB = info.sideB? side : null;
	} else {
		this.sideA = info.sideA? new Card(game,player,zone,info.sideA,this) : null;
		this.sideB = info.sideB? new Card(game,player,zone,info.sideB,this) : null;
	}

	// Lostorage
	this.coin = info.coin || 0;
	this.bet = info.bet || 0;
	this.bettedCost = info.bettedCost || null;
	this.rise = info.rise;
	this.acce = !!info.acce;
	this.acceingCard = null;

	// 杂项
	this.effectFilters     = [];
	this.registeredEffects = [];
	this.charm             = null; // 魅饰卡
	this._data             = null; // 私有的数据储存,约定: 只能在 CardInfo.js 自身的代码里访问
	this.fieldData         = {};   // 离场即清空的数据
	this.fieldTurnData     = {};   // 离场或回合结束即清空的数据

	// 时点
	this.onMove            = new Timming(game);
	this.onEnterField      = new Timming(game);
	this.onLeaveField      = new Timming(game); // 常时效果中「离场时」的时点
	this.onLeaveField2     = new Timming(game); // 包括被 rise 等而成为卡垫的时点
	this.onBurst           = new Timming(game);
	this.onAttack          = new Timming(game);
	this.onStartUp         = new Timming(game);
	this.onPowerChange     = new Timming(game);
	this.onPowerUpdate     = new Timming(game);
	this.onBanish          = new Timming(game);
	this.onAffect          = new Timming(game);
	this.onUp              = new Timming(game);
	this.onDown            = new Timming(game);
	this.onBattle          = new Timming(game);
	this.onHeaven          = new Timming(game);
	this.onFreeze          = new Timming(game);
	this.onChangeSigniZone = new Timming(game);
	this.onRised           = new Timming(game);

	// 附加的属性
	this.canNotAttack                = false;
	this.lancer                      = false;
	this.doubleCrash                 = false;
	this.tripleCrash                 = false;
	this.frozen                      = false;
	this.forceSummonZone             = false;
	this.trashCharmInsteadOfBanish   = false;
	this.attachedCostColorless       = 0;     // <星占之巫女 忆·夜>
	this.assassin                    = false;
	this.canNotBeBanished            = false;
	this.abilityLost                 = false;
	this.canNotBeBanishedByEffect    = false;
	this.protectingShironakujis      = [];    // <幻水 蓝鲸>
	this.protectingMpps              = [];    // <コードハート　Ｍ・Ｐ・Ｐ>
	this.useBikouAsWhiteCost         = false; // <启示的天惠 安=FORTH>
	this.canNotBeTrashedBySelf       = false; // <罗星 星宿一>
	this.trashAsWhiteCost            = false; // <美しき弦奏　コントラ>
	this.summonConditions            = [];    // <罠砲　タイマーボム>
	this._OrichalciaNaturalStone     = false; // <罗石 金铜>
	this._KosakiPhantomBeast         = false; // <幻兽 小御先>
	this._MikamuneSmallSword         = false; // <小剑 三日月>
	this.resonaBanishToTrash         = false; // <绿叁游 水滑梯>
	this.discardSpellInsteadOfBanish = false; // <核心代号 Ｓ・Ｗ・Ｔ>
	this.attackCostColorless         = 0;     // <黑幻虫 水熊虫>
	this.canNotGainAbility           = false; // <迷宫代号 金阁>
	this.canNotGainAbilityBySelfPlayer = false; // <城堡代号 凡尔赛宫>
	this._SnoropNaturalPlantPrincess = false; // <罗植姬 雪花莲>
	this._CodeLabyrinthLouvre        = null;  // <卢浮宫>
	this.powerAddProtected           = false; // <幻兽 苍龙>
	this._GustaftCenterBallista      = false; // <弩中砲　グスタフト>
	this.colorLost                   = false; // <侍从 ∞>
	this.banishProtections           = [];
	this.upProtections               = [];
	// 注意hasAbility
}

Card.abilityProps = [
	'canNotAttack',
	'lancer',
	'doubleCrash',
	'tripleCrash',
	'assassin',
	'canNotBeBanished',
	'canNotBeBanishedByEffect'
];

Card.prototype.cookEffect = function (rawEffect,type,offset) {
	if (!offset) offset = 0;
	return concat(rawEffect || []).map(function (eff,idx) {
		var effect = Object.create(eff);
		effect.source = this;
		effect.description = [this.cid,type,idx+offset].join('-');
		return effect;
	},this);
};

Card.prototype.setupConstEffects = function () {
	this.constEffects.forEach(function (eff,idx) {
		var createTimming,destroyTimming,once;
		if (eff.duringGame) {
			createTimming = null;
			destroyTimming = null;
			once = false;
		} else if (eff.getCreateTimming) {
			createTimming = eff.getCreateTimming.call(this);
			destroyTimming = eff.getDestroyTimming.call(this);
			once = eff.once;
		} else {
			createTimming = this.onEnterField;
			destroyTimming = this.onLeaveField2;
			once = false;
		}
		var action = eff.action
		if (eff.auto) {
			action = function (set,add) {
				var effect = this.game.newEffect({
					source: this,
					description: this.cid+'-'+'const-'+idx,
					actionAsyn: eff.actionAsyn,
				});
				add(this,eff.auto,effect);
			};
		}
		this.game.addConstEffect({
			source: this,
			createTimming: createTimming,
			once: once,
			destroyTimming: destroyTimming,
			cross: !!eff.cross,
			fixed: !!eff.fixed,
			condition: eff.condition,
			action: action,
		},true);
	},this);
};

Card.prototype.setupStartUpEffects = function () {
	this.startUpEffects.forEach(function (eff) {
		if (this.type === 'SIGNI') {
			if (eff.cross) {
				eff.condition = function () {
					return this.crossed && inArr(this,this.player.signis);
				};
			} else {
				eff.condition = function () {
					return inArr(this,this.player.signis);
				};
			}
		}
		var effect = new Effect(this.game.effectManager,eff);
		this.game.addConstEffect({
			source: this,
			fixed: true,
			action: function (set,add) {
				add(this,'onStartUp',effect);
			}
		},true);
	},this);
};

Card.prototype.setupBurstEffects = function () {
	this.burstEffects.forEach(function (eff) {
		eff.optional = true;
		var effect = new Effect(this.game.effectManager,eff);
		this.game.addConstEffect({
			source: this,
			fixed: true,
			action: function (set,add) {
				add(this,'onBurst',effect);
			}
		},true);
	},this);
};

Card.prototype.setupEffects = function () {
	this.setupConstEffects();
	this.setupStartUpEffects();
	this.setupBurstEffects();
};

Card.prototype.canGrow = function (ignoreCost) {
	if (this.type !== 'LRIG') return false;
	if (this.player.canNotGrow) return false;
	if (this.cid === this.player.lrig.cid) return false;
	if (this.growCondition) {
		if (!this.growCondition()) {
			return false;
		}
	}
	if (!ignoreCost && !this.player.enoughCost(this.getGrowCostObj())) return false;
	// LRIG type
	if (this.classes.every(function (cls) {
		return !this.player.lrig.hasClass(cls) && (cls !== '?'); // <紡ぐ者>
	},this)) {
		return false;
	}
	return (this.level <= this.player.lrig.level+1);
};

Card.prototype.getGrowCostObj = function () {
	var obj = Object.create(this);
	obj.costWhite     -= this.player.reducedGrowCostWhite;
	obj.costBlack     -= this.player.reducedGrowCostBlack;
	obj.costRed       -= this.player.reducedGrowCostRed;
	obj.costBlue      -= this.player.reducedGrowCostBlue;
	obj.costGreen     -= this.player.reducedGrowCostGreen;
	obj.costColorless -= this.player.reducedGrowCostColorless;
	if (obj.costWhite     < 0) obj.costWhite     = 0;
	if (obj.costBlack     < 0) obj.costBlack     = 0;
	if (obj.costRed       < 0) obj.costRed       = 0;
	if (obj.costBlue      < 0) obj.costBlue      = 0;
	if (obj.costGreen     < 0) obj.costGreen     = 0;
	if (obj.costColorless < 0) obj.costColorless = 0;
	return obj;
};

Card.prototype.getChainedCostObj = function (obj) {
	if (!obj) {
		obj = Object.create(this);
	}
	if (!this.player.chain) return obj;
	obj.costWhite     -= this.player.chain.costWhite     || 0;
	obj.costBlack     -= this.player.chain.costBlack     || 0;
	obj.costRed       -= this.player.chain.costRed       || 0;
	obj.costBlue      -= this.player.chain.costBlue      || 0;
	obj.costGreen     -= this.player.chain.costGreen     || 0;
	obj.costColorless -= this.player.chain.costColorless || 0;
	if (obj.costWhite     < 0) obj.costWhite     = 0;
	if (obj.costBlack     < 0) obj.costBlack     = 0;
	if (obj.costRed       < 0) obj.costRed       = 0;
	if (obj.costBlue      < 0) obj.costBlue      = 0;
	if (obj.costGreen     < 0) obj.costGreen     = 0;
	if (obj.costColorless < 0) obj.costColorless = 0;
	return obj;
};

Card.prototype.canSummon = function () {
	return this.canSummonWith(this.player.signis);
};

Card.prototype.canSummonWith = function (signis) {
	// 类型
	if (this.type !== 'SIGNI') return false;
	// rise
	var riseTargets = []
	if (this.rise) {
		riseTargets = signis.filter(function (signi) {
			return this.rise(signi)
		},this)
		if (!riseTargets.length) return false;
	}
	// <绿罗植 世界树>
	if (this.player.canNotUseColorlessSigni) {
		if (this.hasColor('colorless')) {
			return false;
		}
	}
	// summonConditions
	var flag = this.summonConditions.some(function (condition) {
		return !condition.call(this);
	},this);
	if (flag) return false;
	// 限定
	if (!this.checkLimiting()) return false;
	// 等级限制
	if (this.level > this.player.lrig.level) return false;
	// SIGNI 数量限制
	var length = signis.length;
	if (this.rise) length--;
	if (length >= this.player.getSigniAmountLimit()) {
		return false;
	}
	// 界限限制
	var totalLevel = signis.reduce(function (total,signi) {
		return total + signi.level;
	},this.level);
	if (this.rise) {
		// rise 减去等级最高的目标即可
		totalLevel -= Math.max.apply(Math,riseTargets.map(function (signi) {
			return signi.level;
		}));
	}
	if (totalLevel > this.player.lrig.limit) return false;
	// 召唤区限制
	var zones = this.player.getSummonZones(signis,this.rise);
	if (!zones.length) return false;
	// 结束
	return true;
};

Card.prototype.getSummonSolution = function (filter,count) {
	var cards = this.player.signis.filter(function (card) {
		return filter(card) && card.canTrashAsCost();
	},this);
	// 选项不足
	if (cards.length < count) return null;
	// 必须全选
	if (this.player.signis.length === count) {
		if (!this.canSummonWith([])) return null;
		return function () {
			return Callback.immediately().callback(this,function () {
				var signis = this.player.signis.slice();
				this.game.trashCards(signis);
				return signis;
			});
		}.bind(this);
	}
	// 2或3选1
	if (count === 1) {
		// 遍历
		cards = cards.filter(function (card) {
			var signis = this.player.signis.filter(function (signi) {
				return (signi !== card);
			},this);
			return this.canSummonWith(signis);
		},this);
		if (!cards.length) return null;
		return function () {
			return this.player.selectAsyn('TRASH',cards).callback(this,function (card) {
				card.trash();
				return [card];
			});
		}.bind(this);
	}
	// 3选2
	if (count === 2) {
		// signis.length === 3;
		if (cards.length === 2) {
			var signis = this.player.signis.filter(function (signi) {
				return !inArr(signi,cards);
			},this);
			if (!this.canSummonWith(signis)) return null;
			return function () {
				return Callback.immediately().callback(this,function () {
					this.game.trashCards(cards);
					return cards;
				});
			}.bind(this);
		}
		if (cards.length === 3) {
			var cards_left = cards.filter(function (card) {
				return this.canSummonWith([card]);
			},this);
			if (!cards_left.length) return null;
			if (cards_left.length === 1) {
				cards = cards.filter(function (card) {
					return card !== cards_left[0];
				},this);
				return function () {
					return Callback.immediately().callback(this,function () {
						this.game.trashCards(cards);
						return cards;
					});
				}.bind(this);
			}
			if (cards_left.length === 2) {
				return function () {
					return this.player.selectAsyn('TRASH',cards).callback(this,function (c) {
						var cards_trash = [c];
						if (inArr(c,cards_left)) {
							cards = cards.filter(function (card) {
								return !inArr(card,cards_left);
							});
						} else {
							cards = cards_left;
						}
						return this.player.selectAsyn('TRASH',cards).callback(this,function (c) {
							cards_trash.push(c);
							this.game.trashCards(cards_trash);
							return cards_trash;
						});
					});
				}.bind(this);
			}
			if (cards_left.length === 3) {
				return function () {
					return this.player.selectSomeAsyn('TRASH',cards,2,2).callback(this,function (cards) {
						this.game.trashCards(cards);
						return cards;
					});
				}.bind(this);
			}
		}
	}
	return null;
};

Card.prototype.canAttack = function () {
	if (this.attackCostColorless) {
		var obj = {
			costColorless: this.attackCostColorless
		};
		if (!this.player.enoughCost(obj)) return false;
	}

	// <バインド・ウェポンズ>
	if (this.type === 'SIGNI') {
		var attackCount = this.fieldTurnData.attackCount || 0;
		if (attackCount >= this.player.signiAttackCountLimit) return false;
	} else {
		var lrigAttackCount = this.game.getData(this.player,'lrigAttackCount') || 0;
		if (lrigAttackCount >= this.player.lrigAttackCountLimit) return false;
	}

	// <白羅星　フルムーン>
	if (this.type === 'SIGNI') {
		var attackCount = this.game.getData(this.player,'signiAttackCount') || 0;
		if (attackCount >= this.player.signiTotalAttackCountLimit) return false;
	}

	return (this.type === 'SIGNI' || this.type === 'LRIG') &&
	       (this.isUp) &&
	       (!this.canNotAttack);
};

Card.prototype.canTrashAsCost = function () {
	if (this.canNotBeTrashedBySelf) return false;
	if (this.player.trashSigniBanned && inArr(this,this.player.signis)) return false;
	return true;
};

Card.prototype.canUse = function (timming,ignoreCost) {
	if (inArr(this.cid,this.player.bannedCards)) return false;
	if (!this.checkLimiting()) return false;
	if (this.useCondition && !this.useCondition()) return false;
	if (this.type === 'SPELL') {
		// <绿罗植 世界树>
		if (this.player.canNotUseColorlessSpell) {
			if (this.hasColor('colorless')) {
				return false;
			}
		}
		if (this.player.spellBanned) return false;
		if (ignoreCost) return true;
		return this.enoughCost();
	}
	if (this.type === 'ARTS') {
		if (this.player.artsBanned) return false;
		if (!inArr(timming,this.timmings)) return false;
		if (this.player.oneArtEachTurn && this.game.getData(this.player,'flagArtsUsed')) return false;

		// cost 判断
		if (ignoreCost) return true;
		var cost = this.getChainedCostObj()
		if (this.player.enoughCost(cost)) return true;
		// bet 相关
		if (this.bet && this.bettedCost) {
			if (this.bet > this.player.coin) return false; // 避免出现coin不够却可以选择使用技艺。《孤立无炎》
			cost = this.getChainedCostObj(this.bettedCost)
			if (this.player.enoughCost(cost)) return true;
		}
		return false;
	}
	return false;
};

Card.prototype.checkLimiting = function () {
	// this.limiting === this.player.lrig.lrigType
	if (!this.limitings.length) return true;
	if (this.player.ignoreLimitingOfArtsAndSpell) {
		if ((this.type === 'SPELL') || (this.type === 'ARTS')) {
			return true;
		}
	}
	if (this.player.ignoreLimitingOfLevel5Signi) {
		if ((this.type === 'SIGNI') && (this.level === 5)) {
			return true;
		}
	}
	return this.limitings.some(function (limiting) {
		return inArr(limiting,this.player.lrig.classes);
	},this);
};

Card.prototype.enoughCost = function () {
	return this.player.enoughCost(this);
};

Card.prototype.hasClass = function (cls) {
	return this.classes.some(function (thisClass) {
		return thisClass === cls;
	},this);
};

// 注意：不保证唯一性
Card.prototype.getColors = function (ignoreColorless) {
	var colors = this.otherColors.concat(this.color);
	if (this.colorLost) {
		colors = ['colorless'];
	}
	if (ignoreColorless) {
		removeFromArr('colorless',colors);
	}
	if (!this._SnoropNaturalPlantPrincess) return colors;
	if (!inArr(this,this.player.signis)) return colors;
	this.player.enerZone.cards.forEach(function (card) {
		card.otherColors.concat(card.color).forEach(function (color) {
			if (color === 'colorless') return;
			if (inArr(color,colors)) return;
			colors.push(color);
		},this);
	});
	return colors;
};

Card.prototype.hasColor = function (color) {
	if (color === 'colorless') {
		return !this.getColors(true).length;
	}
	return inArr(color,this.getColors(true));
};

Card.prototype.hasSameColorWith = function (card) {
	var colors = this.getColors(true);
	return card.getColors(true).some(function (color) {
		return inArr(color,colors);
	},this);
};

Card.prototype.hasBurst = function () {
	return this.burstIcon || this.onBurst.effects.length;
};

Card.prototype.isEffectFiltered = function (source) {
	if (!this.effectFilters.length) return false;
	if (!source) source = this.game.getEffectSource();
	if (!source) return false;
	return this.effectFilters.some(function (filter) {
		return !filter.call(this,source);
	},this);
};

Card.prototype.up = function () {
	if (this.isUp) return false;
	if (this.isEffectFiltered()) return false;
	this.isUp = true;
	this.triggerOnAffect();
	this.onUp.trigger({
		card: this
	});
	this.game.output({
		type: 'UP_CARD',
		content: {card: this}
	});
	return true;
};

Card.prototype.upAsyn = function () {
	if (this.isUp) return Callback.immediately(false);
	if (this.isEffectFiltered()) return Callback.immediately(false);
	var protections = this.upProtections.filter(function (protection) {
		return protection.condition.call(protection.source);
	},this);
	if (!this.upProtections.length) return Callback.immediately(this.up());
	return this.player.selectAsyn('CHOOSE_EFFECT',protections).callback(this,function (protection) {
		protection.source.activate();
		return protection.actionAsyn.call(protection.source,this);
	}).callback(this,function () {
		return true;
	});
};

Card.prototype.down = function () {
	if (!this.isUp) return false;
	if (this.isEffectFiltered()) return false;
	if (this.player.canNotBeDownedByOpponentEffect) {
		var source = this.game.getEffectSource()
		if (source && (source.player === this.player.opponent)) {
			return false;
		}
	}

	this.game.frameStart();
	this.isUp = false;
	if (this.hasClass('植物')) {
		var count = this.game.getData(this.player,'増武Count') || 0;
		this.game.setData(this.player,'増武Count',count+1);
	}
	this.triggerOnAffect();
	this.onDown.trigger({
		card: this
	});
	this.game.frameEnd();

	this.game.output({
		type: 'DOWN_CARD',
		content: {card: this}
	});
	return true;
};

Card.prototype.faceup = function () {
	if (this.isFaceup) return false;
	if (this.isEffectFiltered()) return false;
	this.isFaceup = true;
	this.triggerOnAffect();
	this.game.output({
		type: 'FACEUP_CARD',
		content: {
			card: this,
			pid: this.pid
		}
	});
};

Card.prototype.facedown = function () {
	if (!this.isFaceup) return false;
	if (this.isEffectFiltered()) return false;
	this.isFaceup = false;
	this.triggerOnAffect();
	this.game.output({
		type: 'FACEDOWN_CARD',
		content: {card: this}
	});
};

Card.prototype.moveTo = function (zone,arg) {
	// 共鸣
	if (this.resona) {
		if (!inArr(zone.name,['SigniZone','LrigTrashZone','LrigDeck','ExcludedZone'])) {
			zone = this.player.lrigDeck;
			arg = {}; // 忽略移动参数
		}
	}
	// <コードアンチ　カイヅカ>
	if (this.fieldData.excludeWhenLeaveField) {
		if (inArr(this,this.player.signis) && zone.name !== 'SigniZone') {
			zone = this.player.excludedZone;
		}
	}
	if (arg === undefined) arg = {};
	if (arg.up === undefined) arg.up = zone.up;
	if (arg.faceup === undefined) arg.faceup = zone.faceup;
	if (arg.bottom === undefined) arg.bottom = zone.bottom;

	var card = this;

	// 效果过滤 (不会受到XXX的效果影响)
	var source = this.game.getEffectSource();
	if (this.isEffectFiltered(source)) return false;
	// "不能抽卡,也不能将卡加入手牌"
	if (card.player.addCardToHandBanned) {
		if ((zone.name === 'HandZone') && (card.zone !== zone)) {
			return false;
		}
	}
	// "不能自己将这只 SIGNI 从场上放置到废弃区。"
	if (card.canNotBeTrashedBySelf && source && (source.player === card.player)) {
		if (inArr(card,card.player.signis) && (zone.name === 'TrashZone')) {
			return false;
		}
	}
	// "不能从场上返回手牌。"
	if (card.player.canNotBeBounced) {
		if (inArr(card,card.player.signis) && (zone.name === 'HandZone')) {
			return false;
		}
	}

	// 注: 交换 SIGNI 区请用 card.changeSigniZone(zone).
	//     以下代码作废.
	// 从 SIGNI 区移动到 SIGNI 区的情况比较特殊,单独处理.
	// 全部卡片一起移动,不触发任何时点.
	// 注意: 这里没考虑转移控制权的情况,目前WX还没有这种效果.
	// if ((card.zone.name === 'SigniZone') && (zone.name === 'SigniZone')) {
		// var cards = card.zone.cards.slice();
		// card.zone.cards.length = 0;
		// this.game.packOutputs(function () {
		// 	cards.forEach(function (card) {
		// 		zone.cards.push(card);
		// 		card.zone = zone;
		// 		var msgObj = {
		// 			type: 'MOVE_CARD',
		// 			content: {
		// 				card: card,
		// 				pid: card.isFaceup? card.pid : 0,
		// 				zone: zone,
		// 				up: card.isUp,
		// 				faceup: card.isFaceup,
		// 				bottom: true
		// 			}
		// 		};
		// 		card.player.output(msgObj);
		// 		card.player.opponent.output(msgObj);
		// 	},this);
		// },this);
		// return;
	// }

	// 更新 player 的 hands,signis,lrig .
	// 同时设置 onEnterField 等时点的事件对象.
	var moveEvent = {
		card: card,
		isSigni: inArr(card,card.player.signis),
		isCharm: arg.isCharm || false,
		isCrossed: !!card.crossed,
		riseTarget: null,
		isUp: arg.up,
		oldZone: card.zone,
		newZone: zone,
		resonaArg: arg.resonaArg || null,
		isExceedCost: !!arg.isExceedCost,
		source: source
	};
	var enterFieldEvent = null;
	var leaveFieldEvent = null;
	var lrigChangeEvent = null;
	var charm = null;

	/* 处理离开区域逻辑 */
	if (card.zone.name === 'HandZone') {
		// 离开手牌
		removeFromArr(card,card.player.hands);
	} else if (card.zone.name === 'SigniZone') {
		// 离开 SigniZone
		if (inArr(card,card.player.signis)) {
			// 是 SIGNI
			// 以下代码 rise 里复用了，虽然说 DRY 原则，但这里也不太好抽离，养肥了再抽吧（
			leaveFieldEvent = moveEvent;
			card.frozen = false;
			card.fieldData = {};
			card.fieldTurnData = {};
			charm = card.charm;
			card.charm = null;
			removeFromArr(card,card.player.signis);
		} else {
			// 是 SIGNI 下方的卡,比如魅饰卡
			// 处理魅饰卡
			var signi = card.zone.getActualCards()[0];
			if (signi && card === signi.charm) {
				moveEvent.isCharm = true;
				signi.charm = null;
			}
		}
	}

	/* 处理进入区域逻辑 */
	if (zone.name === 'HandZone') {
		// 进入手牌
		zone.player.hands.push(card);
	} else if (zone.name === 'SigniZone') {
		if (card.zone.name !== 'SigniZone' || zone.player !== card.player) {
			// 进入 SIGNI 区
			if (zone.getActualCards().length) {
				// rise
				if (card.rise) {
					// 被 rise 的卡“离场”
					signi = zone.getActualCards()[0];
					removeFromArr(signi,signi.player.signis);
					signi.frozen = false;
					signi.fieldData = {};
					signi.fieldTurnData = {};
					charm = signi.charm;
					signi.charm = null;
					signi.onLeaveField2.trigger({});
					// 出场
					arg.bottom = false;
					enterFieldEvent = moveEvent;
					enterFieldEvent.riseTarget = signi;
					card.player.signis.push(card);
				} else {
					// 放置到 SIGNI 下面的卡
					// （目前不用处理）
				}
			} else {
				// 出场
				enterFieldEvent = moveEvent;
				zone.player.signis.push(card);
			}
		}
	} else if ((zone.name === 'LrigZone') && !arg.bottom) {
		// 进入 LrigZone
		lrigChangeEvent = {
			oldLrig: zone.player.lrig,
			newLrig: card
		};
		zone.player.lrig = card;
	}

	// <混沌之键主 乌姆尔=FYRA>
	if (this.game.getData(card,'zeroActionCostInTrash')) {
		this.game.setData(card,'zeroActionCostInTrash',false);
	}

	// 移动卡片
	removeFromArr(card,card.zone.cards);
	card.isUp = arg.up;
	card.isFaceup = arg.faceup;
	if (arg.bottom) {
		zone.cards.push(card);
	} else {
		zone.cards.unshift(card);
	}
	card.zone = zone;

	// CROSS
	if (enterFieldEvent || leaveFieldEvent) {
		card.player.setCrossPair();
	}

	// 向客户端输出信息.
	// 注意,客户端并不能获知所有信息,而且玩家双方获得的信息也不一定是一样的.
	// 须隐藏或修改的信息有: pid 和 faceup.
	// 对 pid 及 faceup 的说明:
	// pid: 对于游戏逻辑中正面朝上的卡,双方都可见其pid. (也就是都知道是什么卡)
	//      而对于游戏逻辑中背面朝上的卡,
	//          对方玩家: 不能获知其pid,
	//          己方玩家: 如果卡片区域是 checkable 的,可见其pid. 否则不能.
	// faceup: 游戏逻辑中卡片的面向和客户端中的卡片面向是不同的. 不同点仅在于手牌.
	//         手牌中非公开的卡,在游戏逻辑中是"背面朝上"的,即:
	//             对方不能查看;己方能查看(这是因为手牌区是 checkable 的).
	//         但在客户端中,手牌里的卡即使逻辑上是背面朝上的,仍显示为正面朝上.
	card.player.output({
		type: 'MOVE_CARD',
		content: {
			card: card,
			pid: (card.isFaceup || zone.checkable)? card.pid : 0,
			zone: zone,
			up: arg.up,
			faceup: zone.inhand? true : arg.faceup,
			bottom: arg.bottom,
			isSide: arg.isSide
		}
	});
	card.player.opponent.output({
		type: 'MOVE_CARD',
		content: {
			card: card,
			pid: card.isFaceup? card.pid : 0,
			zone: zone,
			up: arg.up,
			faceup: arg.faceup,
			bottom: arg.bottom,
			isSide: arg.isSide
		}
	});

	// "混淆"手牌
	// 说明:
	//     手牌区是"玩家可随时洗切"的区域.这意味着:
	//     卡片加入某玩家手牌后,须要对对方玩家"混淆"其手牌.
	//     "混淆"的方法描述详见 <关于各种id的说明.txt> .
	if (card.zone.inhand) {
		card.game.allocateSid(card.player.opponent,card.player.hands);
	}

	// 触发各种时点
	card.game.frameStart();
	card.onMove.trigger(moveEvent);
	card.player.onCardMove.trigger(moveEvent);
	if ((moveEvent.oldZone.name === 'HandZone') && (moveEvent.newZone.name === 'TrashZone')) {
		this.game.setData(card.player,'hasDiscardedCard',true);
		card.player.onDiscard.trigger(moveEvent);
	}
	card.triggerOnAffect();
	if (enterFieldEvent) {
		// card.player.onSignisChange.trigger();
		card.player.onSummonSigni.trigger(moveEvent);
		card.onEnterField.trigger(enterFieldEvent);
		if (!(arg.dontTriggerStartUp || card.player.signiStartUpBanned)) {
			card.onStartUp.trigger(enterFieldEvent);
		}
		// rise
		if (enterFieldEvent.riseTarget) {
			enterFieldEvent.riseTarget.onRised.trigger(enterFieldEvent);
		}
	} else if (leaveFieldEvent) {
		// card.player.onSignisChange.trigger();
		card.onLeaveField.trigger(leaveFieldEvent);
		card.onLeaveField2.trigger(leaveFieldEvent);
		card.player.onSigniLeaveField.trigger(leaveFieldEvent);
		// SIGNI 离场时,下面的卡送入废弃区，
		// 此处理在块结束时执行。
		// http://www.takaratomy.co.jp/products/wixoss/rule/rule_rulechange/151211/index.html
		leaveFieldEvent.oldZone.cards.forEach(function (card) {
			if (card === charm) {
				card.game.trashingCharms.push(card);
			} else {
				card.game.trashingCards.push(card);
			}
		},this);
	} else if (lrigChangeEvent) {
		// card.player.onLrigChange.trigger(lrigChangeEvent);
		if (card.coin) {
			card.player.gainCoins(card.coin)
		}
		var oldLrig = lrigChangeEvent.oldLrig;
		if (oldLrig) oldLrig.onLeaveField2.trigger();
		card.onEnterField.trigger(enterFieldEvent);
		if (!(arg.dontTriggerStartUp || card.player.lrigStartUpBanned)) {
			card.onStartUp.trigger(enterFieldEvent);
		}
	}
	// 双面共鸣
	var side = card.sideA || card.sideB;
	if (side && !arg.isSide) {
		var arg = {
			isSide: true,
		};
		if (enterFieldEvent) {
			side.moveTo(card.player.excludedZone,arg);
		} else if (zone === card.player.lrigTrashZone) {
			side.moveTo(zone,arg);
		} else if (zone === card.player.lrigDeck) {
			side.moveTo(zone,arg);
		}
	}
	card.game.frameEnd();

	return true;
};

Card.prototype.changeSigniZone = function (zone) {
	if (!inArr(this,this.player.signis)) {
		console.warn('card.changeSigniZone: card is not a SIGNI!');
		return;
	}

	// 效果过滤 (不会受到XXX的效果影响)
	if (this.isEffectFiltered()) return false;
	var card = zone.cards[0];
	if (card && card.isEffectFiltered()) return false;

	// 交换 zone.cards
	var oldZone = this.zone;
	var tmp = oldZone.cards;
	oldZone.cards = zone.cards;
	zone.cards = tmp;
	// 设置 card.zone
	oldZone.cards.forEach(function (card) {
		card.zone = oldZone;
	},this);
	zone.cards.forEach(function (card) {
		card.zone = zone;
	},this);
	// CROSS
	this.player.setCrossPair();
	this.onChangeSigniZone.trigger();
	if (card) card.onChangeSigniZone.trigger();
	// 向客户端输出信息
	function createMsgObj (card) {
		return {
			type: 'MOVE_CARD',
			content: {
				card: card,
				pid: card.isFaceup? card.pid : 0,
				zone: card.zone,
				up: card.isUp,
				faceup: card.isFaceup,
				bottom: true
			}
		}
	}
	this.game.packOutputs(function () {
		var cards = concat(oldZone.cards,zone.cards);
		cards.forEach(function (card) {
			var msgObj = createMsgObj(card);
			this.player.output(msgObj);
			this.player.opponent.output(msgObj);
		},this);
	},this);
	this.game.handleFrameEnd();
	return true;
};

Card.prototype.getCrossPairCids = function () {
	var pairs = [];
	if (this.crossLeft) pairs = pairs.concat(this.crossLeft);
	if (this.crossRight) pairs = pairs.concat(this.crossRight);
	return pairs;
};

Card.prototype.trash = function (arg) {
	var zone = inArr(this.type,['LRIG','ARTS'])?
		this.player.lrigTrashZone:
		this.player.trashZone;
	return this.moveTo(zone,arg);
};

Card.prototype.exclude = function () {
	return this.moveTo(this.player.excludedZone);
};

Card.prototype.trashAsyn = function () {
	return this.game.trashCardsAsyn([this]);
};

Card.prototype.bounceAsyn = function () {
	return this.game.bounceCardsAsyn([this]);
};

Card.prototype.attackAsyn = function () {
	var card = this;
	var player = card.player;
	var opponent = player.opponent;
	var crashArg = {
		source: this,
		lancer: false,
		doubleCrash: false,
		attack: true,
	};
	var cost = null;
	if (this.attackCostColorless) {
		cost = {
			costColorless: this.attackCostColorless
		};
		if (!this.player.enoughCost(cost)) {
			throw 'Not enough attack cost!'
		}
	}
	// <バインド・ウェポンズ>, <白羅星　フルムーン>
	if (this.type === 'SIGNI') {
		var attackCount = this.fieldTurnData.attackCount || 0;
		this.fieldTurnData.attackCount = ++attackCount;
		var signiAttackCount = this.game.getData(this.player,'signiAttackCount') || 0;
		this.game.setData(this.player,'signiAttackCount',++signiAttackCount);
	} else {
		var lrigAttackCount = this.game.getData(this.player,'lrigAttackCount') || 0;
		this.game.setData(this.player,'lrigAttackCount',++lrigAttackCount);
	}

	return Callback.immediately().callback(this,function () {
		if (!cost) return;
		return this.player.payCostAsyn(cost);
	}).callback(this,function () {
		// "下次攻击无效化"
		var prevented = !!this.game.getData(this.game,'preventNextAttack');
		if (prevented) {
			this.game.setData(this.game,'preventNextAttack',false);
		}
		// <暴风警报>
		player.attackCount++;
		if (player._stormWarning && (player.attackCount <= 2)) {
			prevented = true;
		}
		// onAttack 的事件对象
		var event = {
			prevented: prevented,
			preventedByGuard: false,
			card: card,
			banishAttackingSigniSource: null,
			wontBeDamaged: false,
			_1877: false, // PR-305
		};
		if (card.type === 'SIGNI') {
			// 触发"攻击时"时点
			// 触发"onHeaven"时点
			return this.game.blockAsyn(this,function () {
				this.game.frameStart();
				card.down();
				card.onAttack.trigger(event);
				card.player.onAttack.trigger(event);
				var pairs = card.crossed;
				var heaven = pairs && pairs.every(function (pair) {
					return !pair.isUp;
				},this);
				if (heaven) {
					pairs.forEach(function (pair) {
						pair.onHeaven.trigger(event);
					},this);
					card.player.onHeaven.trigger(event);
				}
				this.game.frameEnd();
			}).callback(this,function () {
				// 强制结束回合
				if (this.game.phase.checkForcedEndTurn()) return;
				// 此时,攻击的卡可能已不在场上
				if (!inArr(card,player.signis)) return;
				// 被无效化
				if (event.prevented) return;
				// 攻击时发动的起动效果 (<被侵犯的神判 安=Fifth>)
				return opponent.useOnAttackActionEffectAsyn(event).callback(this,function () {
					// 攻击的卡不在场上或攻击被无效化,结束处理.
					if (!inArr(card,player.signis)) return;
					if (event.prevented) return;
					// 若对面有 SIGNI 且攻击方无暗杀,则进行战斗;
					// 否则造成伤害.
					var opposingSigni = card.getOpposingSigni();
					if (opposingSigni && !card.assassin) {
						// 战斗
						// 触发"进行战斗"时点
						var onBattleEvent = {
							card: card,
							opposingSigni: opposingSigni
						};
						return this.game.blockAsyn(this,function () {
							this.game.frameStart();
							card.onBattle.trigger(onBattleEvent);
							opposingSigni.onBattle.trigger(onBattleEvent);
							this.game.frameEnd();
						}).callback(this,function () {
							// 此时,攻击的卡可能已不在场上
							if (!inArr(card,player.signis)) return;
							// 受攻击的卡也可能已不在场上
							// 注意: 根据事务所QA,此时不击溃对方的生命护甲(即使有 lancer ). (<大剣　レヴァテイン>)
							if (!inArr(opposingSigni,opposingSigni.player.signis)) return;
							// 结算战斗伤害
							if (card.power >= opposingSigni.power) {
								// 保存此时的 lancer 属性作为参考,
								// 因为驱逐被攻击的 SIGNI 后,攻击侧的 lancer 可能改变.
								var lancer = card.lancer;
								return this.game.blockAsyn(this,function () {
									return opposingSigni.banishAsyn({attackingSigni: card}).callback(this,function (succ) {
										if (succ && lancer) {
											crashArg.lancer = lancer;
											return opponent.crashAsyn(1,crashArg);
										}
									});
								});
							}
						}).callback(this,function () {
							if (onBattleEvent._1877 && inArr(opposingSigni,opposingSigni.player.signis)) {
								return this.game.blockAsyn(onBattleEvent._1877,this,function () {
									opposingSigni.moveTo(opposingSigni.player.mainDeck,{bottom: true});
								});
							}
						});
					} else {
						// 伤害
						if (event.wontBeDamaged || opponent.wontBeDamaged) return;
						crashArg.damage = true;
						if (opponent.lifeClothZone.cards.length) {
							var count = 1;
							if (this.doubleCrash) count = 2;
							if (this.tripleCrash) count = 3;
							crashArg.doubleCrash = this.doubleCrash;
							return opponent.crashAsyn(count,crashArg);
						} else {
							if (card.game.win(player)) return Callback.never();
							return;
						}
					}
				});
			}).callback(this,function () {
				// "这场战斗结束之后,就回老家结婚" (划掉)
				// "战斗结束后,将进行攻击的 SIGNI 驱逐"
				if (event.banishAttackingSigniSource) {
					return this.game.blockAsyn(event.banishAttackingSigniSource,card,card.banishAsyn);
				}
			}).callback(this,function () {
				if (event.prevented) {
					return this.game.blockAsyn(this,function () {
						player.onAttackPrevented.trigger(event);
					});
				}
			});
		} else {
			return this.game.blockAsyn(this,function () {
				this.game.frameStart();
				card.down();
				card.onAttack.trigger(event);
				card.player.onAttack.trigger(event);
				this.game.frameEnd();
			}).callback(this,function () {
				// 被无效化
				if (event.prevented) return;
				// TODO: 处理onAttackActionEffect
				// 防御
				return this.game.blockAsyn(this,function () {
					return opponent.guardAsyn();
				}).callback(this,function (succ) {
					if (succ) {
						event.prevented = true;
						event.preventedByGuard = true;
						return;
					};
					if (event.wontBeDamaged || opponent.wontBeDamaged) return;
					if (player.opponent.wontBeDamagedByOpponentLrig) return;
					crashArg.damage = true;
					if (opponent.lifeClothZone.cards.length) {
						var count = 1;
						if (this.doubleCrash) count = 2;
						if (this.tripleCrash) count = 3;
						crashArg.doubleCrash = this.doubleCrash;
						return opponent.crashAsyn(count,crashArg);
					} else {
						if (card.game.win(player)) return Callback.never();
						return;
					}
				});
			}).callback(this,function () {
				if (event.prevented) {
					return this.game.blockAsyn(this,function () {
						player.onAttackPrevented.trigger(event);
					});
				}
			});
		}
	});
};

Card.prototype.handleBurstEnd = function (crossLifeCloth) {
	if (this.zone !== this.player.checkZone) return;
	if (crossLifeCloth) {
		// 改变规则 <幻水 希拉>
		this.trash();
		var card = this.player.mainDeck.cards[0];
		if (!card) return;
		card.moveTo(this.player.lifeClothZone);
	} else {
		this.moveTo(this.player.enerZone);
	}
};

Card.prototype.banishAsyn = function (arg) {
	return this.game.banishCardsAsyn([this],false,arg);
};

// Card.prototype.banishAsyn = function () {
// 	return Callback.immediately().callback(this,function () {
// 		if (this.isEffectFiltered()) return false;
// 		if (this.canNotBeBanished) return false;
// 		if (this.trashCharmInsteadOfBanish && this.charm) {
// 			return this.player.selectOptionalAsyn('TRASH_CHARM',[this]).callback(this,function (c) {
// 				if (!c) {
// 					return this.doBanish();
// 				}
// 				return this.charm.trash();
// 			});
// 		}
// 		return this.doBanish();
// 	});
// };

// Card.prototype.beBanished = function () {
// 	var succ;
// 	this.game.frameStart();
// 	if (this.player.banishTrash) {
// 		succ = this.moveTo(this.player.trashZone);
// 	} else {
// 		succ = this.moveTo(this.player.enerZone);
// 	}
// 	if (succ) {
// 		var event = {
// 			card: this
// 		};
// 		this.onBanish.trigger(event);
// 		this.player.onSigniBanished.trigger(event);
// 	}
// 	this.game.frameEnd();
// 	return succ;
// };

// Card.prototype.doBanish = function () {
// 	if (this.isEffectFiltered()) return false;
// 	if (this.canNotBeBanished) return false;
// 	if (this.canNotBeBanishedByEffect) {
// 		var source = this.game.getEffectSource();
// 		if (source && (source.player === this.player.opponent)) {
// 			return false;
// 		}
// 	}
// 	var succ;
// 	this.game.frameStart();
// 	if (this.player.banishTrash) {
// 		succ = this.moveTo(this.player.trashZone);
// 	} else {
// 		succ = this.moveTo(this.player.enerZone);
// 	}
// 	if (succ) {
// 		var event = {
// 			card: this
// 		};
// 		this.onBanish.trigger(event);
// 		this.player.onSigniBanished.trigger(event);
// 	}
// 	this.game.frameEnd();
// 	return succ;
// };

Card.prototype.summonAsyn = function (optional,dontTriggerStartUp,down) {
	if (!this.canSummon()) return Callback.immediately();
	return Callback.immediately().callback(this,function () {
		if (optional) {
			return this.player.selectOptionalAsyn('SUMMON_SIGNI',[this]);
		} else {
			// return this.player.selectAsyn('SUMMON_SIGNI',[this]);
			return this;
		}
	}).callback(this,function (card) {
		if (!card) return;
		return this.player.selectSummonZoneAsyn(false,this.rise).callback(this,function (zone) {
			card.moveTo(zone,{
				dontTriggerStartUp: dontTriggerStartUp,
				up: !down
			});
			this.game.handleFrameEnd(); // 增加一个空帧,以进行两次常计算
		});
	});
};

Card.prototype.summonOptionalAsyn = function (dontTriggerStartUp) {
	return this.summonAsyn(true,dontTriggerStartUp);
};

Card.prototype.growAsyn = function (ignoreCost) {
	return Callback.immediately().callback(this,function () {
		if (!this.growActionAsyn) return;
		return this.growActionAsyn();
	}).callback(this,function () {
		if (ignoreCost || this.player.ignoreGrowCost) return;
		return this.player.payCostAsyn(this.getGrowCostObj());
	}).callback(this,function () {
		var colorChanged = (this.color !== this.player.lrig.color);
		this.moveTo(this.player.lrigZone,{
			up: this.player.lrig.isUp
		});
		if (colorChanged) this.game.outputColor();
	});
};

Card.prototype.freeze = function () {
	if (this.isEffectFiltered()) return false;
	var event = {
		card: this,
		forzen: this.frozen
	};
	this.frozen = true;
	this.game.frameStart();
	this.onFreeze.trigger(event);
	this.player.onSigniFreezed.trigger(event);
	this.triggerOnAffect();
	this.game.frameEnd();
	return true;
};

Card.prototype.banishSigniAsyn = function (power,min,max,above) {
	if (!isNum(min)) min = 0;
	if (!isNum(max)) max = 1;
	// <罗石 金铜>
	if (this._OrichalciaNaturalStone && (min === 0) && (max === 1) && (power === 7000) && !above) {
		power = 15000;
	}
	var cards = this.player.opponent.signis;
	if (isNum(power)) {
		cards = cards.filter(function (card) {
			return above? (card.power >= power) : (card.power <= power);
		},this);
	}
	if (!cards.length) return Callback.immediately(false);
	return this.player.selectSomeTargetsAsyn(cards,min,max).callback(this,function (cards) {
		return this.game.banishCardsAsyn(cards);
	});
};

Card.prototype.decreasePowerAsyn = function (power,filter) {
	return this.player.selectOpponentSigniAsyn(filter).callback(this,function (card) {
		if (!card) return null;
		this.game.tillTurnEndAdd(this,card,'power',-power);
		return card;
	});
};

Card.prototype.trashWhenTurnEnd = function () {
	this.fieldData.trashWhenTurnEnd = true;
};

// 获得所谓的类别,在wx中,类别组成为"大类:小类"
// 其中,某些卡可以拥有多种小类,而"精元"没有小类.
// 对于"精武:武装:武器"类别,返回["武装","武器"]
// 对于"精元"类别,返回["精元"]
Card.prototype.getClasses = function () {
	if (this.classes.length === 1) return this.classes.slice(0);
	return this.classes.slice(1);
};

Card.prototype.activate = function () {
	if (!this.zone.faceup) return;
	this.game.output({
		type: 'ACTIVATE',
		content: {
			card: this
		}
	});
};

Card.prototype.beSelectedAsTarget = function () {
	this.game.output({
		type: 'CARD_SELECTED',
		content : {
			card: this
		}
	});
};

Card.prototype.getTotalEnerCost = function (original) {
	return this.player.getTotalEnerCost(this,original);
};

Card.prototype.getOpposingSigni = function () {
	if (!inArr(this,this.player.signis)) return null;
	var idx = 2 - this.player.signiZones.indexOf(this.zone);
	return this.player.opponent.signiZones[idx].getActualCards()[0] || null;
};

Card.prototype.charmTo = function (signi) {
	if (signi.charm) return;
	signi.charm = this;
	this.game.frameStart();
	this.moveTo(signi.zone,{
		faceup: false,
		up: signi.isUp
	});
	this.game.frameEnd();
};

Card.prototype.getAccedCards = function () {
	if (!inArr(this,this.player.signis)) return [];
	return this.zone.cards.filter(function (card) {
		return card.acceingCard === this;
	},this);
};

Card.prototype.isAcced = function () {
	return this.getAccedCards().length;
};

Card.prototype.canBeAcced = function () {
	return !this.isAcced();
};

Card.prototype.acceTo = function (signi) {
	if (!signi.canBeAcced()) return;
	this.acceingCard = signi;
	this.game.frameStart();
	this.moveTo(signi.zone,{
		faceup: true,
		up: signi.isUp,
	});
	this.game.frameEnd();
};

Card.prototype.getStates = function () {
	var states = [];
	if (this.frozen) states.push('frozen');
	if (this.charm) states.push('charm');
	if (this.lancer) states.push('lancer');
	if (this.doubleCrash) states.push('doubleCrash');
	if (this.canNotAttack) states.push('locked');
	if (this.assassin) states.push('assassin');
	return states;
};

Card.prototype.triggerOnAffect = function (source) {
	if (!source) {
		source = this.game.getEffectSource();
	}
	if (!source) return;
	this.onAffect.trigger({
		card: this,
		source: source
	});
};

// Card.prototype.loseAbility = function () {
// 	this.canNotAttack = false;
// 	this.lancer = false;
// 	this.doubleCrash = false;
// 	this.assassin = false;
// 	this.canNotBeBanished = false;

	// this.onMove.effects.length = 0;
	// this.onEnterField.effects.length = 0;
	// this.onLeaveField.effects.length = 0;
	// this.onBurst.effects.length = 0;
	// this.onAttack.effects.length = 0;
	// this.onStartUp.effects.length = 0;
	// this.onPowerChange.effects.length = 0;
	// this.onBanish.effects.length = 0;
	// this.onAffect.effects.length = 0;
	// this.onDown.effects.length = 0;
	// this.onBattle.effects.length = 0;
// };

Card.prototype.hasAbility = function () {
	var flag = Card.abilityProps.some(function (prop) {
		return this[prop];
	},this);
	if (flag) return true;
	if (!this.withAbility) return false;
	return !this.abilityLost;
};

Card.prototype.canBeBanished = function () {
	if (this.canNotBeBanished) return false;
	if (this.player.canNotBeBanished) return false;
	if (this.canNotBeBanishedByEffect) {
		var source = this.game.getEffectSource();
		if (source && (source.player === this.player.opponent)) {
			return false;
		}
	}
	return true;
};

Card.prototype.canGainAbility = function (source) {
	let canNotGainAbility =
		this.canNotGainAbility ||
		(this.player.signiCanNotGainAbility && this.type === 'SIGNI') ||
		(this.canNotGainAbilityBySelfPlayer && source && source.player === this.player);
	return !canNotGainAbility;
};

global.Card = Card;