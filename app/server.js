const WebSocketServer = require('websocket').server;
const OSC = require('osc-js');
const EXPRESS = require('express');

const app = EXPRESS();


//express html server (7000)

app.use(EXPRESS.static(__dirname + '/node_modules'));  
//app.use(EXPRESS.static(__dirname + '/assets'));
app.get('/', function(req, res,next) {  
    res.sendFile(__dirname + '/index.html');
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
const options = { send: { port: 7777 } }
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

var testOSC= new OSC();
testOSC.on('open', () =>{
  console.log ("Opened OSC client");
  testOSC.send(new OSC.Message('/load_xiz', 0, '/usr/local/share/zynaddsubfx/banks/Brass/0001-FM Thrumpet.xiz'), { port: 9912 })
});

testOSC.open({send: {port: 9912}});


