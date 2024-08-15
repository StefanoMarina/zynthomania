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

const ADSYNTH_GLOBAL = 127; //adsynth voice id pointing to global


 function onBanks() {
  //no more preloading banks
  
  new ZynthoREST().query('files/banks', null)
  .then((data) =>{
    data.forEach( (item) => {
      window.zsession.banks[item] = [];
      displayOutcome("Banks loaded.");
    });
    let banks = window.zsession.banks;
    let entry = '';
    let selectObject = document.getElementById('selBanks');
    
    if (selectObject.children.length == 0) {
      Object.keys(banks).forEach( (key) => {
        selectObject.innerHTML += `<li data-bank='${key}'>${key}</li>`;
      });
      
      selectObject.querySelectorAll('li').forEach ( (li) => {
          li.addEventListener('click', onBanksBankSelect);
      });
    }
    
    selectObject = document.getElementById('selInstruments');
    selectObject.innerHTML = '';
    
    loadSection('section-select-bank');
    
    //TODO: this selector will be trouble
    setSelectedToolbarButton(document.querySelector('#partToolbar > button:nth-child(2)'));
  });
}
      
function onBanksBankSelect(event) {
  //let ul = target.parentNode;
  //ul.querySelectorAll('.selected').forEach ( (el) => el.classList.remove('selected'));
  //target.classList.add('selected');
  let selectedBank = event.target.dataset.bank;
  
  new ZynthoREST().query('files/banks/xiz', {bank: selectedBank})
  .then( (data) => {
    window.zsession.bank = selectedBank;
    window.zsession.banks[selectedBank] = data;
    
    let instruments = window.zsession.banks[selectedBank];
    let entry = '';
    let selectObject = document.getElementById('selInstruments');
    selectObject.innerHTML = '';
    
    instruments.forEach( (value, index, array) => {
      let entry = `<li data-instrument="${value.path}">${value.name}`;
      
      if (isFavorite(value))
        entry += '<span style="float:right"><i class="fas fa-star"></i></span>';
        
       selectObject.innerHTML += entry+"</li>";
    });
    
    selectObject.querySelectorAll('li').forEach( (li) => {
        li.addEventListener('click',
          (e)=>{
            let previous = selectObject.querySelector('li.selected');
            if (previous != null)
              previous.classList.remove('selected');
              
            e.target.classList.add('selected');
            onBanksInstrumentClick(e.target.dataset.instrument);
          }
        );
    });
        
    document.getElementById('bankName').innerHTML= selectedBank;
    loadSection('section-select-patch');
  });
}

function onBanksInstrumentClick(instrument) {
  new ZynthoREST().post( "loadInstrument", {'instrument': instrument, 
    'id': window.zsession.partID} )
   .then (
    
    ()=>{onToolbarChangePart()}
   );
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
    bind.info = {source : 'cc', channel: 1};
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
    
    $('#bindEditTrigger button').removeClass('selected hidden').
      addClass( (current['hmode']) ? 'selected' : '');
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
  let selection = $(switchTable).find('li.selected');
  
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
  if (qb.hasClass('selected')) {
    window.zsession.bind.current.hmode = 0;
    qb.removeClass('selected')
  } else {
    window.zsession.bind.current.hmode = 1;
    qb.addClass('selected')
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
  let element = $('#bindEditSwitchTable li.selected');
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
  let file = $('#selBinds').children('li.selected').text();
  //console.log(file);
  if (file == "") return;
  doAction('binds/add', {file: file}, (data) =>{
    $(source).removeClass('selected');
  });
}

function onBindFileEditClick() {
  let file = $('#selBinds').children('li.selected').text();
  if (file == "") return;
  
  doAction('binds/session', {'file': file}, 
    (data) => {
      
    window.zsession.bind.session = data;
    
  });
}
function onBindFileSaveClick() {
   let select = $('#selBinds').find('li.selected');
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
  $('#pnlBinds header button[data-open=pnlBindSession]').removeClass('selected');
  $('#pnlBinds header button[data-open=pnlBindEdit]').addClass('selected');
  
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
    $('.btnDrySelection').removeClass('selected');
    
    fxes.forEach( (fx) => {
        $(`.btnDrySelection:contains(${fx})`).addClass('selected');
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
    
    $('.btnRouteSelection').removeClass('selected');
    
    fxes.forEach( (fx) => {
        $(`.btnRouteSelection:contains(${fx})`).addClass('selected');
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

function onSynthToolbarUpdate() {
  window.zsession.layerID = document.querySelector('#synth-layer select')
    .selectedIndex;
  
  //console.log("Updating synth toolbar");
  
  window.zsession.oscElements['bundle-synth-toolbar'].sync()
    .then ( (data) => {
      console.log(data);
      result = osc_map_to_control(data);
      window.zsession.oscElements['synth-toolbar-layer-enabled']
        .setValue(result['Penabled']);
      
      showIf('synth-toolbar-ad-enabled', result['Padenabled'], 'disabled');
      showIf('synth-toolbar-sub-enabled', result['Psubenabled'], 'disabled');
      showIf('synth-toolbar-pad-enabled', result['Ppadenabled'], 'disabled'); 
      
      window.zsession.elements['adsynth-voice'].setSelection(window.zsession.voiceID);
  });
}

function onSynthToolbarVoiceUpdate(event) {
  window.zsession.voiceID = 
    event.target.options[event.target.selectedIndex].value;
    
  set_synth_cursor();
  
  //reload the section or return to main synth
  let currentActiveSection = document.querySelector('#section-content section.opened');
  
  //Adsynth Oscillator not availale in global
  if (currentActiveSection.id == 'section-synth-osc'
   && window.zsession.voiceID == ADSYNTH_GLOBAL){
     onSynth();
  } else {
    window.zsession.reloadSynthSubSection();
  }
}

function onSynth(synth) {
  if (window.zsession.initSynthMain === undefined) {
    
    // Synth toolbar init
    let zeroTo15 = [...Array(16).keys()];
    let swipe = new Swipeable(document.getElementById('synth-layer'));
    swipe.setOptions(zeroTo15, 
      zeroTo15.map ( el => "Layer "+(String(el+1).padStart(2,0)) )
    );
    swipe.setDialogData({'title': 'Select layer', 'buttonClass' : 'col-4'});
    swipe.selectElement.addEventListener('change', onSynthToolbarUpdate);
   
    let toolbarUpdateObject = new OSCBundle(['/part/kit/Padenabled',
        '/part/kit/Psubenabled', '/part/kit/Ppadenabled',
        '/part/kit/Penabled']);
    window.zsession.oscElements['bundle-synth-toolbar'] = toolbarUpdateObject;
    
    new OSCBoolean(document.getElementById('synth-toolbar-layer-enabled'))
      .label = ('Layer enabled');
    
    swipe = new Swipeable(document.getElementById('adsynth-voice'));
    let zeroToEight = [...Array(8).keys()];
    swipe.setOptions(
      [ADSYNTH_GLOBAL,...zeroToEight],
      ['Global'].concat(zeroToEight.map ( 
        (el) => 'Voice '+(String(el+1).padStart(2,0))
        )
      ));
    swipe.setDialogData({'title': 'Select voice', 'buttonClass' : 'col-3'});
    
    swipe.selectElement.addEventListener('change', onSynthToolbarVoiceUpdate);
    
    swipe.setValue(window.zsession.voiceID);
    
    
    window.zsession.elements['adsynth-voice'] = swipe;
    
    //enable synth
    let obj = new OSCBoolean(document.getElementById('synth-enabled'));
    
    //turn on/off toolbar
    obj.HTMLElement.addEventListener( 'sync' , (event)=> {
      value = Object.values(event.detail)[0][0];
      let id= `synth-toolbar-${window.zsession.synthID}-enabled`;
      showIf(id, value, 'disabled');
    });
    
    window.zsession.initSynthMain = true;
  }
  
  //refresh synth cursor
  set_synth_cursor(synth);
  if (synth == undefined)
    synth = window.zsession.synthID;
  
  document.querySelectorAll('#synthSelector button.selected')
      .forEach ( (btn)=>btn.classList.remove('selected'));
  
  //general stuff
  showIf('adsynth-voice', synth == 'ad');
  
  showIf('adsynth-edit', synth == 'ad');
  showIf('subsynth-edit', synth == 'sub');
  showIf('padsynth-edit', synth == 'pad');
  
  let section = document.getElementById('section-synth');
  
  //set caption
  document.getElementById('current-synth').innerHTML = 
      synth.toUpperCase()+'SYNTH';

  window.zsession.oscElements['synth-enabled'].sync();
    
  loadSection('section-synth');
  setSelectedToolbarButton(document.getElementById('part-toolbar-synth'));
  
  document.getElementById(`synth-toolbar-${synth}-enabled`)
          .classList.add('selected');
          
  window.zsession.reloadSynthSubSection = onSynth;
}

function onSynthOSC() {
  if (window.zsession.initSynthOSC === undefined) {
    
    /* synth-osc-wave is a representation of an OSC bundle actually */
    let swipe = new Swipeable(document.getElementById('synth-osc-wave'));
    swipe.setOptions( [...Array(16).keys(),17,18],
      ['Sine','Triangle','Pulse','Saw','Power','Gauss','Diode','AbsSine',
        'PulseSine','StretchSine', 'Chirp', 'AbsStrSine', 'Chebyshev',
        'Square','Spike','Circle','White noise','Pink noise']
    );
    swipe.setDialogData({ 'title' : 'Select base wave', 'buttonClass': 'col-6 col-lg-4'});
    
    swipe.selectElement.addEventListener('change', (ev) => {
      let value = ev.target.options[ev.target.selectedIndex].value;
      let typeValue = Math.max(0, value - 16);
      window.zsession.oscElements['synth-generator-type'].act (typeValue);
      
      if (typeValue == 0)
        window.zsession.oscElements['synth-generator-wave'].act(value);
    });
  
    window.zsession.elements['synth-osc-wave'] = swipe;
    
    new OSCElement(document.getElementById('synth-generator-type'));
    new OSCElement(document.getElementById('synth-generator-wave'));
    new OSCKnob(document.getElementById('synth-osc-wave-p'),
      undefined, BALANCE);
    
    new OSCSwipeable(document.getElementById('synth-osc-shaper'),
      [...Array(18).keys()],
      ['None', 'Arc Tang.', 'Asymmetric', 'Pow', 'Sine', 'Quantis.', 'Zigzag',
        'Limiter', 'Up Limit', 'Low limit', 'Inverse Lim.', 'Clip', 'Asym2', 'Pow2', 'Sigmoid',
        'TanH','Cubic','Square' ],
      { 'title': 'Select shaper', 'buttonClass': 'col-6 col-lg-4'}
      );
    new OSCKnob(document.getElementById('synth-osc-shaper-p'));
      
    new OSCSwipeable(document.getElementById('synth-osc-h'),
      [...Array(9).keys()],
      ['Off', 'On', 'Square', '2xSub','2xAdd', '3xSub', '3xAdd',
        '4xSub', '4xAdd'],
      { 'title': 'Select harmonics', 'buttonClass': 'col-4 col-lg-3'}
      );
    new OSCKnob(document.getElementById('synth-osc-h-f'),undefined,
      {'type': 'Harmonic frequency', 'min' : 0, 'max' : 255, 'itype': 'i'} );
    new OSCKnob(document.getElementById('synth-osc-h-p'),undefined,
      {'type': 'Harmonic power', 'min' :0, 'max' : 200, 'itype': 'i'} );
    
    
    new OSCSwipeable(document.getElementById('synth-osc-fm'),
     [...Array(6).keys()],
     ['Off','Morph','Ring', 'PM', 'FM', 'PWM'],
     {'title': 'Frequency Mod Type', 'buttonClass': 'col-12'}
    );
    
    
    //Unison
    new OSCKnob(document.getElementById('synth-uni-size'), undefined,
      {'min':1,'max':50, 'type': '# of voices'});
      
    let osc = new OSCKnob(document.getElementById('synth-uni-spread'), undefined,
      {'min':0,'max':200, 'type': '%', 'itype': 'f'});
    osc.serverRange = CC_RANGE;
    
    new OSCKnob(document.getElementById('synth-uni-phase'));
    new OSCKnob(document.getElementById('synth-uni-vib'));
    new OSCKnob(document.getElementById('synth-uni-speed'));
    
    window.zsession.initSynthOSC = true;
  }
  
  var bChangedPart = false;
  if (window.zsession.voiceID == ADSYNTH_GLOBAL) {
    window.zsession.voiceID = 0;
    window.zsession.elements['adsynth-voice'].setSelection(1);
    
    bChangedPart = true; //setting for later as sync clears msg
  }
  
  osc_synch_section(document.getElementById('section-synth-osc')). then ( () => {
    
    //Synch complex swiper
    let val = parseInt(window.zsession.oscElements['synth-generator-type']
      .HTMLElement.dataset.value);
    if (val > 0) {
      window.zsession.elements['synth-osc-wave'].setSelection(val+16);
   
      Array.from( document.querySelectorAll('#section-synth-osc .osc-element'))
        .map ( (el) => el.id)
        .forEach ( (id) => {window.zsession.oscElements[id].setEnabled(false)});
    } else {
      window.zsession.elements['synth-osc-wave'].setSelection(
        window.zsession.oscElements['synth-generator-wave']
          .HTMLElement.dataset.value );
      Array.from( document.querySelectorAll('#section-synth-osc .osc-element'))
        .map ( (el) => el.id)
        .forEach ( (id) => {window.zsession.oscElements[id].setEnabled(true)});
    }
    
    window.zsession.onChangeSynth=onSynth;
    window.zsession.reloadSynthSubSection = onSynthOSC;
    
    if (bChangedPart)
      displayOutcome('Switching to adsynth voice #1');
      
    loadSection('section-synth-osc');
  });
}

function onSynthAmplitude() {
  window.zsession.reloadSynthSubSection = onSynthAmplitude;
  
  loadAmplitudeEditor('VCA', 'section-synth', onSynthAmplitudeLFO,
    onSynthAmplitudeEnvelope);
}

function onSynthAmplitudeLFO() {
  window.zsession.reloadSynthSubSection = onSynthAmplitudeLFO;
  
  let sc = osc_sanitize('/synthcursor/AmpLfo');
  
  let enable = (window.zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PAmpLfoEnabled');
    
  loadLFOEditor( 'synth-edit-amp', enable, sc);
}

function onSynthAmplitudeEnvelope() {
  window.zsession.reloadSynthSubSection = onSynthAmplitudeEnvelope;
  
  let sc = osc_sanitize('/synthcursor/AmpEnvelope');
  
  let enable = (window.zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PAmpEnvelopeEnabled');
    
  loadEnvelopeEditor('Amp Envelope', 'synth-edit-amp',
   enable, sc,
   [1,1,1,0,0,1,0]
   );
}

function onSynthFilter() {
  window.zsession.reloadSynthSubSection = onSynthFilter;
  
  let sc, enable;
  
  if (window.zsession.voiceID == ADSYNTH_GLOBAL){
    enable = null;
    sc = osc_sanitize('/synthcursor/GlobalFilter');
  } else {
    enable = osc_sanitize('/synthcursor/PFilterEnabled');
    sc = osc_sanitize('/synthcursor/VoiceFilter');
  }
    
  loadFilterEditor('VCF', 'section-synth', 
    enable, sc, onSynthFilterLFO, onSynthFilterEnvelope);
}

function onSynthFilterLFO() {
  window.zsession.reloadSynthSubSection = onSynthFilterLFO;
  
  let sc = osc_sanitize('/synthcursor/FilterLfo');
  
  let enable = (window.zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PFilterLfoEnabled');
    
  loadLFOEditor('synth-edit-filter', enable, sc);
}

function onSynthFilterEnvelope() {
  window.zsession.reloadSynthSubSection = onSynthFilterEnvelope;
  
  let sc = osc_sanitize('/synthcursor/FilterEnvelope');
  
  let enable = (window.zsession.voiceID == ADSYNTH_GLOBAL)
    ? null : osc_sanitize('/synthcursor/PFilterEnvelopeEnabled');
    
  loadEnvelopeEditor(
  'Filter Envelope', 'synth-edit-filter',
  enable, sc,
  [1,1,1,1,1,0,1]
  );
}

function onSynthFrequency() {
  window.zsession.reloadSynthSubSection = onSynthFrequency;
  
  let sc = osc_sanitize('/synthcursor');
  
  loadFrequencyEditor('VCO', 'section-synth', '', sc,
    onSynthFrequencyLFO, onSynthFrequencyEnvelope);
}

function onSynthFrequencyLFO() {
  window.zsession.reloadSynthSubSection = onSynthFrequencyLFO;
  
  let sc = osc_sanitize('/synthcursor/FreqLfo');
  
  let enable = (window.zsession.voiceID == ADSYNTH_GLOBAL)
    ? null 
    : osc_sanitize('/synthcursor/PFreqLfoEnabled');
    
  loadLFOEditor('synth-frequency-editor', enable, sc);
}

function onSynthFrequencyEnvelope() {
  window.zsession.reloadSynthSubSection = onSynthFrequencyEnvelope;
  
  let sc = osc_sanitize('/synthcursor/FreqEnvelope');
  
  let enable = (window.zsession.voiceID == ADSYNTH_GLOBAL)
    ? null : osc_sanitize('/synthcursor/PAmpEnvelopeEnabled');
    
  loadEnvelopeEditor(
  'Wave Frequency Env.', 'synth-frequency-editor',
  enable, sc,
  [1,0,1,1,0,0,1]
  );
}

function onSynthFMFrequency() {
  window.zsession.reloadSynthSubSection = onSynthFMFrequency;
  
  let sc = osc_sanitize('/synthcursor');
  
  loadFrequencyEditor('FM Frequency', 'section-synth-osc', 'FM', sc,
    null, onSynthFMFrequencyEnvelope);
}

function onSynthFMFrequencyEnvelope() {
  window.zsession.reloadSynthSubSection = onSynthFMFrequencyEnvelope;
  
  let sc = osc_sanitize('/synthcursor')+'/FMAmpEnvelope';
  loadEnvelopeEditor('FM Frequency Env', 'synth-frequency-editor',
    osc_sanitize('/synthcursor/PFMAmpEnvelopeEnabled'),
    sc,
    [1,0,1,1,0,0,1]
  );     
}

function onSynthSubHarmonics() {
  if (window.zsession.initSubH === undefined){
    new OSCButton(document.getElementById('sub-h-clear'));
    
    new OSCSwipeable(document.getElementById('sub-h-mag-type'),
    [0,1,2,3,4],
    ['Linear', '-40 Db', '-60 Db', '-80 Db', '-100 Dd'],
    {'title' :'Magnitude type'}
    );
    
    new OSCSwipeable(document.getElementById('sub-h-spread-type'),
    [...Array(8).keys()],
    ['Harmonic', 'Shift U', 'Shift L', 'Power U', 'Power L', 'Sine', 'Power', 'Shift'],
    {'title' :'Spread type'}
    );
    
    new OSCKnob(document.getElementById('sub-h-stages'),
      null, {'min': 1, 'max': 5, 'type': 'Stages', 'itype': 'i'});
        
    for (let i = 1; i < 4; i++) {
      let obj = new OSCKnob(document.getElementById(`sub-h-spread-${i}`));
      obj.label="Parameter " + i;
    }
    window.zsession.initSubH = true;
  }
  
  osc_synch_section(document.getElementById('section-synth-harmonics'))
    .then ( () => {
      loadSection ('section-synth-harmonics');
    });
}

function onSynthSubBandwidth() {
   if (window.zsession.initSubB === undefined){
     new OSCSwipeable(document.getElementById('sub-band-init'),
     [0,1,2],
     ['Zero', 'Random', 'Ones']);
     
     new OSCKnob(document.getElementById('sub-band-band'));
     new OSCKnob(document.getElementById('sub-band-stretch'));
     window.zsession.initSubB = true;
   }
   
   osc_synch_section(document.getElementById('subsynth-bandwidth'))
    .then ( ()=> {
      loadSection('subsynth-bandwidth');
    });
}

function onSynthSubMagnitudeGen() {
  new ZynthoREST().query('status/subsynth'). then ( (data) => {
    loadHarmonicsEditor('H. Magnitude', data, 'magnitude', 
      osc_sanitize('/synthcursor/Phmag'));
  });
}

function onSynthSubBandwidthGen() {
  new ZynthoREST().query('status/subsynth'). then ( (data) => {
    loadHarmonicsEditor('R. Bandwidth', data, 'bandwidth', 
      osc_sanitize('/synthcursor/Phrelbw'));
  });
}



function onScriptOK() {
  $('#pnlConsole div').addClass('hidden');
  $('#pnlConsole button, #pnlConsole textarea').removeClass('hidden');
  $('#pnlConsole button[value=ok]').addClass('hidden')
}

function onSystemInfo() {
    doQuery('system', null, (data) => {
      console.log(data);
      let space = $('#pnlSystemInfo > div:first-child');
      space.empty();
      space.append(`<p class='col-12'>Temp: ${data.cpuTemp}</p>`);
      space.append(`<p class='col-12'>JACK<span class="d-none d-md-inline"> process status</span>: <i class="${(data.jackProcess != null) ? 'fa fa-check-circle' : 'fa fa-times-circle'}"></i></p>`);
      space.append(`<p class='col-12'>ZynAddSubFX<span class="d-none d-md-inline"> status</span>: <i class="${(data.zynProcess != null) ? 'fa fa-check-circle' : 'fa fa-times-circle'}"></i></p>`);
      space.append(`<p class='col-12'>Cartridge: ${data.workingDir}</p>`);
    });
}

function onSystemMIDI() {
  doQuery('system/midi', null, (data) => {
    
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
      let selClass = (item.connected) ? "selected" : "";
      
      let content = `<button class="col-sm-12 col-md-8 col-lg-6 ${selClass}" value="${item.port}">${item.name}`+"</button>";
      $(midiCont).append(content);
    });
    
    //Add action to midi device buttons: plug in device
    $(midiCont).children('button').on('click', (e) => {
      let target = $(e.target);
      let plugged = $(target).hasClass('selected');
      
      doAction('system/midi/plug', 
        {'name': $(target).val(), 'status': !plugged}, (data) =>{
          onSystemMIDI();
        });
    });
  });
}

function onSystemNetwork() {
  doQuery('system', null, (data) => {
    console.log(data);
    let space = $('#pnlSystemNetwork > div:first-child');
    space.empty();
    space.append("<p class='col-12'>Net address:"+data.netAddress.reduce( (acc, x)=> acc+", "+x)+"</p>");
    
    let btnDoHotspot = $('#pnlSystemNetwork > div:nth-child(2) > div:first-child button'),
      btnDoWifi = $('#pnlSystemNetwork > div:nth-child(2) > div:last-child button');
    
    btnDoHotspot.prop('disabled', data.isHotspot);
    btnDoWifi.prop('disabled', !data.isHotspot);
    
  });
}

function onSystemNetworkChange(toHotspotVal) {
  doAction('network-change', {toHotspot : toHotspotVal}, (data) => {
    $('main').addClass('hidden');
    $('body').append('<small>Please change connection to reconnect to client</small>');
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
  let select = $('#keybSessionList').find('li.selected');
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
  let select = $('#keybSessionList').find('li.selected');
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
        btnClass='selected';
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

//controls are created at start as this is the default page see main.js
function onPartMixer() {
  osc_synch_section(document.getElementById('section-part-main'))
  .then ( ()=> {
    loadSection('section-part-main');
    setSelectedToolbarButton(document.querySelector('#partToolbar > button:nth-child(1)'));
  });
}

function onPartControl() {
  
  // Init controls
  if (window.zsession.initControl === undefined) {
     new OSCSwipeable(
      document.getElementById('part-ctl-channel'),
      OneToSixteen.map ( (e)=> e-1), 
      OneToSixteen.map( (val, index, arr) => 
        {return "#"+String(index+1).padStart(2,'0');} ),
      { 'title' : 'Channel', 'class' : 'col-4' }
    );
    
    //window.zsession.oscElements['part-ctl-channel'].setLabel('Midi channel', 'Midi');
    
      new OSCMidiNote( document.getElementById('part-ctl-minkey') );
      new OSCMidiNote( document.getElementById('part-ctl-maxkey') );
      new OSCKnob( document.getElementById('part-ctl-transpose') )
        .range = SEMITONE;
      
    window.zsession.initControl = true;
  }
  
  //synch osc
  osc_synch_section(document.getElementById('section-part-control'))
    .then ( () => {
    //enable section
    loadSection('section-part-control');
    setSelectedToolbarButton(
      document.querySelector('#partToolbar .i-piano')
      .parentElement);
  });
}

function onPartControlPoly() {
  if (window.zsession.initControlPoly === undefined) {
     new OSCSwipeable(
      document.getElementById('part-ctl-polytype'),
      [0,1,2], 
      ['Poly', 'Mono', 'Legato'],
      { 'title' : 'Poly mode', 'class' : 'col-12' }
    );
    window.zsession.oscElements['part-ctl-polytype']
      .setLabel('Polyphony mode', 'Polyphony');
      
    
      new OSCKnob(document.getElementById('part-ctl-keylimit'));
      new OSCBoolean(document.getElementById('part-ctl-drummode'));
    window.zsession.initControlPoly = true;
  }
  
  osc_synch_section(document.getElementById('section-ctl-poly'))
    .then ( () => {
    //enable section
    loadSection('section-ctl-poly');
  });
}

function onPartControlVelo() {
  if (window.zsession.initControlVelo === undefined) {
      new OSCKnob(document.getElementById('part-ctl-velsns'));
      new OSCKnob(document.getElementById('part-ctl-veloffs'));
    window.zsession.initControlVelo = true;
  }
  
  osc_synch_section(document.getElementById('section-ctl-velocity'))
    .then ( () => {
    //enable section
    loadSection('section-ctl-velocity');
  });
}

function onPartControlDepth() {
  if (window.zsession.initControlDepth === undefined) {  
    new OSCKnob(document.getElementById('part-ctl-depth-pan'));
    new OSCKnob(document.getElementById('part-ctl-depth-cutoff'));
    new OSCKnob(document.getElementById('part-ctl-depth-q'));
    new OSCKnob(document.getElementById('part-ctl-depth-modwheel'));
    new OSCBoolean(document.getElementById('part-ctl-modwheel-exponential'));
    new OSCBoolean(document.getElementById('part-ctl-bandwidth-exponential'));
    new OSCKnob(document.getElementById('part-ctl-depth-bandwidth'));
    new OSCBoolean(document.getElementById('part-ctl-expression-receive'));
    new OSCBoolean(document.getElementById('part-ctl-volume-receive'));
    new OSCBoolean(document.getElementById('part-ctl-fmamp-receive'));
    new OSCBoolean(document.getElementById('part-ctl-sustain-receive'));
    window.zsession.initControlDepth = true;
  }
  osc_synch_section(document.getElementById('section-part-control-response'))
    .then ( () => { loadSection('section-part-control-response');
  });
}

function onPartControlPitch() {
  if (window.zsession.initControlPitch === undefined) {  
    
    new OSCKnob(document.getElementById('part-ctl-pitch-range'));
    window.zsession.oscElements['part-ctl-pitch-range']
      .range = BEND_RANGE;
      
    new OSCBoolean(document.getElementById('part-ctl-pitch-split'));
    
    new OSCKnob(document.getElementById('part-ctl-pitch-range-down'));
      window.zsession.oscElements['part-ctl-pitch-range-down']
        .range = BEND_RANGE;
    
    window.zsession.oscElements['part-ctl-pitch-split']
      .bindEnable('part-ctl-pitch-range-down');
    window.zsession.initControlPitch = true;
  }
  
  osc_synch_section(document.getElementById('section-part-control-pitch'))
    .then ( () => {
      loadSection('section-part-control-pitch');
  });
}

function onPartControlPortamento() {
  if (window.zsession.initPartControlPortamento === undefined) {
    new OSCBoolean(document.getElementById('part-ctl-port-enable'));
    new OSCBoolean(document.getElementById('part-ctl-port-receive'));
    new OSCKnob(document.getElementById('part-ctl-port-length'));
    new OSCKnob(document.getElementById('part-ctl-port-updown'));
    
    new OSCBoolean(document.getElementById('part-ctl-port-proportional'));
    new OSCKnob(document.getElementById('part-ctl-port-proprate'));
    new OSCKnob(document.getElementById('part-ctl-port-propdepth'));
    
    window.zsession.oscElements['part-ctl-port-proportional']
      .bindEnable( 'part-ctl-port-proprate', 'part-ctl-port-propdepth' );
    
    new OSCSwipeable(document.getElementById('part-ctl-port-pitchtype'),
      ['F', 'T'],
      ['Include','Exclude'],
      {'title': 'Threshold behaviour'}
      );
    //new OSCBoolean(document.getElementById('part-ctl-port-pitchtype'));
    new OSCKnob(document.getElementById('part-ctl-port-pitchthresh'));
    window.zsession.initPartControlPortamento = true;
    
    window.zsession.oscElements['part-ctl-port-enable'].bindEnable(
      'part-ctl-port-length', 'part-ctl-port-updown',
      'part-ctl-port-proportional', 'part-ctl-port-pitchtype',
      'part-ctl-port-pitchthresh');
  }
  
  osc_synch_section(document.getElementById('section-part-control-portamento'))
    .then ( () => {
      loadSection('section-part-control-portamento');
  });
}

function onPartFX() {
  if (window.zsession.initPartFX == undefined){
    
      //initialize send to global
      for (let i = 0; i < 4; i++)
        new OSCKnob(document.getElementById(`part-fx-send-${i}`));
    
      //Initialize route matrix
      let entries = [0,1,2];
      let labels = ['Next', 'Part out', 'Dry out']
      for (let i = 0; i < 3; i++){
        let obj = new OSCSwipeable(document.getElementById(`part-fx-route-${i}`),
          entries, labels, {'title' : 'Route part to...'});
        document.getElementById(`p-r-trigger-${i}`)
          .addEventListener('click', (ev)=>{
            obj.HTMLElement.querySelector("label").click()
         });
         obj.HTMLElement.addEventListener('act',onPartFXMatrixAct);
         //obj.HTMLElement.addEventListener('sync',onPartFXMatrixUpdate);
      }
      
    window.zsession.initPartFX = true;
  }
  
  new ZynthoREST().query('/status/partfx', 
    {id: window.zsession.partID} ).then ( (data) => {
    //fx buttons
    for (let i = 0; i < 3; i++) {
      let element = document.getElementById(`part-fx-${i}`);
      element.innerHTML = data.efx[i].name;
      if (data.efx[i].bypass)
        element.classList.add('disabled');
      else
        element.classList.remove('disabled');
     
     onPartFxSetMatrixValue(i, data.efx[i].route);
      
      //window.zsession.oscElements[`part-fx-route-${i}`].setValue(data.efx[i].route);
      //onPartFXMatrixUpdate(data);
    }
    
    
    for (let i = 0; i < 4; i++) {
      let id = `part-fx-send-${i}`;
      //let element = document.getElementById(id);
      window.zsession.oscElements[id].setLabel(data.sysefxnames[i]);
      window.zsession.oscElements[id].setEnabled((data.sysefxnames[i] != 'None'));
    }
    
    loadSection('section-part-fx');
    setSelectedToolbarButton(document.getElementById('part-toolbar-fx'));
  });
}

/* TODO: not an event */
function onPartFxSetMatrixValue(id, val) {
  for (let i = 0; i < 3; i++) {
      if (i != val) {
        document.getElementById(`p-r-${id}-${i}`)
          .classList.add('hide-content');
      } else {
        document.getElementById(`p-r-${id}-${i}`)
          .classList.remove('hide-content');
      }
  }
}

function onPartFXMatrixAct(data){
  let id = /Pefxroute(\d)/.exec(data.detail.script)[1];
  let val = parseInt(/\d+$/.exec(data.detail.script)[0]);
  
  onPartFxSetMatrixValue(id, val);
}

function onPartFXEdit(fxid) {
    window.zsession.fxcursor=`/part${window.zsession.partID}/partefx${fxid}`;
    new ZynthoREST().query('status/fx', {'path': window.zsession.fxcursor})
      .then ( (data) => {
        loadFXEditor(data, `Edit Part FX #${fxid}`, 'section-part-fx');
        document.querySelector('#fx-type select')
          .addEventListener('change', onPartFXEditFxChanged);
        document.querySelector('#fx-part-bypass')
          .addEventListener('sync', onPartFXEditFxBypass);
    });
}

function onPartFXEditFxChanged(event) {
  let changed = event.target.options[event.target.selectedIndex].text;
  let fxid = /\d+$/.exec(window.zsession.fxcursor)[0];
  document.getElementById(`part-fx-${fxid}`).innerHTML = changed;
}

function onPartFXEditFxBypass(event) {
  let fxid = /\d+$/.exec(window.zsession.fxcursor)[0];
  if (OSC_BOOL(event.detail[0]) == 'T')
    document.getElementById(`part-fx-${fxid}`).classList.add('disabled');
  else
    document.getElementById(`part-fx-${fxid}`).classList.remove('disabled');
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
      btn.addClass('selected');
      span.removeClass('i-midi');
      span.addClass('i-midi-alt');
    });
  } else {
    doAction('script', {script: `/part${part}/Prcvchn ${part}`}, ()=>{
      displayMessage(`Part #${part+1} chan restored.`);
      split.channel = part;
      
      let btn = $(`#keybSplitTable > .row:nth-child(${part+1}) > div:nth-child(4) > button:nth-child(4)`);
      let span = btn.find('span');
      btn.removeClass('selected');
      span.removeClass('i-midi i-midi-alt');
      
      if (part == midiChan) {
        btn.addClass('selected');
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
    button.removeClass('selected');
    
    if (split.channel == val) {
      button.addClass('selected');
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
    $(`#pnlUADSR button[value=${type}]`).addClass('selected');
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

function onTempo() {
  let currentvalue = parseInt(document.querySelector('#global-tempo p')
    .innerHTML);
  
  let newTempo = prompt('Enter new tempo', currentvalue);
  if (isNaN(newTempo) || newTempo < 1)
    return;
  else {
    window.zsession.oscElements['global-tempo'].act(newTempo)
    .then ( () => {
      window.zsession.oscElements['global-tempo'].setValue(newTempo)
      }) ;
  }
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
          
          let li = $('#selInstruments li.selected');
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
  new ZynthoREST().query('status/part', 
      {id: window.zsession.partID})
  .then ( (data) => {
    if (data.name == '') data.name = 'Unloaded';
  
    displayOutcome('Switched part');
    document.getElementById('instrumentName').innerHTML = 
            (data.enabled)
            ? `#${window.zsession.partID+1}: ${data.name}`
            : `#${window.zsession.partID+1}: Disabled`;
            
   
  });
  
}

//this currently only updates volume
function onToolbarUpdate() {
  window.zsession.oscElements['global-volume'].sync();
  window.zsession.oscElements['global-tempo'].sync();
}
