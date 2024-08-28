class Checkbox {
  constructor(objectOrId) {
    if (typeof objectOrId === 'string')
      this.element = document.getElementById(objectOrId);
    else
      this.element = objectOrId;
    
    
  }
}
