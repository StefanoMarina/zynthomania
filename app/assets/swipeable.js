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

function createSwipeable(query, elements) {
  let sid = $(query);
  if (sid.length == 0) {
    console.error(`error: swipeable query ${query} is not valid.`);
    return;
  }
  
  let select = sid.find('select');
  let selectid;
  
  if (select.length == 0) {
    sid.append('<select></select>');
    select = sid.find('select');
    if (elements == null) {
      console.error('Error: no elements with missing select.');
      return;
    }
  }
  
  if (sid.find('label').length == 0)
    sid.append(`<label></label>`);
 
  if (elements != null) {
    elements.forEach( (el) => 
      select.append(`<option value="${el}">${el}</option>`)
    );
    select.val(elements[0]);
    sid.find('label').text(elements[0]);
  } else {
    sid.find('label').text(select.val(select.children().get()[0].value).val())
  }
  
  
  select.on('change', (e) =>{
    sid.find('label').text(e.target.value);
  });
}

function swipeableGetElements(select) {
  return $(select).find('option').map( 
          function(){return this.value}).get();
}

function registerSwipeables(query, enableClickSelect) {
  if (query===undefined)
     query = '.swipeable';
  
  let qLabel = $(query).find('label');
  
  qLabel.on('swipeleft', (e) =>{
    let select = $(e.target).siblings('select');
    let elements = swipeableGetElements(select),
        index = elements.indexOf(select.val());
    
    index = (index > 0) ? index-1 : elements.length-1;
    
    let value = elements[index];
    select.val(value);
    select.trigger({type: 'change', e: e, value: value});
  });
  
  $(query).find('label').on('swiperight', (e) =>{
    let select = $(e.target).siblings('select');
    let elements = swipeableGetElements(select),
        index = elements.indexOf(select.val());
    
    index = (index < elements.length-1) ? index+1 : 0;
    
    let value = elements[index];
    select.val(value);
    select.trigger({type: 'change', e: e, value: value});
  });
  
  const onClick = function (e) {
    let select = $(e.target).siblings('select');
    let elements = swipeableGetElements(select);
    if (elements.length == 0) {
        console.error(`swipeable click error: no elements`);
        return;
    }
    
    dialogBox('Select:', elements, select.val(), (i) =>{
      console.log (`select: ${i}, ${elements[i]}`);
      
      select.val(elements[i]);
      select.trigger({type: 'change', e: e, value: select.val()});
    });
  };
  
  if (enableClickSelect) {
    $(query).find('label').on('click', function (e) {
      if ($(e.target).hasClass('btn-selected'))
        onClick(e);
      else
        $(e.target).addClass('btn-selected');
    });
  } else
    $(query).find('label').on('click', onClick);
  
}

function dialogBox(title, elements, defValue, onOk, onCancel) {
  $('.dialogBox').removeClass('hidden');
  $('main').addClass('hidden');
  let dialog = $('.dialogBox > div');
  let content = $(dialog).find('> div');
  
  $(dialog).find('h4').text(title);
  $(content).empty();
  elements.forEach( (element) => {
    let isSelected = (element == defValue) ? 'btn-selected' : '';
    let html = `<div class="col-12"><button style="width:100%" data-i="${elements.indexOf(element)}" class="${isSelected} big-btn dialog-button">${element}</button></div>`;
    $(content).append(html);
  });
  
  $(content).find('button').on('click', (e)=>{
    if ($(e.target).hasClass('btn-selected')) {
      $('#btnOk').trigger('click');
    } else {
      $(content).find('button').removeClass('btn-selected');
      $(e.target).addClass('btn-selected');
    }
  });
  
  $('#btnOk').one('click', () =>{
    $('main').removeClass('hidden');
    $('.dialogBox').addClass('hidden');
    window.scrollTo(0,0);
    if ($(content).find('.btn-selected').length>0) {
      console.log('ok trigger');
      onOk($(content).find('.btn-selected').attr('data-i'));
    }
  });
  
  $('#btnCancel').one('click', () =>{
    window.scrollTo(0,0);
    $('.dialogBox').addClass('hidden');
    $('main').removeClass('hidden');
    if (onCancel)
      onCancel();
  });
}

