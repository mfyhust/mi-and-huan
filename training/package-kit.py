#!/usr/bin/env python3
"""Fixed allowlist server preparation kit; no upload, weights, secrets or business DB."""
from pathlib import Path
import hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'交付/服务器训练准备/觅归-训练准备-dev10.zip'
files={name:ROOT/'training'/name for name in ['train_lora.py','verify_files.py','model-source.json']}
files['README.md']=ROOT/'training/SERVER_README.md'
for name in ['train.jsonl','validation.jsonl','manifest.json']:files['data/'+name]=ROOT/'.training-data'/name
manifest=json.loads(files['data/manifest.json'].read_text())
for split in ['train','validation']:
    assert hashlib.sha256(files['data/'+split+'.jsonl'].read_bytes()).hexdigest()==manifest['sha256'][split]
checksums=''.join(hashlib.sha256(path.read_bytes()).hexdigest()+'  '+name+'\n' for name,path in files.items())
OUT.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
    for name,path in files.items():z.write(path,'migui-training-kit/'+name)
    z.writestr('migui-training-kit/KIT-SHA256SUMS.txt',checksums)
with zipfile.ZipFile(OUT) as z:
    assert z.testzip() is None
    assert all('test.jsonl' not in n and '.env' not in n and '.venv' not in n for n in z.namelist())
    for name,path in files.items():assert z.read('migui-training-kit/'+name)==path.read_bytes()
(OUT.with_suffix('.zip.sha256')).write_text(hashlib.sha256(OUT.read_bytes()).hexdigest()+'  '+OUT.name+'\n')
print(json.dumps({'archive':str(OUT),'bytes':OUT.stat().st_size,'files':len(files)+1,'uploaded':False,'weightsIncluded':False,'testSetIncluded':False},ensure_ascii=False))
