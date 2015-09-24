#!/bin/sh
if [ "$(whoami)" != "root" ]; then
	echo "You must be root to execute this setup script"
	exit 1
fi

npm install

echo "#!/bin/sh" > lamassu-kontrol.sh
echo "echo \"Kontrol began \$(date)\" >> $PWD/kontrol.log" >> lamassu-kontrol.sh
echo "node $PWD/kontrol.js" >> lamassu-kontrol.sh
chmod +x lamassu-kontrol.sh

echo "start on startup" > /etc/init/lamassu-kontrol.conf
echo "task" >> /etc/init/lamassu-kontrol.conf
echo "exec bash $PWD/lamassu-kontrol.sh" >> /etc/init/lamassu-kontrol.conf

node kontrol.js

reboot
