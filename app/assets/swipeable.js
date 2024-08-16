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

const SWRIGHT = new Event("swipe-right");
const SWLEFT  = new Event("swipe-left");
const SWANY  = new Event("swipe");

class Swipeable {
  constructor(htmlElement) {
        
    this.element = htmlElement;
    
    //enable swiping on element
    enableSwiping(this.element);
    
    //add changing capabilities to swiper
    this.element.addEventListener("swipe-right", (event) => {
      let selectid = event.target.getElementsByTagName("select")[0];
      let labelid = event.target.getElementsByTagName("label")[0];
      let currentValue = selectid.selectedIndex;
      let max = selectid.options.length;
      
      currentValue = (currentValue < max-1)
        ? currentValue +1 : 0;
      selectid.selectedIndex = currentValue;
      labelid.innerHTML = selectid.options[currentValue].text;
      selectid.dispatchEvent(new Event('change'));
      
      //console.log(`Called swipe-right: ${currentValue}`);
    });

    this.element.addEventListener("swipe-left", (event) => {
      let selectid = event.target.getElementsByTagName("select")[0];
      let labelid =  event.target.getElementsByTagName("label")[0];
      let currentValue = selectid.selectedIndex;
      let max = selectid.options.length;
      
      currentValue = (currentValue > 0 )
        ? currentValue -1 
        : selectid.options.length-1;
        
      selectid.selectedIndex = currentValue;
      labelid.innerHTML = selectid.options[currentValue].text;
      //console.log(`Called swipe-left: ${currentValue}`);
      selectid.dispatchEvent(new Event('change'));
    });
    
    if (this.element.querySelector("label") == null)
      this.element.append(document.createElement('label'));
    if (this.element.querySelector("select") == null)
      this.element.append(document.createElement('select'));
    
    this.selectElement = this.element.getElementsByTagName('select')[0];
    
    //Label click to open dialog event
    let label = this.element.querySelector('label');
    label.addEventListener("click", (e) => {
      let obj = e.srcElement || e.target;
      let parent = obj.parentNode;
      
      //gather all elements
      let selid = parent.querySelector("select");
      let data = { 
          title : selid.dataset.title,
          defValue : selid.selectedIndex,
          buttonClass: selid.dataset.buttonClass
      }
      
      var elements = Array.from(selid.options)
        .map ( opt => opt.text );

      document.getElementById('selectBox')
        .addEventListener('ok', (event) => {
          //in this context this is the html element
          this.setSelection(event.detail, true);
        }, {'once': true});
        
      dialogBox(elements, this.dialogData);
    });
  }

  setSelection(index, trigger=false) {
    this.selectElement.selectedIndex = index;
    this.element.querySelector('label').innerHTML =
      this.selectElement.options[index].text;
    if (trigger)
      this.selectElement.dispatchEvent(new Event('change', {'target': this.selectElement}));
  }
  
  setValue ( value, trigger = false) {
    for (let i = 0; i < this.selectElement.options.length; i++) {
      if (this.selectElement.options[i].value == value) {
        this.setSelection(i, trigger);
        return;
      }
    }
    console.log(`swipeable ${this.element.id}: invalid value '${value}'`);
  }
  
  getValue() {
    return this.selectElement.options[
      this.selectElement.selectedIndex].value;
  }
  
  setDialogData(dialogData) {
    this.dialogData = Object.assign(
      { title:'Select', 
        disableClick: false, 
        onCancel: undefined,
        buttonClass: 'col-12 col-md-3 col-lg-2'
      },
      dialogData);
    
    let sel = this.element.querySelector('select');
    sel.dataset.title = this.dialogData.title;
    sel.dataset.buttonClass = this.dialogData.buttonClass;
  }
  
  setOptions(elements, labels) {
    let select = this.element.querySelector('select');
    let label = this.element.querySelector('label');
  
    if (labels == null)
      labels = elements.map ( (el)=>String(el));
    
    select.innerHTML = '';
    
    for (let i = 0; i < elements.length;i++)
      select.options.add( new Option ( labels[i], elements[i] ));
    
    //by default set first
    label.innerHTML = labels[0];
  }
}

//Enables left-right swiping 
function enableSwiping(object, sensitive=4) {
  
  object.swipeSensitiveness = sensitive;
  
  object.addEventListener('touchstart', e => {
    object.touchStartX = e.changedTouches[0].screenX;
  });
  
  object.addEventListener('touchend', e => {
    let touchEndX = e.changedTouches[0].screenX;
    let res = touchEndX - object.touchStartX;
    
    if ( (res - object.swipeSensitiveness) > 0) {
      object.dispatchEvent(SWRIGHT);
      object.dispatchEvent(SWANY);
    } else if ( (res + object.swipeSensitiveness) < 0) {
      object.dispatchEvent(SWLEFT);
      object.dispatchEvent(SWANY);
    } else
      object.click();
  });
}

/**
 * shows a custom selection dialog box
 * elements an array of values
 * DialogBox triggers custom 'ok' and 'cancel' events
 * from <dialog> element.
 * @params elements array of labels - index is returned
 * @params data may have 
 *  title
 *  default selected index
 *  button class
 *  labels
 */
function dialogBox(elements, data) {
  
  data = Object.assign ( {
    title : 'Selection',
    defValue : 0,
    buttonClass : 'col-12 col-md-6 col-lg-3',
    labels : null
  }, data );
  
  let title = (data != null && data.title != null) ? data.title : 'Selection';
  let defValue = (data != null && data.defValue != null) ? data.defValue : null;
  let buttonClass = (data != null && data.buttonClass != null) ? data.buttonClass : 'col-12';
  
  let dialogBox = document.getElementById('selectBox');
  let mainDiv = document.getElementById('main-panel');
  
  //dialogBox.classList.remove('hidden');
  mainDiv.classList.add('hidden');
  
  let query = dialogBox.getElementsByTagName('div');
  let dialogContent = query[1];  
  dialogBox.getElementsByTagName('h4')[0].innerHTML = title;
  dialogContent.innerHTML = '';
    
  let isSelected = false,  html = "", value="", element = null;
  
  for (let i = 0; i < elements.length; i++) {
    element = elements[i];
    isSelected = (i == defValue) ? 'btn-selected' : '';
    value = (data.scores != null) ? data.scores[i] : i;
    html = `<div class="${buttonClass}"><button style="width:100%" value="${value}" class="${isSelected} button">${element}</button></div>`;
    dialogContent.innerHTML += html;
  }
  
  //selection
  let list = dialogContent.getElementsByTagName('button');
  for (let btn of list) {
      btn.addEventListener('click',onSelectBoxItemSelection);
  }
  
  dialogBox.open = true;
}

function onSelectBoxItemSelection(e) {
  if (e.target.classList.contains('selected')){
    selectBoxOk();
    return;
  } else {
    //remove prev selection to all
    document.querySelectorAll('#selectBox .container .selected')
      .forEach( (btn) => {
      btn.classList.remove('selected'); }
    );
    e.target.classList.add('selected');
  }
}

function selectBoxOk() {
  let selection = document.querySelector('#selectBox .container .selected');
  if (selection == null)
    return;
  document.getElementById('selectBox').open=false;
  document.getElementById('main-panel').classList.remove('hidden');
  window.scrollTo(0,0);
  
  document.getElementById('selectBox').dispatchEvent(
    new CustomEvent('ok', {'detail': selection.value}));
}

function selectBoxCancel() {
  document.getElementById('selectBox').open=false;
  document.getElementById('main-panel').classList.remove('hidden');
  window.scrollTo(0,0);
  document.getElementById('selectBox').dispatchEvent(
    new CustomEvent('cancel'));
}
