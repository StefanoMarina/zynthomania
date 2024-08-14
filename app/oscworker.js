/*********************************************************************
 * OSC message event worker
 * Copyright (C) 2021 Stefano Marina
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
***********************************************************************/

const EventEmitter = require('events');


/*
 * NOTE TO SELF:
 * ALTHOUGH WORKER is the default name for multiple handlers,
 * it is more like a listener.
 */
 
/**
 * OSCWorker creates a promise upon multiple osc requests.
 * It is an eventemitter on its own. when all OSC requests are fulfilled,
 * the promise created with listen() will be triggered.
 */
class OSCWorker extends EventEmitter {
  
  constructor(emitter) {
    super();
    if (emitter == undefined || emitter == null)
      throw 'OSCWorker initialized with undefined or null emitter';
      
    this.stack = [];
    this.emitter = emitter;
  }
  
  /**
   * creates a promise bound on the 'done' internal event
   * @param timeout (optional) a timeout in ms, after that the 'done' event
   * will be triggered no matter what. you should run this only if you are
   * not sure that a promise will be honored, i.e. with external OSC.
   * @returns a Promise that will be triggered when the last osc call
   * is made
   * @throws if called with an empty stack
   */
  listen(timeout) {
    if (this.stack.length == 0)
      throw "OscWorker required to listen with an empty stack";
    
    if (timeout !== undefined) {
      setTimeout(() =>{
        if (this.stack.length > 0) {
          this.emit('abort');
        }
      }, timeout);
    }
    
    return new Promise( (resolve,reject) => {
        this.once('done', resolve);
        if (timeout !== undefined)
          this.once('abort',reject);
    })
  }
  
  /**
   * adds an osc address to the stack. the address is bound through
   * .once() on the emitter, and it is then popped out from the osc stack.
   * When the stack gets empty, a 'done' message is sent internally to free
   * listen().
   * @param address address to be received
   * @param callback (optional) callback to resolve.
   */
  push(address, callback) {
    if (address === undefined)
      throw "OscWorker push request with undefined address";
    
    this.stack.push(address);
    this.emitter.once(address, (packet) => {
      
      if (callback !== undefined) {
        callback(address, (undefined !== packet.args) 
                            ? packet.args : packet);
      }
      
      this.stack.splice(this.stack.indexOf(address),1);
      
      if (this.stack.length==0) {
        this.emit('done');
      }
    });
  }
  
  /**
   * utility to push a packet/bundle
   * @param packet a OSC packet / bundle
   * @param callback callback to call
   */
  pushPacket(packet, callback) {
    let packets = (undefined === packet.packets)
      ? [packet] : packet.packets;
    
    packets.forEach( (pack) => {  
        this.push(pack.address, callback)
    } );
  }
}

module.exports.OSCWorker = OSCWorker;
