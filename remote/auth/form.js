for(const button of document.querySelectorAll('[data-toggle]'))button.addEventListener('click',()=>{
 const input=document.getElementById(button.dataset.toggle),visible=input.type==='password';input.type=visible?'text':'password';button.textContent=visible?'隐藏':'显示';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',(visible?'隐藏':'显示')+(input.id==='confirmation'?'确认密码':'密码'));
});
for(const form of document.forms)form.addEventListener('submit',event=>{
 const password=form.elements.namedItem('password'),confirmation=form.elements.namedItem('confirmation');if(confirmation&&password.value!==confirmation.value){event.preventDefault();confirmation.setCustomValidity('两次输入的密码不一致');confirmation.reportValidity();return;}const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='正在处理，请稍候…';
});
const confirmation=document.getElementById('confirmation');confirmation?.addEventListener('input',()=>confirmation.setCustomValidity(''));
