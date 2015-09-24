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

sed -i '1i sudo bash $PWD/lamassu-kontrol.sh' /etc/rc.local
sed -i '1i cd /etc/kontrol/lamassu-kontrol-public-master/' /etc/rc.local
sed -i '1i #!/bin/sh -e' /etc/rc.local

node kontrol.js

sudo reboot
