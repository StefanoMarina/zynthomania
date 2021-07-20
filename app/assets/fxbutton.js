/*********************************************************************
(c) Copyright 2021 by Stefano Marina.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject
to the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**********************************************************************/

/**
 * Class behavior
 * click: makes the current selected fx / path, enables toolbar
 * swipe left / right: send a changeFX event
 * methods:
 * setFX: updates the button with FX data
 */
 
class FXButton {
  constructor(id, channelid) {
    const qid = `#${id}`;
    
    this.id = id;
    this.channelid = channelid;
    this.path = this.base_path = $(qid).attr('data-osc');
    
    $(qid).append(`<button class='col-2 fxBypass'><i class="fa fa-volume-mute"></i></button>`);
    $(qid).append(`<span class='col-8 text' style='text-align:center'></span>`);
    $(qid).append(`<button class='col-2 fxPreset hidden'></button>`);
    
    $(qid).addClass('fx-btn');
    
    const _this = this;
    //doAction(`fx/part/${rest}`, {efxID: window.zsession.fx.id, partID:  window.zsession.partID},
    
    const onPrev = function() { $(qid).trigger({type: 'previous-fx', path: _this.path, basepath: _this.base_path}); };
    const onNext = function() { $(qid).trigger({type: 'next-fx', path: _this.path, basepath: _this.base_path}); };
    
    //name swipe
    jquerySwipeHandler.handleSwipe(`${qid} > .text`, [
      jquerySwipeHandler.SWIPE_LEFT,
      jquerySwipeHandler.SWIPE_RIGHT,
      jquerySwipeHandler.CLICK
    ], (direction) => {
      console.log('swiped! ' + direction);
      switch (direction) {
        case jquerySwipeHandler.SWIPE_LEFT: _this.actionChangeFX('prev_fx'); break;
        case jquerySwipeHandler.SWIPE_RIGHT:_this.actionChangeFX('next_fx'); break;
        case jquerySwipeHandler.CLICK: $(`${qid} .text`).trigger({type: 'click', path: _this.path, basepath: _this.base_path}); break;
      }
    });
    
    $(`${qid}`).on('click', '*', function() {
      //set button as selected, if 'data-group' exists remove all others
      let group = $(qid).attr('data-group');
      if (group !== undefined) {
        $(`*[data-group=${group}]`).removeClass('btn-selected');
      }
      $(qid).addClass('btn-selected');  
    });
    
    $(`${qid}`).on('click', '.fxBypass', function () { _this.actionBypassPartFX(); $('#instrumentName').text('click');});
    $(`${qid}`).on('click', '.fxPreset', function() {_this.actionChangeFXPreset(); });
  }
  
  setFX(fx) {
    let qid = `#${this.id}`
    
    //bypass status
    if (fx.bypass !== undefined) 
    {
      $(`${qid} .fxBypass`).removeClass('hidden');
      let icon = (fx.bypass) ? 'fa-volume-mute' : 'fa-volume-up';
      $(`${qid} .fxBypass > i`).removeClass('fa-volume-mute fa-volume-up').addClass(icon);  
    } else {
      $(`${qid} .fxBypass`).addClass('hidden');
    }
    
    if (fx.preset > -1) {
      $(`${qid} .fxPreset`).removeClass('hidden')
        .text(fx.preset);
    } else
      $(`${qid} .fxPreset`).addClass('hidden');
    
    $(`${qid} > .text`).text(fx.name);
    
    this.path = `${this.base_path}${this.channelid}/${fx.name}`;
  }
  
  getFX() {
    let qid = `#${this.id}`;
    
    return {
      "name" : $(`${qid} > .text`).text(),
      "bypass": $(`${qid} > .fxBypass`).hasClass("hidden")
                ? undefined : $(`${qid} > .fxBypass > i`).hasClass('fa-volume-mute'),
      "preset" : parseInt($(`${qid} > .fxPreset`).text())
    }
  }
  
  actionBypassPartFX() {
    let path = window.zsession.sanitize(`/part/Pefxbypass${this.channelid}`);
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
  
  actionChangeFX(rest) {
    let rest_path = (this.base_path.search('part') > -1)
              ? `fx/part/${rest}`
              : `fx/system/${rest}`;
    
    doAction(rest_path, {efxID: this.channelid, partID: window.zsession.partID },
     (data) => {
       this.setFX(data);
     })
  }
}
