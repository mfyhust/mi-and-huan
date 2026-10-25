"""Minimal own-Agent evaluation source kit; no user data, weights or credentials."""
from pathlib import Path
import hashlib,json,zipfile,argparse

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--revision',choices=['original','v2'],default='original')
args=parser.parse_args();suffix='-v2' if args.revision=='v2' else ''
folder='migui-state-eval-kit'+suffix
OUT=ROOT.parent/('交付/服务器训练准备/觅归-真实Agent状态评测-dev11'+suffix+'.zip')
if OUT.exists():raise SystemExit('旧评测包已存在，不覆盖')
names=['AGENTS.md','THIRD_PARTY_NOTICES.md','package.json','drizzle/0000_military_otto_octavius.sql',
 'data/campus-minhang.mjs','docs/校园地点接入说明.md',
 'evals/adapter-state-cases.mjs','evals/run-adapter-agent.mjs','offline/storage.mjs',
 'lib/agent.mjs','lib/campus-locations.mjs','lib/candidate-feedback.mjs','lib/matching.mjs',
 'lib/model-runtime.mjs','lib/place-learning.mjs','lib/seed.mjs','lib/service.mjs','lib/store.mjs',
 'training/foundation_worker.py','training/tool_protocol.py','training/message_templates.py','training/train_lora.py',
 'training/evaluate_adapter.py','training/verify_files.py','training/model-source.json']
files={n:(ROOT/n).read_bytes() for n in names}
checks=''.join(hashlib.sha256(value).hexdigest()+'  '+name+'\n' for name,value in files.items())
with zipfile.ZipFile(OUT,'x',zipfile.ZIP_DEFLATED,compresslevel=7) as z:
 for name,value in files.items():z.writestr(folder+'/'+name,value)
 z.writestr(folder+'/KIT-SHA256SUMS.txt',checks)
with zipfile.ZipFile(OUT) as z:
 assert z.testzip() is None
 for name,value in files.items():assert z.read(folder+'/'+name)==value
OUT.with_suffix('.zip.sha256').write_text(hashlib.sha256(OUT.read_bytes()).hexdigest()+'  '+OUT.name+'\n')
print(json.dumps({'archive':str(OUT),'files':len(files)+1,'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'userData':False,'weights':False,'testSet':False},ensure_ascii=False))
