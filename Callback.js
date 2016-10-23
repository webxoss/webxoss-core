'use strict';

/**
 * 创建一个Callback对象.
 * @class
 * @example
 *  使用Callback实现的计时器:
 *  function wait (t) {
 *  	return new Callback(function (callback) {
 *  		setTimeout(callback,t*1000);
 *  	});
 *  }
 * @param {Callback~executor} fn - 用于初始化Callback对象的执行函数.
 */

/**
 * 执行函数.
 * @callback Callback~executor
 * @param {function} 操作完成声明函数,该函数被调用后,
 *  由此执行函数创建的Callback对象的状态将变为`Done`,
 *  其回调函数队列将被调用,参数将传入第一个回调函数.
 */
function Callback (fn) {
	/** 
	 * 回调函数队列.
	 * @private {function[]}
	 */
	this._callbacks = [];

	/** 
	 * 回调函数的上下文对象队列.
	 * @private {Object[]}
	 */
	this._thisArray = [];

	/** 
	 * Callback的状态.
	 * `_done` 为false时表示该Callback处于pending状态.
	 * `_done` 为true时表示该Callback处于done状态.
	 * @private {boolean}
	 */
	this._done = false;

	/** 
	 * 调用首个回调函数时的参数.
	 * @private
	 */
	this._arg = [];

	fn(this._handleCallbacks.bind(this));
}

/**
 * 创建一个永远处于pending状态的Callback.
 * @returns {Callback} 永远处于pending状态的Callback.
 */
Callback.never = function () {
	return new Callback(function () {});
};

/**
 * 创建一个立即回调的Callback.
 * 通常用于同步操作和异步操作混合的场合,提供语法糖功能.
 * @returns {Callback} 立即回调的Callback,调用参数会传递到回调函数.
 */
Callback.immediately = function () {
	var arg = arguments;
	return new Callback(function (callback) {
		callback.apply(this,arg);
	});
};


/**
 * 异步的循环`forEach`,语法类似于`Array.prototype.forEach`.
 * @example
 *  `arr`为一个数据数组,`doSomethingAsynWith`是一个返回Callback对象的异步处理函数.
 *  现在要遍历`arr`,对每一个元素执行异步处理:
 *  Callback.forEach(arr,function (item,index,arr) {
 *  	return doSomethingAsynWith(item);
 *  },this).callback(this,function () {
 *  	// all done;
 *  });
 * @returns {Callback}.
 */
Callback.forEach = function (arr,fn,thisp) {
	return arr.reduce(function (chain,item,i,array) {
		return chain.callback(thisp,fn.bind(thisp,item,i,array));
	},Callback.immediately());
};

/**
 * 异步的循环`for`.
 * @example
 *  `doSomethingAsyn`是一个返回Callback对象的异步处理函数.
 *  现在循环执行10次`doSomethingAsyn`:
 *  Callback.for(this,1,10,function (i) {
 *  	return doSomethingAsyn(i);
 *  },this).callback(this,function () {
 *  	// all done;
 *  });
 * @returns {Callback}.
 */
Callback.for = function (thisp,min,max,fn) {
	var chain = Callback.immediately();
	for (var i = min; i <= max; i++) {
		chain.callback(thisp,fn.bind(thisp,i));
	}
	return chain;
};

/**
 * 异步的循环`loop`.
 * @example
 *  `doSomethingAsyn`是一个返回Callback对象的异步处理函数.
 *  现在循环执行10次`doSomethingAsyn`:
 *  Callback.loop(this,10,function () {
 *  	return doSomethingAsyn();
 *  },this).callback(this,function () {
 *  	// all done;
 *  });
 * @returns {Callback}.
 */
Callback.loop = function (thisp,n,fn) {
	var chain = Callback.immediately();
	while (n--) {
		chain.callback(thisp,fn.bind(thisp));
	}
	return chain;
}

/**
 * 处理回调函数队列. 该方法总是在Callback对象的状态变为done时调用.
 * @private
 */
Callback.prototype._handleCallbacks = function () {
	this._done = true;
	if (this._callbacks.length) {
		var callback = this._callbacks.shift();
		var thisp = this._thisArray.shift();
		var returnValue = callback.apply(thisp,arguments);
		if (isObj(returnValue) && isFunc(returnValue.callback)) {
			this._done = false;
			returnValue.callback(this,this._handleCallbacks);
		} else {
			this._handleCallbacks(returnValue);
		}
	} else {
		this._arg = arguments;
	}
};


/**
 * 向Callback对象添加回调函数. 可以链式调用.
 * @public
 * @param thisp - 绑定的上下文对象.
 * @param {function} func - 回调函数.
 *  回调函数的返回值为Callback对象时,其后续的回调函数会在Callback的状态变为done时才执行,
 *  否则该回调函数执行后,后续的回调函数立即执行,并把返回值作为参数传入.
 */
Callback.prototype.callback = function (thisp,func) {
	if (arguments.length !== 2) {
		debugger;
		console.warn('thisp is not specified!');
		func = thisp;
		thisp = this;
	}
	this._thisArray.push(thisp);
	this._callbacks.push(func);
	if (this._done) this._handleCallbacks.apply(this,this._arg);
	return this;
};

global.Callback = Callback;