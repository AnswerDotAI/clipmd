#!/usr/bin/env python3
import json, os, shutil, subprocess
from pathlib import Path
from ghapi.all import GhApi

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
MANIFEST = ROOT / "manifest.json"
FILES = ["manifest.json","background.js","offscreen.html","offscreen.js","turndown.js","README.md","icons"]
BUMP = os.environ.get("BUMP","patch").lower()
KEY_PATH = Path(os.environ.get("KEY_PATH", ROOT/"signing-key.pem"))
CHROME_BIN = os.environ.get("CHROME_BIN")
TARGET_COMMITISH = os.environ.get("TARGET_COMMITISH","main")

def bump(ver):
    a,b,c = (list(map(int, ver.split("."))) + [0,0,0])[:3]
    if BUMP=="major": a,b,c = a+1,0,0
    elif BUMP=="minor": b,c = b+1,0
    else: c+=1
    return f"{a}.{b}.{c}"

def save_manifest(v):
    data = json.loads(MANIFEST.read_text()); data["version"]=v
    MANIFEST.write_text(json.dumps(data,indent=2)+"\n")

def stage():
    dst = DIST/"clipmd"
    if dst.exists(): shutil.rmtree(dst)
    dst.mkdir(parents=True, exist_ok=True)
    for f in FILES:
        src, out = ROOT/f, dst/f
        if src.is_dir(): shutil.copytree(src,out)
        elif src.exists():
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src,out)
    return dst

def zip_it(dst):
    shutil.make_archive(str(DIST/"clipmd"),"zip",root_dir=DIST,base_dir=dst.name)

def find_chrome():
    if CHROME_BIN: return CHROME_BIN
    for c in ["google-chrome-stable","google-chrome","chromium","chromium-browser"]:
        if shutil.which(c): return c

def crx(dst):
    chrome = find_chrome()
    if not chrome: return
    KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not KEY_PATH.exists(): subprocess.run(["openssl","genrsa","-out",str(KEY_PATH),"2048"], check=True)
    subprocess.run([chrome,f"--pack-extension={dst}",f"--pack-extension-key={KEY_PATH}"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for c in [dst.with_suffix(".crx"), dst/"clipmd.crx"]:
        if c.exists(): shutil.move(c, DIST/"clipmd.crx")

def release(version):
    token = os.environ.get("GITHUB_TOKEN")
    if not token: return
    url = subprocess.check_output(["git","config","--get","remote.origin.url"], text=True).strip()
    if url.endswith(".git"): url = url[:-4]
    path = url.split(":",1)[1] if url.startswith("git@") else url.split("://",1)[1].split("/",1)[1]
    owner, repo = tuple(path.split("/")[:2])
    api = GhApi(owner=owner, repo=repo, token=token)
    tag = f"v{version}"
    try: rel = api.repos.get_release_by_tag(tag)
    except Exception: rel = api.repos.create_release(tag_name=tag, name=f"ClipMD v{version}", target_commitish=TARGET_COMMITISH)
    assets = {p.name:p for p in [DIST/"clipmd.zip", DIST/"clipmd.crx"] if p.exists()}
    if not assets: return
    existing = {a.name:a.id for a in api.repos.list_release_assets(rel.id)}
    for name,path in assets.items():
        if name in existing: api.repos.delete_release_asset(existing[name])
        with open(path,"rb") as fh: api.repos.upload_release_asset(rel.id, name=name, data=fh.read(), label=name)

DIST.mkdir(exist_ok=True)
v = bump(json.loads(MANIFEST.read_text())["version"])
save_manifest(v)
dst = stage()
zip_it(dst)
crx(dst)
(DIST/"version.txt").write_text(v)
release(v)
print(f"Built {v}")

