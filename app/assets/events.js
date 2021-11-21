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
        $('#instrumentName').text('Empty!');
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
    'id': window.zsession.partID}, (data) => {
      console.log('done');
//             $('#instrumentName').text(instrument.name);
        window.zsession.instrument = instrument;    
        $('#btnDoFavorite i').removeClass('far fas');
        $('#btnDoFavorite i').addClass( (isFavorite(instrument)) 
                                  ? 'fas' : 'far');
        onToolbarChangePart(0);
    })
  }

function onBindEdit() {
  if (window.zsession.bind.current == null) {
    window.zsession.bind.current = {
      "type" : "trigger",
      "cc" : 0,
      "trigger" : 64,
      "osc" : []
    };
  }
  
  let bind = window.zsession.bind;
  
  if (bind.info == null) {
    bind.info = {source : 'cc', channel: 1}
  }
  
  let item = $('#bindEditChannel');
  
  if ($(item).find('option').length == 0) {
    $(item).append('<option value="all">All</option>');
    for (let i = 1; i < 17; i++)
      $(item).append(`<option value="${i}">${i}</option>`);
  }
  
  $(item).val(bind.info.channel);
  let current = bind.current;
  let source = bind.info.source;
  $('#bindEditSource').val(source);
  $('#bindEditData1').val(current[source]);
  $('#bindEditType').val(current.type);
  $('#bindEditType').trigger('change');
  
  //refresh switch list
  if (current['switch'] !== undefined) {
    let switchSource = $('#bindEditSwitch');
    $(switchSource).empty();
    for (let key in current['switch']) {
      $(switchSource).append(`<li>${key}</li>`);
    }
    
    $(switchSource).find('li').on('click', onBindEditSwitchTableListClick);
    
  } else if (current['trigger'] !== undefined)
    $('#bindEditData2').val(current['trigger']);
  
  
  if (current['osc'] !== undefined)
    bindTranslateOSC(current['osc']);
  
  if (bind.info.isEditing){}
    //refresh instead of add
}

function onBindEditChange(e) {
  let current = window.zsession.bind.current;
  let newMode = $(e.target).val();
  $('.bindSubEditor').addClass('hidden');
  
  switch (newMode) {
    case 'trigger' :
    $('#bindEditTrigger').removeClass('hidden');
    $('#bindEditOSC').removeClass('hidden');
    if (undefined === current[newMode]) {
      if (current.fader) delete current.fader;
      if (current.switch) delete current.switch;
      current.trigger = 127;
      $('#bindEditOSC').val('');
    } else {
      bindTranslateOSC(current['osc']);
    }
    
    break;
    case 'switch':
    current.type = 'switch';
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
      bindTranslateOSC(current['osc']);
    }
    break;
  }
  
}

function onBindEditMidilearn() {
  doQuery('midilearn', null, (data)=>{
    let dataType = (data[0] >> 4);
    
    if (dataType != 9 && dataType != 11) {
      $('#instrumentName').text('Only CC or Note events');
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
      
    onBindEdit();
  });
}

function onBindEditSwitchListClick(e) {
  let value = $(e.target).text();
  window.zsession.bind.selectedSwitch = value;
  let source = window.zsession.bind.current['switch'];
  
  $('#bindEditData2').val(value);
  $('#bindEditTrigger').removeClass('hidden');
  bindTranslateOSC(source[value]);
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

function bindTranslateOSC(osc) {
  $('#bindEditOSC'). val ( (Array.isArray(osc))
      ? osc.join("\n") : osc );
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

function onBindFileAddClick(source) {
  let file = $('#selBinds').children('li.btn-selected').text();
  //console.log(file);
  if (file == "") return;
  doAction('binds/add', {file: file}, (data) =>{
    $(source).removeClass('btn-selected');
    onBind();
  });
}


function onScriptSendClick() {
  let data = $('#commandLine').val();
  doAjax({method:'post', url: window.location.href+"script",
          data: JSON.stringify({script: data}), 
          contentType: 'application/json; charset=utf-8'},
          function(){
  });
}
  
function onToolbarChangePart(index) {
  if (window.zsession.partID+index < 0)
    window.zsession.partID = 15;
  else if (window.zsession.partID+index > 15)
    window.zsession.partID = 0;
  else
    window.zsession.partID += index;
  $('#currentPart').text( ('0'+window.zsession.partID).substr(-2) );
  
  //retrieve part info
  doQuery('status/part', {id: window.zsession.partID}, (data) => {
    console.log(data);
    if (data.name == '') data.name = 'Unloaded';
    $('#instrumentName').text(`#${window.zsession.partID}: ${data.name}`);
  });
  
  //any active panel must be re-triggered
  $('.controlPanel tab-header.btn-selected').trigger('click');
}

function onBind() {
  doQuery("status/binds", null, (data) =>{
    const ul=$('#selBinds');
    $(ul).empty();
    data.files.forEach( (item) => {
      $(ul).append('<li>'+item+'</li>');
    });
    
    const chain = $('#chainContainer');
    $(chain).empty();
    data.chain.forEach( (item) => {
      $(chain).append('<div class="col-12 panel"><button class="col-12 smallEntry">'+item+'</button></div>');
    });
    if (data.hasInstrument) {
      $(chain).append('<button class="col-12 smallEntry" data-remove="instrument">Remove instrument bind</button>');
    }
    $(chain).find('button').on('click', (e) => {
      console.log('howdy!');
      let value = 
       ($(e.target).attr('data-remove') !== undefined) 
          ? "instrument"
          : $(e.target).text();
          
      doAction('binds/remove', {file : value}, (data) =>{
            onBind();
      });
        
    });
  });
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
  doQuery('status/partfx', {id: window.zsession.partID}, function(data){
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
  console.log('called!')
  let newValue = window.knobs[`kss${id}`].getValue();
  doAction('script', {script : `/Psysefxvol${id}/part${window.zsession.partID} ${newValue}` });
}

function onFxSystem() {
   doQuery('status/systemfx', undefined, function(data){
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
      
function onSystemMIDI() {
  doQuery('status/midi', null, (data) => {
    
//          data = JSON.parse(data);
    if (Object.prototype.toString.call(data) !== '[object Array]') {
      console.log("Error: data is not array.");
      console.log(data);
      return;
    }
    
    //data is array
    let midiCont = $('#sysMidiContainer');
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

function onSystemSession() {
  doQuery('status/session', null, (data) =>{
    const currentSession = data.currentSession;
    const sessionList = data.sessionList;
    
    $('#sysCurSession').text( (currentSession != null)
        ? currentSession : 'New session' );
    
    const list = $('#sysSessionList');
    
    $(list).empty();
    sessionList.unshift('(Save to new session)');
    sessionList.forEach( (item) => {
      const li = `<li>${item}</li>`;
      $(list).append(li);
    });
  });
}

function onSystemSessionSaveClick() {
  let select = $('#sysSessionList').find('li.btn-selected');
  if (select.length == 0)
    return;
  let filename = $(select).text();
  
  if (filename.match(/^\(Save to new session\)/)) {
    filename = prompt ("New session name:", "default.xmz");
    if (filename == null)
      return;
    if (!filename.match(/\.xmz$/)) {
      alert('Please save as .xmz file.');
      return;
    }
    if ($('#sysCurSession').find(`li:contains(${filename})`)) {
      let res = confirm(`${filename} exists! Overwrite?`)
      if (!res) return;
    }
  }
  
  doAction('script', {script : `/zmania/save_xmz '${filename}'`}, () =>{
    onSystemSession();
  });
}

function onSystemSessionLoadClick() {
  let select = $('#sysSessionList').find('li.btn-selected');
  if (select.length == 0)
    return;
  let filename = $(select).text();
  if (filename.match(/^\(Save to new session\)/)) 
    return;
  
  doAction('script', {script :`/zmania/load_xmz '${filename}'`}, () =>{
    $('#instrumentName').text('Loaded session.');
    onSystemSession();
  });
}

function onSystemUADSR(type) {
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

