'use strict';

function Zone (game,player,name,args,pids) {
	args = args.split(' ');

	// 引用
	this.game   = game;
	this.player = player;

	// 基本属性
	this.name      = name;
	this.checkable = inArr('checkable',args); // 表示该区域,玩家可以查看里侧的牌.
	this.up        = inArr('up',args);        // 表示该区域,卡片默认竖置.
	this.faceup    = inArr('faceup',args);    // 表示该区域,卡片默认正面朝上.
	this.bottom    = inArr('bottom',args);    // 表示该区域,卡片放入的时候,默认放进底部.
	this.inhand    = inArr('inhand',args);    // 表示该区域,卡片是拿在玩家手里的,这意味着:
	                                          //   1. 该区域的卡,在游戏逻辑中,是里侧表示的,
	                                          //      而在UI中,对己方玩家是表侧表示的.
	                                          //   2. 该区域的卡,玩家可以随时洗切.

	// 注册
	game.register(this);

	// 卡片
	this.cards = [];
	if (isArr(pids)) {
		pids.forEach(function (pid) {
			var card = new Card(game,player,this,pid);
			this.cards.push(card);
			if (card.sideA) this.cards.push(card.sideA);
			if (card.sideB) this.cards.push(card.sideB);
		},this);
	}

	// 附加的属性
	this.disabled = false; // <ワーム・ホール>
	this.powerDown = false; // <黒幻蟲　サソリス>
	this.virus = false;
	this.trap = null;
}

Zone.prototype.getTopCards = function (n) {
	// var cards = [];
	// for (var i = 0; i < n; i++) {
	// 	var card = this.cards[i];
	// 	if (!card) break;
	// 	cards.push(card);
	// }
	// return cards;
	return this.cards.slice(0,n);
};

// SIGNI 区中,魅饰卡及其它下方的卡在块结束时送至废弃区,
// 该函数返回区域中除了这些卡的卡.
Zone.prototype.getActualCards = function () {
	return this.cards.filter(function (card) {
		return !inArr(card,this.game.trashingCharms) &&
		       !inArr(card,this.game.trashingCards);
	},this);
};

Zone.prototype.moveCardsToTop = function (cards) {
	cards = cards.filter(function (card) {
		return inArr(card,this.cards);
	},this);
	cards.forEach(function (card) {
		removeFromArr(card,this.cards);
	},this);
	this.cards.unshift.apply(this.cards,cards);
};

Zone.prototype.moveCardsToBottom = function (cards) {
	cards = cards.filter(function (card) {
		return inArr(card,this.cards);
	},this);
	cards.forEach(function (card) {
		removeFromArr(card,this.cards);
	},this);
	this.cards.push.apply(this.cards,cards);
};

Zone.prototype.getStates = function () {
	var states = [];
	if (this.powerDown) states.push('powerDown');
	if (this.disabled) states.push('disabled');
	if (this.virus) states.push('infected');
	return states;
};


global.Zone = Zone;