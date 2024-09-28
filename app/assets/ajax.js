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

function startTimerDisplay() {
  //console.log('starting timer');
  //Loading timer
  clearTimeout(window.timers['msg']);
        
  //let text = $('#instrumentName').text();
  //Run loading animation if not already
  let statusIcon = document.getElementById('q-status');
  let messageObject = document.getElementById('message');
  
  let bigtext = document.getElementById('instrumentName');
  if ( bigtext != 'Loading' || !zesssion.oldMessage)
    zsession.oldMessage= bigtext.innerHTML;
    
  bigtext.innerHTML = 'Loading';
  
  //Run loading animation if not already
  /*
  if (messageObject.innerHTML.match(/^[ \.]+$/) == null) {
    
    //window.zsession.beforeQueryText = text;
    messageObject.innerHTML = '.';
    
    statusIcon.classList.remove('fa', 'fas','fa-hourglass', 'fa-check-circle','fa-times-circle');
    statusIcon.classList.add('fa','fa-hourglass');
      
    window.timers['ajax'] = setInterval ( () =>{
      let text = messageObject.innerHTML;
      if (text.length < 3)
        text += " .";
      else {
        let padding = messageObject.style.padding.left;
        
        if (NaN === padding) 
          padding = parseInt( /(\d+)(px)?/.exec(padding[1]));
        
        if (padding < 100)
          messageObject.style.padding.left = padding+10+'px';
        else {
          messageObject.style.padding.left = '0px';
          text = ".";
        }
      }
      
      messageObject.innerHTML = text;
    }, 500);
  }
  */
}

function stopTimerDisplay() {
  //console.log('stopping timer');
  clearInterval(window.timers['ajax']);
  delete window.timers['ajax'];
  
  let bigtext = document.getElementById('instrumentName');
  if (zsession.oldMessage) {
    document.getElementById('instrumentName').innerHTML = zsession.oldMessage;
    delete zsession['oldMessage'];
  }
  //document.getElementById('message').innerHTML = '';
}

function displayOutcome(message, isError = false) {
  stopTimerDisplay();
  let statusIcon = document.getElementById('q-status');
  statusIcon.classList.remove('fa', 'fas','fa-hourglass', 'fa-check-circle','fa-times-circle', 'fa-exclamation-triangle');
  
  if (isError)
    statusIcon.classList.add('fas', 'fa-exclamation-triangle');
  else
    statusIcon.classList.add('fas', 'fa-comment-alt');
  
  if ( message == '') return;
    
  let msgObj = document.getElementById('message');
  msgObj.style.padding.left = '0px';
  msgObj.innerHTML = message;
}

class ZynthoREST {
  constructor() {
    this.contentType = 'application/json; charset=utf-8';
    this.dataType = 'application/json';
    this.timeout = 5000;
  }
  
  //Wraps XHR in a promise, auto-handle, error
  ajax ( params ) {
    return new Promise ( ( resolve, reject ) => {
      startTimerDisplay();
  
      let xhr = new XMLHttpRequest();
      xhr.responseType = this.dataType;

      xhr.open(params.method, params.url);
      xhr.setRequestHeader('Content-type', this.contentType);

      // request state change event
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        displayOutcome(''); //just show OK
       // stopTimerDiplay();
        
        if (xhr.status === 200)
          resolve( (this.responseText.length > 0)
            ? JSON.parse(this.responseText)
            : null)
        else {
          let errorMsg = xhr.status + "-" + xhr.statusText;
          displayOutcome(errorMsg, true);
          reject(errorMsg)
        }
      };

      xhr.timeout = this.timeout;
      xhr.ontimeout =  ()=> {
        //stopTimerDisplay();
        let errorMsg = `Timeout! ${xhr.status} - ${xhr.statusText}`;
        displayOutcome(errorMsg, true);
        reject(errorMsg);
      };
      xhr.send(params.data);
    });
  }  
  
  query( url, query) {
    url = url + '?' + new URLSearchParams(query).toString();
    return this.ajax({ method: 'get', url: url });
  }
  
  post(url, data) {
    return this.ajax({
      method: 'post',
      data: JSON.stringify(data),
      url: window.location.href + url
    });
  }
}

/* ajax function */
/*
 * @Deprecated
 */
function doAjax(params, onDone, onError = undefined) {
   
  startTimerDisplay();
  
  let xhr = new XMLHttpRequest();
  xhr.responseType = params.dataType;
  
  xhr.open(params.method, params.url);
  xhr.setRequestHeader('Content-type', params.contentType);

  // request state change event
  xhr.onreadystatechange = function() {

    // request completed?
    if (xhr.readyState !== 4) return;
    
    displayOutcome('ok');
    if (xhr.status === 200) {
      if (onDone != undefined) {
       onDone( (this.responseText.length > 0)
          ? JSON.parse(this.responseText)
          : null)
      }
    }
    else {
      if (onError !== undefined)
        onError( xhr.status + "-" + xhr.statusText );
      else
        displayOutcome(xhr.status + "-" + xhr.statusText, true);
    }
  };

  xhr.timeout = 5000;
  xhr.ontimeout = function() {
    displayOutcome('Timeout!', true);
  };
    
  // start request
  xhr.send(params.data);
}

/*
 * @Deprecated
 */
function doQuery(rest, data, onDone) {
  let url = window.location.href+rest;
  
  if (data != null)
    url = url + '?' + new URLSearchParams(data).toString();
  
  return doAjax({method:'get', dataType: 'application/json', 
            url: url, 
            data: null,
            contentType: 'application/json; charset=utf-8'
  }, onDone);
}

/*
 * @Deprecated
 */
function doAction(rest, data, onDone) {
  return doAjax( {method: 'post', 
    url: window.location.href+rest,
    data: JSON.stringify(data),
    contentType: 'application/json; charset=utf-8'
    }, onDone );
}
