#!/usr/bin/env python3
"""Check the running local edition. API checks never invoke a paid model."""
import http.cookiejar,json,sys,urllib.error,urllib.request

edition=sys.argv[1] if len(sys.argv)>1 else 'local'
if edition not in ('api','local'):raise SystemExit('请选择 api 或 local')
base='http://127.0.0.1:5173'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
client.open(base+'/signin-with-chatgpt?return_to=/',timeout=30).read()

def request(path,body=None):
    headers={'x-demo-mode':'1','x-demo-actor':'lin','content-type':'application/json'}
    req=urllib.request.Request(base+'/api/'+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
    try:
        with client.open(req,timeout=35) as response:return response.status,json.load(response)
    except urllib.error.HTTPError as error:return error.code,json.load(error)

status,state=request('bootstrap')
assert status==200,(status,state.get('error'))
assert state['model']['edition']==edition,state['model']['edition']
report={'edition':edition,'provider':state['model']['provider'],'model':state['model']['model'],'configured':state['model']['configured'],'api_model_requests':0}
if edition=='local':
    before=len(state['tasks'])
    for override in [{'provider':'sjtu'},{'provider':'ollama','key':'forbidden-test-key'},{'provider':'ollama','model':'qwen3:8b-cloud'},{'url':'https://example.com'}]:
        status,result=request('chat',{'text':'版本边界检查：黑色保温杯','llm':override})
        assert status==400,(status,result.get('error'))
    _,after=request('bootstrap')
    assert len(after['tasks'])==before,'拒绝的请求不应创建任务'
    report['forbidden_requests_rejected']=4
    report['rejected_requests_created_tasks']=0
    status,result=request('chat',{'text':'本地版本检查：黑色保温杯','llm':{}})
    assert status==200 and result['provider']=='ollama',(status,result.get('error'))
    assert result['mode'] in ('model','rules-fallback'),result['mode']
    report['local_chat_mode']=result['mode']
    report['local_chat_candidates']=len(result['matches'])
    report['model_requests']=result['execution']['modelRequests']
    # Retain the synthetic check as a clearly cancelled task, not a real search.
    status,_=request('tasks/action',{'id':result['taskId'],'action':'cancel'})
    assert status==200
else:
    report['local_check_task_leaked_into_api']=any(t['body']['title']=='本地版本检查：黑色保温杯' for t in state['tasks'])
    assert not report['local_check_task_leaked_into_api']
print(json.dumps(report,ensure_ascii=False,indent=2))
