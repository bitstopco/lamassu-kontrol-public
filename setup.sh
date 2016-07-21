#!/bin/sh
if [ "$(whoami)" != "root" ]; then
	echo "You must be root to execute this setup script"
	exit 1
fi

npm install
node kontrol.js

npm install -g forever
npm install -g forever-service
forever-service install test --script kontrol.js