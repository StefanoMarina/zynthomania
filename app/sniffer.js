const Fs = require('fs');
const EventEmitter = require('events');
const {execSync, exec} = require("child_process");

const ZynthoIO = require('./io.js');
const zconsole = ZynthoIO.zconsole;

const Osc = require('osc');



var oscPort = new osc.WebSocketPort({
    url: "ws://localhost:8081", // URL to your Web Socket server.
    metadata: true
});
