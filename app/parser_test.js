const OSCParser = require ('./parser.js')
const Util = require ('util')

let parser = new OSCParser.OSCParser();
let teststring = '/sysefx0/efftype 2 3.5';


try {
  
  console.log(parser.translate(teststring));
  console.log(`last Result: \n ${Util.inspect(parser.lastResult)}`)
  console.log(`Tree: \n ${Util.inspect(parser.lastResult.tree)}`)
} catch (err) {
  console.log(err);
} finally {
}

