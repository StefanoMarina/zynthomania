const OSCParser = require ('./knot/parser.js')
const Util = require ('util')

let parser = new OSCParser.OSCParser();
let teststring = "/zmania/binds/load 'bindtest.json'";


try {
  
  console.log(parser.translate(teststring));
  console.log(`last Result: \n ${Util.inspect(parser.lastResult)}`)
  console.log(`Tree: \n ${Util.inspect(parser.lastResult.tree)}`)
} catch (err) {
  console.log(err);
} finally {
}

