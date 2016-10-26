var monitor = require('pomelo-monitor');
var logger = require('pomelo-logger').getLogger('pomelo-admin', __filename);

var DEFAULT_INTERVAL = 5 * 60;		// in second
var DEFAULT_DELAY = 10;						// in second

module.exports = function(opts) {
	return new Module(opts);
};

module.exports.moduleId = 'systemInfo';

var Module = function(opts) {
	opts = opts || {};
	this.type = opts.type || 'pull';
	this.interval = opts.interval || DEFAULT_INTERVAL;
	this.delay = opts.delay || DEFAULT_DELAY;
};

// 如果请求来于Monitor，则通过Component来实现自身的功能（收集数据）
Module.prototype.monitorHandler = function(agent, msg, cb) {
	// collect data
	monitor.sysmonitor.getSysInfo(function (err, data) {
		agent.notify(module.exports.moduleId, {serverId: agent.id, body: data});
	});
};

// 如果请求来于Master, 则发送自己缓存的数据
Module.prototype.masterHandler = function(agent, msg) {
	if(!msg) {
		agent.notifyAll(module.exports.moduleId);
		return;
	}

	var body = msg.body;

	var oneData = {
		Time:body.iostat.date,
		hostname:body.hostname,
		serverId:msg.serverId,
		cpu_user:body.iostat.cpu.cpu_user,
		cpu_nice:body.iostat.cpu.cpu_nice,
		cpu_system:body.iostat.cpu.cpu_system,
		cpu_iowait:body.iostat.cpu.cpu_iowait,
		cpu_steal:body.iostat.cpu.cpu_steal,
		cpu_idle:body.iostat.cpu.cpu_idle,
		tps:body.iostat.disk.tps,
		kb_read:body.iostat.disk.kb_read,
		kb_wrtn:body.iostat.disk.kb_wrtn,
		kb_read_per:body.iostat.disk.kb_read_per,
		kb_wrtn_per:body.iostat.disk.kb_wrtn_per,
		totalmem:body.totalmem,
		freemem:body.freemem,
		'free/total':(body.freemem/body.totalmem),
		m_1:body.loadavg[0],
		m_5:body.loadavg[1],
		m_15:body.loadavg[2]
	};

	// 提取数据并发送
	var data = agent.get(module.exports.moduleId);
	if(!data) {
		data = {};
		agent.set(module.exports.moduleId, data);
	}

	data[msg.serverId] = oneData;
};

Module.prototype.clientHandler = function(agent, msg, cb) {
	cb(null, agent.get(module.exports.moduleId) || {});
};
