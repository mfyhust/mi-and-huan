"""Parse Qwen's official tool format; application remains the authorization boundary."""
import json
import re
import uuid


def assistant_message(text, tools):
    if '<|im_start|>' in text or '<|im_end|>' in text:
        raise ValueError('模型输出跨越回合边界')
    if text.count('<think>') != text.count('</think>'):
        raise ValueError('思考块未闭合')
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.S).strip()
    blocks = list(re.finditer(r'<tool_call>\s*<function=(\w+)>(.*?)</function>\s*</tool_call>', text, re.S))
    residue = re.sub(r'<tool_call>\s*<function=(\w+)>(.*?)</function>\s*</tool_call>', '', text, flags=re.S)
    if any(tag in residue for tag in ['<tool_call', '</tool_call', '<function=', '<parameter=']):
        raise ValueError('工具调用结构不完整')
    if not blocks:
        if not text:
            raise ValueError('模型回答为空')
        return {'role': 'assistant', 'content': text}
    if len(blocks) > 8:
        raise ValueError('工具调用数量超出单轮上限')
    # The official format permits prose before calls, but not interleaved/suffix replies.
    cursor = blocks[0].start()
    prefix = text[:cursor].strip()
    for block in blocks:
        if text[cursor:block.start()].strip():
            raise ValueError('工具块之间存在额外文本')
        cursor = block.end()
    if text[cursor:].strip():
        raise ValueError('工具调用后不能伪造执行结果')
    schemas = {t['function']['name']: t['function']['parameters'].get('properties', {}) for t in tools}
    calls = []
    for block in blocks:
        name, body = block.groups()
        pairs = re.findall(r'<parameter=(\w+)>\s*(.*?)\s*</parameter>', body, re.S)
        if re.sub(r'<parameter=(\w+)>\s*(.*?)\s*</parameter>', '', body, flags=re.S).strip():
            raise ValueError('工具参数结构不完整')
        args = {}
        for key, value in pairs:
            if key in args:
                raise ValueError('工具参数重复')
            kind = schemas.get(name, {}).get(key, {}).get('type')
            if kind == 'boolean':
                if value not in ('True', 'False', 'true', 'false'):
                    raise ValueError('布尔工具参数无效')
                args[key] = value.lower() == 'true'
            elif kind in ('integer', 'number', 'array', 'object'):
                args[key] = json.loads(value)
            else:
                args[key] = value
        # Unknown names/fields are preserved so the real Agent rejects them; never repair silently.
        calls.append({'id': 'local-'+uuid.uuid4().hex, 'type': 'function',
                      'function': {'name': name, 'arguments': json.dumps(args, ensure_ascii=False)}})
    return {'role': 'assistant', 'content': prefix or None, 'tool_calls': calls}
