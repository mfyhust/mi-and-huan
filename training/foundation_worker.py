#!/usr/bin/env python3
"""Evaluation-only local foundation inference over stdin/stdout; no HTTP or business tools."""
import argparse
import contextlib
import json
import os
from pathlib import Path
import signal
import sys

from train_lora import choose_compute_dtype, sha
from evaluate_adapter import stop_token_ids
from tool_protocol import assistant_message
from message_templates import template_messages


def emit(value):
    print(json.dumps(value,ensure_ascii=False),flush=True)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--run',action='store_true')
    p.add_argument('--base-model',type=Path)
    p.add_argument('--adapter',type=Path)
    p.add_argument('--variant',choices=['base','adapter'],default='base')
    p.add_argument('--max-seconds',type=int,default=600)
    args=p.parse_args()
    if not 60<=args.max_seconds<=1800:p.error('运行预算必须为60至1800秒')
    if not args.run:
        emit({'runsInference':False,'transport':'local-pipes','businessToolsExecuted':False});return
    if not args.base_model or not args.base_model.is_dir():p.error('需要本机基础模型')
    if args.variant=='adapter' and (not args.adapter or not args.adapter.is_dir()):p.error('需要本机适配器')
    def expire(*_):raise TimeoutError('本机模型进程达到运行预算')
    signal.signal(signal.SIGALRM,expire);signal.alarm(args.max_seconds)
    for key in ['HF_HUB_OFFLINE','TRANSFORMERS_OFFLINE','HF_HUB_DISABLE_TELEMETRY']:os.environ[key]='1'
    # Library logs never enter the JSON-lines protocol.
    with contextlib.redirect_stdout(sys.stderr):
        import torch
        from transformers import AutoTokenizer,BitsAndBytesConfig,Qwen3_5ForConditionalGeneration
        from peft import PeftModel,get_peft_model_state_dict,prepare_model_for_kbit_training
        from safetensors.torch import load_file
        from verify_files import verify
        if not torch.cuda.is_available() or torch.cuda.device_count()!=1:raise ValueError('仅支持一张显式选择的本机CUDA GPU')
        source=json.loads((Path(__file__).parent/'model-source.json').read_text())
        verify(args.base_model,source)
        dtype=choose_compute_dtype(torch);torch.manual_seed(42)
        tokenizer=AutoTokenizer.from_pretrained(args.base_model,local_files_only=True,trust_remote_code=False)
        model=Qwen3_5ForConditionalGeneration.from_pretrained(args.base_model,local_files_only=True,
            trust_remote_code=False,dtype=dtype,device_map={'':0},attn_implementation='sdpa',
            quantization_config=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',
                bnb_4bit_use_double_quant=True,bnb_4bit_compute_dtype=dtype))
        model=prepare_model_for_kbit_training(model,use_gradient_checkpointing=False)
        adapter_sha=None
        if args.variant=='adapter':
            saved=load_file(str(args.adapter/'adapter_model.safetensors'),device='cpu')
            model=PeftModel.from_pretrained(model,args.adapter,is_trainable=False,local_files_only=True)
            loaded=get_peft_model_state_dict(model)
            if set(saved)!=set(loaded) or any(not torch.equal(saved[k].float(),loaded[k].detach().cpu().float()) for k in saved):
                raise ValueError('适配器重载张量不一致')
            adapter_sha=sha(args.adapter/'adapter_model.safetensors')
        model.requires_grad_(False);model.eval()
        stops=stop_token_ids(tokenizer,model.generation_config.eos_token_id)
    emit({'type':'ready','variant':args.variant,'realModelLoaded':True,'gpu':torch.cuda.get_device_name(0),
          'dtype':str(dtype),'adapterSha256':adapter_sha,'baseRevision':source['revision'],'stopTokenIds':stops,
          'templateFeedbackPolicy':'trusted-system-feedback-collected-in-leading-system'})
    count=0
    while True:
        line=sys.stdin.readline(2*1024*1024+1)
        if not line:break
        if len(line)>2*1024*1024:raise ValueError('请求超出长度限制')
        request=json.loads(line);count+=1
        if count>32:raise ValueError('模型进程请求数超过32次预算')
        try:
            payload=request['payload'];messages=template_messages(payload['messages']);tools=payload.get('tools',[])
            prompt=tokenizer.apply_chat_template(messages,tools=tools,tokenize=False,
                                                add_generation_prompt=True,enable_thinking=False)
            encoded=tokenizer(prompt,add_special_tokens=False,return_tensors='pt').to('cuda:0')
            if encoded['input_ids'].shape[1]>7936:raise ValueError('输入超过评测上下文预算，不静默截断')
            with contextlib.redirect_stdout(sys.stderr),torch.inference_mode():
                generated=model.generate(**encoded,max_new_tokens=256,do_sample=False,use_cache=True,
                    eos_token_id=stops,pad_token_id=tokenizer.pad_token_id if tokenizer.pad_token_id is not None else tokenizer.eos_token_id)
            ids=generated[0,encoded['input_ids'].shape[1]:]
            ended=len(ids)>0 and int(ids[-1]) in stops
            if not ended:raise ValueError('生成达到上限或未正确结束，不执行不完整工具')
            text=tokenizer.decode(ids[:-1],skip_special_tokens=False)
            result=assistant_message(text,tools)
            emit({'id':request['id'],'message':result,'metrics':{'promptTokens':encoded['input_ids'].shape[1],
                'outputTokens':len(ids),'endedWithStopToken':ended}})
        except TimeoutError:
            raise
        except Exception as error:
            detail=type(error).__name__+': '+str(error)[:300]
            print('REQUEST_ERROR '+detail,file=sys.stderr,flush=True)
            emit({'id':request.get('id'),'error':detail})
    signal.alarm(0)


if __name__=='__main__':main()
