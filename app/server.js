const BodyParser = require('body-parser');
const OSC = require('osc-js');
const EXPRESS = require('express');
const Fs = require('fs');
const Util = require ('util');

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
 * getPresets
 * GET request to retrieve all .xiz file inside a folder
 */
app.get('/getPresets', function (req, res, next) {
  console.log(`[GET] getPresets query: ${JSON.stringify(req.query)}`);
  
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
 * loadPreset
 * POST loads xiz
 * BODY {preset: preset}
 */
app.post('/loadPreset', function (req, res) {
  console.log(`[POST] /loadPreset body: ${JSON.stringify(req.body)}`);
  
  var preset=req.body.preset;
  
  osc.send(new OSC.Message('/load_xiz', 0, preset.path), { port: Preferences.synth.port })
  res.status(200).send("OK");
});

/**
 * setFavorite
 * POST set/unset favorite
 * Body {action :"set/unset", preset : {Preset} }
 */
app.post('/setFavorite', function (req, res) {
  console.log(`[POST] /setFavorite body: ${JSON.stringify(req.body)}`);
  
  if (req.body.action == 'set') {
    res.status(addFavorite(req.body.preset)).send("Done");
  } else {
    res.status(removeFavorite(req.body.preset)).send("Done");
  }
});

app.on('open', () => {
  console.log ("Opened web application");
});

app.on('data', (data) =>{
  console.log('data: ' + JSON.stringify(data));
});

const server = require('http').createServer(app);
server.listen(7000);


//Websocket
/*
const wsocket = new WebSocketServer({httpServer:server});
wsocket.on('request', function(message) {
  const connection = request.accept(null, request.origin);
  connection.on('message', function(message) {
      console.log('Received Message:', message.utf8Data);
      //connection.sendUTF('Hi this is WebSocket server!');
    });
     connection.on('close', function(reasonCode, description) {
        console.log('Client has disconnected.');
    });
});*/

//OSC bridge 9912 - 7777 (synth))
const options = { send: { port: Preferences.synth.port } }
const osc = new OSC({ plugin: new OSC.DatagramPlugin(options) })

osc.on('open', () => {
  console.log ("Opened OSC Server");
  // send only this message to `localhost:9002`
 // osc.send(new OSC.Message('/load_xiz', 0, '/usr/local/share/zynaddsubfx/banks/Brass/0001-FM Thrumpet.xiz'), { port: 7777 })
/*
  setInterval(() => {
     // send these messages to `localhost:11245`
     osc.send(new OSC.Message('/response', Math.random()))
  }, 1000)
  */
})


osc.on('*', message => {
  //console.log("Message received.");
  console.log('received message :' + JSON.stringify(message));
})

osc.open({ port: 9912 }) // bind socket to localhost:9912
