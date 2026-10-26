// Human support only: never included in model context or Agent tools.
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function text(value,label,max){if(typeof value!=='string'||!value.trim())fail('请填写'+label+'。');const s=value.trim();if(s.length>max)fail(label+'最多'+max+'字。');return s;}
export class SupportMailbox{
  constructor(service){this.service=service;this.store=service.store;}
  get admin(){return this.service.role==='admin';}
  info(){const s=this.service,personal=s.ctx.runtime?.identity==='personal'&&!s.ctx.demo;return {canReply:this.admin,configured:s.ctx.demo||this.admin||!!s.ctx.runtime?.supportAdminConfigured||!!s.ctx.env?.ADMIN_USER_ID,title:this.admin?'管理员留言箱':'联系管理员',explanation:personal?'你是本机个人工作区的维护者；此处留言只保存在这台电脑。联系作品维护者请使用校内账号入口。':s.ctx.demo?'当前为隔离合成演示；可切换“招领志愿者”体验回复，留言不会发送给真实维护者。':'管理员是本作品被授权的维护者，负责使用问题与人工协助，不代表学校官方，也不是AI自动客服。'};}
  view(r){return {id:r.id,owner:r.owner,created:r.created,updated:r.updated,version:r.version,body:r.body};}
  async list(){return (this.admin?await this.store.list('support_ticket'):await this.store.listOwned('support_ticket',this.service.actor,50)).map(r=>this.view(r));}
  async create(input){
    const content=text(input.content,'留言内容',2000),subject=input.subject===undefined||input.subject===''?'使用反馈':text(input.subject,'留言主题',80);
    let r;try{r=await this.store.addLimited('support_ticket',this.service.actor,{subject,content,senderName:String(this.service.ctx.profile?.name||'用户').slice(0,80),status:'open',replies:[]},50);}catch(e){if(e.status===429)fail('当前账号最多保留50条留言，请联系维护者。',429);throw e;}
    await this.service.audit('support_message',{ticketId:r.id});return this.view(r);
  }
  async reply(input){
    if(!this.admin)fail('只有管理员可以回复留言。',403);
    const r=await this.store.get(input.id);if(!r||r.kind!=='support_ticket')fail('留言不存在。',404);
    if(!Number.isInteger(input.version)||input.version!==r.version)fail('留言已变化，请刷新后再回复。',409);
    const content=text(input.content,'回复内容',2000);if(r.body.replies.length>=30)fail('这条留言的回复已达上限，请另行沟通。',409);
    const saved=await this.store.save(r,{...r.body,status:'answered',replies:[...r.body.replies,{content,at:new Date().toISOString(),name:'管理员'}]});
    await this.service.notify(r.owner,{title:'管理员回复了你的留言',message:r.body.subject,supportId:r.id,type:'support'},'support:'+r.id+':'+saved.version);
    await this.service.audit('support_reply',{ticketId:r.id});return this.view(saved);
  }
}
