const WebSocketServer = require('websocket').server;
const BodyParser = require('body-parser');
const OSC = require('osc-js');
const EXPRESS = require('express');
const fs = require('fs');
const Util = require ('util');

const DEFAULT_PATH="/usr/local/share/zynaddsubfx/banks/";
// Preferences >
var preferences = {};
console.log("Reading preferences...");
try {
  let data = fs.readFileSync('preferences.json', 'utf-8');
  preferences = JSON.parse(data);
  
} catch (err) {
  console.log(`Could not read preferences.json : ${err}`);
  preferences = { "user": "pi", "synth": { "port" : "7777" }, "custom_dir": "/home/pi/custom" }
}
// < Preferences


const app = EXPRESS();

//express html server (7000)
app.use(EXPRESS.static(__dirname + '/node_modules'));  
app.use(EXPRESS.static(__dirname + '/assets'));

app.use (BodyParser.json());
app.use (BodyParser.urlencoded({extended:false}));

app.get('/', function(req, res,next) {  
    res.sendFile(__dirname + '/index.html');
});

//get REST: list all banks
app.get('/getBanks', function (req, res, next) {
  console.log('called ::getBanks get');
    
  var bankList = ['Favorites', 'Custom'];
  var error = false;
  
  var files = fs.readdirSync (DEFAULT_PATH)
                .filter(function (file) {
                    return fs.statSync(DEFAULT_PATH+'/'+file).isDirectory();
                });
  
  files.forEach(file => { bankList.push(file); });
  res.json({status: error, result: bankList});
});

//get REST: list all patches
app.get('/getPatches', function (req, res, next) {
  console.log('called get ::getPatches');
  console.log(Util.inspect(req.query));
  
  
  //console.log(JSON.stringify(req.body));
  //console.log ('url: ' + req.url);
  

  
  //for (i in req.body) {console.log(i)}
  //console.log("bank: " + JSON.stringify(req));
});

app.post('/test', function (req, res, next) {
  console.log('post request');
  osc.send(new OSC.Message('/load_xiz', 0, '/usr/local/share/zynaddsubfx/banks/Brass/0001-FM Thrumpet.xiz'), { port: preferences.synth.port }) 
});

app.on('open', () => {
  console.log ("Opened web application");
});

app.on('data', (data) =>{
  console.log('data: ' + JSON.stringify(data));
});

const server = require('http').createServer(app);
server.listen(7000);


//Websocket
const wsocket = new WebSocketServer({httpServer:server});
wsocket.on('request', function(message) {
  const connection = request.accept(null, request.origin);
  connection.on('message', function(message) {
      console.log('Received Message:', message.utf8Data);
      //connection.sendUTF('Hi this is WebSocket server!');
    });
     connection.on('close', function(reasonCode, description) {
        console.log('Client has disconnected.');
    });
});

//OSC bridge 9912 - 7777 (synth))
const options = { send: { port: preferences.synth.port } }
const osc = new OSC({ plugin: new OSC.DatagramPlugin(options) })

osc.on('open', () => {
  console.log ("Opened OSC Server");
  // send only this message to `localhost:9002`
 // osc.send(new OSC.Message('/load_xiz', 0, '/usr/local/share/zynaddsubfx/banks/Brass/0001-FM Thrumpet.xiz'), { port: 7777 })
/*
  setInterval(() => {
     // send these messages to `localhost:11245`
     osc.send(new OSC.Message('/response', Math.random()))
  }, 1000)
  */
})


osc.on('*', message => {
  //console.log("Message received.");
  console.log('received message :' + JSON.stringify(message));
})

osc.open({ port: 9912 }) // bind socket to localhost:9912
