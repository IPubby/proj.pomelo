var fs = require('fs');
var consoleService = require('./lib/consoleService');

// 导出了三个对象所对应的三个工厂方法
module.exports.createMasterConsole = consoleService.createMasterConsole;
module.exports.createMonitorConsole = consoleService.createMonitorConsole;
module.exports.adminClient = require('./lib/client/client');

// 模组
exports.modules = {};

// 同步加载'/lib/modules'下的所有模块到modules
fs.readdirSync(__dirname + '/lib/modules').forEach(function(filename) {
	if (/\.js$/.test(filename)) {
		var name = filename.substr(0, filename.lastIndexOf('.'));
		var _module = require('./lib/modules/' + name);
		if (!_module.moduleError) {
			exports.modules.__defineGetter__(name, function() {
				return _module;
			});
		}
	}
});