"""Fixed-allowlist targeted kit, local only; preserve all earlier kits."""
from pathlib import Path
import hashlib
import json
import zipfile
import argparse

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--revision',choices=['original','v2'],default='original')
args=parser.parse_args()
suffix='-v2' if args.revision=='v2' else ''
folder='migui-targeted-kit'+suffix
OUT=ROOT.parent/('交付/服务器训练准备/觅归-针对性训练准备-dev11'+suffix+'.zip')
if OUT.exists():raise SystemExit('已有准备包，停止以保留原件')
files={n:ROOT/'training'/n for n in ['train_lora.py','evaluate_adapter.py','verify_files.py','model-source.json']}
files['README.md']=ROOT/'training/TARGETED_README.md'
for name in ['train.jsonl','validation.jsonl','manifest.json']:
    files['data/'+name]=ROOT/'.training-data/targeted-dev11'/name
manifest=json.loads(files['data/manifest.json'].read_text())
for split in ['train','validation']:
    assert hashlib.sha256(files['data/'+split+'.jsonl'].read_bytes()).hexdigest()==manifest['sha256'][split]
payload={name:path.read_bytes() for name,path in files.items()}
if suffix:
    payload['README.md']=payload['README.md'].decode().replace('migui-targeted-kit',folder).replace('觅归-针对性训练准备-dev11.zip',OUT.name).encode()
checks=''.join(hashlib.sha256(data).hexdigest()+'  '+name+'\n' for name,data in payload.items())
OUT.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(OUT,'x',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
    for name,data in payload.items():z.writestr(folder+'/'+name,data)
    z.writestr(folder+'/KIT-SHA256SUMS.txt',checks)
with zipfile.ZipFile(OUT) as z:
    assert z.testzip() is None
    assert all('test.jsonl' not in n and '.env' not in n for n in z.namelist())
    for name,data in payload.items():assert z.read(folder+'/'+name)==data
OUT.with_suffix('.zip.sha256').write_text(hashlib.sha256(OUT.read_bytes()).hexdigest()+'  '+OUT.name+'\n')
print(json.dumps({'archive':str(OUT),'bytes':OUT.stat().st_size,'files':len(files)+1,'uploaded':False,'weightsIncluded':False,'testSetIncluded':False},ensure_ascii=False))
