#!/usr/bin/env python3
"""Download pinned public training-format weights locally, never upload or train."""
import argparse
import concurrent.futures
import hashlib
import json
import subprocess
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / 'training/model-source.json').read_text())
OUT = ROOT / '.training-runtime/base-model/Qwen3.5-4B'

def checksum(path, algorithm='sha256'):
    h = hashlib.new(algorithm)
    if algorithm == 'sha1':
        h.update(('blob ' + str(path.stat().st_size) + '\0').encode())
    with path.open('rb') as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def valid(path, entry):
    if not path.is_file() or path.stat().st_size != entry['size']:
        return False
    return checksum(path) == entry['sha256'] if entry['sha256'] else checksum(path, 'sha1') == entry['gitBlob']

def download_ranges(partial, entry, url):
    block = 64 * 1024 * 1024
    while not partial.exists() or partial.stat().st_size < entry['size']:
        start = partial.stat().st_size if partial.exists() else 0
        end = min(entry['size'], start + block) - 1
        segment = partial.with_name(partial.name + '.segment')
        headers = partial.with_name(partial.name + '.headers')
        result = subprocess.run(['curl','-fLsS','--retry','3','--retry-all-errors',
            '--connect-timeout','15','--max-time','180','--max-filesize',str(block),
            '--range',f'{start}-{end}','-D',str(headers),'-o',str(segment),
            '-w','%{http_code}',url],check=True,capture_output=True,text=True)
        ranges = re.findall(r'content-range:\s*bytes (\d+)-(\d+)/(\d+)',headers.read_text(),re.I)
        if result.stdout.strip() != '206' or not ranges or tuple(map(int,ranges[-1])) != (start,end,entry['size']):
            raise RuntimeError('服务器没有返回请求的分段，保留文件并停止：' + entry['name'])
        if segment.stat().st_size != end-start+1:
            raise RuntimeError('分段大小不符，不合并：' + entry['name'])
        with partial.open('ab') as dst,segment.open('rb') as src:
            shutil.copyfileobj(src,dst,4*1024*1024)
        segment.unlink();headers.unlink()
        print('分段保存：' + entry['name'] + ' ' + str(end+1) + '/' + str(entry['size']),flush=True)

def download(entry):
    name = entry['name']
    if Path(name).name != name:
        raise RuntimeError('文件名越界')
    path = OUT / name
    if path.exists():
        if valid(path, entry):return {'name': name, 'sha256': checksum(path), 'bytes': path.stat().st_size}
        raise RuntimeError('已有文件摘要不符，保留并停止：' + name)
    partial = path.with_name('.partial-' + name)
    print('准备：' + name + '，字节 ' + str(entry['size']), flush=True)
    if not valid(partial, entry):
        url = 'https://huggingface.co/' + SOURCE['repository'] + '/resolve/' + SOURCE['revision'] + '/' + name
        if entry['size'] > 64 * 1024 * 1024:
            download_ranges(partial, entry, url)
        else:
            subprocess.run(['curl','-fLsS','--retry','2','--connect-timeout','15','--max-time','180','-C','-','-o',str(partial),url],check=True)
    if not valid(partial, entry):raise RuntimeError('下载摘要或体积不符，保留断点：' + name)
    partial.replace(path)
    print('已核验：' + name, flush=True)
    return {'name': name, 'sha256': checksum(path), 'bytes': path.stat().st_size}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--download',action='store_true')
    args = parser.parse_args()
    if not args.download:
        print(json.dumps({'repository':SOURCE['repository'],'revision':SOURCE['revision'],'bytes':sum(f['size'] for f in SOURCE['files']),'downloads':False,'training':False},ensure_ascii=False,indent=2))
    else:
        OUT.mkdir(parents=True,exist_ok=True,mode=0o700)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            files = list(pool.map(download,SOURCE['files']))
        (OUT/'verified-source.json').write_text(json.dumps({'source':SOURCE,'files':files,'trainingRun':False},ensure_ascii=False,indent=2)+'\n')
        print('训练格式权重逐文件校验完成；没有上传或训练。',flush=True)
