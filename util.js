'use strict';
global.concat = Array.prototype.concat.bind([]);
global.toArr = function (obj) {
	if (!obj) return [];
	if (typeof obj === 'string') return [];
	return Array.prototype.slice.call(obj,0);
};
global.isArr = Array.isArray;
global.inArr = function (item,arr) {
	return (toArr(arr).indexOf(item) != -1);
};
global.removeFromArr = function (item,arr) {
	var idx = arr.indexOf(item);
	if (idx < 0) {
		return false;
	} else {
		arr.splice(idx,1);
		return true;
	}
}
global.isStr = function (v) {
	return (typeof v === 'string');
};
global.isObj = function (v) {
	return v && (typeof v === 'object') && !isArr(v);
};
global.isNum = function (v) {
	return (typeof v === 'number');
};
global.isFunc = function (v) {
	return (typeof v === 'function');
};

// function nextTick (callback) {
// 	setTimeout(callback,0);
// }

global.renameProperty = function (obj, oldName, newName) {
	if (!obj.hasOwnProperty(oldName) || obj.hasOwnProperty(newName)) {
		return false;
	} else if (oldName === newName) {
		return true;
	}
	obj[newName] = obj[oldName];
	delete obj[oldName];
};