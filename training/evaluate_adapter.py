#!/usr/bin/env python3
"""Offline, bounded validation comparison; no training, tool execution or promotion."""
import argparse
import contextlib
import json
import os
from pathlib import Path
import re
import signal
import time

from train_lora import encoded_example, read_rows, sha, choose_compute_dtype


def stop_token_ids(tokenizer, default_eos):
    """The chat template ends at im_end, which can differ from model EOS."""
    chat_end = tokenizer.convert_tokens_to_ids('<|im_end|>')
    if chat_end is None or tokenizer.convert_ids_to_tokens(chat_end) != '<|im_end|>':
        raise ValueError('分词器缺少已核实的im_end回合结束标记')
    values = default_eos if isinstance(default_eos, list) else [default_eos]
    return sorted({value for value in [chat_end, tokenizer.eos_token_id, *values] if value is not None})


def select_cases(rows, limit):
    """Cover every target kind and family before filling in fixed file order."""
    def kinds(row):
        calls = row['messages'][-1].get('tool_calls', [])
        return [c['function']['name'] + (':restore' if json.loads(c['function']['arguments']).get('restore') else ':reject')
                if c['function']['name'] == 'record_rejection' else c['function']['name'] for c in calls] or ['text']
    chosen = []
    for field, values in [('kind', sorted({k for r in rows for k in kinds(r)})),
                          ('family', sorted({r['family'] for r in rows}))]:
        for value in values:
            if any(value in kinds(r) if field == 'kind' else r['family'] == value for r in chosen):
                continue
            chosen.append(next(r for r in rows if value in kinds(r)) if field == 'kind'
                          else next(r for r in rows if r['family'] == value))
    if len(chosen) > limit:
        raise ValueError('样本上限不足以覆盖全部目标和场景')
    ids = {r['id'] for r in chosen}
    for row in rows:
        if len(chosen) >= limit:
            break
        if row['id'] not in ids:
            chosen.append(row)
            ids.add(row['id'])
    return chosen


def score_output(text, row):
    """Strict XML syntax and exact gold arguments, NOT semantic/Agent success."""
    expected = row['messages'][-1].get('tool_calls', [])
    if '<|im_start|>' in text or '<|im_end|>' in text:
        return {'expected': 'tool' if expected else 'text', 'exactToolMatch': False if expected else None,
                'roleBoundaryViolation': True, 'manualReviewRequired': True,
                'parseError': '输出越过assistant回合边界，不接受伪造的后续用户或工具交互'}
    blocks = re.findall(r'<tool_call>\s*<function=([\w]+)>(.*?)</function>\s*</tool_call>', text, re.S)
    residue = re.sub(r'<tool_call>\s*<function=([\w]+)>(.*?)</function>\s*</tool_call>', '', text, flags=re.S)
    if not expected:
        return {'expected': 'text', 'unexpectedToolCall': bool(blocks) or '<tool_call' in text,
                'exactToolMatch': None, 'manualReviewRequired': True}
    schemas = {t['function']['name']: t['function']['parameters']['properties'] for t in row['tools']}
    parsed = []
    try:
        if len(blocks) != len(expected) or '<tool_call' in residue or '<function=' in residue:
            raise ValueError('工具块数量或结构不匹配')
        for name, body in blocks:
            if name not in schemas:
                raise ValueError('未知工具')
            params = re.findall(r'<parameter=([\w]+)>\s*(.*?)\s*</parameter>', body, re.S)
            if re.sub(r'<parameter=([\w]+)>\s*(.*?)\s*</parameter>', '', body, flags=re.S).strip():
                raise ValueError('参数结构不完整')
            args = {}
            for key, value in params:
                if key in args or key not in schemas[name]:
                    raise ValueError('重复或未知参数')
                kind = schemas[name][key].get('type')
                if kind == 'boolean':
                    if value not in ('True', 'False', 'true', 'false'):
                        raise ValueError('布尔值错误')
                    args[key] = value.lower() == 'true'
                elif kind == 'string':
                    args[key] = value
                else:
                    args[key] = json.loads(value)
            parsed.append({'name': name, 'arguments': args})
        gold = [{'name': c['function']['name'], 'arguments': json.loads(c['function']['arguments'])} for c in expected]
        # Canonical JSON distinguishes true from 1 and ignores dictionary order.
        exact = json.dumps(parsed, sort_keys=True) == json.dumps(gold, sort_keys=True)
        return {'expected': 'tool', 'exactToolMatch': exact, 'parsed': parsed,
                'manualReviewRequired': not exact}
    except (ValueError, KeyError, TypeError) as error:
        return {'expected': 'tool', 'exactToolMatch': False, 'parseError': str(error), 'manualReviewRequired': True}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--run', action='store_true')
    p.add_argument('--base-model', type=Path)
    p.add_argument('--adapter', type=Path)
    p.add_argument('--data', type=Path, default=Path('data'))
    p.add_argument('--output', type=Path)
    p.add_argument('--cases', type=int, default=14)
    p.add_argument('--max-seconds', type=int, default=1200)
    args = p.parse_args()
    if not 14 <= args.cases <= 28 or not 60 <= args.max_seconds <= 1800:
        p.error('限定14至28条验证样本，60至1800秒')
    if not args.run:
        print(json.dumps({'runsInference': False, 'cases': args.cases, 'testSetRead': False, 'training': False}))
        return
    if not args.base_model or not args.base_model.is_dir() or not args.adapter or not args.adapter.is_dir():
        p.error('需要本机基础模型与适配器目录')
    if not args.output or args.output.exists():
        p.error('输出目录必须尚不存在')
    for key in ['HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE', 'HF_HUB_DISABLE_TELEMETRY']:
        os.environ[key] = '1'
    os.environ['WANDB_DISABLED'] = 'true'
    from verify_files import verify
    verify(args.base_model, json.loads((Path(__file__).parent/'model-source.json').read_text()))
    from transformers import AutoTokenizer, BitsAndBytesConfig, Qwen3_5ForConditionalGeneration
    import torch
    import torch.nn.functional as F
    from peft import PeftModel, get_peft_model_state_dict, prepare_model_for_kbit_training
    from safetensors.torch import load_file
    if not torch.cuda.is_available() or torch.cuda.device_count() != 1:
        raise ValueError('通过CUDA_VISIBLE_DEVICES仅选择一张空闲GPU')
    rows = select_cases(read_rows(args.data, 'validation'), args.cases)
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, local_files_only=True, trust_remote_code=False)
    examples = [encoded_example(tokenizer, row, 3072) for row in rows]
    if any(e is None for e in examples):
        raise ValueError('验证样本超长，不静默剔除')
    saved = load_file(str(args.adapter/'adapter_model.safetensors'), device='cpu')
    if not saved or any(not torch.isfinite(v).all() for v in saved.values()):
        raise ValueError('适配器为空或包含非有限参数')
    args.output.mkdir(parents=True, mode=0o700)
    report = {'status': 'running', 'evaluatorVersion': 2, 'training': False, 'testSetRead': False, 'adapterDeployed': False,
              'qualityImproved': None, 'scope': 'synthetic-validation-single-decision',
              'productionAgentExecuted': False, 'cases': len(rows), 'results': [],
              'validationGroups': len({r['group'] for r in rows}),
              'adapterSha256': sha(args.adapter/'adapter_model.safetensors'),
              'validationSha256': sha(args.data/'validation.jsonl'),
              'note': '严格参数匹配是诊断指标，等价表达可能误判；文本需人工复核。不代表实际工具执行或任务成功率。'}
    started = time.monotonic()
    def expire(*_):
        raise TimeoutError('评测达到运行预算')
    previous = signal.signal(signal.SIGALRM, expire)
    signal.alarm(args.max_seconds)
    try:
        torch.manual_seed(42)
        dtype = choose_compute_dtype(torch)
        report['computeDtype'] = str(dtype)
        report['computeDtypePolicy'] = 'native-bf16-otherwise-fp16'
        base = Qwen3_5ForConditionalGeneration.from_pretrained(args.base_model, local_files_only=True,
            trust_remote_code=False, dtype=dtype, device_map={'': 0}, attn_implementation='sdpa',
            quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4',
                bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=dtype))
        # Match the training runner's non-quantized FP32 casts, without enabling checkpointing.
        base = prepare_model_for_kbit_training(base, use_gradient_checkpointing=False)
        model = PeftModel.from_pretrained(base, args.adapter, is_trainable=False, local_files_only=True)
        model.requires_grad_(False)
        model.eval()
        stops = stop_token_ids(tokenizer, model.generation_config.eos_token_id)
        report['stopTokenIds'] = stops
        report['tokenizerEosTokenId'] = tokenizer.eos_token_id
        report['defaultGenerationEosTokenId'] = model.generation_config.eos_token_id
        loaded = get_peft_model_state_dict(model)
        if set(saved) != set(loaded) or any(not torch.equal(saved[k].float(), loaded[k].detach().cpu().float()) for k in saved):
            raise ValueError('重新加载后的适配器与保存文件不一致')
        report['adapterReloadVerified'] = True
        report['adapterTensorsMatched'] = len(saved)
        report['gpu'] = torch.cuda.get_device_name(0)
        for row, example in zip(rows, examples):
            case = {'id': row['id'], 'family': row['family'], 'targetKinds': example['targetKinds'],
                    'gold': row['messages'][-1], 'variants': {}}
            report['results'].append(case)
            ids = torch.tensor([example['input_ids']], device='cuda:0')
            boundary = example['prompt_length']
            positions = torch.arange(boundary-1, ids.shape[1]-1, device=ids.device)
            for variant in ['base', 'adapter']:
                with (model.disable_adapter() if variant == 'base' else contextlib.nullcontext()), torch.inference_mode():
                    with torch.autocast('cuda', dtype=dtype):
                        logits = model(input_ids=ids, attention_mask=torch.ones_like(ids), use_cache=False,
                                       logits_to_keep=positions).logits
                        loss = F.cross_entropy(logits[0].float(), ids[0, boundary:])
                    if not torch.isfinite(loss):
                        raise ValueError('非有限验证损失')
                    loss_value = float(loss)
                    del logits, loss
                    prompt = ids[:, :boundary]
                    generated = model.generate(input_ids=prompt, attention_mask=torch.ones_like(prompt),
                        max_new_tokens=192, do_sample=False, use_cache=True,
                        eos_token_id=stops,
                        pad_token_id=tokenizer.pad_token_id if tokenizer.pad_token_id is not None else tokenizer.eos_token_id)
                    new_ids = generated[0, boundary:]
                    raw_text = tokenizer.decode(new_ids, skip_special_tokens=False)
                    ended = len(new_ids) > 0 and int(new_ids[-1]) in stops
                    # Remove only an actual final stop token; preserve role markers for diagnosis.
                    text = tokenizer.decode(new_ids[:-1] if ended else new_ids, skip_special_tokens=False)
                    score = score_output(text, row)
                    capped = len(new_ids) >= 192 and not ended
                    if capped and score.get('exactToolMatch'):
                        score['exactToolMatch'] = False
                    if capped:
                        score['manualReviewRequired'] = True
                    case['variants'][variant] = {'loss': loss_value, 'generatedText': text,
                        'rawGeneratedText': raw_text, 'endedWithStopToken': ended,
                        'tokenCapReached': capped, **score}
                print(json.dumps({'case': row['id'], 'variant': variant,
                    'loss': loss_value, 'exactToolMatch': score['exactToolMatch']}, ensure_ascii=False), flush=True)
        report['summary'] = {}
        for variant in ['base', 'adapter']:
            values = [r['variants'][variant] for r in report['results']]
            tools = [v for v in values if v['expected'] == 'tool']
            report['summary'][variant] = {'meanExampleLoss': sum(v['loss'] for v in values)/len(values),
                'toolCases': len(tools), 'strictToolMatches': sum(v['exactToolMatch'] for v in tools),
                'textCasesWithUnexpectedTools': sum(v.get('unexpectedToolCall', False) for v in values),
                'roleBoundaryViolations': sum(v.get('roleBoundaryViolation', False) for v in values),
                'tokenCapReached': sum(v['tokenCapReached'] for v in values)}
        report['peakAllocatedGiB'] = torch.cuda.max_memory_allocated()/1024**3
        report['status'] = 'comparison-completed'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = type(error).__name__ + ': ' + str(error)[:500]
        raise
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)
        report['elapsedSeconds'] = round(time.monotonic()-started, 2)
        (args.output/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps({'status': report['status'], 'report': str(args.output/'report.json')}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
