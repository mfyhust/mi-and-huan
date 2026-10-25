#!/usr/bin/env python3
"""Explicit, offline-only QLoRA smoke training; never promotes a model automatically."""
import argparse
import copy
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import random
import signal
import time


def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(4*1024*1024),b''):h.update(block)
    return h.hexdigest()


def read_rows(folder,split):
    manifest=json.loads((folder/'manifest.json').read_text())
    path=folder/(split+'.jsonl')
    if sha(path)!=manifest['sha256'][split]:raise ValueError('数据摘要不匹配：'+split)
    rows=[json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    if not rows or any(r.get('synthetic') is not True or r.get('split')!=split for r in rows):raise ValueError('只接受本项目合成数据的指定划分')
    return rows


def encoded_example(tokenizer,row,max_length):
    messages=copy.deepcopy(row['messages'])
    if messages[-1]['role']!='assistant':raise ValueError('样本必须以监督的assistant目标结束')
    for message in messages:
        if message.get('content') is None:message['content']=''
        for call in message.get('tool_calls',[]):
            args=call['function'].get('arguments',{})
            if isinstance(args,str):call['function']['arguments']=json.loads(args)
    kwargs={'tools':row['tools'],'tokenize':False,'enable_thinking':False}
    prompt=tokenizer.apply_chat_template(messages[:-1],add_generation_prompt=True,**kwargs)
    full=tokenizer.apply_chat_template(messages,add_generation_prompt=False,**kwargs)
    if not full.startswith(prompt):raise ValueError('官方模板的监督边界不一致，停止而非猜测标签')
    before=tokenizer(prompt,add_special_tokens=False)['input_ids']
    ids=tokenizer(full,add_special_tokens=False)['input_ids']
    if ids[:len(before)]!=before or len(ids)<=len(before):raise ValueError('分词监督边界不一致')
    if len(ids)>max_length:return None
    target=messages[-1]
    kinds=[c['function']['name']+(':restore' if c['function'].get('arguments',{}).get('restore') else ':reject') if c['function']['name']=='record_rejection' else c['function']['name'] for c in target.get('tool_calls',[])] or ['text']
    return {'input_ids':ids,'prompt_length':len(before),'group':row['group'],'family':row['family'],'targetKinds':kinds}


def training_schedule(examples, steps, balanced=False, seed=42):
    """Round-robin family/action buckets; never consult validation targets."""
    rng=random.Random(seed)
    if not balanced:
        shuffled=examples.copy();rng.shuffle(shuffled)
        return [shuffled[i%len(shuffled)] for i in range(steps)]
    buckets={}
    for example in examples:
        key=(example['family'],tuple(sorted(example['targetKinds'])))
        buckets.setdefault(key,[]).append(example)
    keys=sorted(buckets);rng.shuffle(keys)
    if steps<len(keys):raise ValueError('均衡训练步数不足以覆盖各场景动作')
    for rows in buckets.values():rng.shuffle(rows)
    return [buckets[keys[i%len(keys)]][(i//len(keys))%len(buckets[keys[i%len(keys)]])] for i in range(steps)]


def choose_compute_dtype(torch):
    # PyTorch's default includes emulation; it can return True on a 2080 Ti.
    # Choose BF16 only when native hardware supports it, otherwise AMP FP16.
    return torch.bfloat16 if torch.cuda.is_bf16_supported(including_emulation=False) else torch.float16


def validation_subset(examples):
    # One per family can accidentally select only initial searches in every family.
    chosen=[]
    for kind in sorted({kind for e in examples for kind in e['targetKinds']}):
        if not any(kind in e['targetKinds'] for e in chosen):
            chosen.append(next(e for e in examples if kind in e['targetKinds']))
    for family in sorted({e['family'] for e in examples}):
        if not any(e['family']==family for e in chosen):
            chosen.append(next(e for e in examples if e['family']==family))
    if len(chosen)>14:raise ValueError('小规模验证覆盖超过14条预算，不静默遗漏动作')
    return chosen


def scaled_training_step(torch,loss_fn,trainable,optimizer,scaler,on_overflow,max_attempts=6):
    """Retry the same example after AMP overflow; never count a skipped update."""
    for attempt in range(max_attempts):
        optimizer.zero_grad(set_to_none=True)
        value=loss_fn()
        scaler.scale(value).backward();scaler.unscale_(optimizer)
        grads=[p.grad for p in trainable if p.grad is not None]
        if not grads:raise ValueError('没有可更新的梯度')
        finite=bool(torch.stack([torch.isfinite(g).all() for g in grads]).all())
        if not finite:
            if not scaler.is_enabled():raise ValueError('非有限梯度，且未启用FP16动态缩放')
            before=scaler.get_scale()
            # unscale_ records inf/nan; GradScaler.step skips optimizer.step.
            scaler.step(optimizer);scaler.update()
            on_overflow({'attempt':attempt+1,'scaleBefore':before,'scaleAfter':scaler.get_scale()})
            if attempt+1==max_attempts:raise ValueError('FP16梯度连续溢出，达到有限重试上限')
            continue
        norm=torch.nn.utils.clip_grad_norm_(trainable,1.0,error_if_nonfinite=True)
        scaler.step(optimizer);scaler.update()
        return float(value.detach()),float(norm)
    raise AssertionError('更新未完成')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--run',action='store_true')
    parser.add_argument('--check-data',action='store_true')
    parser.add_argument('--base-model',type=Path)
    parser.add_argument('--data',type=Path,default=Path('data'))
    parser.add_argument('--output',type=Path)
    parser.add_argument('--steps',type=int,default=10)
    parser.add_argument('--max-seconds',type=int,default=1200)
    parser.add_argument('--max-length',type=int,default=3072)
    parser.add_argument('--balanced',action='store_true',help='按训练场景与监督动作均衡采样，保留原始数据')
    args=parser.parse_args()
    if args.run and args.check_data:parser.error('训练与数据检查分别运行')
    if not 1<=args.steps<=100 or not 60<=args.max_seconds<=1800 or not 256<=args.max_length<=4096:parser.error('超出小规模验证范围')
    plan={'method':'NF4 QLoRA','baseModel':'Qwen/Qwen3.5-4B','steps':args.steps,'maxSeconds':args.max_seconds,'maxLength':args.max_length,'runsTraining':args.run,'automaticPromotion':False,'balancedSampling':args.balanced}
    if not args.run and not args.check_data:print(json.dumps(plan,ensure_ascii=False,indent=2));return
    if not args.base_model or not args.base_model.is_dir():parser.error('必须提供已校验的本机模型目录')
    if args.run and (not args.output or args.output.exists()):parser.error('训练必须指定一个尚不存在的输出目录，避免覆盖')
    if args.run:
        from verify_files import verify
        verify(args.base_model,json.loads((Path(__file__).parent/'model-source.json').read_text()))
    # No inference service, online download, remote code, or experiment tracker.
    for key in ['HF_HUB_OFFLINE','TRANSFORMERS_OFFLINE','HF_HUB_DISABLE_TELEMETRY']:os.environ[key]='1'
    os.environ['WANDB_DISABLED']='true'
    from transformers import AutoTokenizer
    tokenizer=AutoTokenizer.from_pretrained(args.base_model,local_files_only=True,trust_remote_code=False)
    raw={name:read_rows(args.data,name) for name in ['train','validation']}
    groups={name:{r['group'] for r in rows} for name,rows in raw.items()}
    if groups['train']&groups['validation']:raise ValueError('训练与验证任务重叠')
    encoded={name:[e for row in rows if (e:=encoded_example(tokenizer,row,args.max_length)) is not None] for name,rows in raw.items()}
    stats={name:{'raw':len(raw[name]),'kept':len(rows),'skippedTooLong':len(raw[name])-len(rows),'families':sorted({r['family'] for r in rows}),'targetKinds':dict(Counter(k for r in rows for k in r['targetKinds']))} for name,rows in encoded.items()}
    if any(not rows for rows in encoded.values()):raise ValueError('长度筛选后没有可用训练/验证样例')
    for name in encoded:
        for needed in ['record_rejection:restore','record_rejection:reject','subscribe_to_clues','search_found_items']:
            if not stats[name]['targetKinds'].get(needed):raise ValueError('长度筛选丢失关键动作 '+name+': '+needed)
    if args.check_data:print(json.dumps({'trained':False,'statistics':stats,'testSetRead':False},ensure_ascii=False,indent=2));return
    schedule=training_schedule(encoded['train'],args.steps,args.balanced)
    import torch
    import torch.nn.functional as F
    import peft
    from transformers import BitsAndBytesConfig,Qwen3_5ForConditionalGeneration
    from peft import LoraConfig,get_peft_model,prepare_model_for_kbit_training
    if not torch.cuda.is_available():raise ValueError('训练验证要求CUDA，不自动转CPU或云端')
    if torch.cuda.device_count()!=1:raise ValueError('请通过CUDA_VISIBLE_DEVICES仅选一张空闲GPU')
    started=time.monotonic();random.seed(42);torch.manual_seed(42)
    args.output.mkdir(parents=True,mode=0o700)
    report={'status':'running',**plan,'statistics':stats,'testSetRead':False,'baseChanged':False,'adapterDeployed':False,'lossHistory':[],'gpu':torch.cuda.get_device_name(0),'torchVersion':torch.__version__,'peftVersion':peft.__version__,'dataManifestSha256':sha(args.data/'manifest.json'),
        'scheduledFamilies':dict(Counter(e['family'] for e in schedule)),'scheduledTargetKinds':dict(Counter(k for e in schedule for k in e['targetKinds'])),'scheduledUniqueGroups':len({e['group'] for e in schedule})}
    class BudgetExpired(Exception):pass
    def expire(*_):raise BudgetExpired('达到包含模型加载在内的运行时限')
    signal.signal(signal.SIGALRM,expire);signal.alarm(args.max_seconds)
    try:
        dtype=choose_compute_dtype(torch)
        report['computeDtype']=str(dtype)
        report['computeDtypePolicy']='native-bf16-otherwise-fp16'
        model=Qwen3_5ForConditionalGeneration.from_pretrained(args.base_model,local_files_only=True,trust_remote_code=False,dtype=dtype,device_map={'':0},attn_implementation='sdpa',quantization_config=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_use_double_quant=True,bnb_4bit_compute_dtype=dtype))
        model=prepare_model_for_kbit_training(model,use_gradient_checkpointing=True)
        model.config.use_cache=False
        targets=[n for n,_ in model.named_modules() if 'language_model.layers.' in n and n.endswith(('.q_proj','.v_proj','.o_proj','.out_proj'))]
        if not targets:raise ValueError('未找到预期文本投影层，不自动更换模型或训练视觉模块')
        model=get_peft_model(model,LoraConfig(r=8,lora_alpha=16,target_modules=targets,lora_dropout=0.05,bias='none',task_type='CAUSAL_LM'))
        trainable=[p for p in model.parameters() if p.requires_grad]
        report['trainableParameters']=sum(p.numel() for p in trainable);report['targetModules']=len(targets)
        report['trainableNames']=[n for n,p in model.named_parameters() if p.requires_grad]
        tracked=[p for n,p in model.named_parameters() if p.requires_grad and 'lora_B' in n][0]
        initial=tracked.detach().cpu().clone()
        optimizer=torch.optim.AdamW(trainable,lr=2e-5,weight_decay=0.01,foreach=False)
        scaler=torch.amp.GradScaler('cuda',enabled=dtype==torch.float16,init_scale=128.0)
        report['ampOverflowRetries']=[]
        def loss(example):
            ids=torch.tensor([example['input_ids']],device='cuda:0')
            boundary=example['prompt_length'];positions=torch.arange(boundary-1,ids.shape[1]-1,device=ids.device)
            # Only materialize logits for supervised assistant tokens, not the long prompt.
            with torch.autocast('cuda',dtype=dtype):
                output=model(input_ids=ids,attention_mask=torch.ones_like(ids),use_cache=False,logits_to_keep=positions)
                value=F.cross_entropy(output.logits[0].float(),ids[0,boundary:])
            if not torch.isfinite(value):raise ValueError('出现非有限损失，停止并保留报告')
            return value
        # Fixed, bounded validation subset; this is not the held-out Agent test.
        validation=validation_subset(encoded['validation'])
        def validation_loss():
            model.eval()
            with torch.no_grad():values=[float(loss(e)) for e in validation]
            return sum(values)/len(values)
        report['validationExamples']=len(validation)
        report['validationTargetKinds']=dict(Counter(k for e in validation for k in e['targetKinds']))
        report['validationFamilies']=sorted({e['family'] for e in validation})
        report['validationLossBefore']=validation_loss()
        for step in range(args.steps):
            model.train()
            def overflow(event):
                event={'step':step+1,**event};report['ampOverflowRetries'].append(event)
                print(json.dumps({'ampOverflowRetry':event}),flush=True)
            value,norm=scaled_training_step(torch,lambda:loss(schedule[step]),trainable,optimizer,scaler,overflow)
            result={'step':step+1,'loss':value,'gradNorm':norm,'elapsedSeconds':round(time.monotonic()-started,2)}
            report['lossHistory'].append(result);print(json.dumps(result),flush=True)
        report['validationLossAfter']=validation_loss()
        report['trackedParameterChangeL1']=float((tracked.detach().cpu()-initial).abs().sum())
        if not report['trackedParameterChangeL1']>0:raise ValueError('未检测到适配器参数更新')
        model.save_pretrained(args.output/'adapter',safe_serialization=True)
        tokenizer.save_pretrained(args.output/'tokenizer')
        report['peakAllocatedGiB']=torch.cuda.max_memory_allocated()/1024**3
        report['status']='smoke-completed';report['qualityImproved']=None
        report['note']='只证明少量步骤可更新和保存适配器；不证明Agent质量提升，未合并、导出或替换部署模型。'
    except Exception as error:
        report['status']='failed';report['error']=type(error).__name__+': '+str(error)[:500]
        raise
    finally:
        signal.alarm(0);report['elapsedSeconds']=round(time.monotonic()-started,2)
        (args.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({'status':report['status'],'report':str(args.output/'report.json')},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
