/*!
 * Pomelo -- commandLine Client
 * Copyright(c) 2012 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */

var protocol = require('../util/protocol');
var io = require('socket.io-client');
var utils = require('../util/utils');

var Client = function(opt) {
	this.id = "";
	this.reqId = 1;
	this.callbacks = {};
	this.listeners = {};
	this.state = Client.ST_INITED;
	this.socket = null;
	opt = opt || {};
	this.username = opt['username'] || "";
	this.password = opt['password'] || "";
	this.md5 = opt['md5'] || false;
};

Client.prototype = {
	connect: function(id, host, port, cb) { // 这个connect其实还是可细分为很多子步骤的，全部完成后才会择机执行cb
		this.id = id;
		var self = this;

		console.log('try to connect ' + host + ':' + port);

        // 构建并配置socket
		this.socket = io.connect('http://' + host + ':' + port, {
			'force new connection': true,
			'reconnect': false
		});

        // 连接并注册
		this.socket.on('connect', function() {
			self.state = Client.ST_CONNECTED;
			if(self.md5){
				self.password = utils.md5(self.password);
			}

			// 连接之后立刻发送“注册”消息
			self.socket.emit('register', {
				type: "client",
				id: id,
				username: self.username,
				password: self.password,
				md5: self.md5
			});
		});

		// 收到“注册”消息后重新标记自身状态
		this.socket.on('register', function(res) {
			if (res.code !== protocol.PRO_OK) {
				cb(res.msg);
				return;
			}

			self.state = Client.ST_REGISTERED;
			cb();
		});

        // 在收到消息后只有两种行为：1：根据respId执行cbk 2：触发消息
		this.socket.on('client', function(msg) {
			msg = protocol.parse(msg);
			if (msg.respId) {
				// response for request
				var cb = self.callbacks[msg.respId];
				delete self.callbacks[msg.respId];
				if (cb && typeof cb === 'function') {
					cb(msg.error, msg.body);
				}
			} else if (msg.moduleId) {
				// notify
				self.emit(msg.moduleId, msg);
			}
		});

		this.socket.on('error', function(err) {
			if (self.state < Client.ST_CONNECTED) {
				cb(err);
			}

			self.emit('error', err);
		});

		this.socket.on('disconnect', function(reason) {
			this.state = Client.ST_CLOSED;
			self.emit('close');
		});
	},

	// 发送请求（生成reqId，并暂时缓存cbk）
	request: function(moduleId, msg, cb) {
		var id = this.reqId++;
		// something dirty: attach current client id into msg
		msg = msg || {};
		msg.clientId = this.id;
		msg.username = this.username;
		var req = protocol.composeRequest(id, moduleId, msg);
		this.callbacks[id] = cb;
		this.socket.emit('client', req);
	},

	// 发送通告（不会成reqId，因为也没有cbk啊）
	notify: function(moduleId, msg) {
		// something dirty: attach current client id into msg
		msg = msg || {};
		msg.clientId = this.id;
		msg.username = this.username;
		var req = protocol.composeRequest(null, moduleId, msg);
		this.socket.emit('client', req);
	},

    // 发送命令
	command: function(command, moduleId, msg, cb) {
		var id = this.reqId++;
		msg = msg || {};
		msg.clientId = this.id;
		msg.username = this.username;
		var commandReq = protocol.composeCommand(id, command, moduleId, msg);
		this.callbacks[id] = cb;
		this.socket.emit('client', commandReq);
	},

    // 监听某个事件
	on: function(event, listener) {
		this.listeners[event] = this.listeners[event] || [];
		this.listeners[event].push(listener);
	},

    // 主动激发某事件
	emit: function(event) {
		var listeners = this.listeners[event];
		if (!listeners || !listeners.length) {
			return;
		}

		var args = Array.prototype.slice.call(arguments, 1);
		var listener;
		for (var i = 0, l = listeners.length; i < l; i++) {
			listener = listeners[i];
			if (typeof listener === 'function') {
				listener.apply(null, args);
			}
		}
	}
};

Client.ST_INITED = 1;
Client.ST_CONNECTED = 2;
Client.ST_REGISTERED = 3;
Client.ST_CLOSED = 4;

module.exports = Client;