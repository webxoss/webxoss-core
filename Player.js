'use strict';

function Player (game,io,mainDeck,lrigDeck) {
	// 引用
	this.game = game;
	// this.client = open('../WEBXOSS_Client/test.html');
	// this.client = new Client(this.input.bind(this));
	this.io = io;
	io.listener = function () {
		if (!this.input.apply(this,arguments)) {
			console.warn('Invalid input!');
			console.warn(arguments);
			var effectSource = this.game.getEffectSource();
			if (effectSource) {
				console.warn('EffectSource cid: %s',effectSource.cid);
			}
			// console.warn('IP Address: %s',this.io.socket.request.connection.remoteAddress);
		}
	}.bind(this);

	// 注册
	game.register(this);

	// 储存的数据
	this.listener = {}; // 监听器(监听玩家输入).
	this.msgQueue = []; // 要向客户端发送的消息队列.
	                    // 消息不是直接发送给客户端,而是先入队,
	                    // 然后在调用堆栈的最后将整个队列发送.
	this.messagePacks = []; // 用于保存录像.
	this.rebuildCount = 0;
	this.coin         = 0;

	// 快捷方式
	this.hands    = [];   // 手牌
	this.signis   = [];
	this.lrig     = null;
	this.opponent = null; // 对手(Player对象)
	this.crossed  = [];

	// 区域
	this.mainDeck      = new Zone(game,this,'MainDeck','up',mainDeck);
	this.lrigDeck      = new Zone(game,this,'LrigDeck','checkable up',lrigDeck);
	this.handZone      = new Zone(game,this,'HandZone','checkable up inhand');
	this.lrigZone      = new Zone(game,this,'LrigZone','checkable up faceup');
	this.signiZones    = [new Zone(game,this,'SigniZone','up faceup bottom'),
	                      new Zone(game,this,'SigniZone','up faceup bottom'),
	                      new Zone(game,this,'SigniZone','up faceup bottom')];
	this.enerZone      = new Zone(game,this,'EnerZone','checkable faceup');
	this.checkZone     = new Zone(game,this,'CheckZone','checkable up faceup');
	this.trashZone     = new Zone(game,this,'TrashZone','checkable up faceup');
	this.lrigTrashZone = new Zone(game,this,'LrigTrashZone','checkable up faceup');
	this.lifeClothZone = new Zone(game,this,'LifeClothZone','');
	this.excludedZone  = new Zone(game,this,'ExcludedZone','checkable up faceup');

	// 时点
	// this.onLrigChange     = new Timming(game);
	// this.onSignisChange   = new Timming(game);
	this.onUseSpell         = new Timming(game);
	this.onUseArts          = new Timming(game);
	this.onCrash            = new Timming(game);
	this.onSigniBanished    = new Timming(game);
	this.onTurnStart        = new Timming(game);
	this.onTurnEnd          = new Timming(game);
	this.onSummonSigni      = new Timming(game);
	this.onCardMove         = new Timming(game);
	this.onBurstTriggered   = new Timming(game);
	this.onAttack           = new Timming(game);
	this.onAttackPrevented  = new Timming(game);
	this.onRebuild          = new Timming(game);
	this.onAttackPhaseStart = new Timming(game);
	this.onGrowPhaseStart   = new Timming(game);
	this.onMainPhaseStart   = new Timming(game);
	this.onTurnEnd2         = new Timming(game); // 注: 详见 Phase.js 的 endPhase 函数.
	this.onHeaven           = new Timming(game);
	this.onSigniFreezed     = new Timming(game);
	this.onSigniLeaveField  = new Timming(game);
	this.onDiscard          = new Timming(game);
	this.onDoubleCrashed    = new Timming(game);
	this.onDraw             = new Timming(game);
	this.onRemoveVirus      = new Timming(game);

	// 附加属性
	this.skipGrowPhase = false;
	this.guardLimit = 0;
	this.banishTrash = false;
	this.ignoreGrowCost = false;
	this.lrigAttackBanned = false; // 与 lrig.canNotAttack 不同,不会被无效.
	this.wontBeCrashed = false;
	this.wontBeCrashedExceptDamage = false;
	this._trashLifeClothCount = 0;
	this.forceSigniAttack = false;
	this.drawCount = 2;
	this._ionaUltimaMaiden = false; // <究极/少女 伊绪奈>
	this.twoSignisLimit = false; // <白罗星 土星> <开辟者 塔维尔=TRE>
	this.spellCancelable = true;
	this.artsBanned = false;
	this.trashSigniBanned = false;
	this._ViolenceSplashCount = 0; // <暴力飞溅>
	this._DreiDioDaughter = 0; // <DREI=恶英娘>
	this.powerChangeBanned = false;
	this.skipSigniAttackStep = false;
	this.skipLrigAttackStep = false;
	this.addCardToHandBanned = false;
	this.spellBanned = false;
	this.skipEnerPhase = false;
	this.ignoreLimitingOfArtsAndSpell = false;
	this.ignoreLimitingOfLevel5Signi = false; // <紡ぐ者>
	this.summonPowerLimit = 0;
	this.additionalRevealCount = 0; // <反复的独立性 网格>
	this.useBikouAsWhiteCost = false; // <不思議な童話　メルへ>
	this.burstTwice = false; // <Burst Rush>
	this.wontBeDamaged = false; // <音阶的右律 G>
	this.wontBeDamagedByOpponentLrig = false; // <紡ぐ者>
	this.actionEffectBanned = false;
	this.charmedActionEffectBanned = false; // <黒幻蟲　アラクネ・パイダ>
	this.canNotGrow = false; // <ドント・グロウ>
	this._HammerChance = false; // <ハンマー・チャンス>
	this._VierVX = false; // <VIER=维克斯>
	this._RanergeOriginalSpear = []; // <原槍　ラナジェ>
	this.reducedGrowCostWhite = 0;
	this.reducedGrowCostBlack = 0;
	this.reducedGrowCostRed = 0;
	this.reducedGrowCostBlue = 0;
	this.reducedGrowCostGreen = 0;
	this.reducedGrowCostColorless = 0;
	this.attackCount = 0; // <暴风警报>
	this._stormWarning = false; // <暴风警报>
	this.guardBannedLevels = []; // <缚魔炎 花代·叁>
	this.discardOnAttackPhase = false; // <雪月風火　花代・肆>
	this.signiStartUpBanned = false; // <呪われし数字　６６６>
	this.lrigStartUpBanned = false; // <花咲乱 游月·叁>
	this.signiAttackCountLimit = Infinity;
	this.signiTotalAttackCountLimit = Infinity;
	this.lrigAttackCountLimit = Infinity;
	this.canNotGuard = false;
	this.wontLoseGame = false; // <紅蓮乙女　遊月・肆>
	this.canNotBeBanished = false;
	this.canNotBeBounced = false;
	this.signiCanNotGainAbility = false;
	this.canNotBeDownedByOpponentEffect = false;
	this.canNotUseColorlessSigni = false; // <绿罗植 世界树>
	this.canNotUseColorlessSpell = false; // <绿罗植 世界树>

	this.usedActionEffects = [];
	this.chain = null;
	this.inResonaAction = null; // 是否正在执行共鸣单位的出现条件. (同时也是正在执行出现条件的那只共鸣单位)
	this.inActionEffectCost = false; // 是否正在支付起动能力的COST
	this.bannedCards = []; // <漆黑之棺>
	this.oneArtEachTurn = false; // <博愛の使者　サシェ・リュンヌ>
}

// Player.prototype.rockPaperScissorsAsyn = function () {
// 	var player = this;
// 	player.output({
// 		type: 'ROCK_PAPER_SCISSORS',
// 		content: {}
// 	});
// 	return new Callback(function (callback) {
// 		player.listen('ROCK_PAPER_SCISSORS',function (input) {
// 			input = +input;
// 			if (!(input>=0 && input<=2)) return false;
// 			return function () {
// 				callback(input);
// 			};
// 		});
// 	});
// };

// 玩家设置lrig
// (从LRIG卡组里选择等级0的卡片,背面表示放置到LRIG区)
Player.prototype.setupLrigAsyn = function () {
	var cards = this.lrigDeck.cards.filter(function (card) {
		return (card.type === 'LRIG') && (card.level === 0);
	});
	return Callback.immediately().callback(this,function () {
		if (cards.length === 1) return cards[0];
		return this.selectAsyn('LEVEL0_LRIG',cards);;
	}).callback(this,function (card) {
		card.moveTo(this.lrigZone,{faceup: false});
	});
};

// 玩家抽起始手牌(5张)
Player.prototype.setupHands = function () {
	this.draw(5);
};

// 玩家重抽手牌
// (将不需要的卡片返回主卡组并洗牌,再从主卡组顶端抽和返回的卡片数量相同的卡片.)
Player.prototype.redrawAsyn = function () {
	return this.selectSomeAsyn('DISCARD_AND_REDRAW',this.hands).callback(this,function (cards) {
		this.game.moveCards(cards,this.mainDeck);
		this.shuffle();
		this.draw(cards.length);
	});
};

// 玩家洗切牌组
Player.prototype.shuffle = function (cards) {
	if (!cards) {
		cards = this.mainDeck.cards;
	}
	var len = cards.length;

	if (!len) return;

	var oldSids = cards.map(function (card) {
		return {
			a: this.game.getSid(this,card),
			b: this.game.getSid(this.opponent,card)
		};
	},this);

	for (var i = 0; i < len-1; i++) {
		var r = this.game.rand(i,len-1);
		var tmp = cards[i];
		cards[i] = cards[r];
		cards[r] = tmp;
	}

	cards.forEach(function (card,idx) {
		this.game.setSid(this,card,oldSids[idx].a);
		this.game.setSid(this.opponent,card,oldSids[idx].b);
	},this);

	this.game.output({
		type: 'SHUFFLE',
		content: {
			cards: cards
		}
	});
};

// 玩家设置生命护甲
// (从主卡组顶将7张卡依次重叠放置到生命护甲区)
Player.prototype.setupLifeCloth = function () {
	var cards = this.mainDeck.getTopCards(7);
	this.game.moveCards(cards,this.lifeClothZone);
};

// OPEN!!
Player.prototype.open = function () {
	this.lrig.faceup();
	this.setCoin(this.coin); // output
};

// 玩家把lrig和所有signi竖置 (竖置阶段)
Player.prototype.up = function () {
	var cards = concat(this.lrig,this.signis);
	if (!cards.length) return;
	this.game.packOutputs(function () {
		this.game.frame(this,function () {
			cards.forEach(function (card) {
				if (card.frozen) {
					card.frozen = false;
				} else {
					card.up();
				}
			},this);
		});
	},this);
};

// 玩家从卡组抽取n张卡
// 返回:
//   cards: Array,抽到的卡,长度可能少于n(卡组没有足够的卡可以抽),也可能为空数组.
Player.prototype.draw = function (n) {
	if (this.addCardToHandBanned) return [];
	var cards = this.mainDeck.getTopCards(n);
	if (!cards.length) return [];
	if (this.game.phase.isAttackPhase()) {
		var count = this.game.getData(this,'attackPhaseDrawCount') || 0;
		count += cards.length;
		this.game.setData(this,'attackPhaseDrawCount',count);
	}
	this.onDraw.trigger();
	this.game.moveCards(cards,this.handZone);
	return cards;
};

// 被动充能
// 从卡组最上面拿n张卡放到能量区.
// 跟主动充能 player.chargeAsyn() 不一样.
Player.prototype.enerCharge = function (n) {
	var cards = this.mainDeck.getTopCards(n);
	this.game.moveCards(cards,this.enerZone);
	return cards;
};

// 舍弃n张卡
Player.prototype.discardAsyn = function (n) {
	if (!this.hands.length || !n) return Callback.immediately([]);
	if (this.hands.length < n) {
		n = this.hands.length;
	}
	return this.selectSomeAsyn('DISCARD',this.hands,n,n).callback(this,function (cards) {
		return this.discardCards(cards);
	});
};

// 随机舍弃n张卡
Player.prototype.discardRandomly = function (n) {
	if (!isNum(n)) n = 1;
	var cards = [];
	var hands = this.hands.slice();
	for (var i = 0; i < n; i++) {
		if (!hands.length) break;
		var idx = this.game.rand(0,hands.length - 1);
		cards.push(hands[idx]);
		removeFromArr(hands[idx],hands);
	}
	return this.discardCards(cards);
};

// 舍弃指定的卡
Player.prototype.discardCards = function (cards) {
	return this.game.trashCards(cards);
};

// 玩家进行充能操作 (主动充能)
// 玩家从手牌或自己场上的SIGNI选一张卡放到能力区.
Player.prototype.chargeAsyn = function () {
	var cards = concat(this.hands,this.signis);
	if (!cards.length) return Callback.never();
	return this.selectAsyn('CHARGE',cards).callback(this,function (card) {
		return this.game.blockAsyn(this,function () {
			card.moveTo(this.enerZone);
		});
	});
};

// 玩家结束充能阶段
Player.prototype.endEnerPhaseAsyn = function () {
	return this.selectAsyn('END_ENER_PHASE');
};

// 玩家进行成长操作 (主动成长)
Player.prototype.growAsyn = function () {
	var cards = this.lrigDeck.cards.filter(function (card) {
		return card.canGrow(this.ignoreGrowCost);
	},this);
	if (!cards.length) return Callback.never();
	return this.selectAsyn('GROW',cards).callback(this,function (card) {
		return this.game.blockAsyn(this,function () {
			// return Callback.immediately().callback(this,function () {
			// 	if (!card.growActionAsyn) return;
			// 	return card.growActionAsyn();
			// }).callback(this,function () {
			// 	if (this.ignoreGrowCost) return;
			// 	return this.payCostAsyn(card);
			// }).callback(this,function () {
			// 	var colorChanged = (card.color !== this.lrig.color);
			// 	card.moveTo(this.lrigZone,{
			// 		up: this.lrig.isUp
			// 	});
			// 	if (colorChanged) this.game.outputColor();
			// });
			return card.growAsyn();
		});
	});
};

Player.prototype.resetSignisAsyn = function () {
	var signis = [];
	var totalLevel = this.signis.reduce(function (total,signi) {
		return total + signi.level;
	},0);
	// 超出 SIGNI 数量限制
	if (this.signis.length > this.getSigniAmountLimit()) {
		signis = this.signis;
	} else if (totalLevel > this.lrig.limit) {
		// 超出界限
		signis = this.signis;
	} else {
		// 限制及等级
		signis = this.signis.filter(function (signi) {
			return (!signi.checkLimiting()) || (signi.level > this.lrig.level);
		},this);
	}
	if (!signis.length) return Callback.immediately();
	return this.selectAsyn('TRASH_SIGNI',signis).callback(this,function (card) {
		return this.game.blockAsyn(this,function () {
			card.trash();
		});
	}).callback(this,this.resetSignisAsyn);
};

Player.prototype.getSigniAmountLimit = function () {
	if (this._ionaUltimaMaiden) return 1;
	if (this.twoSignisLimit) return 2;
	return 3;
};

// 玩家结束成长阶段
Player.prototype.endGrowPhaseAsyn = function () {
	return this.selectAsyn('END_GROW_PHASE');
};

// 玩家召唤SIGNI
Player.prototype.summonSigniAsyn = function () {
	var cards = this.hands.filter(function (card) {
		return card.canSummon() && (!this.summonPowerLimit || (card.power < this.summonPowerLimit));
	},this);
	if (!cards.length) {
		return Callback.never();
	}
	return this.selectAsyn('SUMMON_SIGNI',cards).callback(this,function (card) {
		return this.selectSummonZoneAsyn(true,card.rise).callback(this,function (zone) {
			if (!zone) return;
			return this.game.blockAsyn(this,function () {
				card.moveTo(zone,{isSummon: true});
				this.game.handleFrameEnd(); // 增加一个空帧,以进行两次常计算
			});
		});
	});
};

// 玩家召唤共鸣SIGNI
Player.prototype.summonResonaSigniAsyn = function (arg) {
	if (!arg) arg = {};
	var cards = this.getResonas(arg);
	if (!cards.length) {
		return Callback.never();
	}
	return this.selectAsyn('RESONA',cards).callback(this,function (card) {
		return this.summonResonaAsyn(card);
	});
};

Player.prototype.getResonas = function (arg) {
	return this.lrigDeck.cards.filter(function (card) {
		if (!card.resona) return false;
		var phase = '';
		if (arg.spellCutIn) {
			phase = 'spellCutIn';
		} else if (this.game.phase.status === 'mainPhase') {
			phase = 'mainPhase';
		} else if (this.game.phase.isAttackPhase()) {
			phase = 'attackPhase';
		}
		if (!inArr(phase,card.resonaPhases)) return false;
		var resonaAsyn = card.resonaCondition();
		if (!resonaAsyn) return false;
		card.resonaAsyn = resonaAsyn;
		return true;
	},this);
};

Player.prototype.summonResonaAsyn = function (card) {
	this.inResonaAction = card;
	return card.resonaAsyn().callback(this,function (resonaArg) {
		this.inResonaAction = null;
		return this.selectSummonZoneAsyn(false).callback(this,function (zone) {
			if (!zone) return;
			return this.game.blockAsyn(this,function () {
				card.moveTo(zone,{isSummon: true, resonaArg: resonaArg});
				this.game.handleFrameEnd(); // 增加一个空帧,以进行两次常计算
			});
		});
	});
};

Player.prototype.selectSummonZoneAsyn = function (optional,rise) {
	var zones = this.getSummonZones(null,rise);
	if (!zones.length) {
		debugger;
		return Callback.immediately(null);
	}
	if (optional) return this.selectOptionalAsyn('SUMMON_SIGNI_ZONE',zones);
	return this.selectAsyn('SUMMON_SIGNI_ZONE',zones);
};

Player.prototype.getSummonZones = function (signis,rise) {
	if (!signis) signis = this.signis;
	var forcedZones = [];
	var zones = this.signiZones.filter(function (zone,idx) {
		if (zone.disabled) return false;
		var signi = zone.getSigni();
		if (rise) {
			if (!signi || !rise(signi)) return false;
		} else {
			if (signi && inArr(signi,signis)) return false;
		}
		var opposingSigni = this.opponent.signiZones[2-idx].getSigni();
		if (opposingSigni && opposingSigni.forceSummonZone) {
			forcedZones.push(zone);
		}
		return true;
	},this);
	if (forcedZones.length) {
		zones = forcedZones;
	}
	return zones.slice();
};

// 玩家废弃SIGNI
Player.prototype.trashSigniAsyn = function () {
	if (this.trashSigniBanned) return Callback.never();
	var signis = this.signis.filter(function (signi) {
		return !signi.resona && !signi.canNotBeTrashedBySelf;
	},this);
	if (!signis.length) return Callback.never();
	return this.selectAsyn('TRASH_SIGNI',signis).callback(this,function (card) {
		return this.game.blockAsyn(this,function () {
			card.trash();
		});
	});
};

// 玩家使用魔法
Player.prototype.useSpellAsyn = function () {
	var cards = this.hands.filter(function (card) {
		return card.canUse();
	});
	if (!cards.length) return Callback.never();

	return this.selectAsyn('USE_SPELL',cards).callback(this,this.handleSpellAsyn);
};

Player.prototype.handleSpellAsyn = function (card,ignoreCost,costObj,arg) {
	if (!costObj) costObj = card;
	if (!arg) arg = {};
	var effect,target,costArg;
	this.game.setData(this,'flagSpellUsed',true);
	var count = this.game.getData(this,'CodeHeartAMS') || 0;
	this.game.setData(this,'CodeHeartAMS',count + 1);

	this.game.spellToCutIn = card;
	return Callback.immediately().callback(this,function () {
		// ------ 块开始 ------
		this.game.blockStart();
		// 1. 放到检查区.
		card.moveTo(this.checkZone);

		// 被 米璐璐恩 抢夺,转移控制权
		// 要在 moveTo 之后改变 player .
		card.player = this;

		// 2. 支付费用.
		// 无视支付费用
		if (ignoreCost) return {  // 返回 costArg 对象
			enerCards: [],
			enerColors: []
		};
		return this.payCostAsyn(costObj);
	}).callback(this,function (_costArg) {
		costArg = _costArg;
		// 如果魔法卡的效果不止一个,选择其中一个发动
		if (card.spellEffects.length === 1) {
			effect = card.spellEffects[0];
		} else {
			return this.selectAsyn('SPELL_EFFECT',card.spellEffects).callback(this,function (eff) {
				effect = eff;
				return this.opponent.showEffectsAsyn([eff]);
			});
		}
	}).callback(this,function () {
		// 3. 娶(划掉)取对象.
		card.activate();
		if (effect.getTargets) {
			// 简单的取对象,即从目标卡片中选一张. (也可以不选,空发)
			if (effect.targetCovered) {
				// 从废弃区等[卡片可能被覆盖的区域]取对象
				return this.selectOptionalAsyn('TARGET',effect.getTargets.call(card)).callback(this,function (card) {
					if (!card) return card;
					return this.opponent.showCardsAsyn([card]).callback(this,function () {
						return card;
					});
				});
			}
			return this.selectTargetOptionalAsyn(effect.getTargets.call(card));
		}
		if (effect.getTargetAdvancedAsyn) {
			// 复杂(高级)的取对象.
			return effect.getTargetAdvancedAsyn.call(card,costArg);
		}
	}).callback(this,function (t) {
		target = t;
		return this.game.blockEndAsyn();
		// ------ 块结束 ------
	}).callback(this,function () {
		// 4. 魔法切入.
		return this.opponent.useSpellCutInArtsAsyn();
	}).callback(this,function (canceled) {
		// 5. 处理.
		// "处理+放置到废弃区"放在1个block里.
		return this.game.blockAsyn(effect.source,this,function () {
			return Callback.immediately().callback(this,function () {
				// "结束这个回合",处理直接结束.
				if (this.game.phase.checkForcedEndTurn()) return;
				// "不会被取消"
				if (!this.spellCancelable) {
					canceled = false;
				}
				// 触发"使用魔法"时点,不管是否被取消
				var event = {
					card: effect.source
				};
				effect.source.player.onUseSpell.trigger(event);
				// 如果被取消,处理直接结束.
				if (canceled) return;
				// 如果目标丢失,处理直接结束. (除非设置了dontCheckTarget)
				if (effect.getTargets && !effect.dontCheckTarget) {
					if (!inArr(target,effect.getTargets.call(card))) {
						return;
					}
				}
				return effect.actionAsyn.call(card,target,costArg);
			}).callback(this,function () {
				// 6. 放到废弃区
				// 恢复控制权
				card.player = card.owner;
				this.game.spellToCutIn = null;
				if (card.zone !== this.checkZone) return;
				return this.game.blockAsyn(this,function () {
					// <皮露露可 APEX>
					if (arg.excludeAfterUse) {
						card.exclude()
					} else {
						card.trash();
					}
				});
			}).callback(this,function () {
				// <混乱交织> 的特殊处理
				if (this.game.phase.checkForcedEndTurn()) return;
				if (canceled !== '_crossScramble') return;
				return this.opponent.handleSpellAsyn(card,true);
			});
		});
	});
};

// 技艺的处理
Player.prototype.handleArtsAsyn = function (card,ignoreCost) {
	var effects,costArg,control;
	var encored = false;
	var costObj = card.getChainedCostObj();
	if (ignoreCost) costObj = {};
	this.game.setData(this,'flagArtsUsed',true);
	// 五色电影卡
	if (card.cid !== 1167) {
		this.game.setData(this,'flagArcDestruct',true);
	}
	if (card.cid !== 1526) {
		this.game.setData(this,'flagDestructOut',true);
	}
	return Callback.immediately().callback(this,function () {
		// ------ 块开始 ------
		this.game.blockStart();
		// 1. 放到检查区
		card.moveTo(this.checkZone);
		// bet
		if (!card.bet) return;
		if (this.coin < card.bet) return;
		var bettedCost = Object.create(costObj);
		if (card.bettedCost && !ignoreCost) {
			bettedCost = card.getChainedCostObj(card.bettedCost);
		}
		bettedCost.costCoin = card.bet;
		if (!this.enoughCost(costObj)) {
			// 必须 bet
			return costObj = bettedCost;
		}
		return this.confirmAsyn('CONFIRM_BET').callback(this,function (answer) {
			if (!answer) return;
			costObj = bettedCost;
		})
	}).callback(this,function () {
		// 如果效果不止一个,选择其中n个发动
		if (card.artsEffects.length === 1) {
			effects = card.artsEffects.slice();
		} else {
			var min,max;
			if (!card.getMinEffectCount || !card.getMaxEffectCount) {
				min = max = 1;
			} else {
				min = card.getMinEffectCount(costObj);
				max = card.getMaxEffectCount(costObj);
			}
			return this.selectSomeAsyn('ARTS_EFFECT',card.artsEffects,min,max,false).callback(this,function (effs) {
				effects = effs;
				if (card.costChangeAfterChoose) {
					card.costChangeAfterChoose.call(card,costObj,effs);
				}
				return this.opponent.showEffectsAsyn(effs);
			});
		}
	}).callback(this,function () {
		// encore 费用,约定: 除了颜色费用，其它属性直接覆盖
		if (!card.encore) return;
		var encoredCost = Object.create(costObj);
		encoredCost.source = card;
		var enerCostProps = [
			'costColorless',
			'costWhite',
			'costBlack',
			'costRed',
			'costBlue',
			'costGreen',
		];
		for (var prop in card.encore) {
			if (inArr(prop,enerCostProps)) {
				encoredCost[prop] += card.encore[prop];
			} else {
				encoredCost[prop] = card.encore[prop];
			}
		}
		if (!this.enoughCost(encoredCost)) return;
		return this.confirmAsyn('CONFIRM_ENCORE').callback(this,function (answer) {
			if (!answer) return;
			costObj = encoredCost;
			encored = true;
		});
	}).callback(this,function () {
		return this.payCostAsyn(costObj);
	}).callback(this,function (_costArg) {
		costArg = _costArg;
		card.activate();
		control = {
			backToDeck: false,
			rtn: null // 当有多个效果时,这个作为返回值. <ブルー・パニッシュ>
		};
		// 3. 处理
		this.onUseArts.trigger({
			card: card
		});
		return this.game.blockAsyn(card,this,function () {
			return Callback.forEach(effects,function (effect) {
				return effect.actionAsyn.call(card,costArg,control);
			},this);
		});
	}).callback(this,function (rtn) {
		// 4. 放到LRIG废弃区
		this.chain = card.chain; // 连锁
		if (encored || control.backToDeck) {
			card.moveTo(card.player.lrigDeck);
		} else {
			card.moveTo(card.player.lrigTrashZone);
		}
		// ------ 块结束 ------
		return this.game.blockEndAsyn().callback(this,function () {
			return control.rtn || rtn;
		});
	});
};


// 玩家使用【魔法切入】的技艺(和起动效果和召唤魔法切入共鸣单位)
Player.prototype.useSpellCutInArtsAsyn = function () {
	var canceled = false;
	function loopAsyn () {
		if (this.game.phase.checkForcedEndTurn()) {
			return Callback.immediately(true);
		}
		var cards = this.lrigDeck.cards.filter(function (card) {
			return card.canUse('spellCutIn');
		});
		cards = cards.concat(this.getResonas({spellCutIn: true}));
		concat(this.signis,this.lrig).forEach(function (card) {
			var hasSpellCutInEffect = card.actionEffects.some(function (effect) {
				return this.canUseActionEffect(effect,{spellCutIn: true});
			},this);
			if (hasSpellCutInEffect) cards.push(card);
		},this);
		// 选择一张魔法切入的技艺(或持有魔法切入的起动效果的卡)
		return this.selectOptionalAsyn('SPELL_CUT_IN',cards,true).callback(this,function (card) {
			if (!card) return true;
			if (card.type === 'ARTS') {
				// 如果选择的是ARTS
				return this.handleArtsAsyn(card).callback(this,function (c) {
					if (c) canceled = c;
					return false;
				});
			} else if (card.resona && inArr('spellCutIn',card.resonaPhases)) {
				// 如果选择的是魔法切入的共鸣单位
				return this.summonResonaAsyn(card);
			} else {
				// 如果选择的是持有起动效果的卡
				var effects = card.actionEffects.filter(function (effect) {
					return this.canUseActionEffect(effect,{spellCutIn: true});
				},this);
				if (!effects.length) return false;
				return Callback.immediately().callback(this,function () {
					if (effects.length === 1) return effects[0];
					return this.selectAsyn('USE_ACTION_EFFECT',effects);
				}).callback(this,function (effect) {
					return this.handleActionEffectAsyn(effect);
				}).callback(this,function (c) {
					if (c) canceled = c;
					return false;
				});
			}
		}).callback(this,function (done) {
			if (canceled || done) return canceled;
			// 重复上述步骤 (直至魔法被取消或没有魔法切入或玩家放弃使用)
			return loopAsyn.call(this);
		});
	}
	return loopAsyn.call(this);
};

// 玩家使用【主要阶段】的技艺
Player.prototype.useMainPhaseArtsAsyn = function () {
	var cards = this.lrigDeck.cards.filter(function (card) {
		return card.canUse('mainPhase');
	});
	if (!cards.length) return Callback.never();
	return this.selectAsyn('USE_ARTS',cards).callback(this,function (card) {
		return this.handleArtsAsyn(card);
	});
};

Player.prototype.canUseActionEffect = function (effect,arg) {
	if (!arg) arg = {};
	if (this.actionEffectBanned) return false;
	if (this.charmedActionEffectBanned && effect.source.charm) return false;
	if (effect.source.abilityLost) return false;
	// inHand
	if (effect.source.zone === this.handZone && !effect.activatedInHand) return false;
	if (effect.source.zone !== this.handZone && effect.activatedInHand) return false;
	// inTrashZone
	if (effect.source.zone === this.trashZone && !effect.activatedInTrashZone) return false;
	if (effect.source.zone !== this.trashZone && effect.activatedInTrashZone) return false;
	// inEnerZone
	if (effect.source.zone === this.enerZone && !effect.activatedInEnerZone) return false;
	if (effect.source.zone !== this.enerZone && effect.activatedInEnerZone) return false;
	// attackPhase && spellCutIn
	if (!arg.ignoreTimming) {
		if (arg.spellCutIn) {
			if (!effect.spellCutIn) return false;
		} else {
			if (this.game.phase.isAttackPhase()) {
				if (!effect.attackPhase) return false;
			} else {
				if (effect.attackPhase && !effect.mainPhase) return false;
			}
		}
	}
	// onAttack
	if (arg.onAttack && !effect.onAttack) return false;
	if (!arg.onAttack && effect.onAttack) return false;
	// cross
	if (effect.cross && !effect.source.crossed) return false;
	// once
	if (effect.once && inArr(effect,this.usedActionEffects)) return false;
	// condition
	if (effect.useCondition && !effect.useCondition.call(effect.source,arg)) return false;
	// <混沌之键主 乌姆尔=FYRA>
	if (effect.activatedInTrashZone) {
		if (this.game.getData(effect.source,'zeroActionCostInTrash')) {
			return true;
		}
	}
	var obj = Object.create(effect);
	if (obj.costColorless) {
		obj.costColorless += effect.source.attachedCostColorless;
	} else {
		obj.costColorless = effect.source.attachedCostColorless;
	}
	if (arg.ignoreExceedCost) {
		obj.costExceed = 0;
	}
	return this.enoughCost(obj);
};

// 玩家使用起动效果
Player.prototype.useActionEffectAsyn = function () {
	var effects = [];
	var cards = concat(this.lrig,this.signis,this.trashZone.cards,this.hands,this.enerZone.cards);
	cards.forEach(function (card) {
		card.actionEffects.forEach(function (effect) {
			if (effect.spellCutIn) return;
			if (this.canUseActionEffect(effect)) {
				effects.push(effect);
			}
		},this);
	},this);
	if (!effects.length) return Callback.never();
	return this.selectAsyn('USE_ACTION_EFFECT',effects).callback(this,function (effect) {
		return this.handleActionEffectAsyn(effect,{
			cancelable: true,
		});
	});
};

Player.prototype.useOnAttackActionEffectAsyn = function (event) {
	var effects = this.lrig.actionEffects.filter(function (effect) {
		return this.canUseActionEffect(effect,{
			onAttack: true,
			event: event,
		});
	},this);
	if (!effects.length) return Callback.immediately();
	return this.selectOptionalAsyn('LAUNCH',effects).callback(this,function (effect) {
		if (!effect) return;
		return this.handleActionEffectAsyn(effect,{event: event});
	});
};

Player.prototype.handleActionEffectAsyn = function (effect,arg) {
	if (!arg) arg = {};
	return this.game.blockAsyn(this,function () {
		var obj = Object.create(effect);
		if (obj.costColorless) {
			obj.costColorless += effect.source.attachedCostColorless;
		} else {
			obj.costColorless = effect.source.attachedCostColorless;
		}
		if (arg.ignoreExceedCost) {
			obj.costExceed = 0;
		}
		// <混沌之键主 乌姆尔=FYRA>
		if (effect.activatedInTrashZone) {
			if (this.game.getData(effect.source,'zeroActionCostInTrash')) {
				obj = {};
				this.game.setData(effect.source,'zeroActionCostInTrash',false);
			}
		}
		this.inActionEffectCost = true;
		return this.payCostAsyn(obj,arg.cancelable).callback(this,function (costArg) {
			this.inActionEffectCost = false;
			if (!costArg) return; // canceled
			effect.source.activate();
			this.usedActionEffects.push(effect);
			return this.game.blockAsyn(effect.source,this,function () {
				return effect.actionAsyn.call(effect.source,costArg,arg);
			});
		});
	});
};

// 玩家结束主要阶段
Player.prototype.endMainPhaseAsyn = function () {
	return this.selectAsyn('END_MAIN_PHASE');
};

// // 玩家使用【攻击阶段】的技艺(和起动效果)
// Player.prototype.useAttackPhaseArtsAsyn = function () {
// 	var cards = this.lrigDeck.cards.filter(function (card) {
// 		return card.canUse('attackPhase');
// 	});
// 	concat(this.signis,this.lrig).forEach(function (card) {
// 		var hasAttackPhaseEffect = card.actionEffects.some(function (effect) {
// 			return effect.attackPhase && this.canUseActionEffect(effect);
// 		},this);
// 		if (hasAttackPhaseEffect) cards.push(card);
// 	},this);
// 	if (!cards.length) return Callback.never();
// 	// 选择一张【攻击阶段】的技艺(或持有【攻击阶段】的起动效果的卡)
// 	return this.selectAsyn('USE_ARTS',cards).callback(this,function (card) {
// 		if (card.type === 'ARTS') {
// 			// 如果选择的是ARTS
// 			return this.handleArtsAsyn(card);
// 		} else {
// 			// 如果选择的是持有起动效果的卡
// 			var effects = card.actionEffects.filter(function (effect) {
// 				return effect.attackPhase && this.canUseActionEffect(effect);
// 			},this);
// 			if (!effects.length) return;
// 			return Callback.immediately().callback(this,function () {
// 				if (effects.length === 1) return effects[0];
// 				return this.selectAsyn('USE_ACTION_EFFECT',effects);
// 			}).callback(this,function (effect) {
// 				return this.handleActionEffectAsyn(effect);
// 			});
// 		}
// 	});
// };

Player.prototype.useAttackPhaseArtsAsyn = function () {
	var cards = this.lrigDeck.cards.filter(function (card) {
		return card.canUse('attackPhase');
	});
	if (!cards.length) return Callback.never();
	return this.selectAsyn('USE_ARTS',cards).callback(this,function (card) {
		return this.handleArtsAsyn(card);
	});
};

Player.prototype.useAttackPhaseActionEffect = function () {
	var cards = concat(this.signis,this.lrig,this.trashZone.cards,this.hands).filter(function (card) {
		return card.actionEffects.some(function (effect) {
			return this.canUseActionEffect(effect);
		},this);
	},this);
	if (!cards.length) return Callback.never();
	return this.selectAsyn('USE_ACTION_EFFECT',cards).callback(this,function (card) {
		var effects = card.actionEffects.filter(function (effect) {
			return this.canUseActionEffect(effect);
		},this);
		if (!effects.length) return;
		return Callback.immediately().callback(this,function () {
			if (effects.length === 1) return effects[0];
			return this.selectAsyn('USE_ACTION_EFFECT',effects);
		}).callback(this,function (effect) {
			return this.handleActionEffectAsyn(effect);
		});
	});
};

// 玩家结束技艺使用步骤
Player.prototype.endArtsStepAsyn = function () {
	return this.selectAsyn('END_ARTS_STEP');
};

// 玩家进行SIGNI攻击
Player.prototype.signiAttackAsyn = function () {
	var cards = this.signis.filter(function (card) {
		return card.canAttack();
	});
	if (!cards.length) return Callback.never();
	return this.selectAsyn('SIGNI_ATTACK',cards).callback(this,function (card) {
		return card.attackAsyn();
	});
};

// 玩家结束SIGNI攻击步骤
Player.prototype.endSigniAttackStepAsyn = function () {
	if (this.forceSigniAttack) {
		var cards = this.signis.filter(function (card) {
			return card.canAttack() && !card.attackCostColorless;
		});
		if (cards.length) return Callback.never();
	}
	return this.selectAsyn('END_SIGNI_ATTACK_STEP');
};

// 玩家进行LRIG攻击
Player.prototype.lrigAttackAsyn = function () {
	if (this.lrigAttackBanned) return Callback.never();
	var cards = [this.lrig].filter(function (card) {
		return card.canAttack();
	});
	if (!cards.length) return Callback.never();
	return this.selectAsyn('LRIG_ATTACK',cards).callback(this,function (card) {
		return card.attackAsyn();
	});
};

// 防御
// callback(succ)
//   succ: 表示是否成功防御
Player.prototype.guardAsyn = function () {
	if (this.canNotGuard) return Callback.immediately(false);
	var cards = this.hands.filter(function (card) {
		return card.guardFlag && (card.level > this.guardLimit) && !inArr(card.level,this.guardBannedLevels);
	},this);
	return this.selectOptionalAsyn('GUARD',cards,true).callback(this,function (card) {
		if (!card) return false;
		card.moveTo(this.trashZone);
		return true;
	});
};

// 玩家结束LRIG攻击步骤
Player.prototype.endLrigAttackStepAsyn = function () {
	return this.selectAsyn('END_LRIG_ATTACK_STEP');
};

// 玩家被击溃(噗
Player.prototype.crashAsyn = function (n,arg) {
	if (n === undefined) n = 1;
	if (arg === undefined) arg = {};
	var source = arg.source || this.game.getEffectSource();
	var attack = !!arg.attack;
	var lancer = !!arg.lancer;
	var doubleCrash = !!arg.doubleCrash;
	var damage = !!arg.damage;
	var tag = arg.tag || '';

	if (this.wontBeCrashed) return Callback.immediately(false);
	if (this.wontBeCrashedExceptDamage && !damage) return Callback.immediately(false);

	var cards = this.lifeClothZone.getTopCards(n);
	if (!cards.length) return Callback.immediately(false);
	var crossLifeCloth = (tag === 'crossLifeCloth'); // <幻水 希拉>
	var effectSource = this.game.getEffectSource();
	return this.game.blockAsyn(this,function () {
		// 放到检查区并触发 onBurst 和 onCrash .
		// 根据<幻竜姫　スヴァローグ>的FAQ,
		// 无迸发的卡立即进入能量区;
		// 有迸发的卡在迸发解决后进入能量区.
		this.game.frame(this,function () {
			cards.forEach(function (card) {
				// <多元描写>
				if (effectSource && (effectSource.player === this.opponent)) {
					this.game.setData(this,'_PluralismDepiction',true);
				}

				card.moveTo(this.checkZone);
				var event = {
					source: source,
					lancer: lancer
				};
				this.onCrash.trigger(event);
				if (card.onBurst.effects.length && (tag !== 'dontTriggerBurst')) {
					// 迸发
					card.onBurst.trigger({crossLifeCloth: crossLifeCloth}); // 注意<DYNAMITE>
				} else {
					card.handleBurstEnd(crossLifeCloth);
				}
			},this);
			if (doubleCrash && (cards.length === 2)) {
				this.onDoubleCrashed.trigger();
			}
		});
	}).callback(this,function () {
		return true;
	});
};

Player.prototype.damageAsyn = function () {
	if (this.wontBeDamaged) return Callback.immediately(false);
	if (this.wontBeDamagedByOpponentLrig) {
		var source = this.game.getEffectSource();
		if (source === this.opponent.lrig) {
			return Callback.immediately(false);
		}
	}
	if (!this.lifeClothZone.cards.length) {
		if (this.game.win(this.opponent)) return Callback.never();
		return Callback.immediately(false);
	}
	return this.crashAsyn(1,{damage: true});
};

// 向玩家展示一些卡,通常用于公开探寻的卡.
Player.prototype.showCardsAsyn = function (cards,label) {
	var player = this;
	// player.opponent.output({
	// 	type: 'WAIT_FOR_OPPONENT',
	// 	content: {
	// 		operation: 'CONFIRM'
	// 	}
	// });
	player.output({
		type: 'SHOW_CARDS',
		content: {
			label: label || 'CONFIRM',
			cards: cards,
			pids: cards.map(function (card) {
				return card.pid;
			})
		}
	});
	return new Callback(function (callback) {
		player.listen('OK',function (input) {
			return function () {
				callback(cards);
			};
		});
	});
};

Player.prototype.showCardsByIdAsyn = function (ids,label) {
	var player = this;
	// player.opponent.output({
	// 	type: 'WAIT_FOR_OPPONENT',
	// 	content: {
	// 		operation: 'CONFIRM'
	// 	}
	// });
	player.output({
		type: 'SHOW_CARDS_BY_ID',
		content: {
			label: label || 'CONFIRM',
			ids: ids
		}
	});
	return new Callback(function (callback) {
		player.listen('OK',function (input) {
			return function () {
				callback();
			};
		});
	});
};

Player.prototype.revealAsyn = function (n) {
	return Callback.immediately().callback(this,function () {
		var source = this.game.getEffectSource();
		if (!source) return 0;
		if (source.player !== this) return 0;
		if (!this.additionalRevealCount) return 0;
		return this.selectNumberAsyn('REVEAL_MORE',0,this.additionalRevealCount,this.additionalRevealCount);
	}).callback(this,function (num) {
		n += num;
		var cards = this.mainDeck.getTopCards(n);
		return this.showCardsAsyn(cards).callback(this,function () {
			return this.opponent.showCardsAsyn(cards).callback(this,function () {
				return cards;
			});
		});
	});
};

Player.prototype.showColorsAsyn = function (colors) {
	var player = this;
	// player.opponent.output({
	// 	type: 'WAIT_FOR_OPPONENT',
	// 	content: {
	// 		operation: 'CONFIRM'
	// 	}
	// });
	player.output({
		type: 'SHOW_COLORS',
		content: {
			colors: colors
		}
	});
	return new Callback(function (callback) {
		player.listen('OK',function (input) {
			return function () {
				callback();
			};
		});
	});
};

Player.prototype.showCardTypesAsyn = function (types) {
	var player = this;
	// player.opponent.output({
	// 	type: 'WAIT_FOR_OPPONENT',
	// 	content: {
	// 		operation: 'CONFIRM'
	// 	}
	// });
	player.output({
		type: 'SHOW_TYPES',
		content: {
			types: types
		}
	});
	return new Callback(function (callback) {
		player.listen('OK',function (input) {
			return function () {
				callback();
			};
		});
	});
};

Player.prototype.showEffectsAsyn = function (effects) {
	var player = this;
	// player.opponent.output({
	// 	type: 'WAIT_FOR_OPPONENT',
	// 	content: {
	// 		operation: 'CONFIRM'
	// 	}
	// });
	player.output({
		type: 'SHOW_EFFECTS',
		content: {
			effects: effects.map(function (eff) {
				return eff.description;
			})
		}
	});
	return new Callback(function (callback) {
		player.listen('OK',function (input) {
			return function () {
				callback();
			};
		});
	});
};

Player.prototype.showTextAsyn = function (title,type,content) {
	var player = this;
	// player.opponent.output({
	// 	type: 'WAIT_FOR_OPPONENT',
	// 	content: {
	// 		operation: 'CONFIRM'
	// 	}
	// });
	player.output({
		type: 'SHOW_TEXT',
		content: {
			type: type,
			title: title,
			content: content
		}
	});
	return new Callback(function (callback) {
		player.listen('OK',function (input) {
			return function () {
				callback();
			};
		});
	});
};

Player.prototype.selectNumberAsyn = function (label,min,max,defaultValue) {
	if (defaultValue === undefined) {
		defaultValue = min;
	}
	var player = this;
	player.output({
		type: 'SELECT_NUMBER',
		content: {
			label: label,
			min: min,
			max: max,
			defaultValue: defaultValue
		}
	});
	return new Callback(function (callback) {
		player.listen(label,function (num) {
			num = num >>> 0;
			if (!((num >= min) && (num <= max))) return false;
			return function () {
				callback(num);
			};
		});
	});
};

Player.prototype.declareAsyn = function (min,max) {
	return this.selectNumberAsyn('DECLARE',min,max).callback(this,function (num) {
		return this.opponent.showTextAsyn('DECLARE','number',num).callback(this,function () {
			return num;
		});
	});
};

Player.prototype.declareCardIdAsyn = function () {
	return this.selectCardIdAsyn('DECLARE').callback(this,function (pid) {
		return this.opponent.showCardsByIdAsyn([pid],'DECLARE').callback(this,function () {
			return pid;
		});
	});
};

Player.prototype.selectTextAsyn = function (label,texts,type) {
	var player = this;
	if (!texts.length) return Callback.immediately(null);
	player.output({
		type: 'SELECT_TEXT',
		content: {
			label: label,
			texts: texts,
			type: type || ''
		}
	});
	return new Callback(function (callback) {
		player.listen(label,function (idx) {
			idx = idx >>> 0;
			var text = texts[idx];
			if (!text) return false;
			return function () {
				callback(text);
			};
		});
	});
};

Player.prototype.selectCardIdAsyn = function (label) {
	var player = this;
	player.output({
		type: 'SELECT_CARD_ID',
		content: {
			label: label
		}
	});
	return new Callback(function (callback) {
		player.listen(label,function (pid) {
			pid = pid >>> 0;
			if (!CardInfo[pid]) return false;
			return function () {
				callback(pid);
			};
		});
	});
};

Player.prototype.confirmAsyn = function (text) {
	var player = this;
	player.output({
		type: 'CONFIRM',
		content: {
			text: text
		}
	});
	return new Callback(function (callback) {
		player.listen('OK',function (answer) {
			return function () {
				callback(!!answer);
			};
		});
	});
};

// 令玩家获得cards的pid.
Player.prototype.informCards = function (cards) {
	this.output({
		type: 'INFORM_CARDS',
		content: {
			cards: cards,
			pids: cards.map(function (card) {
				return card.pid;
			},this)
		}
	});
};

// needEner(obj)
// obj是一个包含 costWhite 等属性的对象 (cost对象),
// 如果obj的所有cost为零,返回false,否则true
Player.prototype.needEner = function (obj) {
	if (obj.costChange) {
		obj = obj.costChange();
	}
	var costs = [obj.costColorless,obj.costWhite,obj.costBlack,obj.costRed,obj.costBlue,obj.costGreen];
	return costs.some(function (cost) {
		return cost > 0;
	});
};

Player.prototype.getTotalEnerCost = function (obj,original) {
	if (!original && obj.costChange) {
		obj = obj.costChange();
	}
	var props = [
		'costColorless',
		'costWhite',
		'costBlack',
		'costRed',
		'costBlue',
		'costGreen',
	];
	var total = 0;
	props.forEach(function (prop) {
		total += (original? this.game.getOriginalValue(obj,prop) : obj[prop]) || 0;
	},this);
	return total;
};

// Player.prototype.needSigniCost = function (obj) {
// 	var costs = [
// 		obj.costSigniWhite,
// 		obj.costSigniBlack,
// 		obj.costSigniRed,
// 		obj.costSigniBlue,
// 		obj.costSigniGreen,
// 		obj.costSigniColorless,
// 	];
// 	return costs.some(function (cost) {
// 		return cost > 0;
// 	});
// };

Player.prototype.needCost = function (obj) {
	if (obj.costChange) {
		obj = obj.costChange();
	}
	if (obj.costCoin) return true;
	if (obj.costDown && obj.source) return true;
	if (obj.costAsyn && obj.source) return true;
	if (obj.costExceed && obj.source) return true;
	if (this.needEner(obj)) return true;
	return false;
};

// For test.
// Player.prototype.testCheckEner = function (colorObj,costObj) {
// 	var cards = [];
// 	var obj = {};
// 	var colorMap = {
// 		'm': 'xxx',
// 		'l': 'colorless',
// 		'w': 'white',
// 		'b': 'black',
// 		'r': 'red',
// 		'u': 'blue',
// 		'g': 'green',
// 		'k': 'green'
// 	};
// 	var costMap = {
// 		'm': 'xxx',
// 		'l': 'costColorless',
// 		'w': 'costWhite',
// 		'b': 'costBlack',
// 		'r': 'costRed',
// 		'u': 'costBlue',
// 		'g': 'costGreen',
// 		'k': 'xxx'
// 	};
// 	for (var x in colorMap) {
// 		var color = colorMap[x];
// 		var count = colorObj[x] || 0;
// 		for (var i = 0; i < count; i++) {
// 			var card = {
// 				color: color,
// 				multiEner: x === 'm',
// 				hasClass: function () {
// 					return this.k;
// 				},
// 				k: x === 'k'
// 			};
// 			cards.push(card);
// 		}
// 		obj[costMap[x]] = costObj[x];
// 	}
// 	obj.useBikouAsWhiteCost = true;
// 	return this.checkEner(cards,obj);
// };

// 御先狐...
Player.prototype.checkEner = function (cards,obj,ignoreReplacement) {
	if (obj.costChange) {
		obj = obj.costChange();
	}
	obj = Object.create(obj);
	obj.costGreen = obj.costGreen || 0;
	cards = cards.slice();
	var osakiCards = cards.filter(function (card) {
		return card._KosakiPhantomBeast;
	},this);
	var minOsaki = 0;
	var maxOsaki = Math.min(osakiCards.length,Math.floor(obj.costGreen/2));
	for (var i = 0; i <= maxOsaki; i++) {
		var result = this._checkEner(cards,obj,ignoreReplacement);
		if (ignoreReplacement || (result.left >= 0)) break;
		minOsaki++;
		removeFromArr(osakiCards[i],cards);
		obj.costGreen = Math.max(0,obj.costGreen - 3);
	}
	result.osakiCards = osakiCards;
	result.minOsaki = minOsaki;
	result.maxOsaki = maxOsaki;
	return result;
};
// _checkEner(cards,obj)
// obj是个cost对象,cards是用来支付能量的卡.
// 返回一个带 left,minBikou,maxBikou,bikouCards 属性的对象.
// left: 支付后剩余的卡片数. (若为负数,表示无法完成支付)
// minBikou: 表示至少要支付的美巧数量.
// maxBikou: 表示至多可以支付的美巧数量.
// bikouCards: 可以用于代替白色费用的美巧卡.
// 注: 由于后来出现了<美しき弦奏　コントラ>,这里的美巧也指这张卡.
Player.prototype._checkEner = function (cards,obj,ignoreReplacement) {
	var minBikou = 0;
	var maxBikou = 0;
	var bikouCards = [];
	// 以下变量表示对应颜色的卡的盈余量. (盈余=存在-需求,负数则表示不足)
	// 减掉需求
	var colorless = -obj.costColorless || 0;
	var white     = -obj.costWhite     || 0;
	var black     = -obj.costBlack     || 0;
	var red       = -obj.costRed       || 0;
	var blue      = -obj.costBlue      || 0;
	var green     = -obj.costGreen     || 0;
	var multi     = 0;
	// 美巧
	var useBikou = !ignoreReplacement && this.canUseBikou(obj);
	var bikou = 0;
	var costWhite = obj.costWhite || 0;
	// <小剑 三日月>
	var mikamune = 0;
	var lrig = this.lrig;

	// 加上存在
	cards.forEach(function (card) {
		if (card.multiEner) multi++;
		else if (card.color === 'colorless') colorless++;
		else if (card.color === 'white'    ) white++;
		else if (card.color === 'black'    ) black++;
		else if (card.color === 'red'      ) red++;
		else if (card.color === 'blue'     ) blue++;
		else if (card.color === 'green'    ) green++;
		// <小剑 三日月>
		if (card._MikamuneSmallSword && !card.multiEner && (card.color !== lrig.color)) {
			mikamune++;
		}
	},this);
	// <小剑 三日月>
	// 借与LRIG颜色相同的卡
	if (lrig.color === 'white') white += mikamune;
	else if (lrig.color === 'black') black += mikamune;
	else if (lrig.color === 'red') red += mikamune;
	else if (lrig.color === 'blue') blue += mikamune;
	else if (lrig.color === 'green') green += mikamune;
	else mikamune = 0;
	// 美巧
	if (useBikou) {
		bikouCards = cards.filter(function (card) {
			return card.hasClass('美巧');
		},this);
	} else {
		bikouCards = cards.filter(function (card) {
			return card.trashAsWhiteCost; // <美しき弦奏　コントラ>
		},this);
	}
	bikou = bikouCards.length;

	// 于是此时变量的值即为盈余值. (负数表示不足)

	// 先考虑白色
	if (white >= 0) {
		maxBikou = Math.min(bikou,costWhite);
		colorless += white; // 盈余的数量加到无色上.
	} else {
		minBikou = Math.min(-white,bikou);
		bikou += white; // 不足的数量用美巧代替.
		green += white; // 注意绿色也同时减少了.
		if (bikou < 0) {
			// 若用美巧代替之后还是不足,则用万花色代替.
			multi += bikou; // 不足的数量用万花色代替.
			green -= bikou; // 注意因为用万花色代替了,所以绿色的盈余增加.
			if (multi < 0) {
				// 万花色不足,无法完成支付.
				return {left: -1,minBikou: 0,maxBikou: 0,bikouCards: []};
			}
		} else {
			maxBikou = Math.min(bikou,costWhite - minBikou);
		}
	}

	// 然后考虑剩下的颜色,除了无色
	if (![black,red,blue,green].every(function (count) {
		if (count >= 0) {
			colorless += count; // 盈余的数量加到无色上.
			return true;
		}
		multi += count; // 不足的数量用万花色代替.
		return multi >= 0; // 万花色不足,无法完成支付.
	})) return {left: -1,minBikou: 0,maxBikou: 0,bikouCards: []};

	maxBikou = minBikou + Math.min(maxBikou,Math.max(0,green) + multi);
	minBikou = Math.max(0,minBikou - multi);

	// 最后考虑无色.
	colorless += multi; // 盈余的数量加到无色上.
	colorless -= mikamune; // 还回从<小剑 三日月>借来的卡.

	return  {
		left: colorless, // 此时无色的盈余量即为支付能力后剩下的卡片数.
		bikouCards: bikouCards,
		minBikou: minBikou,
		maxBikou: maxBikou
	};
};

Player.prototype.canUseBikou = function (obj) {
	return obj.useBikouAsWhiteCost || this.useBikouAsWhiteCost;
};

// 注意 costSigniColorless 是指任意颜色的signi作为cost
// Player.prototype.enoughSigniCost = function (obj) {
// 	var white     = obj.costSigniWhite     || 0;
// 	var black     = obj.costSigniBlack     || 0;
// 	var red       = obj.costSigniRed       || 0;
// 	var blue      = obj.costSigniBlue      || 0;
// 	var green     = obj.costSigniGreen     || 0;
// 	var colorless = obj.costSigniColorless || 0;
// 	for (var i = 0; i < this.hands.length; i++) {
// 		var card = this.hands[i];
// 		if (card.type !== 'SIGNI') continue;

// 		if (card.color === 'white') {
// 			white? white-- : colorless--;
// 		} else if (card.color === 'black') {
// 			black? black-- : colorless--;
// 		} else if (card.color === 'red') {
// 			red? red-- : colorless--;
// 		} else if (card.color === 'blue') {
// 			blue? blue-- : colorless--;
// 		} else if (card.color === 'green') {
// 			green? green-- : colorless--;
// 		} else {
// 			colorless--;
// 		}
// 	}
// 	return [white,black,red,blue,green,colorless].some(function (need) {
// 		return need > 0;
// 	});
// };

// 玩家是否有足够的能量来支付obj指定的费用
Player.prototype.enoughEner = function (obj) {
	if (obj.costChange) {
		obj = obj.costChange();
	}
	return this.checkEner(this.enerZone.cards,obj).left >= 0;
};
Player.prototype.enoughExceed = function (obj) {
	var lrig = obj.source;
	return lrig.zone.cards.length > obj.costExceed;
};
Player.prototype.enoughCost = function (obj) {
	if (obj.costChange) {
		obj = obj.costChange();
	}
	if (obj.costCoin && obj.costCoin > this.coin) return false;
	if (obj.costDown && obj.source && !obj.source.isUp) return false;
	if (obj.costCondition && obj.source) {
		if (!obj.costCondition.call(obj.source)) return false;
	}
	if (obj.costExceed && obj.source) {
		if (!this.enoughExceed(obj)) return false;
	}
	if (!this.enoughEner(obj)) return false;
	return true;
};

// Player.prototype.selectSigniCost = function (obj) {
// 	if ((!this.needSigniCost(obj))) return Callback.immediately([]);
// };
// 要求玩家选择能量
Player.prototype.selectEnerAsyn = function (obj,cancelable) {
	if (obj.costChange) {
		obj = obj.costChange();
	}
	if (!this.needEner(obj)) return Callback.immediately([]);

	var player = this;
	player.output({
		type: 'PAY_ENER',
		content: {
			source: obj.source || 0,
			cancelable: !!cancelable,
			cards: this.enerZone.cards,
			colors: this.enerZone.cards.map(function (card) {
				if (card.multiEner) return 'multi';
				if (card._MikamuneSmallSword && (card.color !== this.lrig.color))
					return [card.color,this.lrig.color];
				return card.color;
			},this),
			colorless: obj.costColorless,
			white:     obj.costWhite,
			black:     obj.costBlack,
			red:       obj.costRed,
			blue:      obj.costBlue,
			green:     obj.costGreen,
			multi:     obj.costMulti
		}
	});
	// player.opponent.output({
	// 	type: 'WAIT_FOR_OPPONENT',
	// 	content: {
	// 		operation: 'PAY_ENER'
	// 	}
	// });

	return new Callback(function (callback) {
		player.listen('PAY_ENER',function (idxs) {
			if (idxs === null) {
				// cancel
				if (!cancelable) return false;
				return function () {
					callback(null);
				}
			}
			if (!isArr(idxs)) return false;
			var cards = idxs.map(function (idx) {
				return player.enerZone.cards[idx];
			});
			var legal = cards.every(function (card,idx) {
				return inArr(card,player.enerZone.cards) && cards.indexOf(card) >= idx;
			});
			if (!legal || player.checkEner(cards,obj,true).left !== 0) return false;
			return function () {
				callback(cards);
			}
		})
	});
};

Player.prototype.selectExceedAsyn = function (obj) {
	var cards = obj.source.zone.cards.slice(1);
	var n = obj.costExceed;
	return this.selectSomeAsyn('PAY_EXCEED',cards,n,n);
};

// 支付Cost
Player.prototype.payCostAsyn = function (obj,cancelable) {
	this.game.frameStart();
	return Callback.immediately().callback(this,function () {
		if (obj.costChangeAsyn) {
			cancelable = false;
			// 需要异步操作的费用改变,如<虹彩・横置>等.
			return obj.costChangeAsyn().callback(this,function (o) {
				obj = o;
			});
		} else if (obj.costChange) {
			// 费用改变
			obj = obj.costChange();
		}
	}).callback(this,function () {
		// 御先狐
		var o = this.checkEner(this.enerZone.cards,obj);
		if (o.left < 0) {
			throw new Error('No enough ener to pay! obj.cid:' + obj.cid);
		}
		if (o.maxOsaki) {
			var min = o.minOsaki;
			var max = o.maxOsaki;
			return this.selectSomeAsyn('TRASH_OSAKI',o.osakiCards,min,max).callback(this,function (cards) {
				if (!cards.length) return;
				cancelable = false;
				this.game.trashCards(cards);
				obj = Object.create(obj);
				obj.costGreen -= cards.length * 3;
				if (obj.costGreen < 0) obj.costGreen = 0;
			});
		}
	}).callback(this,function () {
		// 用美巧代替白色费用
		var o = this.checkEner(this.enerZone.cards,obj);
		if (o.left < 0) {
			throw new Error('No enough ener to pay!');
		}
		if (o.maxBikou) {
			var min = o.minBikou;
			var max = o.maxBikou;
			return this.selectSomeAsyn('PAY_WHITE_INSTEAD',o.bikouCards,min,max).callback(this,function (cards) {
				if (!cards.length) return;
				cancelable = false;
				this.game.trashCards(cards);
				obj = Object.create(obj);
				obj.costWhite -= cards.length;
			});
		}
	}).callback(this,function () {
		// 选择能量
		var costArg = {};
		return this.selectEnerAsyn(obj,cancelable).callback(this,function (cards) {
			if (!cards) {
				// 取消
				this.game.frameEnd();
				return null;
			}
			return Callback.immediately().callback(this,function () {
				costArg.enerCards = cards;
				costArg.enerColors = cards.map(function (card) {
					if (card.multiEner) return 'multi';
					return card.color;
				},this);
				this.game.trashCards(cards);
				// 超越
				if (obj.costExceed && obj.source) {
					return this.selectExceedAsyn(obj).callback(this,function (cards) {
						costArg.exceedCards = cards;
						this.game.trashCards(cards,{isExceedCost: true});
					});
				}
			}).callback(this,function () {
				// 横置
				if (obj.costDown && obj.source) {
					obj.source.down();
				}
				// Coin
				if (obj.costCoin) {
					this.loseCoins(obj.costCoin);
					costArg.bet = obj.costCoin;
				}
				// 其它
				if (obj.costAsyn) {
					if (obj.source) return obj.costAsyn.call(obj.source);
					return obj.costAsyn();
				}
			}).callback(this,function (others) {
				costArg.others = others;
				this.game.frameEnd();
				return costArg;
			});
		});
	});
};

// player.selectAsyn(label,cards,optional,needConfirm)
// 玩家从cards中选一张卡,
// 若cards为null或空数组:
//     若!needConfirm,那么立即callback(null).
//     否则等玩家确认,然后callback(null).
// 若cards非空:
//     若optional,玩家可以不选(返回null).
//     否则,玩家必须从cards中选一张卡,callback返回这张卡.
// callback(null|card)
Player.prototype.selectAsyn = function (label,cards,optional,needConfirm) {
	if (cards && !cards.length && !needConfirm) {
		return Callback.immediately(null);
	}

	if (!cards) {
		return this.selectSomeAsyn(label,[]).callback(this,function () {
			return null;
		});
	}

	var min = optional? 0 : 1;
	return this.selectSomeAsyn(label,cards,min,1).callback(this,function (selectedCards) {
		return selectedCards[0] || null;
	});
};

Player.prototype.selectOptionalAsyn = function (label,cards,needConfirm) {
	return this.selectAsyn(label,cards,true,needConfirm);
};

Player.prototype.selectTargetAsyn = function (cards,optional,needConfirm) {
	return this.selectAsyn('TARGET',cards,optional,needConfirm).callback(this,function (card) {
		if (card) {
			card.beSelectedAsTarget();
		}
		return card;
	});
};

Player.prototype.selectTargetOptionalAsyn = function (cards,needConfirm) {
	return this.selectTargetAsyn(cards,true,needConfirm);
};

Player.prototype.selectSomeTargetsAsyn = function (cards,min,max,careOrder) {
	return this.selectSomeAsyn('TARGET',cards,min,max,careOrder).callback(this,function (selectedCards) {
		selectedCards.forEach(function (card) {
			card.beSelectedAsTarget();
		},this);
		return selectedCards;
	})
};

Player.prototype.selectSomeAsyn = function (label,items,min,max,careOrder,extraCards) {
	// 过滤 shadow 目标
	items = items.filter(item => {
		var source = this.game.getEffectSource();
		if (item.shadow && source && source.player !== item.player) {
			return false;
		}
		return true;
	});
	if (!(min >= 0)) min = 0;
	if (max === undefined || max < 0) {
		max = items.length;
	}
	min = Math.min(min,items.length);
	max = Math.min(max,items.length);
	careOrder = !!careOrder;
	extraCards = extraCards || [];

	var cards = items;
	var descriptions = [];
	var sample = items[0];
	if (sample && sample.source) {
		// 选项是效果
		cards = items.map(function (effect) {
			return effect.source || null;
		});
		descriptions = items.map(function (effect) {
			return effect.description || '';
		});
	}

	var player = this;
	player.output({
		type: 'SELECT',
		content: {
			label: label,
			options: cards,
			descriptions: descriptions,
			extraCards: extraCards,
			extraPids: extraCards.map(function (card) {
				return card.pid;
			}),
			min: min,
			max: max,
			careOrder: careOrder
		}
	});
	// player.opponent.output({
	// 	type: 'WAIT_FOR_OPPONENT',
	// 	content: {
	// 		operation: '' // 注意!
	// 	}
	// });
	return new Callback(function (callback) {
		player.listen(label,function (idxs) {
			if (!isArr(idxs)) return false;
			if (idxs.length > max) return false;
			if (idxs.length < min) return false;
			if (!careOrder) {
				idxs.sort(function (a,b) {
					return a - b;
				});
			}
			var selectedItems = idxs.map(function (idx) {
				if ((idx >= 0) && (idx < items.length)) {
					return items[idx];
				}
				return null;
			},this);
			var legal = selectedItems.every(function (item,i) {
				return item && (selectedItems.indexOf(item) === i);
			},this);
			if (!legal) return false;
			return function () {
				callback(selectedItems);
			}
		});
	});
};

Player.prototype.selectByFilterAsyn = function (filter,optional,cards) {
	var cards = filter? cards.filter(filter) : cards;
	return optional? this.selectTargetOptionalAsyn(cards) : this.selectTargetAsyn(cards);
};

Player.prototype.selectOpponentSigniAsyn = function (filter,optional) {
	return this.selectByFilterAsyn(filter,optional,this.opponent.signis);
};

Player.prototype.selectSelfSigniAsyn = function (filter,optional) {
	return this.selectByFilterAsyn(filter,optional,this.signis);
};

Player.prototype.searchAsyn = function (filter,max,min,dontShow) {
	var cards = this.mainDeck.cards.filter(filter,this);
	max = Math.min(max,cards.length);
	min = min || 0;
	min = Math.min(min,cards.length);
	return this.selectSomeAsyn('SEEK',cards,min,max,false,this.mainDeck.cards).callback(this,function (cards) {
		if (dontShow) {
			this.shuffle();
			return cards;
		}
		return this.opponent.showCardsAsyn(cards).callback(this,function () {
			this.shuffle();
			return cards;
		});
	});
};

Player.prototype.seekAsyn = function (filter,max,min,dontShow) {
	return this.searchAsyn(filter,max,min,dontShow).callback(this,function (cards) {
		this.game.moveCards(cards,this.handZone);
		return cards;
	});
};

Player.prototype.seekAndSummonAsyn = function (filter,n,dontTriggerStartUp) {
	var done = false;
	var rtnCards = [];
	this.game.frameStart();
	return Callback.loop(this,n,function () {
		if (done) return;
		var cards = this.mainDeck.cards.filter(function (card) {
			return card.canSummon() && filter(card);
		},this);
		return this.selectSomeAsyn('SEEK',cards,0,1,false,this.mainDeck.cards).callback(this,function (cards) {
			var card = cards[0];
			if (!card) {
				done = true;
				return;
			};
			rtnCards.push(card);
			return card.summonAsyn(false,dontTriggerStartUp);
		});
	}).callback(this,function () {
		this.shuffle();
		this.game.frameEnd();
		return rtnCards;
	});
};

Player.prototype.pickCardAsyn = function (filter,min,max,zone) {
	if (!isNum(min)) min = 1;
	if (!isNum(max)) max = 1;
	if (!zone) zone = this.trashZone;
	var cards = filter? zone.cards.filter(filter) : zone.cards;
	return this.selectSomeAsyn('ADD_TO_HAND',cards,min,max).callback(this,function (cards) {
		if (!cards.length) return;
		return this.opponent.showCardsAsyn(cards).callback(this,function () {
			this.game.moveCards(cards,this.handZone);
		});
	});
};

Player.prototype.rebornAsyn = function (filter,count,arg) {
	if (!isNum(count)) count = 1;
	if (!arg) arg = {};
	var done = false;
	return Callback.loop(this,count,function () {
		if (done) return;
		var cards = this.trashZone.cards.filter(function (card) {
			if (filter && !filter(card)) return false;
			return card.canSummon();
		},this);
		return this.selectAsyn('SUMMON_SIGNI',cards).callback(this,function (card) {
			if (!card) return done = true;
			return card.summonAsyn(false,arg.dontTriggerStartUp,arg.down);
		});
	});
};

Player.prototype.rearrangeOpponentSignisAsyn = function () {
	return this.rearrangeSignisAsyn(this.opponent);
};

Player.prototype.rearrangeSignisAsyn = function (whos) {
	if (!whos) whos = this;
	var done = false;
	var signis = whos.signis.filter(function (signi) {
		return !signi.isEffectFiltered();
	},this);
	var zones = whos.signiZones.filter(function (zone) {
		if (zone.disabled) return false;
		return (!zone.cards.length) || (!zone.cards[0].isEffectFiltered());
	},this);

	var changedSignis = [];
	return Callback.loop(this,2,function () {
		if (done) return;
		if (!signis.length || (zones.length <= 1)) return;
		return this.selectTargetOptionalAsyn(signis).callback(this,function (signi) {
			if (!signi) {
				done = true;
				return;
			}
			removeFromArr(signi,signis);
			var _zones = zones.filter(function (zone) {
				return (zone !== signi.zone);
			},this);
			return this.selectOptionalAsyn('RESET_SIGNI_ZONE',_zones).callback(this,function (zone) {
				if (!zone) return;
				removeFromArr(zone,zones);
				var card = zone.cards[0];
				if (signi.changeSigniZone(zone)) {
					if (!inArr(signi,changedSignis)) changedSignis.push(signi);
					if (card && !inArr(card,changedSignis)) changedSignis.push(card);
				}
			});
		});
	}).callback(this,function () {
		return changedSignis;
	});
};

Player.prototype.listen = function (label,handle) {
	this.listener[label] = handle;
};

Player.prototype.input = function (data) {
	// if (!isArr(data)) return false;
	// if (data.length !== 2) return false;
	// var label = data[0];
	// var input = data[1];
	if (!isObj(data)) return false;
	var label = data.label;
	var input = data.input;
	if (!isStr(label)) return false;
	var handle = this.listener[label];
	if (!isFunc(handle)) return false;
	var callback = handle(input);
	if (!isFunc(callback)) return false;
	this.listener = {};
	// var p = (this === this.game.hostPlayer)? 'hostPlayer' : 'guestPlayer';
	// if (!window.inputs) window.inputs = '';
	// window.inputs += ('game.'+p+'.input("'+label+'",['+input.toString()+']);');
	// console.time(label);
	callback();
	// console.timeEnd(label);
	this.game.sendMsgQueue();
	if (this.game.winner) {
		this.game.gameover();
	}
	return true;
};

Player.prototype.output = function (msgObj) {
	// var start = Date.now();
	msgObj = this.handleMsgObj(msgObj);
	// var end = Date.now();
	// console.log('player.handleMsgObj() '+(end-start)+'ms');
	this.msgQueue.push(msgObj);
};

Player.prototype.sendMsgQueue = function () {
	var queue = this.msgQueue.slice();
	this.messagePacks.push(queue);
	this.io.send(queue);
	this.msgQueue.length = 0;
};

Player.prototype.handleMsgObj = function (v) {
	if (isArr(v)) {
		var arr = v;
		var newArr = []
		arr.forEach(function (item) {
			newArr.push(this.handleMsgObj(item));
		},this);
		return newArr;
	}
	if (isObj(v)) {
		var obj = v;
		var sid = this.game.getSid(this,obj);
		if (isNum(sid)) return sid;
		var newObj = {};
		for (var x in obj) {
			newObj[x] = this.handleMsgObj(obj[x]);
		}
		return newObj;
	}
	return v;
};

Player.prototype.ignoreGrowCostInNextTurn = function () {
	this.ignoreGrowCost = true;
};

Player.prototype.trashLifeClothWhenTurnEnd = function (n) {
	this._trashLifeClothCount += n;
};

Player.prototype.getCharms = function () {
	var charms = [];
	this.signis.forEach(function (signi) {
		if (signi.charm) {
			charms.push(signi.charm);
		}
	},this);
	return charms;
};

Player.prototype.setCrossPair = function () {
	// 清除已有CP
	this.crossed.forEach(function (pair) {
		pair.crossed = null;
	},this);
	this.crossed = [];

	var card = this.signiZones[1].cards[0];
	if (!card) return;
	if (!card.crossLeft && !card.crossRight) return;
	function checkMatch (zone,cross) {
		if (!zone) return null;
		var card = zone.getSigni();
		if (!card) return null;
		var cids = concat(cross);
		var matched = cids.some(function (cid) {
			return (card.cid === cid);
		},this);
		return matched? card : null;
	}
	// 3 CROSS
	if (card.crossLeft && card.crossRight) {
		if (!checkMatch(this.signiZones[0],card.crossRight)) return;
		if (!checkMatch(this.signiZones[2],card.crossLeft)) return;
		this.crossed = this.signis.slice();
		this.signis.forEach(function (signi) {
			signi.crossed = this.signis.slice();
		},this);
		return;
	}
	// 2 CROSS
	var zone = card.crossRight? this.signiZones[0] : this.signiZones[2];
	var pair = checkMatch(zone,card.crossLeft || card.crossRight);
	if (!pair) return;
	this.crossed = [card,pair];
	card.crossed = [card,pair];
	pair.crossed = [card,pair];
};

Player.prototype.gainCoins = function(count) {
	this.setCoin(this.coin + count);
};

Player.prototype.loseCoins = function(count) {
	this.setCoin(this.coin - count);
};

Player.prototype.setCoin = function(count) {
	var coin = this.coin;
	this.coin = Math.max(0, Math.min(5, count));
	if (this.lrig.isFaceup) {
		this.game.output({
			type: 'COIN_CHANGE',
			content: {
				player: this,
				coin: this.coin,
			},
		});
	}
};

Player.prototype.getInfectedZones = function() {
	return this.signiZones.filter(function (zone) {
		return zone.virus;
	},this);
};

Player.prototype.getInfectedCards = function() {
	return this.signis.filter(function (signi) {
		return signi.isInfected();
	},this);
};

Player.prototype.infectZoneAsyn = function() {
	var zones = this.opponent.signiZones;
	return this.selectAsyn('TARGET',zones).callback(this,function (zone) {
		if (!zone) return null;
		zone.putVirus();
		return zone;
	});
};

Player.prototype.setTrapFromDeckTopAsyn = function(count,max) {
	if (!isNum(max)) max = 1;
	var cards = this.mainDeck.getTopCards(count);
	this.informCards(cards);
	var done = false;
	return Callback.loop(this,max,function () {
		if (done) return;
		return this.selectOptionalAsyn('TARGET',cards).callback(this,function (card) {
			if (!card) return done = true;
			removeFromArr(card,cards);
			return this.selectAsyn('TARGET',this.signiZones).callback(this,function (zone) {
				card.trapTo(zone);
			});
		});
	}).callback(this,function () {
		var len = cards.length;
		if (!len) return;
		return this.selectSomeAsyn('SET_ORDER',cards,len,len,true).callback(this,function (cards) {
			this.mainDeck.moveCardsToBottom(cards);
		});
	});
};

Player.prototype.getTraps = function() {
	return this.signiZones.filter(function (zone) {
		return zone.trap;
	}).map(function (zone) {
		return zone.trap;
	});
};

global.Player = Player;