'use strict';

function Game (cfg) {
	// 基本属性
	this.seed = cfg.seed;
	this.onGameover = cfg.onGameover;
	this.winner = null;
	this.cards = [];

	// 私有
	this._r = new Random(Random.engines.mt19937().seed(cfg.seed));
	this._frameCount = 0;
	this._sources = [];
	this._framedBeforeBlock = false; // 表示处理块前,是否有帧发生.
	                                 // 在驱逐力量0以下的 SIGNI 前置 false, 在 handleFrameEnd() 中置 true.
	                                 // 因为第一次驱逐力量0以下的 SIGNI 后,可能发生常时效果改变,
	                                 // 导致剩下的 SIGNI 力量也变为0以下.
	                                 // 于是不断驱逐力量0以下的 SIGNI 直至 _framedBeforeBlock 为 false.

	// 储存的数据
	this.objList = [];
	this.hostMsgObjs = [];
	this.guestMsgObjs = [];
	this.dataObj = {}; // 储存游戏对象(card,player 等)绑定的数据,回合结束时清空
	this.trashingCards = [];
	this.trashingCharms = [];

	// 注册
	this.register(this);

	// 玩家
	this.hostPlayer = new Player(this,cfg.hostIO,cfg.hostMainDeck,cfg.hostLrigDeck);
	this.guestPlayer = new Player(this,cfg.guestIO,cfg.guestMainDeck,cfg.guestLrigDeck);
	this.hostPlayer.opponent = this.guestPlayer;
	this.guestPlayer.opponent = this.hostPlayer;
	this.turnPlayer = this.hostPlayer;

	// 组件
	this.phase = new Phase(this);
	this.constEffectManager = new ConstEffectManager(this);
	this.effectManager = new EffectManager(this);
	this.triggeringEffects = [];
	this.triggeringEvents  = [];

	// 附加属性
	this.trashWhenPowerBelowZero = false;
	this.spellToCutIn = null; // <ブルー・パニッシュ>
	this.lastTurnCoinSkillsDisabled = false;
};

Game.checkDeck = function (cfg,mayusRoom) {
	if (!isObj(cfg)) return false;
	if (!isArr(cfg.mainDeck) || !isArr(cfg.lrigDeck)) return false;
	// 主卡组正好40张
	if (cfg.mainDeck.length !== 40) return false;
	// LRIG卡组最多10张
	if (cfg.lrigDeck.length > 10) return false;

	// toInfo
	var mainDeckInfos = [];
	var lrigDeckInfos = [];
	var burstCount = 0;
	var flagLrig = false;
	for (var i = 0; i < cfg.mainDeck.length; i++) {
		var pid = cfg.mainDeck[i];
		var info = CardInfo[pid];
		if (!info) return false;
		info = CardInfo[info.cid];
		if (!info) return false;
		if (info.cardType === 'LRIG') return false;
		if (info.cardType === 'ARTS') return false;
		if (info.cardType === 'RESONA') return false;
		if (info.burstEffect) {
			burstCount++;
		}
		mainDeckInfos.push(info);
	}
	for (var i = 0; i < cfg.lrigDeck.length; i++) {
		var pid = cfg.lrigDeck[i];
		var info = CardInfo[pid];
		if (!info) return false;
		info = CardInfo[info.cid];
		if (!info) return false;
		if (info.cardType === 'SIGNI') return false;
		if (info.cardType === 'SPELL') return false;
		if ((info.cardType === 'LRIG') && (info.level === 0)) {
			flagLrig = true;
		}
		lrigDeckInfos.push(info);
	}

	var infos = mainDeckInfos.concat(lrigDeckInfos);
	// LRIG卡组至少有一张0级LRIG
	if (!flagLrig) return false;
	// 生命迸发恰好20张
	if (burstCount !== 20) return false;
	// 相同的卡最多放入4张
	var legal = [mainDeckInfos,lrigDeckInfos].every(function (infos) {
		var bucket = {};
		infos.forEach(function (info) {
			if (info.sideA) {
				info = CardInfo[info.sideA]
			}
			if (info.cid in bucket) {
				bucket[info.cid]++;
			} else {
				bucket[info.cid] = 1;
			}
		});
		for (var cid in bucket) {
			if (bucket[cid] > 4) return false;
		}
		return true;
	},this);
	if (!legal) return false;

	if (!mayusRoom) return true;
	return Game.checkMayusRoom(infos);
};

Game.checkMayusRoom = function (infos) {
	// 禁止 狐狸+修复 和 狐狸+Three out
	if (infos.some(function (info) {
		return info.cid === 33; // 狐狸
	}) && infos.some(function (info) {
		return (info.cid === 34) || (info.cid === 84); // 修复, three out
	})) {
		return false;
	}
	// 禁止 V・＠・C+共鸣・进军 和 V・＠・C+共鸣
	if (infos.some(function (info) {
		return info.cid === 1202; // V・＠・C
	}) && infos.some(function (info) {
		return (info.cid === 884) || (info.cid === 1369); // 共鸣・进军, 共鸣
	})) {
		return false;
	}
	// 禁止 Lock+割裂 和 Lock+精挖
	if (infos.some(function (info) {
		return info.cid === 534; // Lock
	}) && infos.some(function (info) {
		return (info.cid === 408) || (info.cid === 570); // 割裂, 精挖
	})) {
		return false;
	}
	// 禁止 Ar+魔术手
	if (infos.some(function (info) {
		return info.cid === 814; // Ar
	}) && infos.some(function (info) {
		return (info.cid === 1090); // 魔术手
	})) {
		return false;
	}
	// 禁止 双麻油
	if (infos.some(function (info) {
		return info.cid === 649; // 創世の巫女　マユ
	}) && infos.some(function (info) {
		return (info.cid === 1562); // 真名の巫女　マユ
	})) {
		return false;
	}
	// 禁止 台风蛇
	if (infos.some(function (info) {
		return info.cid === 957; // 台風一過
	}) && infos.some(function (info) {
		return (info.cid === 1652); // コードアンシエンツ　ヘルボロス
	})) {
		return false;
	}
	// 限制
	var limitMap = {
		37: 2,  // <忘得ぬ幻想　ヴァルキリー>
		34: 2,  // <修復>
		178: 2, // <先駆の大天使　アークゲイン>
		1501: 2, // <幻竜　アパト>
		534: 1, // <ロック・ユー>
		// 689: 1, // <ＲＡＩＮＹ>
		474: 0, // <ノー・ゲイン>
		23: 0,  // <大器晩成>
		689: 0, // <ＲＡＩＮＹ>
		1030: 0, // <四面楚火>
		1457: 0, // <サーバント　Ｚ>
		1212: 0, // <コードアート　Ｃ・Ｌ>
	};
	for (var i = 0; i < infos.length; i++) {
		var info = infos[i];
		var cid = info.cid;
		if (cid in limitMap) {
			limitMap[cid]--;
			if (limitMap[cid] < 0) return false;
		}
	}
	return true;
};

Game.prototype.start = function () {
	this.allocateSid(this.hostPlayer,this.objList);
	this.allocateSid(this.guestPlayer,this.objList);
	this.setupEffects();
	this.outputInitMsg(this.hostPlayer);
	this.outputInitMsg(this.guestPlayer);
	this.phase.setup();
	this.sendMsgQueue();
};

Game.prototype.setupEffects = function () {
	[this.hostPlayer,this.guestPlayer].forEach(function (player) {
		concat(player.mainDeck.cards,player.lrigDeck.cards).forEach(function (card) {
			card.setupEffects();
		},this);
	},this);
};

Game.prototype.outputInitMsg = function (player) {
	var opponent = player.opponent;
	player.output({
		type: 'INIT',
		content: {
			player: player,
			opponent: opponent,
			playerZones: {
				mainDeck: player.mainDeck,
				lrigDeck: player.lrigDeck,
				handZone: player.handZone,
				lrigZone: player.lrigZone,
				signiZones: player.signiZones,
				enerZone: player.enerZone,
				checkZone: player.checkZone,
				trashZone: player.trashZone,
				lrigTrashZone: player.lrigTrashZone,
				lifeClothZone: player.lifeClothZone,
				excludedZone: player.excludedZone,
				mainDeckCards: player.mainDeck.cards,
				lrigDeckCards: player.lrigDeck.cards,
				lrigDeckCardInfos: player.lrigDeck.cards.map(function (card) {
					return {
						pid: card.pid,
						isSide: !!card.sideA
					}
				},this)
			},
			opponentZones: {
				mainDeck: opponent.mainDeck,
				lrigDeck: opponent.lrigDeck,
				handZone: opponent.handZone,
				lrigZone: opponent.lrigZone,
				signiZones: opponent.signiZones,
				enerZone: opponent.enerZone,
				checkZone: opponent.checkZone,
				trashZone: opponent.trashZone,
				lrigTrashZone: opponent.lrigTrashZone,
				lifeClothZone: opponent.lifeClothZone,
				excludedZone: opponent.excludedZone,
				mainDeckCards: opponent.mainDeck.cards,
				lrigDeckCards: opponent.lrigDeck.cards,
				lrigDeckCardInfos: opponent.lrigDeck.cards.map(function (card) {
					return {
						pid: 0,
						isSide: !!card.sideA
					}
				},this)
			}
		}
	});
};

Game.prototype.register = function (obj) {
	if (!obj) throw new TypeError();
	obj.gid = obj._asid = obj._bsid = this.objList.push(obj);
};

Game.prototype.allocateSid = function (player,objs) {
	var len = objs.length;
	objs.forEach(function (obj,i) {
		var r = this.rand(i,len-1);
		if ((player === this.hostPlayer)) {
			var tmp = obj._asid;
			obj._asid = objs[r]._asid;
			objs[r]._asid = tmp;
		} else {
			var tmp = obj._bsid;
			obj._bsid = objs[r]._bsid;
			objs[r]._bsid = tmp;
		}
	},this);
};

Game.prototype.getSid = function (player,obj) {
	return (player === this.hostPlayer)? obj._asid : obj._bsid;
};

Game.prototype.setSid = function (player,obj,sid) {
	if (player === this.hostPlayer) {
		obj._asid = sid;
	} else {
		obj._bsid = sid;
	}
};

Game.prototype.getObjectBySid = function (player,sid) {
	if (!isNum(sid)) return null;
	for (var i = this.objList.length - 1; i >= 0; i--) {
		var obj = this.objList[i];
		if (player === this.hostPlayer) {
			if (obj._asid === sid) return obj;
		} else {
			if (obj._bsid === sid) return obj;
		}
	}
	return null;
};

Game.prototype.decideFirstPlayerAsyn = function () {
	return Callback.immediately().callback(this,function () {
		var firstPlayer = this.rand(0,1)? this.hostPlayer : this.guestPlayer;
		return firstPlayer;
	});
	// var a,b;
	// return this.hostPlayer.rockPaperScissorsAsyn(this,function (v) {
	// 	a = v;
	// }).callback(this,function () {
	// 	return this.guestPlayer.rockPaperScissorsAsyn(this,function (v) {
	// 		b = v;
	// 	});
	// }).callback(this,function () {
	// 	if (a === b) return this.decideFirstPlayerAsyn();
	// 	var aWin =
	// 		((a === 0) && (b === 2)) ||
	// 		((a === 1) && (b === 0)) ||
	// 		((a === 2) && (b === 2));
	// 	var firstPlayer = aWin? this.hostPlayer : this.guestPlayer;
	// 	return firstPlayer;
	// });
};

Game.prototype.win = function (player) {
	if (player.opponent.wontLoseGame) return false;
	player.output({
		type: 'WIN',
		content: {}
	});
	player.opponent.output({
		type: 'LOSE',
		content: {}
	});

	this.winner = player;
	return true;
};

Game.prototype.destroy = function () {
	this.hostPlayer.io.listener = null;
	this.guestPlayer.io.listener = null;
};

Game.prototype.output = function (msgObj) {
	this.hostPlayer.output(msgObj);
	this.guestPlayer.output(msgObj);
};

Game.prototype.packOutputs = function (func,thisp) {
	this.output({
		type: 'PACKED_MSG_START',
		content: {}
	});

	var rtn = func.call(thisp || this);

	this.output({
		type: 'PACKED_MSG_END',
		content: {}
	});

	return rtn;
};

Game.prototype.outputColor = function () {
	var playerColor = this.turnPlayer.lrig.color;
	var opponentColor = this.turnPlayer.opponent.lrig.color;
	if (playerColor === 'colorless') {
		playerColor = 'white';
	}
	if (opponentColor === 'colorless') {
		opponentColor = 'white';
	}
	this.turnPlayer.output({
		type: 'SET_COLOR',
		content: {
			selfColor: playerColor,
			opponentColor: opponentColor
		}
	});
	this.turnPlayer.opponent.output({
		type: 'SET_COLOR',
		content: {
			selfColor: opponentColor,
			opponentColor: playerColor
		}
	});
};

Game.prototype.sendMsgQueue = function () {
	this.hostPlayer.sendMsgQueue();
	this.guestPlayer.sendMsgQueue();
};

Game.prototype.rand = function (min,max) {
	// return Math.floor(Math.random() * (max+1-min)) + min;
	return this._r.integer(min,max);
};

Game.prototype.moveCards = function (cards,zone,arg) {
	if (!cards.length) return [];
	cards = cards.slice();
	this.packOutputs(function () {
		this.frameStart();
		cards = cards.filter(function (card) {
			return card.moveTo(zone,arg);
		},this);
		this.frameEnd();
	});
	return cards;
};

Game.prototype.moveCardsAdvancedAsyn = function (cards,zones,args,force) {
	cards = cards.slice();
	this.frameStart();
	var source = this.getEffectSource();
	var signis = [];          // 可以被保护的 SIGNI
	var protectedSignis = []; // 确实被保护了的 SIGNI
	var succs = [];           // 返回值,表示是否成功移动. 注: 被保护了也算成功移动.
	var protectedFlags = [];  // 返回值,表示是否被保护
	if (!force && source && !source.powerChangeBanned) { // <幻兽神 狮王>
		// 获得以被保护的 SIGNI
		signis = cards.filter(function (card,i) {
			return card.protectingShironakujis.length &&
			       (source.player === card.player.opponent) &&
			       inArr(card,card.player.signis) &&
			       !card.isEffectFiltered(source);
		},this);
	}
	return Callback.forEach(signis,function (signi) {
		// 获得保护该 SIGNI 的<幻水 蓝鲸>
		var protectingShironakujis = signi.protectingShironakujis;
		if (!protectingShironakujis.length) return;
		return signi.player.selectOptionalAsyn('PROTECT',[signi]).callback(this,function (c) {
			if (!c) return;
			signi.beSelectedAsTarget();
			return signi.player.selectOptionalAsyn('_SHIRONAKUJI',protectingShironakujis).callback(this,function (shironakuji) {
				if (!shironakuji) return;
				shironakuji.beSelectedAsTarget();
				// 保护
				protectedSignis.push(signi);
				this.tillTurnEndAdd(source,shironakuji,'power',-6000); // 力量-6000,注意效果源
				this.constEffectManager.compute(); // 强制计算,即使不是帧结束
			});
		});
	},this).callback(this,function () {
		this.packOutputs(function () {
			cards.forEach(function (card,i) {
				if (inArr(card,protectedSignis)) {
					protectedFlags.push(true);
					succs.push(true);
				} else {
					protectedFlags.push(false);
					succs.push(card.moveTo(zones[i],args[i]));
				}
			},this);
		},this);
		this.frameEnd();
		return {protectedFlags: protectedFlags, succs: succs};
	});
};

// 只要有1只 SIGNI 被驱逐成功(包括代替)就返回 true.
Game.prototype.banishCardsAsyn = function (cards,force,arg) {
	if (!arg) arg = {};
	var attackingSigni = arg.attackingSigni || null;
	var control = {
		someBanished: false,
	};
	var source = this.getEffectSource();
	cards = cards.filter(function (card) {
		if (card.isEffectFiltered(source)) return false;
		if (!card.canBeBanished()) return false;
		return true;
	},this);
	if (!cards.length) return Callback.immediately(false);
	this.frameStart();
	return this.protectBanishAsyn(cards,this.turnPlayer,control).callback(this,function (cards) {
		var zones = cards.map(function (card) {
			// <绿叁游 水滑梯>
			if (card.resonaBanishToTrash) return card.player.lrigTrashZone;
			// 原枪
			if (card.player.banishTrash) return card.player.trashZone;
			// <原槍　エナジェ>
			if (inArr(source,card.player._RanergeOriginalSpear)) return card.player.trashZone;
			if (inArr(attackingSigni,card.player._RanergeOriginalSpear)) return card.player.trashZone;
			return card.player.enerZone;
		},this);
		var opposingSignis = cards.map(function (card) {
			return card.getOpposingSigni();
		},this);
		var accedCards = cards.map(function (card) {
			return card.getAccedCards();
		},this);
		return this.moveCardsAdvancedAsyn(cards,zones,[],force).callback(this,function (arg) {
			arg.protectedFlags.forEach(function (isProtected,i) {
				if (isProtected) return;
				if (!arg.succs[i]) return;
				var signi = cards[i];
				// <幻獣神　ウルティム>
				var banishSource = attackingSigni || source;
				var count;
				if (banishSource) {
					if (banishSource.hasClass('空獣') || banishSource.hasClass('地獣')) {
						if (signi.player === banishSource.player.opponent) {
							count = this.getData(banishSource.player,'_UltimPhantomBeastDeity') || 0;
							this.setData(banishSource.player,'_UltimPhantomBeastDeity',++count);
						}
					}
				}
				var event = {
					card: signi,
					opposingSigni: opposingSignis[i],
					accedCards: accedCards[i],
					attackingSigni: attackingSigni,
					source: banishSource
				};
				this.setData(signi.player,'flagSigniBanished',true);
				signi.onBanish.trigger(event);
				signi.player.onSigniBanished.trigger(event);
			},this);
			this.frameEnd();
			return control.someBanished || !!arg.succs.length;
		});
	});
};

Game.prototype.protectBanishAsyn = function (cards,player,control) {
	// 过滤不被驱逐的卡
	cards = cards.filter(function (card) {
		if (card.isEffectFiltered()) return false;
		if (!card.canBeBanished()) return false;
		return true;
	},this);
	// 获得玩家受保护的卡及其保护措施
	var cardList = [];
	var protectionTable = {};
	var optional = true;
	cards.forEach(function (card) {
		if (card.player !== player) return;
		card.banishProtections.forEach(function (protection) {
			if (!protection.condition.call(protection.source,card)) return;
			if (!protection.optional) optional = false;
			if (protectionTable[card.gid]) {
				protectionTable[card.gid].push(protection);
			} else {
				cardList.push(card);
				protectionTable[card.gid] = [protection];
			}
		},this);
	},this);
	// 选择要保护的卡以及保护措施
	return player.selectAsyn('PROTECT',cardList,optional).callback(this,function (card) {
		if (!card) {
			// 回合玩家处理完毕,处理非回合玩家.
			if (player === this.turnPlayer) {
				return this.protectBanishAsyn(cards,player.opponent,control);
			}
			// 非回合玩家处理完毕,结束处理.
			return cards;
		}
		card.beSelectedAsTarget();
		var protections = protectionTable[card.gid];
		return player.selectAsyn('CHOOSE_EFFECT',protections).callback(this,function (protection) {
			protection.source.activate();
			return protection.actionAsyn.call(protection.source,card).callback(this,function () {
				control.someBanished = true;
				this.constEffectManager.compute(); // 强制计算,即使不是帧结束
				cards = cards.filter(function (c) {
					if (c === card) return false; // 排除已被保护的卡
					if (!inArr(c,c.player.signis)) return false; // 排除已不在场的卡
					return true;
				},this);
				// 继续处理当前玩家.
				return this.protectBanishAsyn(cards,player,control);
			});
		});
	});
};

// Game.prototype.protectBanishAsyn = function () {
// 	// 代替驱逐
// 	return Callback.forEach(cards,function (card) {
// 		if (force) return;
// 		if (card.isEffectFiltered()) return;
// 		if (card.canNotBeBanished) return;
// 		if (card.power <= 0 ) return;
// 		// <堕落虚无 派蒙>
// 		if (card.trashCharmInsteadOfBanish && card.charm) {
// 			return card.player.selectOptionalAsyn('TRASH_CHARM',[card]).callback(this,function (c) {
// 				if (!c) return;
// 				someBanished = true;
// 				card.charm.trash();
// 				removeFromArr(card,cards);
// 			});
// 		}
// 		// <核心代号 Ｓ・Ｗ・Ｔ>
// 		if (card.discardSpellInsteadOfBanish) {
// 			var spells = card.player.hands.filter(function (card) {
// 				return card.type === 'SPELL';
// 			},this);
// 			if (!spells.length) return;
// 			return card.player.selectOptionalAsyn('PROTECT',[card]).callback(this,function (c) {
// 				if (!c) return;
// 				return card.player.selectAsyn('TRASH',spells).callback(this,function (spell) {
// 					if (!spell) return;
// 					someBanished = true;
// 					spell.trash();
// 					removeFromArr(card,cards);
// 				});
// 			});
// 		}
// 		// <コードハート　Ｍ・Ｐ・Ｐ>
// 		if (card.protectingMpps.length) {
// 			// 获得保护该 SIGNI 的<Ｍ・Ｐ・Ｐ>
// 			var protectingMpps = card.protectingMpps.filter(function (mpp) {
// 				if (!inArr(mpp,card.player.signis)) return false;
// 				var spells = mpp.zone.cards.slice(1).filter(function (card) {
// 					return (card !== mpp.charm);
// 				},this);
// 				return (spells.length >= 2);
// 			},this);
// 			if (!protectingMpps.length) return;
// 			card.beSelectedAsTarget(); // 被驱逐的SIGNI闪烁
// 			return card.player.selectOptionalAsyn('PROTECT',protectingMpps).callback(this,function (mpp) {
// 				if (!mpp) return;
// 				var spells = mpp.zone.cards.slice(1).filter(function (card) {
// 					return (card !== mpp.charm);
// 				},this);
// 				return card.player.selectSomeAsyn('TRASH',spells,2,2).callback(this,function (spells) {
// 					mpp.activate();
// 					this.trashCards(spells);
// 					someBanished = true;
// 					removeFromArr(card,cards);
// 				});
// 			});
// 		}
// 	},this)
// };

// Game.prototype.banishCards = function (cards) {
// 	if (!cards.length) return;
// 	cards = cards.slice();
// 	this.packOutputs(function () {
// 		this.frameStart();
// 		cards.forEach(function (card) {
// 			card.beBanished();
// 		},this);
// 		this.frameEnd();
// 	});
// };

// Game.prototype.doBanishCards = function (cards) {
// 	if (!cards.length) return;
// 	cards = cards.slice();
// 	this.packOutputs(function () {
// 		this.frameStart();
// 		cards.forEach(function (card) {
// 			card.doBanish();
// 		},this);
// 		this.frameEnd();
// 	});
// };

// Game.prototype.banishCardsAsyn = function (cards) {
// 	if (!cards.length) return Callback.immediately();
// 	cards = cards.slice();
// 	return this.packOutputs(function () {
// 		this.frameStart();
// 		return Callback.forEach(cards,function (card) {
// 			return card.banishAsyn();
// 		},this).callback(this,function () {
// 			this.frameEnd();
// 		});
// 	});
// };

Game.prototype.trashCardsAsyn = function (cards,arg) {
	if (!cards.length) return Callback.immediately();
	cards = cards.slice();
	var zones = cards.map(function (card) {
		if (inArr(card.type,['LRIG','ARTS'])) return card.player.lrigTrashZone;
		return card.player.trashZone;
	},this);
	var args = cards.map(function (card) {
		return arg || {};
	},this);
	return this.moveCardsAdvancedAsyn(cards,zones,[],args);
};

Game.prototype.bounceCardsAsyn = function (cards) {
	if (!cards.length) return Callback.immediately();
	cards = cards.slice();
	var zones = cards.map(function (card) {
		return card.player.handZone;
	},this);
	return this.moveCardsAdvancedAsyn(cards,zones,[]);
};

Game.prototype.bounceCardsToDeckAsyn = function (cards) {
	if (!cards.length) return Callback.immediately();
	cards = cards.slice();
	var zones = cards.map(function (card) {
		if (inArr(this.type,['LRIG','ARTS'])) return card.player.lrigDeck;
		return card.player.mainDeck;
	},this);
	return this.moveCardsAdvancedAsyn(cards,zones,[]);
};


Game.prototype.trashCards = function (cards,arg) {
	if (!cards.length) return;
	cards = cards.slice();
	this.packOutputs(function () {
		this.frameStart();
		cards = cards.filter(function (card) {
			return card.trash(arg);
		},this);
		this.frameEnd();
	});
	return cards;
};

Game.prototype.excludeCards = function (cards) {
	if (!cards.length) return;
	cards = cards.slice();
	this.packOutputs(function () {
		this.frameStart();
		cards = cards.filter(function (card) {
			card.exclude();
		},this);
		this.frameEnd();
	});
	return cards;
};

Game.prototype.upCards = function (cards) {
	if (!cards.length) return;
	this.packOutputs(function () {
		this.frameStart();
		cards = cards.filter(function (card) {
			return card.up();
		},this);
		this.frameEnd();
	});
	return cards;
};

Game.prototype.upCardsAsyn = function (cards) {
	if (!cards.length) return;
	var upCards = [];
	this.frameStart();
	return Callback.forEach(cards,function (card) {
		return card.upAsyn().callback(this,function (succ) {
			if (succ) upCards.push(card);
		});
	}).callback(this,function () {
		this.frameEnd();
		return upCards;
	});
};

Game.prototype.downCards = function (cards) {
	if (!cards.length) return;
	this.packOutputs(function () {
		this.frameStart();
		cards = cards.filter(function (card) {
			card.down();
		},this);
		this.frameEnd();
	});
	return cards;
};

// Game.prototype.informPower = function () {
// 	var cards = concat(this.turnPlayer.signis,this.turnPlayer.opponent.signis);
// 	var powers = cards.map(function (card) {
// 		return card.power;
// 	});
// 	this.output({
// 		type: 'POWER',
// 		content: {
// 			cards: cards,
// 			powers: powers
// 		}
// 	});
// };

Game.prototype.outputCardStates = function () {
	var cards = concat(this.turnPlayer.signis,this.turnPlayer.opponent.signis);
	var signiInfos = cards.map(function (card) {
		return {
			card: card,
			power: card.power,
			states: card.getStates()
		}
	},this);
	cards = [this.turnPlayer.lrig,this.turnPlayer.opponent.lrig];
	var lrigInfos = cards.map(function (card) {
		return {
			card: card,
			states: card.getStates()
		}
	},this);
	var zones = concat(this.turnPlayer.signiZones,this.turnPlayer.opponent.signiZones);
	var zoneInfos = zones.map(function (zone) {
		return {
			zone: zone,
			states: zone.getStates()
		}
	},this);
	this.output({
		type: 'CARD_STATES',
		content: {
			signiInfos: signiInfos,
			lrigInfos: lrigInfos,
			zoneInfos: zoneInfos
		}
	});
};

Game.prototype.addConstEffect = function (cfg,dontCompute) {
	var constEffect = new ConstEffect(this.constEffectManager,cfg);
	if (!dontCompute) {
		this.handleFrameEnd();
	}
	return constEffect;
};

Game.prototype.newEffect = function (eff) {
	return new Effect(this.effectManager,eff);
};

Game.prototype.frame = function (thisp,func) {
	if (arguments.length !== 2) {
		debugger;
	}
	this.frameStart();
	func.call(thisp);
	this.frameEnd();
};

Game.prototype.frameStart = function () {
	this._frameCount++;
};

Game.prototype.frameEnd = function () {
	if (this._frameCount <= 0) {
		debugger;
		console.warn('game._frameCount <= 0');
		this._frameCount = 0;
		return;
	}
	this._frameCount--;
	this.handleFrameEnd();
};

Game.prototype.handleFrameEnd = function () {
	if (this._frameCount) return;
	this._framedBeforeBlock = true;
	this.constEffectManager.compute();
	this.triggeringEffects.forEach(function (effect,idx) {
		effect.trigger(this.triggeringEvents[idx]);
	},this);
	this.triggeringEffects.length = 0;
	this.triggeringEvents.length = 0;
};

Game.prototype.pushTriggeringEffect = function (effect,event) {
	this.triggeringEffects.push(effect);
	this.triggeringEvents.push(event);
};

Game.prototype.pushEffectSource = function (source) {
	this._sources.push(source || null);
};

Game.prototype.popEffectSource = function (source) {
	return this._sources.pop();
};

Game.prototype.getEffectSource = function () {
	if (!this._sources.length) return null;
	return this._sources[this._sources.length-1];
};

Game.prototype.blockAsyn = function (source,thisp,func) {
	if (arguments.length !== 3) {
		if (arguments.length === 2) {
			source = null;
			thisp = arguments[0];
			func = arguments[1];
		} else {
			debugger;
			console.warn('game.blockAsyn() 参数个数不正确');
		}
	}
	this.blockStart(source);
	return Callback.immediately().callback(thisp,func).callback(this,function (rtn) {
		return this.blockEndAsyn().callback(this,function () {
			return rtn;
		});
	});
};

// Game.prototype.block = function (source,thisp,func) {
// 	this.pushEffectSource(source);
// 	func.call(thisp);
// 	this.popEffectSource();
// };

Game.prototype.blockStart = function (source) {
	this.pushEffectSource(source);
};

Game.prototype.blockEndAsyn = function () {
	if (this._sources.length <= 0) {
		debugger;
		console.warn('game._sources.length <= 0');
		return Callback.immediately();
	}
	this.popEffectSource();
	return this.handleBlockEndAsyn();
};

Game.prototype.handleBlockEndAsyn = function () {
	if (this._sources.length) return Callback.immediately();
	this.frameStart();
	return this.turnPlayer.resetSignisAsyn().callback(this,function () {
		return this.turnPlayer.opponent.resetSignisAsyn();
	}).callback(this,function () {
		return this.turnPlayer.resetAccesAsyn().callback(this,function () {
			return this.turnPlayer.opponent.resetAccesAsyn();
		});
	}).callback(this,function () {
		this.frameEnd();
		return this.banishNonPositiveAsyn();
	}).callback(this,function () {
		// 废弃【魅饰】和SIGNI下方的卡
		this.trashCards(this.trashingCharms,{ isCharm: true });
		this.trashCards(this.trashingCards);
		this.trashingCharms.length = 0;
		this.trashingCards.length = 0;
		return this.rebuildAsyn();
	}).callback(this,function () {
		return this.effectManager.handleEffectsAsyn();
	});
	// return this.banishNonPositiveAsyn().callback(this,function () {
	// 	return this.rebuildAsyn().callback(this,function () {
	// 		return this.effectManager.handleEffectsAsyn();
	// 	});
	// });
};

Game.prototype.banishNonPositiveAsyn = function () {
	if (!this._framedBeforeBlock) return Callback.immediately();
	this._framedBeforeBlock = false;
	var signis = concat(this.turnPlayer.signis,this.turnPlayer.opponent.signis).filter(function (signi) {
		return (signi.power <= 0);
	},this);
	if (!signis.length) Callback.immediately();
	return Callback.immediately().callback(this,function () {
		this.pushEffectSource(null);
		if (this.trashWhenPowerBelowZero) {
			return this.trashCards(signis);
		}
		return this.banishCardsAsyn(signis,true);
	}).callback(this,function () {
		this.popEffectSource();
		return this.banishNonPositiveAsyn();
	});
};

Game.prototype.rebuildAsyn = function () {
	var players = [this.turnPlayer,this.turnPlayer.opponent].filter(function (player) {
		return !player.mainDeck.cards.length && player.trashZone.cards.length;
	},this);
	if (!players.length) return Callback.immediately();
	return this.blockAsyn(this,function () {
		// console.log('game.rebuildAsyn()');
		// 将废弃区的卡片放到牌组,洗切
		this.frameStart();
		return Callback.forEach(players,function (player) {
			var cards = player.trashZone.cards;
			return player.showCardsAsyn(cards,'CONFIRM_REFRESH_SELF').callback(this,function () {
				return player.opponent.showCardsAsyn(cards,'CONFIRM_REFRESH_OPPONENT');
			}).callback(this,function () {
				player.rebuildCount++;
				this.moveCards(player.trashZone.cards,player.mainDeck);
				player.shuffle();
				player.onRebuild.trigger({
					rebuildCount: player.rebuildCount
				});
			});
		},this).callback(this,function () {
			this.frameEnd();
			// 废弃一张生命护甲
			var cards = [];
			players.forEach(function (player) {
				cards = cards.concat(player.lifeClothZone.getTopCards(1));
			},this);
			this.trashCards(cards);
		});
		// this.frame(this,function () {
		// 	players.forEach(function (player) {
		// 		player.rebuildCount++;
		// 		this.moveCards(player.trashZone.cards,player.mainDeck);
		// 		player.shuffle();
		// 		player.onRebuild.trigger({
		// 			rebuildCount: player.rebuildCount
		// 		});
		// 	},this);
		// });
		// // 废弃一张生命护甲
		// var cards = [];
		// players.forEach(function (player) {
		// 	cards = cards.concat(player.lifeClothZone.getTopCards(1));
		// },this);
		// this.trashCards(cards);
	});
};


Game.prototype.setAdd = function (source,obj,prop,value,isSet,arg) {
	if (!arg) arg = {};
	if (!arg.forced) {
		if (obj.isEffectFiltered && obj.isEffectFiltered(source)) return;
		var card = null;
		if (obj.player && inArr(prop,Card.abilityProps)) {
			card = obj;
		} else if (isObj(value) && (value.constructor === Effect)) {
			card = value.source;
			if (card.isEffectFiltered(source)) return;
		}
		if (card) {
			if (card.canNotGainAbility || card.player.canNotGainAbility) return;
			if (card.canNotGainAbilityBySelfPlayer) {
				if (source.player === card.player) {
					return;
				}
			}
		}
	}
	var destroyTimming = [this.phase.onTurnEnd];
	if (obj.type === 'SIGNI') {
		if (inArr(obj,obj.player.signis)) {
			destroyTimming.push(obj.onLeaveField);
		}
	}
	this.frameStart();
	this.addConstEffect({
		source: source,
		fixed: true,
		destroyTimming: destroyTimming,
		action: function (set,add) {
			var target = obj;
			if (obj.type === 'LRIG') {
				target = obj.player.lrig;
			}
			if (isSet) {
				set(target,prop,value,arg);
			} else {
				add(target,prop,value,arg);
			}
		}
	});
	if (obj.triggerOnAffect) {
		obj.triggerOnAffect(source);
	}
	this.frameEnd();
};
Game.prototype.tillTurnEndSet = function (source,obj,prop,value,arg) {
	this.setAdd(source,obj,prop,value,true,arg);
};
Game.prototype.tillTurnEndAdd = function (source,obj,prop,value,arg) {
	this.setAdd(source,obj,prop,value,false,arg);
};
Game.prototype.getData = function (obj,key) {
	var hash = obj.gid + key;
	return this.dataObj[hash];
};
Game.prototype.setData = function (obj,key,value) {
	var hash = obj.gid + key;
	this.dataObj[hash] = value;
};
Game.prototype.clearData = function () {
	this.dataObj = {};
};

Game.prototype.getOriginalValue = function (obj,prop) {
	return this.constEffectManager.getOriginalValue(obj,prop);
};

Game.prototype.gameover = function (arg) {
	if (!arg) arg = {};
	var win,surrender;
	if (arg.surrender === 'host') {
		surrender = true;
		win = false;
	} else if (arg.surrender === 'guest') {
		surrender = true;
		win = true;
	} else {
		surrender = false;
		win = (this.winner === this.hostPlayer);
	}
	if (!this.hostPlayer.lrig || !this.guestPlayer.lrig) {
		this.onGameover(null);
		return;
	}
	var replayObj = {
		win: win,
		surrender: surrender,
		selfLrig: this.hostPlayer.lrig.cid,
		opponentLrig: this.guestPlayer.lrig.cid,
		messagePacks: this.hostPlayer.messagePacks
	};
	this.onGameover(replayObj);
};

Game.prototype.getLiveMessagePacks = function () {
	return this.hostPlayer.messagePacks;
};

Game.prototype.getSubsets = function (arr) {
	var subsets = [];
	for (var i = 0; i < (1 << arr.length); i++) {
		subsets.push(arr.filter(function (item,idx) {
			return idx & i;
		}));
	}
	return subsets;
};

global.Game = Game;