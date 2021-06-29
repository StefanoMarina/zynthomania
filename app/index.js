const OSC = require('osc-js')

const options = { send: { port: 7777 } }
const osc = new OSC({ plugin: new OSC.DatagramPlugin(options) })

osc.on('open', () => {
  console.log ("Opened");
  // send only this message to `localhost:9002`
  osc.send(new OSC.Message('/load_xiz', 0, '/usr/local/share/zynaddsubfx/banks/Brass/0001-FM Thrumpet.xiz'), { port: 7777 })

  setInterval(() => {
     // send these messages to `localhost:11245`
     osc.send(new OSC.Message('/response', Math.random()))
  }, 1000)
})

osc.open({ port: 9912 }) // bind socket to localhost:9912
