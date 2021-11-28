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

/**
 * Class behavior
 * click: makes the current selected fx / path, enables toolbar
 * swipe left / right: send a changeFX event
 * methods:
 * setFX: updates the button with FX data
 */

const FX_LIST = [
  'None', 'Reverb','Echo','Chorus','Phaser','Alienwah','Distorsion', 'EQ', 'DynamicFilter'
];

class FXButton {
  /**
  available options:
  noBypass: remove bypass button
  */
  constructor(id, channel_id, options) {
    const qid = $(`#${id}`);
    
    this.element_id = id;
    this.channel_id = channel_id;
    this.path = this.base_path = qid.attr('data-osc');
    this.options = options;
    this.value = 0;
    
    if (this.options == null)
        this.options = {};
    
    if (this.options.noBypass) {
      qid.append(`<div class='col-10 text swipeable' style='text-align:center'></div>`);
      qid.append(`<button class='col-2 fxPreset hidden'></button>`);
    } else {
      qid.append(`<button class='col-2 fxBypass'><i class="fa fa-volume-mute"></i></button>`);  
      qid.append(`<div class='col-8 text swipeable' style='text-align:center'></div>`);
      qid.append(`<button class='col-2 fxPreset hidden'></button>`);
      
      qid.on('click', '.fxBypass',  (e)=>{
        this.actionBypassPartFX();
      });
    }
        
    qid.addClass('fx-btn');
    createSwipeable($(`#${id} > .swipeable`), FX_LIST);
    
    let select = qid.find('.swipeable > select');
    
    select.on('change', (e) =>{
      this.actionChangeFX(e.target.value);
    });
    
    //selection
    qid.on('click', '*', function() {
      //set button as selected, if 'data-group' exists remove all others
      let group = qid.attr('data-group');
      if (group !== undefined) {
        $(`.fx-btn[data-group=${group}], .fx-btn[data-group=${group}] label`).removeClass('btn-selected');
      }
      qid.addClass('btn-selected');  
      qid.find('.swipeable label').addClass('btn-selected');
    });
    
    qid.on('click', '.fxPreset', () => {this.actionChangeFXPreset();});
  }
  
  setFX(fx) {
    let qid = $(`#${this.element_id}`);
    
    //bypass status
    let btnBypass = qid.find('.fxBypass');
    
    if (fx.bypass !== undefined && btnBypass.length > 0)  {
      let icon = (fx.bypass) ? 'fa-volume-mute' : 'fa-volume-up';
      qid.find ('.fxBypass > i').removeClass('fa-volume-mute fa-volume-up').addClass(icon);  
    }
    
    let btnPreset = qid.find('.fxPreset');
    if (fx.preset > -1) {
      $(btnPreset).removeClass('hidden')
        .text(fx.preset);
    } else
      $(btnPreset).addClass('hidden');
    
    qid.find('.swipeable > select').val(fx.name);
    qid.find('.swipeable > label').text(fx.name);
    
    this.path = `${this.base_path}${this.channel_id}/${fx.name}`;
  }
  
  getFX() {
    let qid = $(`#${this.element_id}`);
    
    return {
      "name" : qid.find('select').val(),
      "bypass": qid.find('.fxBypass').length == 0
                ? undefined : qid.find('.fxBypass > i').hasClass('fa-volume-mute'),
      "preset" : parseInt(qid.find('.fxPreset').text())
    }
  }
  
  actionBypassPartFX() {
    let path = window.zsession.sanitize(`/part/Pefxbypass${this.channel_id}`);
    let currentFX = this.getFX();
    path += (currentFX.bypass) ? ' F' : ' T';
    console.log(`part bypass path: ${path}`);
     
    doAction('script', { script: path }, (data) => {
        currentFX.bypass = !currentFX.bypass;
        this.setFX(currentFX);
     });
  }
  
  actionChangeFXPreset() {
   /* presets up to zynaddsubfx 3.0.6 */
     const limits = {
      'Reverb' : 13,
      'Echo': 9,
      'Chorus': 10,
      'Phaser': 12,
      'Alienwah': 4,
      'Distorsion': 6,
      'DynamicFilter': 5
    }
            
    const currentFX = this.getFX();
    let preset = currentFX.preset+1;
        
    let fxName = currentFX.name;
    if (!limits.hasOwnProperty(fxName))
        return; 
          
    let limit = limits[fxName];
    preset = Math.min(limit, Math.max(0, preset))
    
    let path = window.zsession.sanitize(this.path);
    
    doAction('script', { script : `${path}/preset ${preset}`} , (data) => {
          //$('#'+id).text(`${fxName}/${preset}`);
          currentFX.preset = preset;
          this.setFX(currentFX);
      })
  }
  
  actionChangeFX(value) {
    let qid = `#${this.element_id}`;
    
    let request = {
      part  : ((this.base_path.search('part') > -1)
              ? window.zsession.partID : undefined),
      fx    : this.channel_id,
      type  : FX_LIST.indexOf(value) 
    };
    
    
    doAction('fx/set', request,
     (data) => {
       //change fx does not return bypass status
       data.bypass = $(`${qid} .btnBypass`).hasClass('hidden');
       this.setFX(data);
     })
  }
}
