/*********************************************************************
 * Zynthomania Server
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

const BodyParser = require('body-parser');
const Osc = require('osc');
const EXPRESS = require('express');
const Fs = require('fs');
const Util = require ('util');
const OSCParser = require ('./parser.js')
const EventEmitter = require('events');

async function fileExists(path) {
  try { await Fs.access(path); return true;}
  catch {return false;}
}

// Preferences >
var Preferences = {};
console.log("Reading Preferences...");

try {
  let data = Fs.readFileSync('preferences.json', 'utf-8');
  Preferences = JSON.parse(data);
  
} catch (err) {
  console.log(`Could not read Preferences.json : ${err}`);
  Preferences = { "user": "pi", "synth": { "port" : "7777" }, "custom_dir": "/home/pi/custom", "bank_dir": "/usr/local/share/zynaddsubfx/banks/" }
}
// < Preferences

//Favorites >
var Favorites = {};
console.log('Loading favorites...');
if (fileExists(Preferences.favorites)) {
  try {
    let data = Fs.readFileSync(Preferences.favorites);
    Favorites = JSON.parse(data);
  } catch (err) {
    console.log (`Cannot read favorites: ${err}`);
    Favorites = [];
  }
} else {
  Favorites = [];
}

function addFavorite(entry) {
  for ( item in Favorites ) {
    if (item.path == entry.path)
      return 200;
  }
  Favorites.push(entry);
  //save changes
  Fs.writeFileSync(Preferences.favorites, JSON.stringify(Favorites));
  return 200;
}

function removeFavorite(entry) {
  var newFavs = Favorites.filter(item => item.path != entry.path);
  
  if (Favorites.length == newFavs.length)
    return 404;
  else {
    Favorites = newFavs;
    Fs.writeFileSync(Preferences.favorites, JSON.stringify(Favorites));
    return 200;
  }
}
// < Favorites

const app = EXPRESS();

//express html server (7000)
app.use(EXPRESS.static(__dirname + '/node_modules'));  
app.use(EXPRESS.static(__dirname + '/assets'));

app.use (BodyParser.json());
app.use (BodyParser.urlencoded({extended:false}));

app.get('/', function(req, res,next) {  
    res.sendFile(__dirname + '/index.html');
});

/** custom app properties */

app.oscParser = new OSCParser.OSCParser();
/**
 * default 'done' query
 * this query is used to signal that all OSC get mesagges have been
 * received and thus the result can be returned.
 * This is because there is no guarantee AFAIK that bundle or messages
 * will return in the same order they are sent.
 * this done query should *NEVER* be used in a bundle or for real
 * purposes.
 */
app.defaultDoneQuery = app.oscParser.translate('/part0/self');

/**
 * onOSCDone
 * default method to trigger a REST response after a OSC get message
 * callback will return args
 */
 
app.onOSCDone = function(callback) {
  app.oscPathEvent.once(app.defaultDoneQuery.address, (args) => { callback(args) })
  osc.send(app.defaultDoneQuery);
}

/** Emitter > */
class OSCPathEvent extends EventEmitter {}
app.oscPathEvent = new OSCPathEvent();
/** < Emitter */



/**
 * FX DryOut
 * Sends OSC message to remove any part fx on instrument 0
 * id: can be a single number or an array for part
 * value: T or F
 */
 function FXDryout(id, value) {
  let path = `/part${id}/Pefxbypass[0-2] ${value}`;
  let bundle = app.oscParser.translate(path);
  console.log(`FXDryout: path ${path} object ${JSON.stringify(bundle)}`);
  osc.send(bundle);
}


/**
 * EffectTypeName
 * return effect type as string
 */
function effectTypeName(type) {
  switch (type) {
     case 0: return 'None'; break;
     case 1: return 'Reverb'; break;
     case 2: return 'Echo'; break;
     case 3: return 'Chorus'; break;
     case 4: return 'Phaser'; break;
     case 5: return 'AlienWah'; break;
     case 6: return 'Distortion'; break;
     case 7: return 'EQ'; break;
     case 8: return 'DynamicFilter'; break;
     default: return `Unk (${type})`; break;
  }
}

/************************
 * REST CALLBACKS
 ************************/
 
/**
 * getBanks
 * GET request to retrieve all bank folder
 */
app.get('/getBanks', function (req, res, next) {
  console.log(`[GET] getBanks query: ${JSON.stringify(req.query)}`);
    
  var bankList = ['Favorites', 'Custom'];
  var files = Fs.readdirSync (Preferences.bank_dir)
                .filter(function (file) {
                    return Fs.statSync(Preferences.bank_dir+'/'+file).isDirectory();
                });
  
  files.forEach(file => { bankList.push(file); });
  res.json(bankList);
});

/**
 * getInstruments
 * GET request to retrieve all .xiz file inside a folder
 */
app.get('/getInstruments', function (req, res, next) {
  console.log(`[GET] getInstruments query: ${JSON.stringify(req.query)}`);
  
  let requestedBank = req.query.bank;
  var result = [];
    
  if ('Favorites' == requestedBank) {
    result = Favorites;
  } else if ('Custom' == requestedBank) {
    
  } else {
    var fullpath = Preferences.bank_dir + requestedBank;  
    var files = Fs.readdirSync (fullpath)
                .filter(function (file) {
                    return !Fs.statSync(fullpath+'/'+file).isDirectory();
                });
        
    var regex = /\d*\-?([^\.]+)\.xiz/;
    
    files.forEach(file => {
       let match = regex.exec(file);
       let name = "";
       
       if (match !== null)
         name = match[1];
       else
         name = file;
         
      result.push ({"name": name, path: fullpath+'/'+file});
    });
  }
  
  res.json(result);
});


/**
 * loadInstrument
 * POST loads xiz
 * BODY {instrument: instrument}
 */
app.post('/loadInstrument', function (req, res) {
  console.log(`[POST] /loadInstrument body: ${JSON.stringify(req.body)}`);
  
  var instrument=req.body.instrument;
  
  let msg = {
        address: '/load_xiz',
        args: [
            { type: 'i', value: req.body.id },
            { type: 's', value: instrument.path }
        ]
    };
    
    app.oscPathEvent.once('/damage', (args) => {
      
        let score =RegExp("part(\\d+)","gm").exec(args[0].value);
        if (score != null && score[1] == req.body.id) {
          console.log('done');
          res.status(200).end();
        }
    });
    
    osc.send(msg);
});

 
 /**
  * panic
  * POST Sends panic message
  * BODY: {}
  */
  app.post('/Panic', function(req, res) {
    osc.send({ address: '/panic', args: [] });
  });
  
/**
 * setFavorite
 * POST set/unset favorite
 * Body {action :"set/unset", instrument : {Instrument} }
 */
app.post('/setFavorite', function (req, res) {
  console.log(`[POST] /setFavorite body: ${JSON.stringify(req.body)}`);
  
  if (req.body.action == 'set') {
    res.status(addFavorite(req.body.instrument)).send("Done");
  } else {
    res.status(removeFavorite(req.body.instrument)).send("Done");
  }
});

/**
 * script
 * POST parse script
 * Body { script : "" }
 */
app.post('/script', function(req, res) {
  if (req.body.script === undefined) {
    res.status(401).send("Missing script");
    return;
  }
  
  let parsedMessage=app.oscParser.translate(req.body.script);
  
  osc.send(parsedMessage);
  res.send("Done");
});

/**
 * Utility to find out fx status (type, part bypass)
 * bypass is usable only by part fx query
 * TODO: add preset id
 * basePath: base path for looking, without channels i.e. /part0/partefx
 * channels: how many channels to look for (3 for part, 4 for sys, 8 for insert)
 * bypassQuery: a osc query for part bypass
 * onDone: callback to call when everything is done
 */ 
function fxStatusQuery (basePath, channels, bypassQuery, onDone) {
  const returnObject = {
    efx : [{},{},{}]
  };
  
  
  let efftypeQuery = app.oscParser.translate(`${basePath}[0-${channels-1}]/efftype`);
  
  //callback events on OSC response
  const effectNameCallback = function (fxid, efx) {
    //console.log('called ::effectNameCallback for' + fxid); 
    let fxName = effectTypeName(efx);
    returnObject.efx[fxid].name = fxName;
  };

  const bypassCallback = function (index, value) {
    //console.log('called ::bypassCallback for ' + index); 
    returnObject.efx[index].bypass = value;
  }
  

  //register events
  if (efftypeQuery.packets !== undefined) {
    efftypeQuery.packets.forEach( (item) => {
      let i = RegExp("efx(\\d+)\/efftype", "gm").exec(item.address);
      if (i == null)
        throw `address ${item.address} failed to match regex`;
        
      app.oscPathEvent.once(item.address,  function (args) { effectNameCallback(i[1], args[0].value) });  
    });
  } else {
    let i = RegExp("efx(\\d+)\/efftype", "gm").exec(efftypeQuery.address);
      if (i == null)
        throw `address ${item.address} failed to match regex`;
        
    app.oscPathEvent.once(nameQuery.address,  function (args) { effectNameCallback(i[1], args[0].value) });
  }
  
  if (bypassQuery != null) {
    if (bypassQuery.packets !== undefined) {
      bypassQuery.packets.forEach( (item) => {
        let i = RegExp("Pefxbypass(\\d)", "gm").exec(item.address);
        if (i == null)
          throw `address ${item.address} failed to match bypass regex`;
        
          
        app.oscPathEvent.once(item.address,  function (args) { bypassCallback(i[1], args[0].value) });  
      });
    } else {
      let i = RegExp("Pefxbypass(\\d)", "gm").exec(item.address);
        if (i == null)
          throw `address ${item.address} failed to match bypass regex`;
      app.oscPathEvent.once(bypassQuery.address,  function (args) { bypassCallback(i[1], args[0].value) });
    }
  }
  
  //app.oscPathEvent.once(app.defaultDoneQuery.address, function(args) {console.log('ok'); onDone(returnObject); });
  
  //send all queries
  osc.send(nameQuery);
  osc.send(bypassQuery);
  //osc.send(app.defaultDoneQuery);
  app.onOSCDone( (args) => { onDone(returnObject);});
  
  //register the final command
  
  
  
  //osc.send(app.defaultDoneQuery);
}

/**
 * /status/partfx
 * GET creates an object to be filled with info on part efx.
 * this is an asynch function, it will wait for all effect to return
 * before sending.
 * id: part id
 */
 
app.get('/status/partfx', function (req, res, next) {
 console.log(`[GET] getStatusFX query: ${JSON.stringify(req.query)}`);
 
 if (req.query.id === undefined) {
   res.status(401).json({});
   return;
 }
 
 //let effTypeRequest = app.oscParser.translate(`/part${req.query.id}/partefx[0-2]/efftype`);
 let effBypassRequest = app.oscParser.translate(`/part${req.query.id}/Pefxbypass[0-2]`);
 
 //let onDoneRequest = app.oscParser.translate('/last_xmz');
 
 fxStatusQuery(`part${req.query.id}/partefx`, 3, effBypassRequest, function (returnObject) {
      //set dry
      res.json(returnObject);
    });
})

/**
 * GET returns all zynthomania static options
 * query: none
 * return : json
 */
app.get('/status/options', function (req, res, next) {
  res.json(Preferences);
});

/**
 * /status/part
 * GET returns part info
 * query {id: part id}
 * return: json
 */

app.get('/status/part', function( req, res, next) {
  console.log(`[GET] getStatusPart query: ${JSON.stringify(req.query)}`);
  if ( req.query.id === undefined) {
    res.status(404).end();
    return;
  }

  const partInfo = {};
  
  let partMessage = app.oscParser.translate(`/part${req.query.id}/Pname`);
  app.oscPathEvent.on(partMessage.address, (args) =>{ partInfo.name = args[0].value })
  
  osc.send(partMessage);
  app.onOSCDone( (done) => { console.log(JSON.stringify(partInfo)); res.json(partInfo)} );
  
});

app.on('open', () => {
  console.log ("Opened web application");
});

app.on('data', (data) =>{
  console.log('data: ' + JSON.stringify(data));
});

const server = require('http').createServer(app);
server.listen(7000);


var osc = new Osc.UDPPort({
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

osc.on("osc", function (oscMsg) {
    console.log("An OSC message just arrived!", oscMsg);
    app.oscPathEvent.emit(oscMsg.address, oscMsg.args);
});

app.oscPathEvent.on("error", (err) => {
  console.log(`SORRY! ${err}`);
});

//OSC bridge 9912 - 7777 (synth))
/*
const options = { send: { port: Preferences.synth.port } }
const osc = new OSC({ plugin: new OSC.DatagramPlugin(options) })


osc.on('message', message => {
  //console.log("Message received.");
  console.log('received message :' + JSON.stringify(message));
})

osc.open({ port: 9912 }) // bind socket to localhost:9912
*/
