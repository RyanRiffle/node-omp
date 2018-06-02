const OMP = require('./src/omp');

var omp = new OMP({
	username: 'admin',
	password: 'Retribution4god'
});

var status = omp.connect();
status.then((result) => {
	console.log("Connected to OMP server.");
	var login = omp.login();
	login.then((user) => {
		console.log(user);
	});

	var create = omp.createTarget({
		name: 'Test Target3',
		hosts: '192.168.1.0/24',
		comment: 'This is only a test target',
		excludeHosts: '192.168.1.255',
		aliveTests: 'ICMP Ping',
		ports: '1-1024'
	});

	create.then((success) => {
		console.dir(success, {colors: true});
	}, (err) => {
		console.error(err);
	});

}, (err) => {
	console.log(err);
});
