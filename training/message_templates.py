"""Keep trusted execution feedback compatible with Qwen's leading-system-only template."""
import copy
import json


def template_messages(messages):
    result=[];feedback=[]
    for message in copy.deepcopy(messages):
        if message.get('content') is None:message['content']=''
        if message['role']=='system' and result:
            if not isinstance(message['content'],str):raise ValueError('应用控制反馈必须为文字')
            feedback.append(message['content']);continue
        for call in message.get('tool_calls',[]):
            value=call['function'].get('arguments',{})
            if isinstance(value,str):call['function']['arguments']=json.loads(value)
        result.append(message)
    if feedback:
        if not result or result[0]['role']!='system':raise ValueError('执行反馈缺少原始系统上下文')
        result[0]['content']+='\n\n应用在对话过程中产生的执行核对反馈（按发生顺序；可能已由后续工具执行解决，以最新工具返回和任务状态为准）：\n'+'\n'.join(feedback)
    return result
