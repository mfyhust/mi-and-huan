#!/usr/bin/env python3
"""Independent stdlib verification of the pinned training checkpoint; no inference."""
import argparse
import hashlib
import json
from pathlib import Path

def verify(model_dir,source):
    checked=[]
    for entry in source['files']:
        name=entry['name']
        if Path(name).name!=name:raise ValueError('文件名越界')
        path=model_dir/name
        if not path.is_file() or path.stat().st_size!=entry['size']:raise ValueError('文件缺失或体积不符：'+name)
        algorithm='sha256' if entry['sha256'] else 'sha1';h=hashlib.new(algorithm)
        if algorithm=='sha1':h.update(('blob '+str(entry['size'])+'\0').encode())
        with path.open('rb') as f:
            for block in iter(lambda:f.read(4*1024*1024),b''):h.update(block)
        if h.hexdigest()!=(entry['sha256'] or entry['gitBlob']):raise ValueError('摘要不符：'+name)
        checked.append(name);print('校验通过：'+name,flush=True)
    return checked

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--model-dir',type=Path,required=True);args=parser.parse_args()
    source=json.loads((Path(__file__).parent/'model-source.json').read_text())
    names=verify(args.model_dir,source)
    print(json.dumps({'repository':source['repository'],'revision':source['revision'],'files':len(names),'verified':True,'modelLoaded':False},ensure_ascii=False,indent=2))
