require('dotenv').load();

var minutes = 5;
var os = require('os');
var address = require('network-address');
var fs = require('fs');
var needle = require('needle')
var dateFromNum = require('date-from-num');
var sys = require('sys')
var exec = require('child_process').exec;
var path = require("path");
var Firebase = require("firebase");
var Pusher = require('pusher-client');
function puts(error, stdout, stderr) { sys.puts(stdout) }

exec('cd /var/lib/lamassu-machine && openssl x509 -noout -in client.pem -fingerprint',
  function (error, stdout, stderr) {
    global.fingerprint = stdout.replace("SHA1 Fingerprint=", "").trim().split(":").join("");
    
    if(process.env.custID != undefined)
    {
      //Query for the new .env file (API)
      var options = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        json: true
      }

      var body ={
        fingerprint: fingerprint,
        custID: process.env.custID
      }

      needle.post("https://"+process.env.url+"/api/first_time", body, options, function(err, resp){
        if (!err && resp.statusCode == 200) {
          var re_data = resp.body;
          var final_env = "";
          for(var attributename in re_data){
            final_env += attributename+"='"+re_data[attributename]+"'\n";
          }

          fs.renameSync(path.resolve(__dirname, '.env'),path.resolve(__dirname, '.env-old'))
          fs.writeFileSync(path.resolve(__dirname, '.env'),final_env);
        }
      });
    }
    else
    {
      global.pusher = new Pusher(process.env.KEY, {
        encrypted: true
      });

      start();
    }
  }
);



function send_stats_resources() {
  console.log("Sending data to server - " + dateFromNum(Date.now()));

  var myFirebaseRef = new Firebase("https://"+process.env.FIREBASE_DB+".firebaseio.com/");
  myFirebaseRef.child("atms").child(fingerprint).child(Date.now()).set({
    fingerprint: fingerprint,
    payload: {
      cpuLoad: os.loadavg()[1].toFixed(2),
      osUptime: (os.uptime() / 3600).toFixed(2) + 'h',
      memFree: (os.freemem() * 100 / os.totalmem()).toFixed(1) + '%',
      memUse: (process.memoryUsage().rss / Math.pow(1000, 2)).toFixed(1) + ' MB',
      network_address: address()
    }
  });
}

function send_logs() {
  var myFirebaseRef = new Firebase("https://"+process.env.FIREBASE_DB+".firebaseio.com/");
  var logs = fs.readFileSync('/var/log/upstart/lamassu-machine.log', 'utf8');
  myFirebaseRef.child("logs").child(fingerprint).set({
    fingerprint: fingerprint,
    payload: {
      log: logs
    }
  });
}

function check_for_commands(data) {
  console.log("Checking for commands - " + dateFromNum(Date.now()));

  var re_data = data;
  switch(re_data.command) {
    case 'restart-machine':
      // reboot machine
      console.log('Restarting Machine');
      exec('sudo reboot');
      break;
    case 'restart-lamassu-machine':
      // reboot lamassu-machine process
      console.log('Restarting lamassu-machine');
      exec('restart lamassu-machine');
      break;
    case 'update':
      // update code from githug repo
      console.log('Updating lamassu-machine');
      exec('cd /opt/apps/machine/lamassu-machine && git pull && reboot');
      break;
    case 'operation-hours':
      console.log("Setting hours of operation");
      set_hours_of_operation(re_data.open, re_data.close);
      break;
    }
}
function set_hours_of_operation(open, close) {
  var open_string;

  if(open > close)
    open_string = "today " + open + ":00";
  else
    open_string = "tomorrow " + open + ":00";

  var cron_job = "#!/bin/sh";
  cron_job += "@reboot " + path.resolve(__dirname, 'operating-hours.sh'));
  fs.writeFileSync('/etc/cron.daily/kontrol',cron_job);
  exec('sudo chmod +x ' + /etc/cron.daily/kontrol);

  var commands = "#!/bin/sh\n";
  commands += "sudo rtcwake -m no -l -t $(date +%s -d '" + open_string+"')\n";
  commands += "sudo shutdown -h " + close +":00"
  fs.writeFileSync(path.resolve(__dirname, 'operating-hours.sh'),commands);
  exec('sudo chmod +x ' + path.resolve(__dirname, 'operating-hours.sh'));
  exec('sudo bash ' + path.resolve(__dirname, 'operating-hours.sh'));
}

function start() {
  var channel = pusher.subscribe(fingerprint);
   channel.bind('commands', function(data) {
     check_for_commands(data);
   });

   setInterval(send_stats_resources, 60 * 1000);
   setInterval(send_logs, 300 * 1000);
}
