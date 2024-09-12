
const ZynthoIO = require('./io.js');
const zconsole = ZynthoIO.zconsole;

const Osc = require('osc');
const KNOT = require ('./knot/knot.js');
const ZynthoMidi = require ('./midi.js');
const {registerOSC} = require('./osc.js');
const OSCFile = require('./oscfile.js');
const OSCWorker = require('./oscworker.js').OSCWorker;


class OSCProperty {
  constructor(server, path, defaultValue = 0) {
    this.path = path;
    this.defaultValue = this.value = defaultValue;
    
    server.on(path, (addr, arg) => {
        this.value = arg[0].value
    });
    server.on('damage', (addr, arg) => {
      this.value = this.defaultValue;
    });
  }
    
  sync() {
    let worker = new OSCWorker(this.server);
    worker.push(path);
    this.server.send(this.path);
    return worker.listen();
  }
}

class PartProperty {
  constructor (server, property, defaultValues) {
    this.defaultValues = defaultValues;
    this.rex = /part(\d)/;
    this.paths = [];
    
    for (let i = 0; i < 16; i++)
      this.paths.push(`/part${i}/${property}`);
    
    server.on('osc', (oscMsg) => {
      let id = this.paths.indexOf(oscMsg.address);
      if ( id == -1) return;
      
    });
  }
}


class OSCMultiProperty {
  constructor ( server, paths, regex, defaultValues) {
    this.regex  = regex;
    this.paths = paths;
    
  }
}
