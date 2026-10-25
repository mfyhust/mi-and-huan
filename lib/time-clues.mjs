// Calendar dates in Asia/Shanghai, never inferred hours or fabricated timestamps.
const DAY=86400000;
export function validDay(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const n=Date.parse(value+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value;
}
export function sanitizeDateRange(value){
  if(!value||!validDay(value.start)||!validDay(value.end))return null;
  const days=(Date.parse(value.end)-Date.parse(value.start))/DAY;
  return days>=0&&days<=366?{start:value.start,end:value.end}:null;
}
export function extractTime(text,now=new Date()){
  const s=String(text),today=new Date(new Date(now).getTime()+8*3600e3).toISOString().slice(0,10);
  const offset=n=>new Date(Date.parse(today+'T00:00:00Z')-n*DAY).toISOString().slice(0,10);
  const unknown=/(?:时间|日期|哪天)[^，。；,;]{0,5}(?:不记得|记不清|不知道|忘了)|(?:不记得|记不清|不知道|忘了)[^，。；,;]{0,5}(?:时间|日期|哪天)/.test(s);
  const affirmative=m=>!/(?:不是|并非).{0,1}$/.test(s.slice(Math.max(0,m.index-4),m.index));
  const explicit=[...s.matchAll(/\d{4}-\d{2}-\d{2}/g)].filter(affirmative);
  // An invalid or reversed explicit range must not silently turn into its first day.
  if(explicit.length>=2){
    const between=s.slice(explicit[0].index+10,explicit[1].index);
    if(/到|至|~|～|—|或/.test(between)){
      const dateRange=sanitizeDateRange({start:explicit[0][0],end:explicit[1][0]});
      return dateRange?{date:'',dateRange,dateUnknown:false}:{};
    }
  }
  const recent=s.match(/(?:最近|近|过去)([一二两三四五六七八九十]|\d{1,2})天/);
  if(recent){
    const n=Number(recent[1])||({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[recent[1]]);
    if(n>=1&&n<=31)return {date:'',dateRange:{start:offset(n-1),end:today},dateUnknown:false};
  }
  const relative=[...s.matchAll(/前天|昨天|昨晚|今天|今早/g)].filter(affirmative);
  if(relative.length>=2&&/到|至|或/.test(s.slice(relative[0].index+relative[0][0].length,relative[1].index))){
    const days=relative.slice(0,2).map(m=>offset(m[0]==='前天'?2:/昨/.test(m[0])?1:0)).sort();
    return {date:'',dateRange:{start:days[0],end:days[1]},dateUnknown:false};
  }
  if(explicit.length){return validDay(explicit[0][0])?{date:explicit[0][0],dateRange:null,dateUnknown:false}:{};}
  if(relative.length)return {date:offset(relative[0][0]==='前天'?2:/昨/.test(relative[0][0])?1:0),dateRange:null,dateUnknown:false};
  if(unknown)return {date:'',dateRange:null,dateUnknown:true};
  return {};
}
export function compareItemDate(criteria,found){
  const range=sanitizeDateRange(criteria.dateRange),date=validDay(criteria.date)?criteria.date:null;
  if(criteria.dateUnknown||!range&&!date)return null;
  if(!validDay(found))return {gain:0,pending:'拾获记录未登记有效日期'};
  const start=range?.start||date,end=range?.end||date;
  if(found<start)return {gain:-4,conflict:'拾获日期早于所述遗失时间，需核对日期'};
  if(found<=end)return {gain:8,reason:range?'拾获日期在所述时间范围内':'拾获与遗失日期一致'};
  const days=(Date.parse(found)-Date.parse(end))/DAY;
  return {gain:8*Math.max(0,1-days/14),...(days<=1?{reason:'拾获日期接近所述时间'}:days>14?{conflict:'拾获与遗失时间间隔较大'}:{pending:'拾获晚于所述时间，需核对'})};
}
