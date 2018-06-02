const OMP = require('./src/omp');
const fs = require('fs');

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

}, (err) => {
	console.log(err);
});
