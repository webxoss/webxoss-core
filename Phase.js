'use strict';

function Phase (game) {
	// 引用
	this.game = game;

	// 快捷方式
	this.player = game.turnPlayer;
	this.opponent = game.turnPlayer.opponent;

	// 基本属性
	this.firstTurn = true;
	this.status = '';
	this.additionalTurn = false; // 是否是由于效果追加的回合

	// 注册
	game.register(this);

	// 时点
	this.onTurnStart = new Timming(game);
	this.onTurnEnd = new Timming(game);
}

// 游戏开始前的"setup"阶段:
//   1. 双方洗牌;
//   2. 双方选择等级0的LRIG背面放置到LRIG区;
//   3. 双方猜拳决定先手;
//   4. 双方抽5张卡;
//   5. 双方选择任意数量手牌放回,洗牌后,抽出相同张数的卡; (换手牌)
//   6. 双方从牌组最上方取7张卡放入生命护甲区;
//   7. 双方大喊"OPEN!!",并将LRIG翻至正面.
// 这之后进入先手玩家的竖置阶段.
Phase.prototype.setup = function () {
	this.player.shuffle();
	this.opponent.shuffle();

	this.game.blockStart();
	this.game.frameStart();

	this.player.setupLrigAsyn().callback(this,function () {
		return this.opponent.setupLrigAsyn();
	}).callback(this,function () {
		return this.game.decideFirstPlayerAsyn();
	}).callback(this,function (player) {
		this.game.turnPlayer = player;
		this.player = player;
		this.opponent = player.opponent;
		this.game.packOutputs(function () {
			this.player.setupHands();
			this.opponent.setupHands();
		},this);
		return this.player.redrawAsyn();
	}).callback(this,function () {
		return this.opponent.redrawAsyn();
	}).callback(this,function () {
		this.game.packOutputs(function () {
			this.player.setupLifeCloth();
			this.opponent.setupLifeCloth();
		},this);
		this.game.packOutputs(function () {
			this.player.open();
			this.opponent.open();
		},this);
		this.game.outputColor();
		this.game.frameEnd();
		return this.game.blockEndAsyn();
	}).callback(this,function () {
		this.upPhase();
	});
}

// 竖直阶段:
//   1. 回合玩家将其LRIG和全部SIGNI竖置.
// 这之后进入抽卡阶段.
Phase.prototype.upPhase = function () {
	this.status = 'upPhase';
	this.game.handleFrameEnd();
	this.game.blockStart();
	this.player.up();
	this.game.blockEndAsyn().callback(this,this.drawPhase);
};

// 抽卡阶段:
//   1. 回合玩家抽2张卡. (若该回合为先手第一回合,则抽1张)
// 这之后进入充能阶段.
Phase.prototype.drawPhase = function () {
	this.status = 'drawPhase';
	this.game.handleFrameEnd();
	this.game.blockStart();
	if (this.firstTurn) {
		this.player.draw(1);
	} else {
		this.player.draw(this.player.drawCount);
	}
	this.game.blockEndAsyn().callback(this,this.enerPhase);
};

// 充能阶段:
//   1. 回合玩家可以进行1次主动充能. (主动充能: 选择自己的一张手牌或场上的一只SIGNI,将其置于能量区)
// 这之后进入成长阶段.
Phase.prototype.enerPhase = function () {
	if (this.player.skipEnerPhase) {
		this.growPhase();
		return;
	}
	this.status = 'enerPhase';
	this.game.handleFrameEnd();
	this.player.chargeAsyn().callback(this,this.growPhase);
	this.player.endEnerPhaseAsyn().callback(this,this.growPhase);
};

// 成长阶段:
//   1. 回合玩家可以进行主动成长.
// 这之后进入主要阶段.
Phase.prototype.growPhase = function () {
	if (this.player.skipGrowPhase) {
		this.mainPhase();
		return;
	}
	this.status = 'growPhase';
	this.game.handleFrameEnd();
	return this.game.blockAsyn(this,function () {
		this.player.onGrowPhaseStart.trigger();
	}).callback(this,function () {
		this.player.growAsyn().callback(this,this.mainPhase);
		this.player.endGrowPhaseAsyn().callback(this,this.mainPhase);
	});
};

// 主要阶段:
//   回合玩家可以按任意顺序执行任意次以下行动:
//     * 召唤SIGNI;
//     * 废弃SIGNI;
//     * 使用魔法;
//     * 使用技艺;
//     * 使用起动效果.
// 这之后进入攻击阶段. (若该回合为先手第一回合,则逃过攻击阶段,直接进入结束阶段)
Phase.prototype.mainPhase = function () {
	this.status = 'mainPhase';
	this.game.handleFrameEnd();
	// 由于<白罗星　海王星>的效果,需要在进入主要阶段时重置 SIGNI .
	this.game.blockAsyn(this,function () {
		this.game.frameStart();
		return this.player.resetSignisAsyn().callback(this,function () {
			this.game.frameEnd();
		});
	}).callback(this,function () {
		return this.game.blockAsyn(this,function () {
			this.player.onMainPhaseStart.trigger();
		});
	}).callback(this,function () {
		function loop () {
			if (this.checkForcedEndTurn()) {
				this.endPhase();
				return;
			}
			this.player.summonSigniAsyn().callback(this,loop);
			this.player.summonResonaSigniAsyn().callback(this,loop);
			this.player.trashSigniAsyn().callback(this,loop);
			this.player.useSpellAsyn().callback(this,loop);
			this.player.useMainPhaseArtsAsyn().callback(this,loop);
			this.player.useActionEffectAsyn().callback(this,loop);
			this.player.endMainPhaseAsyn().callback(this,function () {
				if (this.firstTurn) {
					this.endPhase();
				} else {
					this.attackPhase();
				}
			});
		}
		loop.call(this);
	});
};

// 攻击阶段:
// 攻击阶段分为3个步骤:
//   1. 技艺使用步骤
//   2. SIGNI攻击步骤
//   3. LRIG攻击步骤
// WIXOSS官方规则有第四个步骤:防御步骤,
// 而这里,防御步骤归入LRIG攻击步骤.
Phase.prototype.attackPhase = function () {
	this.status = 'beforeArtsStep';
	return this.game.blockAsyn(this,function () {
		// <雪月風火　花代・肆>
		if (this.player.discardOnAttackPhase) {
			this.game.trashCards(this.player.hands);
			this.player.discardOnAttackPhase = false;
		}
		this.player.onAttackPhaseStart.trigger();
	}).callback(this,function () {
		this.artsStep();
	});
};

// 技艺使用步骤:
//   1. 回合玩家可以发动任意次[攻击阶段]的技艺;
//   2. 对方玩家可以发动任意次[攻击阶段]的技艺;
// 这之后进入SIGNI攻击步骤.
Phase.prototype.artsStep = function () {
	this.status = 'artsStep';
	this.game.handleFrameEnd();
	function playerLoop () {
		if (this.checkForcedEndTurn()) {
			this.endPhase();
			return;
		}
		this.player.useAttackPhaseArtsAsyn().callback(this,playerLoop);
		this.player.useAttackPhaseActionEffect().callback(this,playerLoop);
		this.player.summonResonaSigniAsyn().callback(this,playerLoop);
		this.player.endArtsStepAsyn().callback(this,opponentLoop);
	}
	function opponentLoop () {
		if (this.game.getData(this.game,'endAttackPhase')) {
			this.endPhase();
			return;
		}
		this.opponent.useAttackPhaseArtsAsyn().callback(this,opponentLoop);
		this.opponent.useAttackPhaseActionEffect().callback(this,opponentLoop);
		this.opponent.summonResonaSigniAsyn().callback(this,opponentLoop);
		this.opponent.endArtsStepAsyn().callback(this,this.signiAttackStep);
	}
	playerLoop.call(this);
};

// SIGNI攻击步骤:
//   1. 回合玩家可以执行任意次"SIGNI攻击". ("SIGNI攻击"的流程见 Player.js)
// 这之后进入LRIG攻击步骤.
Phase.prototype.signiAttackStep = function () {
	if (this.player.skipSigniAttackStep) {
		this.lrigAttackStep();
		return;
	}
	this.status = 'signiAttackStep';
	this.game.handleFrameEnd();
	function loop () {
		if (this.checkForcedEndTurn()) {
			this.endPhase();
			return;
		}
		this.player.signiAttackAsyn().callback(this,loop);
		this.player.endSigniAttackStepAsyn().callback(this,this.lrigAttackStep);
	}
	loop.call(this);
};

// LRIG攻击步骤:
//   1.回合玩家可以执行任意次"LRIG攻击". ("LRIG攻击"的流程见 Player.js)
// 这之后进入结束阶段.
Phase.prototype.lrigAttackStep = function () {
	if (this.player.skipLrigAttackStep) {
		this.endPhase();
		return;
	}
	this.status = 'lrigAttackStep';
	this.game.handleFrameEnd();
	function loop () {
		if (this.checkForcedEndTurn()) {
			this.endPhase();
			return;
		}
		this.player.lrigAttackAsyn().callback(this,loop);
		this.player.endLrigAttackStepAsyn().callback(this,this.endPhase);
	}
	loop.call(this);
};

// 结束阶段:
//   1. 回合玩家的手牌数多于6张的场合,回合玩家舍弃任意手牌至手牌数为6.
// 这之后交换回合. (wixoss)
Phase.prototype.endPhase = function () {
	this.status = 'endPhase';
	this.player.rebuildCount = 0;
	this.player.opponent.rebuildCount = 0;
	this.player.ignoreGrowCost = false;
	this.game.effectManager.triggeredEffects.length = 0; // 1回合1次的效果.
	this.game.handleFrameEnd();
	Callback.immediately().callback(this,function () {
		// 处理"回合结束时,把XXX放到废弃区" + "回合结束时,把XXX除外".
		// 同时触发"回合结束时"时点.
		var cards = concat(this.player.signis,this.player.opponent.signis).filter(function (signi) {
			if (signi.fieldData.trashWhenTurnEnd) {
				signi.fieldData.trashWhenTurnEnd = false;
				return true;
			}
		},this);
		var cards_exclude = concat(this.player.signis,this.player.opponent.signis).filter(function (signi) {
			if (signi.fieldData.excludeWhenTurnEnd) {
				signi.fieldData.excludeWhenTurnEnd = false;
				return true;
			}
		},this);
		[this.player,this.player.opponent].forEach(function (player) {
			if (player._trashLifeClothCount) {
				cards = cards.concat(player.lifeClothZone.getTopCards(player._trashLifeClothCount));
				player._trashLifeClothCount = 0;
			}
			if (this.game.getData(player,'trashAllHandsWhenTurnEnd')) {
				cards = cards.concat(player.hands);
			}
		},this);
		return this.game.blockAsyn(this,function () {
			// 注: 
			//     根据官方解释,"回合结束时"的触发时点,在弃牌之前,
			//     而常时效果的销毁在弃牌之后.
			//     这里用两个时点加以区分:
			//     player.onTurnEnd 指弃牌之后,
			//     player.onTurnEnd2 指弃牌之前.
			this.player.onTurnEnd2.trigger();
			this.game.trashCards(cards);
			this.game.excludeCards(cards_exclude);
		});
	}).callback(this,function () {
		// 弃牌
		var n = this.player.hands.length - 6;
		if (n > 0) {
			this.game.blockAsyn(this,function () {
				return this.player.discardAsyn(n);
			}).callback(this,function () {
				this.wixoss();
			});
		} else {
			this.wixoss();
		}
	});
};

// 交换回合
//   1. 触发"回合结束"时点;
//   2. 交换回合;
//   3. 触发"回合开始"时点.
// 这之后进入回合玩家的竖置阶段.
Phase.prototype.wixoss = function () {
	this.additionalTurn = !!this.game.getData(this.player,'additionalTurn');
	this.game.clearData();
	this.game.cards.forEach(function (card) {
		card.fieldTurnData = {}
	});
	this.status = '';
	this.player.usedActionEffects.length = 0;
	this.player.opponent.usedActionEffects.length = 0;
	this.player.chain = null;
	this.player.opponent.chain = null;
	this.player.attackCount = 0;
	this.player.opponent.attackCount = 0;
	this.firstTurn = false;

	this.game.blockAsyn(this,function () {
		this.game.frameStart();
		this.player.onTurnEnd.trigger();
		this.onTurnEnd.trigger({
			player: this.player
		});
		this.game.frameEnd();
	}).callback(this,function () {
		// 我方追加回合，跳过交换
		if (!this.additionalTurn) {
			// 对方回合被跳过，跳过交换
			if (this.opponent.skipNextTurn) {
				this.opponent.skipNextTurn = false;
			} else {
				var tmp = this.player;
				this.player = this.opponent;
				this.opponent = tmp;
			}
		}

		this.game.turnPlayer = this.player;

		this.game.frameStart();
		this.player.onTurnStart.trigger();
		this.onTurnStart.trigger({
			player: this.player
		});
		this.game.frameEnd();

		this.upPhase();
	});
};

Phase.prototype.isAttackPhase = function () {
	return inArr(this.status,['beforeArtsStep','artsStep','signiAttackStep','lrigAttackStep']);
};

Phase.prototype.checkForcedEndTurn = function () {
	if (this.player.rebuildCount > 1) return true;
	if (this.game.getData(this.game,'endThisTurn')) return true;
	return false;
};

global.Phase = Phase;