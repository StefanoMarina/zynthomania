/*********************************************************************
 * Zynthomania
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

function onBanks() {
        
  //Banks preloading
  if (Object.keys(window.zsession.banks).length <= 1) {
    doQuery('files/banks', null, (data) => {
      data.forEach( (item) => {
        window.zsession.banks[item] = [];
      });
      onBanks(-1);
      return;
    })
    
    return;
  }
  
  let banks = window.zsession.banks;
  let entry = '';
  let selectObject = $('#selBanks');
  selectObject.empty();
      
  Object.keys(banks).forEach( (key) => {
    selectObject.append('<li data-bank="'+key+'">'+key+'</li>');

  });
       
   $('.controlPanel').addClass('hidden');
   $('#pnlBanks').removeClass('hidden');
}
      
function onBanksBankSelect(selectedBank) {  
  if (window.zsession.banks[selectedBank].length == 0) {
    doQuery('files/banks/xiz', {bank: selectedBank}, (data) => {
      window.zsession.banks[selectedBank] = data;
      
      if (data.length == 0) {
        displayMessage('Empty!');
        return;
      }
      
      onBanksBankSelect(selectedBank);
      return;
    });
    return;
  }

  window.zsession.bank = selectedBank;
  
  let instruments = window.zsession.banks[selectedBank];
  let entry = '';
  let selectObject = $('#selInstruments');
  selectObject.empty();
  
  instruments.forEach( (value, index, array) => {
    let entry = `<li data-instrument="${value.path}">${value.name}`;
          
    if (isFavorite(value))
      entry += '<span style="float:right"><i class="fas fa-star"></i></span>';
      
     selectObject.append(entry+"</li>");
     selectObject.removeClass('hidden');
  });
}


function onBanksInstrumentClick(instrument) {
  doAction("loadInstrument", {'instrument': instrument, 
    'id': window.zsession.partID}, onToolbarChangePart);
  }

function onBindChain() {
  doQuery("status/binds", null, (data) =>{
    
    const chain = $('#chainContainer');
    $(chain).empty();
    
    if (data.chain == null || data.chain.length == 0)
      return;
    
    data.chain.forEach( (item) => {
      $(chain).append('<div class="col-12 panel"><button class="col-12 smallEntry">'+item+'</button></div>');
    });
    if (data.hasInstrument) {
      $(chain).append('<button class="col-12 smallEntry" data-remove="instrument">Remove instrument bind</button>');
    }
    
    $(chain).find('button').on('click', (e) => {
      let value = 
       ($(e.target).attr('data-remove') !== undefined) 
          ? "instrument"
          : $(e.target).text();
          
      doAction('binds/remove', {file : value}, (data) =>{
            onBindChain();
      });
        
    });
  });
}

function onBindFile() {
  doQuery("status/binds", null, (data) =>{
  
    window.zsession.bind.session = data.sessionConfig;
    
    const saveMode = window.zsession.bind.session != null
    && Object.keys(window.zsession.bind.session).length > 0;
    
    const ul=$('#selBinds');
    
    $(ul).empty();
    if (saveMode)
      $(ul).append('<li>(Save to new file)</li>');
    data.files.forEach( (item) => {
      $(ul).append('<li>'+item+'</li>');
    });
    
    if (saveMode)
      $('#bindSave').removeClass('hidden');
    else
      $('#bindSave').addClass('hidden');
  });
}

function onBindEdit(config) {
  if (config === undefined) {
    window.zsession.bind.current = {
      "type" : "trigger",
      "cc" : 0,
      "trigger" : 64,
      "osc" : []
    };
    $('#bindApply').text('Add');
  } else {
    window.zsession.bind.current = config;
    $('#bindApply').text('Update');
  }
  
  let bind = window.zsession.bind;
  
  if (bind.info == null) {
    bind.info = {source : 'cc', channel: 1}
  }
  
  let item = $('#bindEditChannel');
  
  /*if ($(item).find('option').length == 0) {
    $(item).append('<option value="all">All</option>');
    for (let i = 1; i < 17; i++)
      $(item).append(`<option value="${i}">${i}</option>`);
  }*/
  
  $(item).val(bind.info.channel);
  let current = bind.current;
  
  //We need to sanitize current to lowerCase, in case of hand written binds
  let oldKeys = Object.keys(current);
  oldKeys.forEach( (key) => {
    if (key.match(/[A-Z]/)) {
      let newKey = oldKeys.toLowerCase(), oldValue  = current[key];
      delete current[key];
      current[newKey] = oldValue;
    }
  });
  
  let source = bind.info.source;
  $('#bindEditSource').val(source);
  $('#bindEditData1').val(current[source]);
  $('#bindEditType').val( ( 'fader' == current.type.toLowerCase() ) 
        ? current.fader : current.type );  
  
  
  /* Note: triggering the change updates value */
  $('#bindEditType').trigger('change');
  
  
  //refresh switch list
  if (current['switch'] !== undefined) {
    let switchSource = $('#bindEditSwitch');
    $('#bindEditTrigger button').addClass('hidden');
    
    $(switchSource).empty();
    for (let key in current['switch']) {
      $(switchSource).append(`<li>${key}</li>`);
    }
    
    $(switchSource).find('li').on('click', onBindEditSwitchTableListClick);
    
  } else if (current['trigger'] !== undefined) {
    let value = current['trigger'];
    if (typeof value == 'string') {
      current.hmode = (current.hmode === undefined) 
          ? value.match(/\^/) != null 
          : current.hmode;
      current.trigger = parseInt(value.match(/\d+/)[0]);
    }
    
    $('#bindEditData2').val(current.trigger);
    
    $('#bindEditTrigger button').removeClass('btn-selected hidden').
      addClass( (current['hmode']) ? 'btn-selected' : '');
  }
  
  if (current['osc'] !== undefined)
    bindSetOSC(current['osc']);
  
  if (bind.info.isEditing){}
    //refresh instead of add
}

function onBindEditApply() {
  let current = window.zsession.bind.current;
  let info = window.zsession.bind.info;
  
  let d1source= $('#bindEditSource').val();
  
  console.log(`::onBindEditApply: changing ${d1source} to ${$('#bindEditData1').val()}`);
  
  switch (d1source)  {
    case 'noteon' :
      current.noteon = $('#bindEditData1').val();
      delete current.cc;
    break;
    case 'cc':
      current.cc = $('#bindEditData1').val();
      delete current.noteon;
    break;
  }
  
  let type = $('#bindEditType').val();
  ['switch','trigger','fader'].forEach( (tt) => {
    if (current[tt] && tt != type)
        delete current[tt];
  });
  
  switch (type) {
    case 'trigger': 
      current[type] = $('#bindEditData2').val();  
      current.osc = $('#bindEditOSC').val().split(/[\n\r]+/);
    break;
    case 'switch' : bindSaveCurrentEdit(); break;
    default: 
      current['fader'] = type;
      current.osc = $('#bindEditOSC').val().split(/[\n\r]+/);
    break;
  }
  
  let newChannel = String($('#bindEditChannel').val());
  
  if (window.zsession.bind.session == null)
    window.zsession.bind.session = {};
  
  let session =  window.zsession.bind.session;
  
  //find if new config and channel !=, remove old position
  if (newChannel != info.channel && (info.channel != null
            && session[info.channel] != null)) {
    console.log('::onBindEditApply: divergent channel');
    let index = session[info.channel].indexOf(current);
    if (index != -1) {
      console.log('::onBindEditApply: bind found, removing.');
      session[info.channel].splice(index, 1);
    }
  }

  //if unset, add
  if (session[newChannel] == null)
      session[newChannel] = [];
    
  if (session[newChannel].indexOf(current) == -1) {
    console.log('::onBindEditApply: bind not found, adding.');
    session[newChannel].push(current);
  }

  $('#bindApply').text('Update');
  
  bindUpdateRemoteSession();
}

function onBindEditChange(e) {
  let current = window.zsession.bind.current;
  let newMode = $(e.target).val();
  $('.bindSubEditor').addClass('hidden');
  
  switch (newMode) {
    case 'trigger' :
    $('#bindEditTrigger').removeClass('hidden');
    $('#bindEditTrigger button').removeClass('hidden');
    $('#bindEditOSC').removeClass('hidden');
    if (undefined === current[newMode]) {
      if (current.fader) delete current.fader;
      if (current.switch) delete current.switch;
      current.trigger = 127;
      $('#bindEditOSC').val('');
    } else {
      bindSetOSC(current['osc']);
    }
    
    break;
    case 'switch':
    current.type = 'switch';
     $('#bindEditTrigger button').addClass('hidden');
     $('#bindEditSwitch').removeClass('hidden');
     if (undefined === current[newMode]){
       if (current.fader) delete current.fader;
       if (current.trigger) delete current.trigger;
       current.switch = {};
       if(current.osc) delete current.osc;
    }
    break;
    default :
    current.type = 'fader';
    $('#bindEditOSC').removeClass('hidden');
    if (undefined === current[newMode]){ 
      if (current.trigger) delete current.trigger;
      if (current.switch) delete current.switch;
      current.fader = newMode;
    } else {
      bindSetOSC(current['osc']);
    }
    break;
  }
  
}

function onBindEditMidilearn() {
doQuery('midilearn', {force: [9,11]}, (data)=>{
    let dataType = (data[0] >> 4);
    
    if (dataType != 9 && dataType != 11) {
      displayMessage('Only CC or Note events');
      return;
    }
    
    window.zsession.bind.info.channel = (data[0] & 0xf)+1;
    
    let current = window.zsession.bind.current;
    if (dataType == 9) {
      window.zsession.bind.info.source = 'noteon';
      current.noteon = data[1];
      if (current.cc) delete current.cc;
    } else {
      window.zsession.bind.info.source = 'cc';
      current.cc = data[1];
      if (current.noteon) delete current.noteon;
    }
    
    if (current.trigger)
      current.trigger = data[2];
    else if (current['switch'] && undefined === current['switch'][data[2]])
      current['switch'][data[2]] = "";
      
    onBindEdit(current);
  });
}

function onBindEditSwitchListClick(e) {
  let value = $(e.target).text();
  window.zsession.bind.selectedSwitch = value;
  let source = window.zsession.bind.current['switch'];
  
  $('#bindEditData2').val(value);
  $('#bindEditTrigger').removeClass('hidden');
  bindSetOSC(source[value]);
  $('#bindEditOSC').removeClass('hidden');
  $('#bindEditUpdate').removeClass('hidden');
}

function bindSaveCurrentEdit() {
  const current = window.zsession.bind.current;
  const switchTable = $('#bindEditSwitchTable');
  
   //check if there is a current edit, save
  let selection = $(switchTable).find('li.btn-selected');
  
  if (selection.length != 0) {
    let switchValue = $(selection).text();
    let editValue = $('#bindEditData2').val();
    
    if (editValue != switchValue) {
      delete current['switch'][switchValue];
      current['switch'][editValue] = $('#bindEditOSC').val().split(/[\n\r]+/);
    } else
      current['switch'][switchValue] = $('#bindEditOSC').val().split(/[\n\r]+/);
  }
}

function bindSetOSC(osc) {
  $('#bindEditOSC'). val ( (Array.isArray(osc))
      ? osc.join("\n") : osc );
}

function bindUpdateRemoteSession() {
  let session = window.zsession.bind.session;
  if (session == null || Object.keys(session).length == 0) {
    displayMessage('No session to save');
    return;
  }
  
  doAction('binds/session/set', {'session': session}, (data) =>{
    displayMessage('Session updated');
  });
}
function onBindEditSetHigherMode(button) {
  let qb = $(button);
  if (qb.hasClass('btn-selected')) {
    window.zsession.bind.current.hmode = 0;
    qb.removeClass('btn-selected')
  } else {
    window.zsession.bind.current.hmode = 1;
    qb.addClass('btn-selected')
  }
}

function onBindEditSwitchAddClick() {
  let current = window.zsession.bind.current;
  let keys = Object.keys(current['switch']);
  if (keys.length >= 127)
    return; //what?
    
  bindSaveCurrentEdit();
  
  //new entry, randomic
  let number = 64;
  do {
    number = Math.floor(Math.random()*128);
  } while (keys.indexOf(number) != -1);
  
  number = String(number);
  
  current['switch'][number] = [];
  
  const switchTable = $('#bindEditSwitchTable');
  $(switchTable).append(`<li>${number}</li>`);
  let list = $(switchTable).find('li');
  $(list[list.length-1]).on('click', onBindEditSwitchListClick);
}

function onBindEditSwitchDeleteClick() {
  let element = $('#bindEditSwitchTable li.btn-selected');
  if (element.length == 0)
    return;
  let value = $(element).text();
  delete window.zsession.bind.current['switch'][value];
  $(element).remove();
  if ( $('#bindEditSwitchTable').find('li').length == 0) {
    $('#bindEditTrigger').addClass('hidden');
    $('#bindEditOSC').addClass('hidden');
    $('#bindEditUpdate').addClass('hidden');
  }
}

function onBindFileAddClick (source) {
  let file = $('#selBinds').children('li.btn-selected').text();
  //console.log(file);
  if (file == "") return;
  doAction('binds/add', {file: file}, (data) =>{
    $(source).removeClass('btn-selected');
  });
}

function onBindFileEditClick() {
  let file = $('#selBinds').children('li.btn-selected').text();
  if (file == "") return;
  
  doAction('binds/session', {'file': file}, 
    (data) => {
      
    window.zsession.bind.session = data;
    
  });
}
function onBindFileSaveClick() {
   let select = $('#selBinds').find('li.btn-selected');
  if (select.length == 0)
    return;
  let filename = $(select).text();
  
  if (filename.match(/^\(Save to new file\)/)) {
    filename = prompt ("New binds name:", "default.json");
    if (filename == null)
      return;
    if (!filename.match(/\.json$/)) {
      alert('Please save as .json file.');
      return;
    }
    if ($('#selBinds').find(`li:contains(${filename})`)) {
      let res = confirm(`${filename} exists! Overwrite?`)
      if (!res) return;
    }
  }
  
  doAction ('binds/session/save', {file: filename});
}

function onBindSession() {
  doQuery('status/binds', null, (data) => {
    window.zsession.bind.session = data.sessionConfig;
     
    if (window.zsession.bind.session == null) {
      window.zsession.bind.session = {};
    }
    
    let session = window.zsession.bind.session;
    let pnlSession = $('#pnlBindSession');
    if (Object.keys(session).length ==0) {
      $('#pnlBindSession > div').addClass('hidden');
      $(pnlSession).find('p').removeClass('hidden');
      return;
    }
    
    $(pnlSession).find('p').addClass('hidden');
    let content = $('#bindSessionTable');
    
    $('#pnlBindSession > div').removeClass('hidden');
    $(content).empty();
    
    let ch = null, type = null, val = null, id= null, html = null;
    for (let channel in session) {
      ch = session[channel];
      ch.forEach ( (bind) => {
        type = (bind.cc === undefined) ? 'NOTE' : 'CC';
        val = ('NOTE' == type) ? bind.noteon : bind.cc;
        id = `bind-ses-${channel}-${ch.indexOf(bind)}`
        
        if (bind.type === undefined) {
          bind.type = (bind.trigger) ? 'trigger'
                      : (bind['switch'] ? 'switch': 'fader')
        }
        
        html = 
        `<div class="row no-gutters">
            <div class="col-2 tc">${channel}</div>
            <div class="col-5 tc">${bind.type.substr(0,1).toUpperCase()} ${type} ${val}</div>
            <div class="col-5 row no-gutters">
              <button class="bindEditSes col-5" onclick="onBindSessionEditClick('${id}')"><i class="fa fa-edit"></i></button>
              <button class="bindRmSes col-5" onclick="onBindSessionDelClick('${id}')"><i class="fa fa-trash-alt"></i></button>
            </div>
        </tr>
        `
        
        $(content).append(html);
      });
    }
  });
}

function onBindSessionEditClick(id) {
  let rx = id.match(/^bind-ses-(\d+|all)-(\d+)/);
  let channel = rx[1], index = parseInt(rx[2]);
  //emulate click
  $('#pnlBindSession').addClass('hidden');  
  $('#pnlBindEdit').removeClass('hidden');
  $('#pnlBinds header button[data-open=pnlBindSession]').removeClass('btn-selected');
  $('#pnlBinds header button[data-open=pnlBindEdit]').addClass('btn-selected');
  
  let info = window.zsession.bind.info;
  info.channel = channel;
  let bind = window.zsession.bind.session[String(channel)][index];
  info.source = (bind.cc) ? 'cc' : 'noteon';
  onBindEdit(bind);
}

function onBindSessionDelClick(id) {
  let rx = id.match(/^bind-ses-(all|\d+)-(\d+)/);
  let channel = rx[1], index = parseInt(rx[2]);
  
  window.zsession.bind.session[channel].splice(index,1);
  bindUpdateRemoteSession();
  onBindSession();
}

function onFxDry() {
  doQuery('status/options', null, (data) => {
    //console.log(data);
    let fxes = data.dry;
    $('.btnDrySelection').removeClass('btn-selected');
    
    fxes.forEach( (fx) => {
        $(`.btnDrySelection:contains(${fx})`).addClass('btn-selected');
    })
  });
}

/** loads part fx */
function onFxPart() {
  doQuery('status/partfx', {id: window.zsession.partID}, (data) =>{
    console.log(data);
      window.zsession.partefx[window.zsession.partID] = {fx : data.efx, send : data.send }
      //onFXLoad('btnpfx', data);
      
      for (let i = 0; i < 3; i++)
        window.buttons[`btnpfx${i}`].setFX(data.efx[i]);
      
      //update send
      for (let i = 0; i < 4; i++) {
          let id = `kss${i}`;
          console.log(data.send[i]);
          window.knobs[id].setValue(data.send[i]);
      }
      
  });
}
      
function onFxRoute() {
  doQuery('status/options', null, (data) => {
    console.log(data);
    let route = data.route;
    
    let fxes = route.fx;
    
    $('.btnRouteSelection').removeClass('btn-selected');
    
    fxes.forEach( (fx) => {
        $(`.btnRouteSelection:contains(${fx})`).addClass('btn-selected');
    })
    
    window.knobs['routeSend'].setValue(route.send);
  });
}

function onFxPartSystemKnobChange(id) {
  let newValue = window.knobs[`kss${id}`].getValue();
  doAction('script', {script : `/Psysefxvol${id}/part${window.zsession.partID} ${newValue}` });
}

function onFxSystem() {
   doQuery('status/systemfx', {part: window.zsession.partID}, (data) =>{
    console.log(data);
      //window.zsession.partefx[window.zsession.partID] = {fx : data.efx, send : data.send }
      //onFXLoad('btnpfx', data);
      
      for (let i = 0; i < 4; i++)
        window.buttons[`btnsfx${i}`].setFX(data.efx[i]);
  });
}



function onScript() {
  doQuery("files/scripts", null, (data) =>{
    console.log(data);
   const ul=$('#selScripts');
    $(ul).empty();
    data.forEach( (item) => {
      $(ul).append('<li>'+item+'</li>');
    });
  });
}
      

function onScriptSendClick() {
  let data = $('#commandLine').val().split('\n')
    .filter( e=> e != "");
  
  if (data.length == 1)
      data = data[0];
   
  doAction('script', {script: data});
}
  
function onScriptQueryClick() {
  let data = $('#commandLine').val().split('\n')
    .filter( e=> e != "");
  
  if (data.length == 1)
      data = data[0];
  doAction('script', {script: data, requestResult: 1}, (data) =>{
    let output = $('#pnlConsole div');
    let button = $(output.siblings('button').get()[0]);
    
    output.removeClass('hidden');
    $('#pnlConsole button, #pnlConsole textarea').addClass('hidden');
    button.removeClass('hidden');
    
    output.empty();
    for (let add in data) {
      let args = JSON.stringify(data[add]);
      output.append(`<p><strong>${add}</strong>:${args}</p>`);
    }
  });
}

function onScriptOK() {
  $('#pnlConsole div').addClass('hidden');
  $('#pnlConsole button, #pnlConsole textarea').removeClass('hidden');
  $('#pnlConsole button[value=ok]').addClass('hidden')
}

function onSystemInfo() {
    doQuery('status/system', null, (data) => {
      console.log(data);
      let space = $('#pnlSystemInfo > div:first-child');
      space.empty();
      space.append(`<p class='col-12'>Temp: ${data.cpuTemp}</p>`);
      space.append(`<p class='col-12'>JACK<span class="d-none d-md-inline"> process status</span>: <i class="${(data.jackProcess != null) ? 'fa fa-check-circle' : 'fa fa-times-circle'}"></i></p>`);
      space.append(`<p class='col-12'>ZynAddSubFX<span class="d-none d-md-inline"> status</span>: <i class="${(data.zynProcess != null) ? 'fa fa-check-circle' : 'fa fa-times-circle'}"></i></p>`);
      space.append(`<p class='col-12'>Cartridge: ${data.workingDir}</p>`);
      space.append("<p class='col-12'>Net address:"+data.netAddress.reduce( (acc, x)=> acc+", "+x)+"</p>");
    });
}
function onSystemMIDI() {
  doQuery('status/midi', null, (data) => {
    
//          data = JSON.parse(data);
    if (Object.prototype.toString.call(data) !== '[object Array]') {
      console.log("Error: data is not array.");
      console.log(data);
      return;
    }
    
    //data is array
    let midiCont = $('#keybMidiContainer');
    $(midiCont).empty();
    
    
    data.forEach( (item) => {
      
      let plugged = (item.connections !== undefined && 
                item.connections.indexOf(zynConnection.plug) > -1);
      let selClass = (item.connected) ? "btn-selected" : "";
      
      let content = `<button class="col-sm-12 col-md-8 col-lg-6 ${selClass}" value="${item.port}">${item.name}`+"</button>";
      $(midiCont).append(content);
    });
    
    $(midiCont).children('button').on('click', (e) => {
      let target = $(e.target);
      let plugged = $(target).hasClass('btn-selected');
      
      doAction('status/midi/plug', 
        {'name': $(target).val(), 'status': !plugged}, (data) =>{
          onSystemMIDI();
        });
    });
  });
}

function onSystemInfoReconnect() {
  doAction('reconnect', (data) => {
    displayMessage('Reconnected!');
    let icon = $('#pnlSystemInfo > div:first-child').find('p > i');
    icon.removeClass('fa-times-circle');
    icon.addClass('fa-check-circle');
  });
}

function onSystemInfoShutdown(reboot) {
  doAction('shutdown', {'reboot':reboot}, (data)=>{
   $('main').addClass('hidden');
   if (!reboot) {
     $('body').append('<div class="center-screen"><h1 class="tc">Bye bye!</h1></div>');
   } else {
     $('body').append('<div class="center-screen"><div class="col-12"><h1>Rebooting...</h1><div id="rebar" style="background-color:black;height:50px;width:0px"></div></div></div>');
     
     let respan = $('body').find('#rebar').get()[0];
     var width = 0;
     setInterval( () => {
        if (width < 100){
         width = width + 1;
  	 respan.style.width = `${width}%`;
        }
     },1200);
     setTimeout( () => {
       window.location.reload();
     }, 120000);
   }
  });
}
function onKeybSession() {
  doQuery('status/session', null, (data) =>{
    const currentSession = data.currentSession;
    const sessionList = data.sessionList;
    
    $('#keybCurSession').text( (currentSession != null)
        ? currentSession : 'New session' );
    
    const list = $('#keybSessionList');
    
    $(list).empty();
    sessionList.unshift('(Save to new session)');
    sessionList.forEach( (item) => {
      const li = `<li>${item}</li>`;
      $(list).append(li);
    });
  });
}

function onKeybSessionSaveClick() {
  let select = $('#keybSessionList').find('li.btn-selected');
  if (select.length == 0)
    return;
  let filename = $(select).text();
  
  if (filename.match(/^\(Save to new session\)/)) {
    filename = prompt ("New session name:", "default.xmz");
    if (filename == null)
      return;
    if (!filename.match(/\.xmz$/i)) {
      alert('Please save as .xmz file.');
      return;
    }
    if ($('#keybCurSession').find(`li:contains(${filename})`).length>0) {
      let res = confirm(`${filename} exists! Overwrite?`)
      if (!res) return;
    }
  }
  
  doAction('script', {script : `/zmania/save_xmz '${filename}'`}, () =>{
    onKeybSession();
  });
}

function onKeybSessionLoadClick() {
  let select = $('#keybSessionList').find('li.btn-selected');
  if (select.length == 0)
    return;
  let filename = $(select).text();
  if (filename.match(/^\(Save to new session\)/)) 
    return;
  
  doAction('script', {script :`/zmania/load_xmz '${filename}'`}, () =>{
    //displayMessage('Loaded session.');
    onToolbarChangePart(0);
    onKeybSession();
  });
}

const NOTE_LIST = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function splitValueToKey(value) {
  if (value <= 0) return 'C-1';
  
  let channel = Math.floor(value/12)-1;
  let note = NOTE_LIST[value-((channel+1)*12)];
  return `${note}${channel}`;
}

function keyToSplitValue(key) {
  let match = key.match(/(\w\#?)(\d+)/);
  let note = match[1], octave = parseInt(match[2])+1;
  return (octave*12)+NOTE_LIST.indexOf(note);
}

function onKeybSplit() {
  doQuery('status/split', null, (data) =>{
    $('#keybSplitChannel > select').val(data.channel+1);
    $('#keybSplitChannel > label').text(data.channel+1);
    
    window.zsession.splitdata = data;
    
    let table = $('#keybSplitTable');
    let btnClass = "", iconClass= null, split = null, entry = null;
    
    table.empty();
    for (let i = 0; i < 16; i++) {
      split = data.split[i];
      if (split.channel == data.channel) {
        iconClass='i-midi-alt';
        btnClass='btn-selected';
      } else {
        iconClass='i-midi';
        btnClass='';
      }
      
      entry = `<div class="col-2">${i+1}</div><div class="col-2">${splitValueToKey(split.min)}</div> 
<div class="col-2">${splitValueToKey(split.max)}</div>
<div class="col row no-gutters">
  <button class="col-3" onclick='onKeybSplitEdit(${i})'><i class='fa fa-edit'></i></button>
  <button class="col-3"  onclick='onKeybSplitClear(${i})'><i class='fa fa-trash-alt'></i></button>
  <button class="col-3"  onclick='onKeybSplitLearn(${i})'><span class="icon i-send"></span></button>
  <button class="col-3 ${btnClass}"  onclick='onKeybMidi(${i})'><span class="icon ${iconClass}"></span></button>
</div>`;
      table.append(`<div class="row no-gutters">${entry}</div>`);
    }
    
  });
}

function onKeybSplitClear(part) {
   doAction('script', {script: [
    `/part${part}/Pminkey 0`,
    `/part${part}/Pmaxkey 127`
   ]}, ()=>{
      $(`#keybSplitTable > .row:nth-child(${part+1}) > div:nth-child(2)`).text('C-1');
      $(`#keybSplitTable > .row:nth-child(${part+1}) > div:nth-child(3)`).text('G9');
   });
}

function onKeybSplitEdit(part) {
  let split = window.zsession.splitdata.split[part];
  let available_notes = [], available_scores = [];
  
  for (let i = 0; i < split.max; i++) {
    available_notes.push(splitValueToKey(i));
    available_scores.push(i);
  }
  
  let data = { 'title' : 'Select lower key' , 
        'buttonClass': 'col-3 col-md-2',
        'scores' : available_scores,
        'defValue' : splitValueToKey(split.min)
  };
  
  dialogBox(available_notes, data, (minValue) => {
    console.log(`split: min value ${minValue}`);
    
    available_notes = [];
    available_scores = [];
    
    for (let i = parseInt(minValue)+1; i < 127; i++){
      available_notes.push(splitValueToKey(i));
      available_scores.push(i);
    }
    
    data.title = 'Select higher key';
    data.defValue = splitValueToKey(split.max);
    data.scores = available_scores;
    
    dialogBox(available_notes, data, (maxValue) => {
      split.min = parseInt(minValue);
      split.max = parseInt(maxValue);
      
      doAction('script', {script: [
        `/part${part}/Pminkey ${split.min}`,
        `/part${part}/Pmaxkey ${split.max}`
      ]});
      
      $(`#keybSplitTable > .row:nth-child(${part+1}) > div:nth-child(2)`).text(
        splitValueToKey(minValue));
      $(`#keybSplitTable > .row:nth-child(${part+1}) > div:nth-child(3)`).text(
        splitValueToKey(maxValue));
    });
  });
}

function onKeybSplitLearn(part) {
doQuery('midilearn', {force: [9]}, (data)=> {
    const minValue = data[1];
    
    doQuery('midilearn', {force: [9]}, (data) => {
      const maxValue = data[1];
      
      let split = window.zsession.splitdata.split[part];
      split.min = minValue;
      split.max = maxValue;
      
      doAction('script', {script: [
        `/part${part}/Pminkey ${split.min}`,
        `/part${part}/Pmaxkey ${split.max}`
      ]});
      
      $(`#keybSplitTable > .row:nth-child(${part+1}) > div:nth-child(2)`).text(
        splitValueToKey(minValue));
      $(`#keybSplitTable > .row:nth-child(${part+1}) > div:nth-child(3)`).text(
        splitValueToKey(maxValue));
        
    }, ()=>{
      displayMessage('Aborted', true)
    });
    
    displayMessage('Enter highest key', true);
  }, ()=>{
    displayMessage('Aborted', true);
  });
  displayMessage('Enter lowest key', true);
}

function onKeybMidi(part) {
  let split = window.zsession.splitdata.split[part];
  let midiChan = parseInt($('#keybSplitChannel > select').val())-1;
  
  if (midiChan != split.channel) {
    doAction('script', {script: `/part${part}/Prcvchn ${midiChan}`}, ()=>{
      displayMessage(`Part #${part+1} chan set to ${midiChan}`);
      split.channel = midiChan;
      
      let btn = $(`#keybSplitTable > .row:nth-child(${part+1}) > div:nth-child(4) > button:nth-child(4)`);
      let span = btn.find('span');
      btn.addClass('btn-selected');
      span.removeClass('i-midi');
      span.addClass('i-midi-alt');
    });
  } else {
    doAction('script', {script: `/part${part}/Prcvchn ${part}`}, ()=>{
      displayMessage(`Part #${part+1} chan restored.`);
      split.channel = part;
      
      let btn = $(`#keybSplitTable > .row:nth-child(${part+1}) > div:nth-child(4) > button:nth-child(4)`);
      let span = btn.find('span');
      btn.removeClass('btn-selected');
      span.removeClass('i-midi i-midi-alt');
      
      if (part == midiChan) {
        btn.addClass('btn-selected');
        span.addClass('i-midi-alt');
      } else {
        span.addClass('i-midi');
      }
      
    });
  }
}

function onKeybSplitChange(val) {
  let btns = $(`#KeybSplitTable >  .row > div:nth-child(4) > button:nth-child(4)`);
  let split = null, button = null;
  
  for (let i = 0; i < 16; i++) {
    button = $(btns.get()[i]);
    split = window.zsession.splitdata.split[i];
    button.find('span').removeClass('i-midi i-midi-alt');
    button.removeClass('btn-selected');
    
    if (split.channel == val) {
      button.addClass('btn-selected');
      button.find('span').addClass('i-midi-alt');
    } else {
      button.find('span').addClass('i-midi');
    }
  }
  
  doAction('session/set', {splitChannel : val });
}

function onKeybUADSR(type) {
  doQuery("status/options", null, (data) => {
    let uadsr = data.uadsr;
    
    $('.uadsrControl').addClass('hidden');
    
    if (type === undefined) type = uadsr.type;
    $(`#pnlUADSR button[value=${type}]`).addClass('btn-selected');
    let query = null;
    
    switch (type) {
      case "none": break;
      case "uadsr4":
        $('#u4config p').text('General ADSR');
        $('#u4config, #u4switch, #uadsrApply').removeClass('hidden');
        
        query = $('#u4config input');
        for (let i = 0; i < 4; i++)
          query[i].value = uadsr['uadsr4_binds'][i];
          
        $('#u4switch input').val(uadsr['uadsr4_binds'][4]);
      break;
      case "uadsr8":
        $('#u4config p').text('Amplitude');
        $('#u4config, #u8config, #uadsrApply').removeClass('hidden');
        
        query = $('#u4config input');
        for (let i = 0; i < 4; i++)
          query[i].value = uadsr['uadsr8_binds'][i];
          
        query = $('#u8config input');
        for (let i = 0; i < 4; i++)
          query[i].value = uadsr['uadsr8_binds'][i+4];
      break;
    }
  });
}

function onToobarFavoriteClick() {
  let status = $('#btnDoFavorite').hasClass('fas');
  let request = !status;
  
  
  let action = (value) ? 'set' : 'unset';
        
        //First, we update server
        doAjax({method:'post', url: window.location.href+"setFavorite",
                data: JSON.stringify({"instrument": instrument, "action": action}), 
                contentType: 'application/json; charset=utf-8'},
        function() {
          
          //Then we update client, without ajax
          if (!value) {
            window.zsession.banks['Favorites']= 
            window.zsession.banks.Favorites.filter( (entry) => {
              return (entry.path != instrument.path);});
          } else {
            window.zsession.banks.Favorites.push(instrument);
          }
          
          //last we update display
          if (instrument.name == window.zsession.getInstrument().name) {
            $('#btnDoFavorite i').removeClass('far fas');
            $('#btnDoFavorite i').addClass((value == true) ? 'fas' : 'far'); 
          }
          
          let li = $('#selInstruments li.btn-selected');
          if (li !== undefined && li.attr('data-instrument') == instrument.path) {
            $(li).empty();
            $(li).text(instrument.name);
            if (value)
              $(li).append('<span style="float:right"><i class="fas fa-star"></i></span>');
          }
        });
}
/*
TODO:
Passing this as a direct ajax callback will result in index being the
callback result
*/
function onToolbarChangePart(index) {
  
  if (index !== undefined && index !== '')
    window.zsession.partID = parseInt(index);
  
  //retrieve part info
  doQuery('status/part', {id: window.zsession.partID}, (data) => {
    //console.log(data);
    if (data.name == '') data.name = 'Unloaded';
    
    displayMessage ( (data.enabled
            ? `#${window.zsession.partID+1}: ${data.name}`
            : `Disabled`), true);
    
    window.knobs['kpvol'].setValue(data.volume);
    window.knobs['kppan'].setValue(data.panning);
    $('#btnEditChan').val(data.rcvchn);
    
    if (data.enabled)
      $('h3 > a').addClass('hidden');
    else
      $('h3 > a').removeClass('hidden');
    
    //if undefined will reset
    window.zsession.setInstrument(undefined, data.instrument);
    
    let isInstrumentFavorite = (data.instrument != null && data.name != ""
          && isFavorite(data.instrument));
    
    if (isInstrumentFavorite) {
      $('#btnDoFavorite > i').removeClass('far');
      $('#btnDoFavorite > i').addClass('fas');
    } else {
      $('#btnDoFavorite > i').removeClass('fas');
      $('#btnDoFavorite > i').addClass('far');
      window.zsession.setInstrument(null);
    }
    
  });
  
  //TODO: any active panel must be re-triggered
  //$('.controlPanel tab-header.btn-selected').trigger('click');
}


