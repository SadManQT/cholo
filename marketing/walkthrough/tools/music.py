# Score + SFX for the walkthrough, driven by TIMELINE (tl.json from `render.mjs timeline`).
# usage: python3 music.py tl.json out.wav
import numpy as np, wave, json, sys
TL = json.load(open(sys.argv[1])); OUT = sys.argv[2]
SR = 44100; T = TL['total'] + 0.6; N = int(SR * T); BAR = 2.0; BEAT = 0.5
rng = np.random.default_rng(7)
t = (np.arange(N) / SR).astype(np.float32)
SC = {s['id']: s for s in TL['scenes']}
def at(i): return SC[i]['a']
def lp(x, fc, order=1):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / np.sqrt(1 + (f / fc) ** (2 * order)); return np.fft.irfft(X, len(x)).astype(np.float32)
def hp(x, fc, order=2):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); r = (f / fc) ** (2 * order); X *= np.sqrt(r / (1 + r)); return np.fft.irfft(X, len(x)).astype(np.float32)
def bp(x, lo, hi): return lp(hp(x, lo), hi, 2)
def place(buf, snd, a, g=1.0):
    i = int(a * SR); j = min(len(buf), i + len(snd))
    if 0 <= i < len(buf): buf[i:j] += snd[:j - i] * g
def saw(f, tt): return 2 * ((tt * f) % 1) - 1
note = lambda m: 440 * 2 ** ((m - 69) / 12)
ar = lambda L: np.arange(L) / SR
def dly(x, d, L):
    o = np.zeros(L, np.float32); i = int(d * SR); n = min(len(x), L - i); o[i:i + n] = x[:n]; return o

# ---- arrangement ------------------------------------------------------------
# energy: 0 = pad only, 1 = light groove, 2 = full groove, 3 = drop
cards = [s for s in TL['scenes'] if s['id'].startswith('card')]
SEC = [  # (start, end, energy, progression)
    (0, at('kinetic'), 0, 'A'), (at('kinetic'), at('card1'), 2.5, 'A'),
    (at('home-desk'), at('card2'), 1, 'B'),
    (at('signup'), at('sos'), 2, 'A'), (at('sos'), at('stop'), -1, 'T'), (at('stop'), at('card3'), 2, 'A'),
    (at('d-join'), at('d-women'), 2, 'C'), (at('d-women'), at('d-earn'), 1.5, 'B'), (at('d-earn'), at('card4'), 2, 'C'),
    (at('a-dash'), at('x-reveal'), 1.5, 'B'),
    (at('x-reveal'), at('x-reveal') + 2.4, 0, 'A'), (at('x-reveal') + 2.4, at('x-flood'), 3, 'A'),
    (at('x-flood'), at('x-metro'), 1, 'B'), (at('x-metro'), at('card6'), 3, 'C'),
    (at('more'), at('card7'), 2, 'A'), (at('biz-cost'), at('biz-pitch'), 2, 'C'), (at('biz-pitch'), at('outro'), 2.5, 'A'), (at('outro'), T, 0, 'END'),
]
for c in cards: SEC.append((c['a'], c['b'], 0, 'A'))
def sec(tm):
    best = (0, 'A')
    for a, b, e, p in SEC:
        if a <= tm < b: best = (e, p)
    return best
PROG = {'A': [[57, 60, 64, 71], [53, 57, 60, 64], [60, 64, 67, 74], [55, 59, 62, 69]],   # Am F C G
        'B': [[53, 57, 60, 64], [60, 64, 67, 71], [57, 60, 64, 67], [55, 59, 62, 67]],   # Fmaj7 Cmaj7 Am7 G
        'C': [[60, 64, 67, 71], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]],   # C G Am F
        'T': [[45, 52, 57, 58], [45, 52, 57, 58], [44, 51, 56, 57], [44, 51, 56, 57]]}  # tense drone
PROG['END'] = PROG['A']

pad = np.zeros(N, np.float32); bass = np.zeros(N, np.float32); arp = np.zeros(N, np.float32)
for b in range(int(np.ceil(T / BAR))):
    s = int(b * BAR * SR); e = min(N, int((b + 1) * BAR * SR)); tt = t[s:e] - b * BAR
    en, pr = sec(b * BAR + 0.01); c = PROG[pr][b % 4]
    env = np.minimum(1, tt / 0.25) * np.minimum(1, (BAR - tt) / 0.25 + 0.001)
    for m in c:
        for d in (-0.08, 0, 0.08): pad[s:e] += saw(note(m + d), t[s:e] + rng.random()) * env * 0.045
    if en >= 1.5 or pr == 'T':
        r = note(c[0] - 24 if pr != 'T' else 33)
        for k in range(8 if pr != 'T' else 2):
            a = k * (0.25 if pr != 'T' else 1.0); i0 = s + int(a * SR); i1 = min(e, i0 + int((0.24 if pr != 'T' else 1.0) * SR)); x = ar(i1 - i0)
            be = np.exp(-x * (6 if pr != 'T' else 1.5)) * np.minimum(1, x / 0.005)
            bass[i0:i1] += (np.sin(2 * np.pi * r * x) + 0.2 * saw(r * 2, x)) * be * 0.5
    if en >= 1 and pr != 'T':
        arpn = [c[0] + 12, c[1] + 12, c[2] + 12, c[3] + 12, c[2] + 12, c[1] + 12, c[3] + 12, c[2] + 24]
        steps = 16 if en >= 2 else 8
        for k in range(steps):
            a = k * BAR / steps; m = arpn[k % 8]; i0 = s + int(a * SR); i1 = min(N, i0 + int(0.3 * SR)); x = ar(i1 - i0); f0 = note(m)
            arp[i0:i1] += (np.sin(2 * np.pi * f0 * x) + 0.35 * np.sin(4 * np.pi * f0 * x) * np.exp(-x * 30)) * np.exp(-x * 14) * 0.10 * (0.8 if k % 2 else 1)
pad = lp(pad, 1700, 2); bass = lp(bass, 800, 2)

# ---- drums ------------------------------------------------------------------
def kick():
    L = int(0.5 * SR); x = ar(L); f = 45 + 110 * np.exp(-x * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 7) + np.exp(-x * 300) * rng.standard_normal(L) * 0.15
def clap():
    L = int(0.35 * SR); x = ar(L); e = np.exp(-x * 18) + 0.6 * np.exp(-np.maximum(0, x - 0.012) * 60) * (x > 0.012)
    return bp(rng.standard_normal(L), 900, 5000) * e * 0.5
def hat(d=30):
    L = int(0.12 * SR); x = ar(L); return hp(rng.standard_normal(L), 7000) * np.exp(-x * d) * 0.18
K, C, H, H2 = kick(), clap(), hat(), hat(60)
drums = np.zeros(N, np.float32); duck = np.ones(N, np.float32)
for i in range(int(T / BEAT)):
    tm = i * BEAT; en, pr = sec(tm + 0.01)
    if en < 1 or pr == 'T': continue
    if en >= 2 or i % 2 == 0:
        place(drums, K, tm, 0.55 + 0.15 * min(en, 3))
        di = int(tm * SR); x = ar(min(int(0.3 * SR), N - di)); duck[di:di + len(x)] = np.minimum(duck[di:di + len(x)], 1 - 0.18 * en * np.exp(-x * 9))
    if en >= 2 and i % 2 == 1: place(drums, C, tm, 0.55 + 0.1 * en)
    place(drums, H, tm + BEAT / 2, 0.5 + 0.2 * en)
    if en >= 3: place(drums, H2, tm + BEAT / 4, 0.5); place(drums, H2, tm + 3 * BEAT / 4, 0.5)
# snare roll into the Act 5 drop
a0 = at('x-reveal') + 0.4; a1 = at('x-reveal') + 2.4; tm = a0
while tm < a1: place(drums, C, tm, 0.2 + 0.6 * (tm - a0) / (a1 - a0)); tm += 0.25 if tm < a0 + 1 else 0.125

# ---- sfx --------------------------------------------------------------------
def ping(f, d=0.35, g=0.28):
    L = int(d * SR); x = ar(L); return (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(4 * np.pi * f * x)) * np.exp(-x * 9) * np.minimum(1, x / 0.004) * g
def bell(f, d=2.5):
    L = int(d * SR); x = ar(L)
    return sum(np.sin(2 * np.pi * f * r * x) * np.exp(-x * (2 + i * 1.5)) * a for i, (r, a) in enumerate([(1, 1), (2.01, .4), (3.0, .25), (4.2, .12)])) * 0.12
def riser(d):
    L = int(d * SR); x = ar(L); n = hp(rng.standard_normal(L), 600)
    return (n * 0.25 + np.sin(2 * np.pi * np.cumsum(200 + 1800 * (x / d) ** 2) / SR) * 0.15) * (x / d) ** 2.2
def impact():
    L = int(3 * SR); x = ar(L); f = 30 + 60 * np.exp(-x * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 1.6) * 1.1 + lp(rng.standard_normal(L), 3000) * np.exp(-x * 5) * 0.35
def whoosh(d=0.8):
    L = int(d * SR); x = ar(L); return bp(rng.standard_normal(L), 500, 4000) * np.sin(np.pi * x / d) ** 3 * 0.22
def hit():
    L = int(0.9 * SR); x = ar(L); f = 50 + 120 * np.exp(-x * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 5) * 0.8 + bp(rng.standard_normal(L), 1500, 8000) * np.exp(-x * 12) * 0.25
def tick():
    L = int(0.05 * SR); x = ar(L); return (np.sin(2 * np.pi * 2400 * x) * 0.5 + hp(rng.standard_normal(L), 4000) * 0.5) * np.exp(-x * 160) * 0.16
def ding(): return ping(1318.5, 0.9, 0.25) + dly(ping(1760, 0.8, 0.2), 0.12, int(0.9 * SR))
def coin():
    a = ping(1975.5, 0.12, 0.25); b = ping(2637, 0.7, 0.25); return np.concatenate([a[:int(0.08 * SR)], b])
def chime(): return sum(dly(bell(note(m), 2.0), i * 0.14, int(2.6 * SR)) for i, m in enumerate([76, 79, 83, 88])) * 1.2
def bells(): return sum(dly(bell(note(m)), i * 0.18, int(3.2 * SR)) for i, m in enumerate([81, 84, 88, 93]))
def alarm():
    d = 3.2; L = int(d * SR); x = ar(L); f = 750 + 450 * (0.5 + 0.5 * np.sin(2 * np.pi * 1.6 * x))
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5 + np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5
    return lp(s, 3500, 2) * np.minimum(1, x / 0.05) * np.minimum(1, (d - x) / 0.3) * 0.14
def alert2():
    o = np.zeros(int(1.2 * SR), np.float32)
    for k, f in enumerate((988, 1319, 988, 1319)):
        i = int(k * 0.22 * SR); p = ping(f, 0.25, 0.22); o[i:i + len(p)] += p[:len(o) - i]
    return o
def rain():
    d = 9; L = int(d * SR); x = ar(L); n = bp(rng.standard_normal(L), 800, 9000) * 0.1
    drops = np.zeros(L, np.float32); idx = rng.integers(0, L - 2000, 900)
    for i in idx: drops[i:i + 400] += np.exp(-ar(400) * 400) * rng.uniform(0.05, 0.25)
    return (n + hp(drops, 2000)) * np.minimum(1, x / 1.5) * np.minimum(1, (d - x) / 2)
def metro():
    d = 4.5; L = int(d * SR); x = ar(L); rum = lp(rng.standard_normal(L), 180, 2) * 1.2
    clack = np.zeros(L, np.float32)
    for k in np.arange(0.2, d - 0.5, 0.42):
        i = int(k * SR); c = bp(rng.standard_normal(1500), 300, 2500) * np.exp(-ar(1500) * 60) * 0.4; clack[i:i + 1500] += c
    env = np.sin(np.pi * x / d) ** 1.5
    s = (rum + clack) * env * 0.5
    for i, m in enumerate([79, 76]): s[int((1.0 + i * 0.5) * SR):int((1.0 + i * 0.5) * SR) + int(1.5 * SR)] += bell(note(m), 1.5) * 1.3
    return s
def ring():
    o = np.zeros(int(1.2 * SR), np.float32)
    for k in range(2):
        i = int(k * 0.45 * SR); L2 = int(0.38 * SR); x = ar(L2)
        s = (np.sin(2 * np.pi * 1318.5 * x) + np.sin(2 * np.pi * 1661.2 * x)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 22 * x))) * np.minimum(1, (0.38 - x) / 0.03) * 0.11
        o[i:i + L2] += s
    return o
SFX = {'ring': ring, 'tick': tick, 'ding': ding, 'coin': coin, 'whoosh': whoosh, 'impact': impact, 'bells': bells, 'alarm': alarm, 'alert2': alert2,
       'chime': chime, 'metro': metro, 'rain': rain, 'riser2': lambda: riser(2.4), 'riser6': lambda: riser(4.8), 'hit': hit}
cache = {}
fx = np.zeros(N, np.float32)
for c in TL['cues']:
    nm = c['name']
    if nm not in cache or nm in ('tick',): cache[nm] = SFX[nm]().astype(np.float32)
    place(fx, cache[nm], c['t'], c.get('gain', 1))
for c in cards: place(fx, whoosh(1.0), c['a'] - 0.5, 0.9)   # act-card transitions

# ---- master -----------------------------------------------------------------
g = np.ones(N, np.float32)
def ramp(a, b, v0, v1):
    i, j = int(a * SR), min(N, int(b * SR)); g[i:j] *= np.linspace(v0, v1, j - i, dtype=np.float32)
g *= np.clip(t / 3, 0, 1)
s0, s1 = at('sos'), at('stop'); ramp(s0, s1, 0.7, 0.7)            # SOS: tense bed, alarms on top
out = np.zeros(N, np.float32); so = int(at('outro') * SR); tt = t[so:] - at('outro')
for m in [45, 57, 60, 64, 71, 76]:
    for d in (-0.06, 0, 0.06): out[so:] += saw(note(m + d), tt) * 0.09 * np.exp(-tt * 0.22)
out = lp(out, 1400, 2)
music = (pad * (1.0) + bass + arp * 0.9) * duck * g + drums * g
L = int(2.2 * SR); x = ar(L); ir = rng.standard_normal(L) * np.exp(-x * 3.2); ir = lp(ir, 5000); ir /= np.sqrt(np.sum(ir ** 2))
send = (pad * 0.5 + arp) * g + fx * 0.3 + out
M = 1 << int(np.ceil(np.log2(N + L))); wet = np.fft.irfft(np.fft.rfft(send, M) * np.fft.rfft(ir, M), M)[:N].astype(np.float32)
mix = music * 0.8 + fx * 1.3 + out + wet * 0.3
mix *= np.clip((T - 0.4 - t) / 3.0, 0, 1)
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.5) / np.tanh(1.5) * 0.9
l = mix; r = np.roll(mix, int(0.011 * SR)) * 0.3 + mix * 0.7
st = np.stack([l, r], 1); st = (st / np.max(np.abs(st)) * 0.89 * 32767).astype(np.int16)
w = wave.open(OUT, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes()); w.close()
print('ok', round(T, 2))
