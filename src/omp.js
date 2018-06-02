'use strict';
const tls = require('tls');
const jsonxml = require('jsontoxml');
const xmlParser = require('xml2json');

function createResponsePromise(handler, resolve, reject)
{
	return {
		handler: handler,
		resolve: resolve,
		reject: reject
	};
}

/*
 * class OMP
 * see http://docs.greenbone.net/API/OMP/omp-6.0.html#command_create_target
 * for more information
 */
class OMP {
	constructor(opt) {
		this.socket = null;
		this.username = opt.username || null;
		this.password = opt.password || null;
		this.host = opt.host || "127.0.0.1";
		this.port = opt.port || 9390;
		this.errorStr = null;
		this.commandQueue = [];
		this.responseHandlerQueue = [];
		this.sending = false;
		this.user = {
			role: '',
			timezone: '',
			severity: '',
			loggedIn: false
		};
	}

	connect(host, port) {
		host = host || this.host;
		port = port || this.port;

		if (host == null || port == null) {
			this.errorStr = "Provided invalid host or port for connection"
			return false;
		}


		return new Promise((resolve, reject) => {
			this.socket = tls.connect({
				host: host,
				port: port,
				rejectUnauthorized: false
			}, () => {
				this.socket.setEncoding('utf8');
				this.socket.on('data', this._onResponse.bind(this));
				this.socket.on('close', this._onclose.bind(this));
				resolve(this.socket.authorized);
			});
		});
	}

	login(username, password) {
		username = username || this.username;
		password = password || this.password;

		var xml = jsonxml({
			authenticate: {
				credentials: [
					{name: 'username', text: username},
					{name: 'password', text: password}
				]
			}
		});

		return new Promise((resolve, reject) => {
			this.sendCommand(xml,
				createResponsePromise(this._handleLogin, resolve, reject));
		});
	}

	getAllTargets() {
		return new Promise((resolve, reject) => {
			this.sendCommand("<get_targets/>",
				createResponsePromise(this._handleGetTargets, resolve, reject));
		});
	}

	getTarget(targetId) {
		var xml = '<get_targets target_id="'+targetId+'"/>';

		return new Promise((resolve, reject) => {
			this.sendCommand(xml,
				createResponsePromise(this._handleGetTargets, resolve, reject));
		});
	}

	/*
     * createTarget(opts)
     *
     * opts:
     * 	!name: String
     *	comment: String
     *	hosts: String
     *	excludeHosts: String
     *	sshCredentials: {
	 *		!id: Id
	 *		ports: String
     *	}
     *	smbCredentials: id
     *	esxiCredentials: id
     *	aliveTests: String
     *	reverseLookupOnly: Boolean
     *	reverseLookupUnify: Boolean
     *	ports: String
     *	portList: id
	 */
	createTarget(opts) {
		if (!opts.name)
			throw new Error('`name` is a required option');

		if (!opts.hosts)
			opts.hosts = '';

		return new Promise((resolve, reject) => {
			var json = {
				create_target: [
					{name: 'name', text: opts.name},
					{name: 'hosts', text: opts.hosts}
				]
			};

			if (opts.comment) {
				json.create_target.push({
					name: 'comment',
					text: opts.comment
				});
			}

			if (opts.excludeHosts) {
				json.create_target.push({
					name: 'exclude_hosts',
					text: opts.excludeHosts
				});
			}

			if (opts.sshCredentials) {
				var creds = {
					name: 'ssh_lsc_credential',
					children: [
						{name: 'id', text: opts.sshCredentials.id}
					]
				};

				if (opts.sshCredentials.ports) {
					creds.children.push({
						name: 'ports',
						text: opts.sshCredentials.ports
					});
				}

				json.create_target.push(creds);
			}

			if (opts.smbCredentials) {
				json.create_target.push({
					name: 'smb_lsc_credential',
					text: opts.smbCredentials
				});
			}

			if (opts.esxiCredentials) {
				json.create_target.push({
					name: 'esxi_lsc_credential',
					text: opts.esxiCredentials
				});
			}

			if (opts.aliveTests) {
				json.create_target.push({
					name: 'alive_tests',
					text: opts.aliveTests
				});
			}

			if (opts.reverseLookupOnly) {
				json.create_target.push({
					name: 'reverse_lookup_only',
					text: opts.reverseLookupOnly
				});
			}

			if (opts.reverseLookupUnify) {
				json.create_target.push({
					name: 'reverse_lookup_unify',
					text: opts.reverseLookupUnify
				});
			}

			if (opts.ports) {
				json.create_target.push({
					name: 'port_range',
					text: opts.ports
				});
			}

			if (opts.portList) {
				json.create_target.push({
					name: 'port_list',
					text: opts.portList
				});
			}

			var xml = jsonxml(json);
			console.log(xml);
			this.sendCommand(xml,
				createResponsePromise(this._handleCreateTarget, resolve, reject));
		});
	}

	sendCommand(cmd, res) {
		this.commandQueue.push(cmd);
		this.responseHandlerQueue.push(res);
		this._sendCommand();
	}

	_handleLogin(res, resolve, reject) {
		if (res.authenticate_response.status == '200') {
			this.user.loggedIn = true;
			this.user.severity = res.authenticate_response.severity;
			this.user.timezone = res.authenticate_response.timezone;
			this.user.role = res.authenticate_response.role;
			return resolve(this.user);
		}

		return reject(res.authenticate_response.status_text);
	}

	_handleGetTargets(res, resolve, reject) {
		var targets_res = res.get_targets_response;
		if (targets_res.status === '200') {
			return resolve({
				targets: targets_res.target,
				filters: targets_res.filters,
				targetCount: targets_res.target_count
			});
		}

		return reject(targets_res.status_text);
	}

	_handleCreateTarget(res, resolve, reject) {
		var res = res.create_target_response;
		if (res.status === '201') {
			return resolve(res);
		}

		return reject(res.status_text);
	}

	_sendCommand() {
		if (this.sending)
			return;

		if (this.commandQueue.length == 0)
			return;

		var cmd = this.commandQueue.shift();
		this.sending = true;
		this.socket.write(cmd);
	}

	_onResponse(data) {
		try {
			var resHandler = this.responseHandlerQueue.shift();
			var json = JSON.parse(xmlParser.toJson(data));
			console.dir(json, {colors: true});
			resHandler.handler.apply(this, [json, resHandler.resolve, resHandler.reject]);
		} catch(err) {
			console.log(data.toString());
			console.error(err);
		}

		this.sending = false;
		this._sendCommand();
	}

	_onclose() {
		console.log("Connection closed by remote host");
	}
}

module.exports = OMP;
