# Assemble the master and make the short cuts.
# usage: python3 cuts.py <segdir> <music.wav> <stills dir> <outdir>
import subprocess, sys, os, json
SEG, MUSIC, STILLS, OUT = sys.argv[1:5]; os.makedirs(OUT, exist_ok=True)
FF = open('/tmp/claude-0/-home-user-cholo/0fa3d96b-ff87-52da-968b-41d83cf82665/scratchpad/ffpath').read().strip()
def run(*a): print('>', ' '.join(a)[:160]); subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', *a], check=True)
MASTER = os.path.join(OUT, 'cholo-walkthrough.mp4')
ENC = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k']

# master: concat the rendered segments (stream copy) + loudness-normalised score
lst = os.path.join(SEG, 'list.txt')
open(lst, 'w').write(''.join(f"file '{os.path.join(SEG, s)}.mp4'\n" for s in 'abcd'))
run('-f', 'concat', '-safe', '0', '-i', lst, '-i', MUSIC, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', MASTER)

XF = 0.35
def cut(name, parts, vertical=False):
    durs = [b - a for a, b in parts]; fc = []
    for i, (a, b) in enumerate(parts):
        fc.append(f'[0:v]trim={a}:{b},setpts=PTS-STARTPTS,fps=30[v{i}]')
        fc.append(f'[0:a]atrim={a}:{b},asetpts=PTS-STARTPTS[a{i}]')
    v, a, acc = 'v0', 'a0', durs[0]
    for i in range(1, len(parts)):
        fc.append(f'[{v}][v{i}]xfade=transition=fade:duration={XF}:offset={acc - XF:.3f}[vx{i}]')
        fc.append(f'[{a}][a{i}]acrossfade=d={XF}[ax{i}]')
        v, a, acc = f'vx{i}', f'ax{i}', acc + durs[i] - XF
    total = acc
    fc.append(f'[{v}]fade=t=in:d=0.4,fade=t=out:st={total - 0.6:.3f}:d=0.6[vf]')
    fc.append(f'[{a}]afade=t=in:d=0.3,afade=t=out:st={total - 0.8:.3f}:d=0.8,loudnorm=I=-14:TP=-1.0[af]')
    ins = ['-i', MASTER]
    if vertical:
        ins += ['-i', os.path.join(STILLS, 'vertical-overlay.png')]
        fc.append('[vf]split[s1][s2];[s1]scale=-2:1920,crop=1080:1920,boxblur=40:2,eq=brightness=-0.12[bg];[s2]scale=1080:-2[fg];'
                  '[bg][fg]overlay=0:656[cmp];[cmp][1:v]overlay=0:0,format=yuv420p[vo]')
        vo = 'vo'
    else: vo = 'vf'
    out = os.path.join(OUT, name)
    run(*ins, '-filter_complex', ';'.join(fc), '-map', f'[{vo}]', '-map', '[af]', *ENC, out)
    print(name, round(total, 2), 's')

cut('cholo-90s.mp4', [(0, 10.4), (36.5, 44.8), (103.4, 108.7), (148.9, 163.1), (222.2, 228.6), (259.4, 268.6),
                      (337.6, 341.8), (395.6, 404.8), (490.6, 504.3), (591.7, 600.85)])
cut('cholo-60s-vertical.mp4', [(0, 10.4), (103.4, 108.7), (148.9, 163.1), (395.6, 404.8), (490.6, 504.3), (591.7, 600.85)], vertical=True)
cut('cholo-15s-teaser.mp4', [(1.0, 5.6), (155.3, 159.6), (338.0, 340.5), (595.5, 600.4)])
