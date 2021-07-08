const BodyParser = require('body-parser');
const OSC = require('osc-js');
const EXPRESS = require('express');
const Fs = require('fs');
const Util = require ('util');


//OSC bridge 9912 - 7777 (synth))
const options = { send: { port: 7777 } }
const osc = new OSC({ plugin: new OSC.DatagramPlugin(options) })

osc.on('open', () => {
  console.log ("Opened OSC Server");
  console.log ("Testing message...");
  
  osc.send(new OSC.Message('/sysefx[0]/self-enabled'), {port: 7777});
  osc.close();
})

osc.on('message', message => {
  //console.log("Message received.");
  console.log('received message :' + JSON.stringify(message));
})

osc.open({ port: 9912 }) // bind socket to localhost:9912
