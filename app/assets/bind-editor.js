
function loadBindEditor(bind, add=false) {
    if (zsession.initBindEditor === undefined) {
      
      let editorA = document.getElementById('bind-editor-part-key');
      let editorB = document.getElementById('bind-editor-layer-key');
      let editorC = document.getElementById('bind-editor-ad-voice-key');
      let editorD = document.getElementById('bind-editor-channel');
      
      [editorA,editorB,editorC].forEach( (editor) => {
        editor.options.add(new  Option ( '-', '' ));
        editor.options.add(new  Option ( 'Ch', '${ch}' ));
      });
      
      editorD.options.add(new Option ( 'all', 'all' ));
      
      for (let i = 0; i < 16; i++) {
        let str = String(i+1).padStart(0,2);
        //let opt = new Option ( i, str );
        
        editorA.options.add ( new Option ( str, i ) );
        editorB.options.add ( new Option ( str, i ) );
        if (i < 8)
          editorC.options.add( new Option ( str, i ) );
          
        editorD.options.add(new Option ( str, i+1 ));
      }
      
      document.getElementById('bind-editor-cancel').addEventListener('click',
        (event) => { 
          document.getElementById('bind-editor').open = false;
          event.stopPropagation();
        });
      
      let toggleInvert = document.getElementById('bind-editor-reverse');
      toggleInvert.addEventListener('click', onToggleButtonClick);
      
      let select = document.getElementById('bind-editor-type');
      
      select.addEventListener('change', (event)=>{
        let min = document.getElementById('bind-editor-min'),
            max = document.getElementById('bind-editor-max');
            
        switch (select.value) {
          case 'abs': case 'bool': case 'trigger': {
            document.getElementById('bind-editor-range')
              .classList.add('hidden');
          break;
          }
          case 'int': 
            document.getElementById('bind-editor-range')
              .classList.remove('hidden');
           // min.type=max.type='number';
            min.pattern=max.pattern = '';
            //min.value = max.value = '0';
          break;
          case 'float':
          document.getElementById('bind-editor-range')
              .classList.remove('hidden');
            min.pattern=max.pattern='[0-9]+\\.?[0-9]';
            //min.value=max.value='0.0';
          break;
        }
      });
      zsession.initBindEditor = true;
    }
    
    let data = { ...{
      "type" : "abs",
      "cc" : 0
      }, ...bind
    };
    
    /*
     * Reduce to simpler types:
     * - fader/abs : abs
     * - fader/int : int
     * - fader/bool : bool
     * - fader/float : float
     * - trigger : action
    */
    
    if (bind['fader']) data['type'] = bind['fader'];
    if (bind['trigger']) data['type'] = 'action';
    
    //Set min/max if necessary
    if (data['type'] == 'int' || data['type'] == 'float'){
      if (bind['min'])
        document.getElementById('bind-editor-min').value = bind.min;
      if (bind['max'])
        document.getElementById('bind-editor-max').value = bind.max;  
    }
      
    document.getElementById('bind-editor-cc-value').value = data.cc;
    if (Array.isArray(data.osc)) {
      if ( data.osc.length > 0) {
        document.getElementById('bind-editor-osc-paths').value =
        data.osc.reduce ( (acc, el)=> acc + "\n"+el )
      }
    } else {
      document.getElementById('bind-editor-osc-paths').value =
        data.osc;
    }
    
    selectIf ('bind-editor-reverse', data.type.endsWith('-'));
    
    document.getElementById('bind-editor-type').value = 
      data.type.replace('-','');
    
    //zsession.elements['bind-editor-type'].setValue(data.type.replace('-',''));
    
    showIf('bind-editor-ok', !add);
    showIf('bind-editor-add', add);
    showIf('bind-editor-target-row', add);
    
    showIf('bind-editor-range', 
      ['int','float'].indexOf(data['type'])>-1);
    
    //query controllers
    let promise = null;
    if (add) {
      promise = new ZynthoREST().query('/controllers').then ( (data) => {
        
        let sel = document.getElementById('bind-editor-target');
        sel.innerHTML = '';
        sel.options.add(new Option('Session', 'session'));
        
        data.filter( (el) => el.connected)
          .map ( el => el.name)
          .forEach ( name => sel.options.add(
            new Option(
              (name .length > 10) 
                ? name.substring(0,9)+'…'
                : name,
              name) 
          ));
        
        return true;
      });
    } else {
      promise = Promise.resolve(true);
    }
    
    promise.then( ()=> {
      document.getElementById('bind-editor').open = true;
    });
}

function onBindEditorApplyKeys() {
  let textarea = document.getElementById('bind-editor-osc-paths');
  let data = textarea.value.split('\n').filter ( line => line != '');
  //console.log(data);
  
  ['bind-editor-part-key', 'bind-editor-layer-key',
    'bind-editor-ad-voice-key'].forEach ( (id) => {
      let value = document.getElementById(id).value;
      if (value == '') return;
      
      switch ( id ) {
        case 'bind-editor-part-key':
           data = data.map ( 
            (line) => line.replace(/part[^\/]*\//,`part${value}/`));
        break;
        case 'bind-editor-layer-key':
          data = data.map (
            (line) => line.replace(/kit[^\/]*\//,`kit${value}/`) );
        break;
        case 'bind-editor-ad-voice-key':
          data = data.map (
            (line) => line.replace(/VoicePar[^\/]*\//,`VoicePar${value}/`));
        break;  
      }
    });
  
  textarea.value = data.join('\n');
}

function loadBindMap(bindings) {
  //zsession.bindListEditor.currentEditedBindings = bindings;
  
  //update UI
   ['bf-edit-del', 'bf-edit-edit'].forEach ( 
    id =>  document.getElementById(id).disabled = true);
  
  zsession.bindListEditor.currentPath = null;
  
  let table = document.getElementById('bind-editor-list');
  
  let body = document.createElement('tbody');
      
  if (Object.keys(bindings).length > 0) {
    let channels = Object.keys(bindings);
    
    channels.forEach( (ch) => {
      let data = bindings[ch];
      for (let i = 0; i < data.length; i++) {
        let id = `${ch}/${i}`;
        let row = document.createElement('tr');
        
        row.appendChild(document.createElement('td'));
        row.appendChild(document.createElement('td'));
        row.appendChild(document.createElement('td'));
        
        row.dataset.path = id;
        row.cells[0].innerText = ch;
        row.cells[1].innerText = data[i].cc;
        
        let osc = data[i].osc;
        row.cells[2].innerText = (Array.isArray(osc))
          ? '[ Multiple OSC ]'
          : osc;

        row.addEventListener('click', onBindListSelect);
        body.appendChild(row);
      }
    });
  } 
  //table.appendChild(body);
  table.replaceChild(body, table.children[2]);
}

function onBindListSelect(event) {
  let target = event.target;
  
  while ( target != null && target.tagName != "TR" )
    target = target.parentNode;
  
  document.getElementById('bind-editor-list')
    .querySelectorAll('.selected')
    .forEach ( (el)=> el.classList.remove('selected'));
  
  target.classList.add('selected');
  
  ['bf-edit-del', 'bf-edit-edit'].forEach ( 
    id =>  document.getElementById(id).disabled = false);
  
  zsession.bindListEditor.currentPath = 
    target.dataset.path.split('/');
}

function createBindingFromDialog() {
  let dataObject = {
    'cc' : document.getElementById('bind-editor-cc-value').value,
  };
  
  let type= document.getElementById('bind-editor-type').value;
  let isInverted = document.getElementById('bind-editor-reverse').classList
    .contains('selected');
  
  switch (type) {
    case 'bool':
      dataObject['max'] = 64;
      dataObject['fader'] = type;
    break;
    case 'int': 
      dataObject['fader'] = type;
      dataObject['max'] = document.getElementById('bind-editor-max').value;
      dataObject['min'] = document.getElementById('bind-editor-min').value;
    break;
    case 'float': 
      dataObject['fader'] = type;
      dataObject['max'] = toFixed(
        document.getElementById('bind-editor-max').value, 2);
      dataObject['min'] =  toFixed(
        document.getElementById('bind-editor-min').value, 2);
    break;
    case 'abs':  {
      dataObject['fader'] = type;
    break;
    }
    
    case 'trigger': {
      dataObject['trigger'] = 1;
    }
    
    default : throw 'unsupported';
  }
  
  //Note: 
  if (dataObject['fader'] && isInverted)
    dataObject['fader'] += '-';
  
  dataObject['osc'] = document.getElementById('bind-editor-osc-paths')
    .value.split('\n').filter ( line => line != '');
  
  if (dataObject['osc'].length == 1)
    dataObject['osc'] = dataObject['osc'][0];
    
  return dataObject;
}

function onBindDialogAdd() {
  
  let dataObject = createBindingFromDialog();
  let ch = document.getElementById('bind-editor-channel').value;
  
  // Update an opened list vs. update a remote list
  if ( zsession.bindListEditor.currentSession != null) {
    let binds = zsession.bindListEditor.currentSession.bindings;
    
    //path: 0 -> channel, 1: index
    if (binds[ch] === undefined)
      binds[ch] = [dataObject];
    else
      binds[ch].push (dataObject);
    
    new ZynthoREST().post('setbinding', {
      'id' : zsession.bindListEditor.currentSession.id,
      'bindings' : zsession.bindListEditor.currentSession
    }).then ( ()=> {
      displayOutcome('Updated bindings.');
      loadBindMap(binds);
      document.getElementById('bind-editor').open = false;
    });
  } else {
    new ZynthoREST().post('binds/add', {
        'target' : document.getElementById('bind-editor-target').value,
        'channel' : ch,
        'bind' : dataObject}
    ).then ( ()=> {
      displayOutcome('Added new bind.');
      document.getElementById('bind-editor').open = false;
    });
  }
  
}

function onBindDialogOk() {
  let dataObject = createBindingFromDialog();
  let path = zsession.bindListEditor.currentPath;
  
  
  zsession.bindListEditor.currentSession
    .bindings[path[0]][path[1]]
    = dataObject;
    
  new ZynthoREST().post('setbinding', {
      'id' : zsession.bindListEditor.currentSession.id,
      'bindings' : zsession.bindListEditor.currentSession
    }).then ( ()=> {
      displayOutcome('Updated bindings.');
      loadBindMap(zsession.bindListEditor
        .currentSession.bindings);
      document.getElementById('bind-editor').open = false;
  });
}

function onBindLearn() {
  document.getElementById('bind-editor-learning')
    .classList.remove('hidden');
  startTimerDisplay();
  
  new ZynthoREST().post('midilearn', {'force': 11} )
    .then ( (data)=> {
      //console.log(data);
      document.getElementById('bind-editor-channel').value =
        (data[0] & 0xf)+1;
      document.getElementById('bind-editor-cc-value').value =
        data[1];
    })
    .finally ( () => {
      stopTimerDisplay();
      document.getElementById('bind-editor-learning')
        .classList.add('hidden');
    });
}
