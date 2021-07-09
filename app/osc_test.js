const BodyParser = require('body-parser');
const OSC = require('osc');
const EXPRESS = require('express');
const Fs = require('fs');
const Util = require ('util');


//OSC bridge 9912 - 7777 (synth))
var osc = new OSC.UDPPort({
    localAddress: "127.0.0.1",
    localPort: 6666,

    remoteAddress: "127.0.0.1",
    remotePort: 7777,
    metadata: true
});


osc.open();

osc.on('ready', () => {
  console.log ("Opened OSC Server");
})

osc.on("message", function (oscMsg) {
    console.log("An OSC message just arrived!", oscMsg);
});
