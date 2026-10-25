"""Real CPU GradScaler overflow regression; no pretrained model or CUDA."""
import torch
from train_lora import scaled_training_step

p=torch.nn.Parameter(torch.tensor(1.0))
optimizer=torch.optim.SGD([p],lr=0.1)
scaler=torch.amp.GradScaler('cpu',init_scale=8.0)
# Emulate overflow only at high scales; ensure retries never update parameters.
p.register_hook(lambda g:torch.full_like(g,float('inf')) if float(g)>2 else g)
events=[]
def event(e):
    assert float(p.detach())==1.0,'溢出步骤不应更新参数'
    events.append(e)
loss,norm=scaled_training_step(torch,lambda:p*1.0,[p],optimizer,scaler,event)
assert len(events)==2 and float(p.detach())<1.0 and norm==1.0

q=torch.nn.Parameter(torch.tensor(1.0));opt=torch.optim.SGD([q],lr=0.1)
scale=torch.amp.GradScaler('cpu',init_scale=8.0);bad=[]
try:
    scaled_training_step(torch,lambda:q*float('inf'),[q],opt,scale,bad.append,max_attempts=2)
    raise AssertionError('连续溢出必须停止')
except ValueError as error:
    assert '连续溢出' in str(error)
assert len(bad)==2 and float(q.detach())==1.0
print('CPU AMP regression passed: skipped updates preserve parameters; finite retry updates once; persistent overflow stops.')
