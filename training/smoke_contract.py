"""Tiny random CPU model API-contract check; NOT a trained 4B model or QLoRA test."""
import json
import torch
from transformers import Qwen3_5Config,Qwen3_5TextConfig,Qwen3_5VisionConfig,Qwen3_5ForConditionalGeneration
from peft import LoraConfig,get_peft_model

torch.manual_seed(42)
text=Qwen3_5TextConfig(vocab_size=128,hidden_size=64,intermediate_size=128,num_hidden_layers=2,num_attention_heads=4,num_key_value_heads=2,head_dim=16,layer_types=['full_attention','full_attention'],full_attention_interval=1,rope_parameters={'rope_type':'default','rope_theta':10000.0,'partial_rotary_factor':0.5,'mrope_section':[2,1,1],'mrope_interleaved':True})
vision=Qwen3_5VisionConfig(depth=1,hidden_size=32,intermediate_size=64,num_heads=4,out_hidden_size=64,num_position_embeddings=16,patch_size=8,temporal_patch_size=1)
model=Qwen3_5ForConditionalGeneration(Qwen3_5Config(text_config=text.to_dict(),vision_config=vision.to_dict()))
targets=[n for n,_ in model.named_modules() if 'language_model.layers.' in n and n.endswith(('.q_proj','.v_proj','.o_proj','.out_proj'))]
model=get_peft_model(model,LoraConfig(r=4,lora_alpha=8,target_modules=targets,task_type='CAUSAL_LM'))
tracked=[p for n,p in model.named_parameters() if p.requires_grad and 'lora_B' in n][0]
before=tracked.detach().clone();optimizer=torch.optim.AdamW([p for p in model.parameters() if p.requires_grad],lr=1e-3)
ids=torch.tensor([[2,3,4,5,6,7,8,9]])
loss=model(input_ids=ids,use_cache=False,logits_to_keep=torch.arange(3,7)).logits
assert loss.shape==(1,4,128)
value=torch.nn.functional.cross_entropy(loss[0],ids[0,4:]);assert torch.isfinite(value)
value.backward();optimizer.step()
assert (tracked.detach()-before).abs().sum()>0
print(json.dumps({'fixtureOnly':True,'device':'cpu','pretrainedWeightsLoaded':False,'quantized':False,'selectiveAssistantLogitsAndBackward':True,'adapterUpdated':True,'loss':float(value.detach())},indent=2))
