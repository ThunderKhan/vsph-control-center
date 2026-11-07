/* Shared, accessible VSPH confirmation, input, details and notification surfaces. */
(() => {
 'use strict';
 const el=(tag,className='',value='')=>{
  const node=document.createElement(tag);node.className=className;
  if(value!==undefined&&value!==null)node.textContent=String(value);
  return node;
 };
 function openDialog({title,description='',confirmLabel='Continue',danger=false,fields=[],input=null}){
  return new Promise(resolve=>{
   const previous=document.activeElement,dialog=el('dialog','vsph-ui-dialog');
   const card=el('div','vsph-ui-dialog-card');
   const head=el('div','vsph-ui-dialog-head'),mark=el('div','vsph-ui-dialog-mark',danger?'!':'i');
   mark.setAttribute('aria-hidden','true');
   const titleNode=el('h2','vsph-ui-dialog-title',title||'Confirm action');titleNode.id='vsph-dialog-title';
   head.append(mark,titleNode);card.append(head);
   if(description){const p=el('p','vsph-ui-dialog-copy',description);card.append(p);}
   if(fields.length){
    const list=el('dl','vsph-ui-dialog-fields');
    for(const field of fields){
     const row=el('div','vsph-ui-dialog-field');row.append(el('dt','',field.label),el('dd','',field.value));list.append(row);
    }
    card.append(list);
   }
   let inputEl=null;
   if(input){
    const label=el('label','vsph-ui-dialog-input-label',input.label||'Reason');
    inputEl=el('textarea','vsph-ui-dialog-textarea');inputEl.rows=3;inputEl.required=true;
    inputEl.minLength=input.minLength||1;inputEl.maxLength=input.maxLength||500;
    if(input.placeholder)inputEl.placeholder=input.placeholder;
    label.append(inputEl);card.append(label);
   }
   const actions=el('div','vsph-ui-dialog-actions');
   const cancel=el('button','vsph-ui-dialog-cancel','Cancel');cancel.type='button';
   const confirm=el('button',danger?'vsph-ui-dialog-accept is-danger':'vsph-ui-dialog-accept',confirmLabel);
   if(confirmLabel==='Close'&&fields.length)cancel.hidden=true;
   confirm.type='button';actions.append(cancel,confirm);card.append(actions);
   dialog.append(card);dialog.setAttribute('aria-labelledby','vsph-dialog-title');
   dialog.setAttribute('aria-modal','true');document.body.append(dialog);
   let settled=false;
   const finish=value=>{
    if(settled)return;settled=true;
    if(dialog.open)dialog.close();dialog.remove();
    if(previous&&previous.isConnected)previous.focus({preventScroll:true});
    resolve(value);
   };
   cancel.addEventListener('click',()=>finish(false));
   confirm.addEventListener('click',()=>{
    if(inputEl&&!inputEl.checkValidity()){inputEl.reportValidity();return;}
    finish(inputEl?inputEl.value.trim():true);
   });
   dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
   if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.setAttribute('open','');dialog.classList.add('vsph-ui-dialog-fallback');}
   (inputEl||(cancel.hidden?confirm:cancel)).focus();
  });
 }
 function toast(message,{type='success',duration=5000}={}){
  let region=document.getElementById('vsph-toast-region');
  if(!region){region=el('div','vsph-toast-region');region.id='vsph-toast-region';document.body.append(region);}
  const item=el('div','vsph-toast '+(type==='error'?'is-error':'is-success'));
  item.setAttribute('role',type==='error'?'alert':'status');
  const icon=el('span','vsph-toast-symbol',type==='error'?'!':'✓');icon.setAttribute('aria-hidden','true');
  const content=el('span','vsph-toast-copy',message);
  const close=el('button','vsph-toast-close','×');close.type='button';close.setAttribute('aria-label','Dismiss notification');
  close.addEventListener('click',()=>item.remove());item.append(icon,content,close);region.append(item);
  if(type!=='error'&&duration>0)setTimeout(()=>item.remove(),duration);
  return item;
 }
 window.VSPHUI={
  confirm:(message,opts={})=>openDialog({title:opts.title||'Confirm action',description:message,confirmLabel:opts.confirmLabel||'Continue',danger:Boolean(opts.danger),fields:opts.fields||[]}),
  prompt:(message,opts={})=>openDialog({title:opts.title||'Provide a reason',description:message,confirmLabel:opts.confirmLabel||'Continue',danger:Boolean(opts.danger),input:{label:opts.label||'Reason',minLength:opts.minLength||8,maxLength:opts.maxLength||500}}),
  details:(title,fields)=>openDialog({title,fields,confirmLabel:'Close'}),toast
 };
})();
