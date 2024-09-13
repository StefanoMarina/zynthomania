
const zconsole = ZynthoIO.zconsole;

const Osc = require('osc');
const KNOT = require ('./knot/knot.js');
const {registerOSC} = require('./osc.js');
const OSCWorker = require('./oscworker.js').OSCWorker;
const EventEmitter = require('events');

//Manages single value
class OSCProperty extends EventEmitter {
  constructor(server, property, defaultValue = 0) {
    this.property = property;
    this.defaultValue = this.value = defaultValue;
    this.value = undefined;
    this.server = server;
    
    server.on('osc', (oscMsg) => {
        if (oscMsg.address.endsWith(this.property)) {
          this.value = oscMsg.args[0].value;
          this.emit('change', oscMsg.address, oscMsg.args[0].value);
        }
        else if ( oscMsg.address == '/damage'
          && oscMsg.args[0].value == '/') {
            this.fetch();
        }
    });
  }
    
  async fetch() {
    let worker = new OSCWorker(this.server);
    worker.push(this.propertyPath);
    this.server.send(new KNOT.OSCParser().translate(this.path));
    await worker.listen();
  }
  
}

//Manages 16 values
class PartProperty {
  constructor (server, property) {
    this.property = property;
    this.defaultValue = this.value = defaultValue;
    this.rex = /part(\d+)/;
    this.values = Array(16).fill(null);
      
    server.on('osc', (oscMsg) => {
        if (oscMsg.address.endsWith(this.property)) {
          let partID = this.rex.exec(oscMsg.address);
            if (partID == null) return;
          try {
            partID = parseInt(partID[1]);
          } catch (err) {
            zconsole.error(`PartProperty: invalid  message ${oscMsg.address}`);
            return;
          }
          
          this.values[partID] = oscMsg.args[0].value;
          this.emit('change', oscMsg.address, oscMsg.args[0].value, partID);
        }
        else if ( oscMsg.address == '/damage' ) {
          this.fetch();
        }
    });
  }
  
  async fetch() {
    let paths = Array(16);
    for (let i = 0; i < 16; i++)
      paths[i] = `/part{i}/${this.property}`;
    
    let worker = new OSCWorker(this.server);
    let packet = new KNOT.OSCParser().translateLines(paths);
    worker.pushPacket(packet);
    this.server.send(packet);
    await worker.listen();
  }
}
