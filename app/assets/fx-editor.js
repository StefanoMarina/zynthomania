function loadFXEditor(data, title, backTo) {
  let section = document.getElementById('fx-editor');
  section.dataset.title= title;
  section.dataset.back = backTo;
  
  console.log(data);
  
  if (window.zsession.initFXEditor === undefined) {
    new OSCKnob(document.getElementById('fx-drywet'));
    new OSCKnob(document.getElementById('fx-pan'));
      
    new OSCSwipeable(document.getElementById('fx-type'),
      [0,1,2,3,4,5,6,7,8],
      ['None', 'Reverb', 'Echo', 'Chorus', 'Phaser', 'Alienwah',
        'Distorsion', 'EQ', 'DynamicFilter'],
      {'title': 'Select effect', 'buttonClass': 'col-12 col-md-6'});
    
    window.zsession.oscElements['fx-type'].HTMLElement
      .addEventListener( 'act', ( ev) => {
          new ZynthoREST().query('/status/fx', 
            {'path':window.zsession.fxcursor})
          .then ( (data) => { loadFXEditor(data, title, backTo); });
      });
        
      //reload itself when changing fx
      
    new OSCKnob(document.getElementById('fx-reagent'));
    new OSCKnob(document.getElementById('fx-catalyst'));
    new OSCKnob(document.getElementById('fx-base'));
    new OSCKnob(document.getElementById('fx-acid'));

    new OSCSwipeable(document.getElementById('fx-preset'),
      [0], ['-'], { 'title' : 'Select preset' } );
    
    //override act with REST
    window.zsession.oscElements['fx-preset'].HTMLElement
      .addEventListener('act',
      ()=> {
        osc_synch('fx-reagent', 'fx-catalyst', 'fx-base', 'fx-acid');
      });
  
    new OSCSwipeable(document.getElementById('fx-formula'),
      [0], ['Default'],
      {'title': 'select Formula' });
     
    new OSCBoolean(document.getElementById('fx-part-bypass'));
    
    window.zsession.initFXEditor = true;
  }
  
  window.zsession.oscElements['fx-type'].setValue(data.efftype);
  if ( data.efftype == 0) {
    loadNoneFx(data);
  } else {
    loadFx(data);
  }
  
  loadSection('fx-editor');
}

function loadNoneFx(data) {
  let __OSCPATH =  `${window.zsession.fxcursor}/parameter`    ;
   window.zsession.oscElements['fx-drywet'].setValue(0);
   window.zsession.oscElements['fx-pan'].setValue(0);
   
   window.zsession.oscElements['fx-drywet'].setEnabled(false);
   window.zsession.oscElements['fx-pan'].setEnabled(false);
      
  document.getElementById('fx-alchemy').classList.add('hidden');
}

function loadFx(data) {
   let __OSCPATH =  `${window.zsession.fxcursor}/parameter`    
   window.zsession.oscElements['fx-drywet'].setValue(
      data.osc[`${__OSCPATH}0`].value);
   window.zsession.oscElements['fx-pan'].setValue(
      data.osc[`${__OSCPATH}1`].value);
      
  window.zsession.oscElements['fx-drywet'].setEnabled(true);
  window.zsession.oscElements['fx-pan'].setEnabled(true);
   
  document.getElementById('fx-alchemy').classList.remove('hidden');
  
  //load presets
  let presetObj = window.zsession.oscElements['fx-preset'];
  if (data.config.presets > 0) {
    let presets = OSC_INT_PARAM(data.config.presets);
      presetObj.setOptions(
        presets, 
        presets.map( (el) => String(el).padStart(2,0))
      );
      presetObj.setValue(data.osc[`${window.zsession.fxcursor}/preset`]
        .value);
      
      window.zsession.oscElements['fx-preset'].setEnabled(true);
  } else {
      presetObj.setOptions([0],['-']);
      presetObj.setEnabled(false);
  }
  
  
  //formula
  let obj = window.zsession.oscElements['fx-formula'];
  if (data.config.algorithm.length > 0) {
    obj.setOptions(
      OSC_INT_PARAM(data.config.algorithm.length),
      data.config.algorithm
    );
    let oscpath = `${window.zsession.fxcursor}/parameter${data.config.formula}`;
    obj.oscpath = oscpath;
    obj.setValue(data.osc[oscpath].value, true);
    obj.setEnabled(true);
  } else {
    obj.setOptions([0], ['Default']);
    obj.setEnabled(false);
  }
  
  //bypass
  if (data.bypass !== undefined) {
    window.zsession.oscElements['fx-part-bypass'].
      HTMLElement.classList.remove('d-none');
      
    let fxid = /partefx(\d)/.exec(window.zsession.fxcursor)[1];
    window.zsession.oscElements['fx-part-bypass'].oscpath =
      `/part${window.zsession.partID}/Pefxbypass${fxid}`;
      
    window.zsession.oscElements['fx-part-bypass'].
      setValue (data.bypass);
  } else {
    window.zsession.oscElements['fx-part-bypass'].
      HTMLElement.classList.add('d-none');
  }
  
  ['reagent', 'catalyst', 'acid', 'base'].forEach ( (element) => {
    let el = data.config[element];
    let path = `${window.zsession.fxcursor}/parameter${el}`;
    let obj = window.zsession.oscElements[`fx-${element}`];
    obj.oscpath = path;
    obj.setValue ( data.osc[path].value, true );
  }); 
}
