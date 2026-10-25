#!/usr/bin/env python3
"""Opt-in live local integration check. Uses synthetic demo data and model quota."""
import argparse,datetime,http.cookiejar,json,time,urllib.request
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--run-model-tests',action='store_true',help='Confirm a few real model requests using the local app configuration')
args=parser.parse_args()
if not args.run_model_tests:parser.error('请显式添加 --run-model-tests；测试会消耗少量模型额度。')
base='http://127.0.0.1:5173';jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
opener.open(base+'/signin-with-chatgpt?return_to=/',timeout=20).close()
def api(path,body=None,actor='lin'):
 headers={'x-demo-mode':'1','x-demo-actor':actor,'Origin':base}
 data=None
 if body is not None:headers['Content-Type']='application/json';data=json.dumps(body,ensure_ascii=False).encode()
 req=urllib.request.Request(base+'/api/'+path,data=data,headers=headers)
 with opener.open(req,timeout=160) as response:return json.load(response)
root=Path(__file__).resolve().parents[1]
report={'checked_at':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),'scope':'本机真实API、交大模型、合成演示数据','steps':[]}
def record(stage,**body):
 row={'stage':stage,**body};report['steps'].append(row);print(json.dumps(row,ensure_ascii=False),flush=True)
 (root/'.sites-runtime/local-agent-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def turn(text,task_id=None):
 result=api('chat',{'text':text,'taskId':task_id})
 record('真实模型对话',text=text,taskId=result.get('taskId'),mode=result.get('mode'),provider=result.get('provider'),model=result.get('model'),elapsedMs=result.get('elapsedMs'),message=result.get('message'),criteria=result.get('criteria'),candidate_count=len(result.get('matches',[])),tools=[t['name'] for t in result.get('traces',[])],modelError=result.get('modelError'))
 if result.get('mode')!='model':raise RuntimeError('实际调用未完成模型模式，请查看记录的失败原因。')
 return result
try:
 bootstrap=api('bootstrap');assert bootstrap['model']['configured'] and bootstrap['model']['provider']=='sjtu'
 record('本机模型配置',provider=bootstrap['model']['provider'],model=bootstrap['model']['model'])
 for old in api('bootstrap',actor='zhou')['myItems']:
  if old['body'].get('status')=='available' and old['body'].get('title','').startswith('本地联调样例'):
   api('items/withdraw',{'id':old['id']},actor='zhou')
 label='本地联调样例'+datetime.datetime.now().strftime('%H%M%S')
 today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat()
 ids=[]
 for brand in ['象印','膳魔师']:
  item=api('items',{'title':label+'｜紫色'+brand+'保温杯','category':'水杯','color':'紫色','brand':brand,'location':'图书馆','date':today,'description':'合成联调样例，紫色杯身，杯盖完整。','custody':'演示保管人','privateNote':'联调隐藏标记，不能进入公开检索'},actor='zhou')['item'];ids.append(item['id'])
 r=turn('本地联调：今天在图书馆丢了一个紫色保温杯，帮我找找。')
 assert r['criteria'].get('color')=='紫色' and {m['item']['id'] for m in r['matches']}==set(ids),'应按紫色条件筛选到两条联调候选'
 r2=turn('我记起来了，品牌是象印。',r['taskId'])
 assert r2['criteria'].get('brand')=='象印' and len(r2['matches'])==1 and r2['matches'][0]['item']['id']==ids[0],'补充品牌后应缩小为一条'
 pending=turn('本地联调：今天在第一教学楼丢了一个橙色文件袋。请持续留意新线索。')
 assert pending['subscribed'] and len(pending['matches'])==0,'暂无候选时应保存用户明确要求的订阅'
 item=api('items',{'title':label+'｜橙色文件袋','category':'包袋','color':'橙色','location':'第一教学楼','date':today,'description':'合成联调样例，橙色文件袋。','custody':'演示保管人'},actor='zhou')['item']
 b=api('bootstrap');notice=any(n['body'].get('taskId')==pending['taskId'] and n['body'].get('itemId')==item['id'] for n in b['notifications'])
 assert notice,'新增拾获信息应通知订阅者'
 record('后到线索提醒',passed=True,taskId=pending['taskId'],itemId=item['id'])
 report['passed']=True
except Exception as error:
 report['passed']=False;record('检查未通过',error=str(error));raise
finally:
 (root/'.sites-runtime/local-agent-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
