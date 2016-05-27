require('dotenv').load();

var minutes = 5;
var root_path = "/opt/apps/machine/lamassu-machine"

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
    global.fingerprint = stdout.replace("SHA1 Fingerprint=", "").trim();
    
    if(process.env.BITSTOP_TOKEN == undefined) {
      //Query for the new .env file (API)
      var options = {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        json: true
      }

      var body ={
        fingerprint: fingerprint
      }

      needle.post("https://"+process.env.url+"/api/first_time", body, options, function(err, resp){
        if (!err && resp.statusCode == 200) {
          var re_data = resp.body;
          var final_env = "";
          for(var attributename in re_data){
            final_env += attributename+"="+re_data[attributename]+"\n";
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



function send_stats_resources(fingerprint) {
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

function send_logs(fingerprint) {
  console.log("Sending logs to server - " + dateFromNum(Date.now()));

  var myFirebaseRef = new Firebase("https://"+process.env.FIREBASE_DB+".firebaseio.com/");
  var logs = fs.readFileSync('/var/log/upstart/lamassu-machine.log', 'utf8');
  myFirebaseRef.child("logs").child(fingerprint).set({
    fingerprint: fingerprint,
    timestamp: Date.now(),
    payload: {
      log: logs
    }
  });
}


function backup_lamassu_files(){
  try {
    fs.statSync('./backup')
    return false;
  }
  catch (e) {
    console.log("BACKUP STARTED")
    fs.mkdirSync('./backup')
    exec('cp -R ' + root_path + " " + './backup/lamassu-machine/', function(error, stdout, stderr){
      inject_lamassu_receipts()
    })
    return true;
  }
}

function restore_backup(){
  try{
    fs.statSync('./backup')
    console.log("RESTORE BACKUP")
    exec('cp -R ' + './backup/lamassu-machine/' + " " + root_path, function(error, stdout, stderr){
      exec('rm -r ./backup && reboot')
    })
  }
  catch (e) {
    console.log(e)
  }
}

function inject_code(src, target, match, before, replace){
  var injected_data = fs.readFileSync(src, 'utf8');
  var target_data = fs.readFileSync(target, 'utf8');

  console.log('INJECTING ' + src)
  if (replace){
    target_data = target_data.replace(match, injected_data)
  }
  else if (before) {
    target_data = target_data.replace(match, injected_data +  "\n" + match)
  } else {
    target_data = target_data.replace(match, match +  "\n" + injected_data)
  }

  fs.writeFileSync(target, target_data)
}

function inject_lamassu_receipts(){
  console.log("INSTALLING DEPENDENCIES")
  //Install files
  exec("cd " + root_path + " && npm install needle --save")
  exec("cd " + root_path + " && npm install dotenv --save")
  
  console.log("PUTTING ENV VARIABLES")
  //Dump env vars
  fs.writeFileSync(root_path + '.env', "BITSTOP_TOKEN=" + process.env.BITSTOP_TOKEN + "\n" + "FINGERPRINT=" +  process.env.FINGERPRINT);

  console.log("INJECTING CODE NOW")
  //Inject files
  inject_code('./partials/email_receipt/app.js.1', root_path + "ui/js/app.js", "var phoneKeypad = null", true, false)
  inject_code('./partials/email_receipt/app.js.2', root_path + "ui/js/app.js", "  wifiKeyboard = new Keyboard('wifi-keyboard').init()", false, false)
  inject_code('./partials/email_receipt/app.js.3', root_path + "ui/js/app.js", "  setupButton('initialize', 'initialize')", true, false)
  inject_code('./partials/email_receipt/app.js.4', root_path + "ui/js/app.js", "  var languageButtons = document.getElementById('languages')", true, false)
  inject_code('./partials/email_receipt/app.js.5', root_path + "ui/js/app.js", "  wifiKeyboard.reset()", false, false)

  inject_code('./partials/email_receipt/brain.js.1', root_path + "lib/brain.js", "var fs = require('fs')", true, false)
  inject_code('./partials/email_receipt/brain.js.2', root_path + "lib/brain.js", "      this._chooseFiat()", true, false)
  inject_code('./partials/email_receipt/brain.js.3', root_path + "lib/brain.js", "  this._startAddressScan()", true, true)
  inject_code('./partials/email_receipt/brain.js.4', root_path + "lib/brain.js", "  this._setState('completed')", false, false)

  inject_code('./partials/email_receipt/start.html.1', root_path + "ui/start.html", '      <section class="viewport idle_state" data-tr-section="idle">', true, false)
  exec('reboot')
}

function check_for_commands(data) {
  console.log("Checking for commands - " + dateFromNum(Date.now()));

  var re_data = data;
  switch(re_data.command){
    case 'inject_email_receipt':
      //Backup lamassu files
      //Email receipts injection
      console.log("BEGIN CODE INJECTION ATTEMPT")
      backup_lamassu_files()
      break;
    case 'undo_inject_email_receipt':
      restore_backup()
      break;
    }
}

function start() {
  var channel = pusher.subscribe(fingerprint.split(":").join(""));
   channel.bind('commands', function(data) {
     check_for_commands(data);
   });

  send_stats_resources(fingerprint);
  send_logs(fingerprint);
  setInterval(send_stats_resources, 60 * 1000, fingerprint);
  setInterval(send_logs, 300 * 1000, fingerprint);
}