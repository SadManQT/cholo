import numpy as np, wave
SR=44100; T=72; N=SR*T; BPM=120; BEAT=60/BPM
rng=np.random.default_rng(3)
t=np.arange(N)/SR
def lp(x,fc,order=1):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1/np.sqrt(1+(f/fc)**(2*order)); return np.fft.irfft(X,len(x))
def hp(x,fc,order=2):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); r=(f/fc)**(2*order); X*=np.sqrt(r/(1+r)); return np.fft.irfft(X,len(x))
def bp(x,lo,hi): return lp(hp(x,lo),hi,2)
def place(buf,snd,at,g=1.0):
    i=int(at*SR); j=min(N,i+len(snd)); 
    if i<N: buf[i:j]+=snd[:j-i]*g
def saw(f,tt): return 2*((tt*f)%1)-1
note=lambda m:440*2**((m-69)/12)
# chords: Am F C G  (midi)
CH=[[57,60,64,71],[53,57,60,64],[60,64,67,74],[55,59,62,69]]
ROOT=[45,41,48,43]
pad=np.zeros(N); bass=np.zeros(N); arp=np.zeros(N)
bar=2.0
for b in range(int(T/bar)):
    s=int(b*bar*SR); e=int((b+1)*bar*SR); tt=t[s:e]-b*bar; c=CH[b%4]
    env=np.minimum(1,tt/0.15)*np.minimum(1,(bar-tt)/0.15+0.001)
    for m in c:
        for d in (-0.08,0,0.08):
            pad[s:e]+=saw(note(m+d),t[s:e]+rng.random())*env*0.05
    r=note(ROOT[b%4]-12)
    for k in range(8):
        a=k*0.25; i0=s+int(a*SR); i1=min(e,i0+int(0.24*SR)); ttt=(np.arange(i1-i0))/SR
        be=np.exp(-ttt*6)*np.minimum(1,ttt/0.005)
        bass[i0:i1]+=(np.sin(2*np.pi*r*ttt)+0.5*saw(r*2,ttt)*0.4)*be*0.5
    arpn=[c[0]+12,c[1]+12,c[2]+12,c[3]+12,c[2]+12,c[1]+12,c[3]+12,c[2]+24]
    for k in range(16):
        a=k*0.125; m=arpn[k%8]; i0=s+int(a*SR); ln=int(0.3*SR); i1=min(N,i0+ln); ttt=np.arange(i1-i0)/SR
        f0=note(m); pe=np.exp(-ttt*14)
        arp[i0:i1]+=(np.sin(2*np.pi*f0*ttt)+0.35*np.sin(2*np.pi*2*f0*ttt)*np.exp(-ttt*30))*pe*0.12*(0.8 if k%2 else 1)
pad=lp(pad,1800,2); bass=lp(bass,900,2)
# drums
def kick():
    L=int(0.5*SR); x=np.arange(L)/SR; f=45+110*np.exp(-x*28); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-x*7)*1.0+np.exp(-x*300)*rng.standard_normal(L)*0.15
def clap():
    L=int(0.35*SR); x=np.arange(L)/SR; n=rng.standard_normal(L)
    e=np.exp(-x*18)+0.6*np.exp(-np.maximum(0,x-0.012)*60)*(x>0.012)
    return bp(n,900,5000)*e*0.5
def hat(d=30):
    L=int(0.12*SR); x=np.arange(L)/SR; return hp(rng.standard_normal(L),7000)*np.exp(-x*d)*0.18
K,C,H=kick(),clap(),hat()
drums=np.zeros(N); duck=np.ones(N)
def active(tm): return (6<=tm<64.5) and not (59.5<=tm<60)
for i in range(int(T/BEAT)):
    tm=i*BEAT
    if active(tm):
        place(drums,K,tm,0.9)
        di=int(tm*SR); L=int(0.3*SR); x=np.arange(min(L,N-di))/SR; duck[di:di+len(x)]=np.minimum(duck[di:di+len(x)],1-0.65*np.exp(-x*9))
        if i%2==1 and tm>=10: place(drums,C,tm,0.8)
        if tm>=8: place(drums,H,tm+BEAT/2,1.0)
        if tm>=18: place(drums,hat(60),tm+BEAT/4,0.5); place(drums,hat(60),tm+3*BEAT/4,0.5)
# snare roll before 60 and 65
for a,b in ((58.0,60.0),(63.0,65.0)):
    k=0; tm=a
    while tm<b:
        g=0.25+0.6*(tm-a)/(b-a); place(drums,C,tm,g); tm+=0.25 if tm<a+1 else 0.125; k+=1
# fx
fx=np.zeros(N)
def riser(d):
    L=int(d*SR); x=np.arange(L)/SR; n=hp(rng.standard_normal(L),600)
    sw=np.sin(2*np.pi*np.cumsum(200+1800*(x/d)**2)/SR)*0.15
    return (n*0.25+sw)*(x/d)**2.2
def impact():
    L=int(3*SR); x=np.arange(L)/SR; f=30+60*np.exp(-x*6)
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-x*1.6)*1.1+lp(rng.standard_normal(L),3000)*np.exp(-x*5)*0.35
def whoosh():
    L=int(0.8*SR); x=np.arange(L)/SR; e=np.sin(np.pi*x/0.8)**3
    return bp(rng.standard_normal(L),500,4000)*e*0.22
place(fx,riser(3.0),3.0,1.0); place(fx,impact(),6.0,1.0)
for c in (10,18,24,30,36,42,48,54,60): place(fx,whoosh(),c-0.45,1.0)
place(fx,riser(2.0),63.0,1.0); place(fx,impact(),65.0,1.0)
# shimmer bells at logo moments
def bell(f,d=2.5):
    L=int(d*SR); x=np.arange(L)/SR
    return sum(np.sin(2*np.pi*f*r*x)*np.exp(-x*(2+i*1.5))*a for i,(r,a) in enumerate([(1,1),(2.01,.4),(3.0,.25),(4.2,.12)]))*0.12
for i,m in enumerate([81,84,88,93]): place(fx,bell(note(m)),1.4+i*0.18,1); place(fx,bell(note(m)),66.4+i*0.18,1)
# arrangement gains
g_pad=np.clip(t/4,0,1)*np.where(t<65,1,1)
g_arp=np.clip((t-10)/1,0,1)*(t<64.5)
g_bass=np.clip((t-6)/0.1,0,1)*(t<64.5)
end=np.clip((72-t)/2.5,0,1)
# outro sustained chord
out=np.zeros(N); s=int(65*SR); tt=t[s:]-65
for m in [45,57,60,64,71,76]:
    for d in (-0.06,0,0.06): out[s:]+=saw(note(m+d),tt)*0.11*np.exp(-tt*0.18)
out=lp(out,1400,2)
mix=pad*g_pad*duck*(t<65)+bass*g_bass*duck+arp*g_arp*duck*0.9+drums+fx+out
# reverb (synthetic IR) on a send
L=int(2.2*SR); x=np.arange(L)/SR; ir=rng.standard_normal(L)*np.exp(-x*3.2); ir=lp(ir,5000); ir/=np.sqrt(np.sum(ir**2))
send=pad*g_pad*0.5+arp*g_arp+fx*0.4+out
M=1<<int(np.ceil(np.log2(N+L))); wet=np.fft.irfft(np.fft.rfft(send,M)*np.fft.rfft(ir,M),M)[:N]
mix=mix+wet*0.35
mix*=end
mix=np.tanh(mix/np.max(np.abs(mix))*1.6)/np.tanh(1.6)*0.89
# stereo widen: arp/wet slight delays
l=mix; r=np.roll(mix,int(0.011*SR))*0.3+mix*0.7
st=np.stack([l,r],1); st=(st/np.max(np.abs(st))*0.89*32767).astype(np.int16)
w=wave.open('music.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes()); w.close()
print('ok')
