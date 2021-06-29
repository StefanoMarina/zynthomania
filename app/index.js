const OSC = require('osc-js')

const options = { send: { port: 11245 } }
const osc = new OSC({ plugin: new OSC.DatagramPlugin(options) })

osc.on('open', () => {
  console.log ("Opened");
  // send only this message to `localhost:9002`
  osc.send(new OSC.Message('/hello'), { port: 9002 })

  setInterval(() => {
     // send these messages to `localhost:11245`
     osc.send(new OSC.Message('/response', Math.random()))
  }, 1000)
})

osc.open({ port: 7777 }) // bind socket to localhost:9912
