#!/usr/bin/env python3
"""Explicit, project-local preparation. No installer, daemon, driver or inference."""
from pathlib import Path, PurePosixPath
import argparse
import concurrent.futures
import datetime
import hashlib
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.40.6'
RUNTIME_SHA = 'c164ab8b1b28e2a247c29719b8e404c423c5b83ae64c3ab4e59d50c7ff7fc5e0'
MANIFEST_SHA = 'd8b0f5e9760cd1682034f292d7ef72ec46f432149be0df7574bf2d6e92e38c04'
MODEL = 'qwen3.5:4b-q4_K_M'
REGISTRY = 'https://registry.ollama.ai/v2/library/qwen3.5/'

def digest(path):
    # Compatible with the user's Python 3.10; bounded memory for multi-GB files.
    checksum = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b''):
            checksum.update(chunk)
    return checksum.hexdigest()

def fetch(url, destination, checksum, size=None):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if (size is None or destination.stat().st_size == size) and digest(destination) == checksum:
            return
        raise RuntimeError('已有文件未通过校验，保留原文件，请核对后重试：' + str(destination.relative_to(ROOT)))
    partial = destination.with_name('.partial-' + destination.name)
    if not (size is not None and partial.exists() and partial.stat().st_size == size and digest(partial) == checksum):
        subprocess.run(['curl', '-fLsS', '--retry', '2', '--connect-timeout', '15', '--max-time', '1800',
                        '-C', '-', '-o', str(partial), url], check=True)
    if (size is not None and partial.stat().st_size != size) or digest(partial) != checksum:
        raise RuntimeError('下载文件未通过体积/摘要校验；保留断点，不写入模型清单。')
    os.chmod(partial, 0o600)
    partial.replace(destination)

def prepare_runtime():
    os.umask(0o077)
    runtime = ROOT / '.offline-runtime'
    downloads = runtime / 'downloads'
    archive = downloads / ('ollama-v' + VERSION + '-linux-amd64.tar.zst')
    runtime_url = 'https://github.com/ollama/ollama/releases/download/v' + VERSION + '/ollama-linux-amd64.tar.zst'
    fetch(runtime_url, archive, RUNTIME_SHA, 1438364593)
    install = runtime / ('ollama-v' + VERSION)
    if not (install / '.verified-extraction').exists():
        listing = subprocess.check_output(['tar', '--zstd', '-tf', str(archive)], text=True)
        for name in listing.splitlines():
            p = PurePosixPath(name)
            if p.is_absolute() or '..' in p.parts:
                raise RuntimeError('归档包含越界路径，不提取。')
        install.mkdir(parents=True, exist_ok=True)
        subprocess.run(['tar', '--zstd', '--no-same-owner', '--no-same-permissions', '-xf', str(archive), '-C', str(install)], check=True)
        if not (install / 'bin/ollama').is_file():
            raise RuntimeError('运行器归档缺少预期入口。')
        os.chmod(install / 'bin/ollama', 0o700)
        (install / '.verified-extraction').write_text(RUNTIME_SHA + '\n')
    print('Ollama官方归档已核验并提取到项目内。', flush=True)
    return runtime, runtime_url

def prepare():
    runtime, runtime_url = prepare_runtime()
    downloads = runtime / 'downloads'
    manifest_file = downloads / 'qwen3.5-4b-q4_K_M.manifest.json'
    fetch(REGISTRY + 'manifests/4b-q4_K_M', manifest_file, MANIFEST_SHA)
    raw = manifest_file.read_bytes()
    manifest = json.loads(raw)
    blobs = ROOT / '.offline-models/blobs'

    def layer_download(layer):
        value = layer['digest']
        if not value.startswith('sha256:') or len(value) != 71 or any(c not in '0123456789abcdef' for c in value[7:]):
            raise RuntimeError('模型分片摘要格式错误。')
        fetch(REGISTRY + 'blobs/' + value, blobs / value.replace(':', '-'), value[7:], layer['size'])
        print('分片已校验：' + layer['mediaType'], flush=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(layer_download, [manifest['config'], *manifest['layers']]))
    installed_manifest = ROOT / '.offline-models/manifests/registry.ollama.ai/library/qwen3.5/4b-q4_K_M'
    installed_manifest.parent.mkdir(parents=True, exist_ok=True)
    installed_manifest.write_bytes(raw)
    report = {'created_at': datetime.datetime.now().astimezone().isoformat(), 'model': MODEL,
              'ollama_version': VERSION, 'runtime_url': runtime_url, 'runtime_sha256': RUNTIME_SHA,
              'manifest_sha256': MANIFEST_SHA, 'model_size_bytes': sum(l['size'] for l in [manifest['config'], *manifest['layers']]),
              'blobs': [{'digest': l['digest'], 'size': l['size'], 'type': l['mediaType']} for l in [manifest['config'], *manifest['layers']]],
              'inference_run_by_prepare': False, 'system_service_installed': False, 'drivers_installed': False}
    (runtime / 'preparation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('运行器、清单和全部模型分片校验通过；本步骤没有启动服务或运行推理。', flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true', help='需用户明确授权；下载/校验/提取，不启动服务或推理')
    options = parser.parse_args()
    if options.download:
        prepare()
    else:
        print(json.dumps({'model': MODEL, 'runtime': VERSION, 'manifest_sha256': MANIFEST_SHA,
                          'downloads': False, 'inference': False, 'next': '经用户授权后使用 --download'}, ensure_ascii=False, indent=2))
