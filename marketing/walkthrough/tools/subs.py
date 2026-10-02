# SRT (EN + BN), YouTube chapters and a VO script from TIMELINE.
# usage: python3 subs.py tl.json outdir
import json, sys, os
TL = json.load(open(sys.argv[1])); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
BN = json.load(open(os.path.join(os.path.dirname(__file__), 'bn.json')))
assert len(BN) == len(TL['caps']), (len(BN), len(TL['caps']))
def ts(x):
    ms = int(round(x * 1000)); return '%02d:%02d:%02d,%03d' % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)
def mmss(x): x = int(x); return '%d:%02d' % (x // 60, x % 60)
for lang, texts in (('en', [c['text'] for c in TL['caps']]), ('bn', BN)):
    with open(os.path.join(OUT, f'walkthrough.{lang}.srt'), 'w') as f:
        for i, (c, s) in enumerate(zip(TL['caps'], texts), 1): f.write(f"{i}\n{ts(c['a'])} --> {ts(c['b'])}\n{s}\n\n")
with open(os.path.join(OUT, 'chapters.txt'), 'w') as f:
    f.write('0:00 Cold open\n' + ''.join(f"{mmss(c['t'])} {c['title']}\n" for c in TL['chapters']))
with open(os.path.join(OUT, 'vo-script.md'), 'w') as f:
    f.write('# চলো walkthrough — voice-over script\n\nOne line per caption, timed to the master. Read at a calm pace; each line fits its window.\n\n')
    f.write('| Time | English | বাংলা |\n|---|---|---|\n')
    for c, b in zip(TL['caps'], BN): f.write(f"| {mmss(c['a'])} | {c['text']} | {b} |\n")
print('ok', len(BN))
