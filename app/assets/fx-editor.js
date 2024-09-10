function loadFXEditor(data, title, backTo) {
  let section = document.getElementById('fx-editor');
  section.dataset.title= title;
  section.dataset.back = backTo;
  
  console.log(data);
  
  if (zsession.initFXEditor === undefined) {
    new OSCKnob(document.getElementById('fx-drywet'));
    new OSCKnob(document.getElementById('fx-pan'));
      
    new OSCSwipeable(document.getElementById('fx-type'),
      [0,1,2,3,4,5,6,7,8],
      ['None', 'Reverb', 'Echo', 'Chorus', 'Phaser', 'Alienwah',
        'Distorsion', 'EQ', 'DynamicFilter'],
      {'title': 'Select effect', 'buttonClass': 'col-12 col-md-6'});
    
    zsession.oscElements['fx-type'].HTMLElement
      .addEventListener( 'act', ( ev) => {
          new ZynthoREST().query('/status/fx', 
            {'path':zsession.fxcursor})
          .then ( (data) => { loadFXEditor(data, title, backTo); });
      });
        
      //reload itself when changing fx
      
    new OSCKnob(document.getElementById('fx-reagent'));
    new OSCTempo(document.getElementById('fx-reagent-sync'));
    new OSCKnob(document.getElementById('fx-catalyst'));
    new OSCKnob(document.getElementById('fx-base'));
    new OSCKnob(document.getElementById('fx-acid'));

    new OSCSwipeable(document.getElementById('fx-preset'),
      [0], ['-'], { 'title' : 'Select preset' } );
    
    //override act with REST
    zsession.oscElements['fx-preset'].HTMLElement
      .addEventListener('act',
      ()=> {
        osc_synch('fx-reagent', 'fx-catalyst', 'fx-base', 'fx-acid');
        if ( !zsession.oscElements['fx-reagent'].isEnabled() )
          zsession.oscElements['fx-reagent-sync'].sync();
      });
  
    new OSCSwipeable(document.getElementById('fx-formula'),
      [0], ['Default'],
      {'title': 'select Formula' });
     
    new OSCBoolean(document.getElementById('fx-part-bypass'));
    
    zsession.initFXEditor = true;
  }
  
  zsession.oscElements['fx-type'].setValue(data.efftype);
  if ( data.efftype == 0) {
    loadNoneFx(data);
  } else if (data.efftype == 7) {
    loadEQ(data);
  }  else {
    loadFx(data);
  }
  
  loadSection('fx-editor');
}

function loadNoneFx(data) {
  let __OSCPATH =  `${zsession.fxcursor}/parameter`    ;
   zsession.oscElements['fx-drywet'].setValue(0);
   zsession.oscElements['fx-pan'].setValue(0);
   
   zsession.oscElements['fx-drywet'].setEnabled(false);
   zsession.oscElements['fx-pan'].setEnabled(false);
      
  document.getElementById('fx-alchemy').classList.add('hidden');
  document.getElementById('fx-eq').classList.add('hidden');
}

function loadFx(data) {
  document.getElementById('fx-alchemy').classList.remove('hidden');
  document.getElementById('fx-eq').classList.add('hidden');
  
   let __OSCPATH =  `${zsession.fxcursor}/parameter`    
   zsession.oscElements['fx-drywet'].setValue(
      data.osc[`${__OSCPATH}0`].value);
   zsession.oscElements['fx-pan'].setValue(
      data.osc[`${__OSCPATH}1`].value);
      
  zsession.oscElements['fx-drywet'].setEnabled(true);
  zsession.oscElements['fx-drywet'].setLabel('Dry/Wet');
  zsession.oscElements['fx-pan'].setEnabled(true);
   
  document.getElementById('fx-alchemy').classList.remove('hidden');
  
  //load presets
  let presetObj = zsession.oscElements['fx-preset'];
  if (data.config.presets > 0) {
    let presets = OSC_INT_PARAM(data.config.presets);
      presetObj.setOptions(
        presets, 
        presets.map( (el) => String(el).padStart(2,0))
      );
      presetObj.setValue(data.osc[`${zsession.fxcursor}/preset`]
        .value);
      
      zsession.oscElements['fx-preset'].setEnabled(true);
  } else {
      presetObj.setOptions([0],['-']);
      presetObj.setEnabled(false);
  }
  
  
  //formula
  let obj = zsession.oscElements['fx-formula'];
  if (data.config.algorithm.length > 0) {
    obj.setOptions(
      OSC_INT_PARAM(data.config.algorithm.length),
      data.config.algorithm
    );
    let oscpath = `${zsession.fxcursor}/parameter${data.config.formula}`;
    obj.oscpath = oscpath;
    obj.setValue(data.osc[oscpath].value, true);
    obj.setEnabled(true);
  } else {
    obj.setOptions([0], ['Default']);
    obj.setEnabled(false);
  }
  
  //bypass
  if (data.bypass !== undefined) {
    zsession.oscElements['fx-part-bypass'].
      HTMLElement.classList.remove('d-none');
      
    let fxid = /partefx(\d)/.exec(zsession.fxcursor)[1];
    zsession.oscElements['fx-part-bypass'].oscpath =
      `/part${zsession.partID}/Pefxbypass${fxid}`;
      
    zsession.oscElements['fx-part-bypass'].
      setValue (data.bypass);
  } else {
    zsession.oscElements['fx-part-bypass'].
      HTMLElement.classList.add('d-none');
  }
  
  ['reagent', 'catalyst', 'acid', 'base'].forEach ( (element) => {
    let el = data.config[element];
    let path = `${zsession.fxcursor}/parameter${el}`;
    let obj = zsession.oscElements[`fx-${element}`];
    obj.oscpath = path;
    obj.setValue ( data.osc[path].value, true );
  });
  
  if (data.efftype == 2){ //echo
    zsession.oscElements['fx-reagent-sync'].setOscPath(zsession.fxcursor);
    zsession.oscElements['fx-reagent-sync'].setEnabled(true);
    console.log(data);
    zsession.oscElements['fx-reagent-sync'].setValue(
      data.osc[`${zsession.fxcursor}/numerator`].value + "/"
      + data.osc[`${zsession.fxcursor}/denominator`].value 
    );
    
    zsession.oscElements['fx-reagent-sync'].HTMLElement.classList.remove('hidden');
    zsession.oscElements['fx-reagent'].setEnabled(false);
    zsession.oscElements['fx-reagent'].HTMLElement.classList.add('hidden');
  } else {
    zsession.oscElements['fx-reagent-sync'].setEnabled(false);
    zsession.oscElements['fx-reagent-sync'].HTMLElement.classList.add('hidden');
    zsession.oscElements['fx-reagent'].setEnabled(true);
    zsession.oscElements['fx-reagent'].HTMLElement.classList.remove('hidden');
  }
}

function loadEQ(data) {
  document.getElementById('fx-alchemy').classList.add('hidden');
  document.getElementById('fx-eq').classList.remove('hidden');
  
  if (zsession.initFxEditorEQ === undefined) {
    
    for (let i = 0; i < 8; i++) {
      let filter = new OSCEQFilter(document.getElementById(`fx-eq-${i}`));
    }
    zsession.initFxEditorEQ = true;
  }
  
  zsession.oscElements['fx-drywet'].setEnabled(true);
  zsession.oscElements['fx-drywet'].setLabel('Gain');
  zsession.oscElements['fx-pan'].setEnabled(true);
  
  let __OSCPATH =  osc_sanitize(`${zsession.fxcursor}/parameter`)
   zsession.oscElements['fx-drywet'].setValue(
      data.osc[`${__OSCPATH}0`]);
   zsession.oscElements['fx-pan'].setValue(
      data.osc[`${__OSCPATH}1`]);
      
  for (let i = 0; i < 8 ; i++) {
    let filter = zsession.oscElements[`fx-eq-${i}`];
    filter.setPath(zsession.fxcursor,i);
    filter.setValue(data.eq[i], false);
  }
}
