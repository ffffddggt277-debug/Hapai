import json, numpy as np, wave, math, sys
SR=44100
cfg=json.load(open('/data/qa/trailer.json')); rec=json.load(open(cfg['rec']))
FPS=30; fdt=1000/FPS
END_FRAMES=int(sys.argv[1]) if len(sys.argv)>1 else 45
# смещения сегментов
segs=[]; off=0.0
for s in cfg['segments']:
    if s.get('menu'): segs.append(('menu',off,s['frames']/FPS,None)); off+=s['frames']/FPS; continue
    n=math.ceil((s['to']-s['from'])/fdt); segs.append(('game',off,n/FPS,s)); off+=n/FPS
total=off+END_FRAMES/FPS
N=int(total*SR)+SR; mix=np.zeros(N); sfx=np.zeros(N)
t=lambda d: np.arange(int(d*SR))/SR
def add(buf,at,sig,g=1.0):
    i=int(at*SR); j=min(N,i+len(sig)); 
    if i<N: buf[i:j]+=sig[:j-i]*g
def env(n,a=.005,r=.1):
    e=np.ones(n); A=max(1,int(a*SR)); R=max(1,int(r*SR)); e[:A]=np.linspace(0,1,A); e[-R:]*=np.linspace(1,0,R); return e
rng=np.random.default_rng(3)
def noise(d): return rng.standard_normal(int(d*SR))
def lp(x,a): # однополюсный ФНЧ
    y=np.zeros_like(x); s=0
    for i in range(len(x)): s+=a*(x[i]-s); y[i]=s
    return y
def hp(x,a): return x-lp(x,a)
# ---- музыка: шпионский бас 132 bpm
bpm=132; beat=60/bpm; A=55.0
notes=[0,0,12,0,3,0,10,0, 0,0,12,0,7,6,5,3]
def bass(f,d):
    x=t(d); s=np.sign(np.sin(2*np.pi*f*x))*.5+np.sin(2*np.pi*f*x)*.5; return lp(s*np.exp(-x*7),.18)
def hat(d=.05): return hp(noise(d),.5)*np.exp(-t(d)*90)
def kick(): x=t(.25); return np.sin(2*np.pi*(50+90*np.exp(-x*30))*x)*np.exp(-x*10)
def snare(): x=t(.2); return (hp(noise(.2),.3)*.6+np.sin(2*np.pi*190*x)*.4)*np.exp(-x*18)
step=beat/2; k=0; tt=0.0
mel=[(0,24),(2,27),(3,31),(5,30),(6,29),(7,27)]
while tt<total-1.0:
    n=notes[k%16]; add(mix,tt,bass(A*2**(n/12),step*.95),.55)
    add(mix,tt,hat(),.18 if k%2 else .1)
    if k%4==0: add(mix,tt,kick(),.7)
    if k%8==4: add(mix,tt,snare(),.35)
    # мелодия-«стаб» каждые 2 такта
    if k%32 in (0,3,6,16,19,22):
        f=A*4*2**([0,3,7,0,3,10][[0,3,6,16,19,22].index(k%32)]/12); x=t(.18); add(mix,tt,(np.sin(2*np.pi*f*x)+.4*np.sin(4*np.pi*f*x))*np.exp(-x*12),.16)
    k+=1; tt+=step
# громкость музыки: тише в меню на старте, финальный аккорд
fade=np.ones(N); i0=int((total-END_FRAMES/FPS)*SR); fade[i0:]=np.linspace(1,0,N-i0)**2; mix*=fade
# ---- SFX
def glass():
    d=.7; x=t(d); s=hp(noise(d),.6)*np.exp(-x*9)*.7
    for _ in range(9): f=rng.uniform(2500,6000); a=rng.uniform(0,.35); y=t(.25); add_s=np.sin(2*np.pi*f*y)*np.exp(-y*25); i=int(a*SR); s[i:i+len(y)]+=add_s[:len(s)-i]*.25
    return s
def cash(): x=t(.6); return (np.sin(2*np.pi*1318*x)*np.exp(-x*6)+np.sin(2*np.pi*1975*x)*np.exp(-np.maximum(0,x-.08)*6)*(x>.08))*.5
def whoosh(): d=.35; x=t(d); return lp(noise(d),.25)*np.sin(np.pi*x/d)*.6
def thud(): x=t(.3); return (np.sin(2*np.pi*(80+60*np.exp(-x*20))*x)*np.exp(-x*12)+lp(noise(.3),.1)*np.exp(-x*25))*.9
def zap(): x=t(.6); return np.sign(np.sin(2*np.pi*(900*np.exp(-x*3))*x))*np.exp(-x*4)*.25
def creak(): x=t(.5); f=140+30*np.sin(2*np.pi*7*x); return lp(np.sign(np.sin(2*np.pi*np.cumsum(f)/SR)),.2)*env(len(x),.05,.15)*.25
def beep(f=880): x=t(.15); return np.sin(2*np.pi*f*x)*env(len(x),.003,.05)*.4
def fanfare():
    s=np.zeros(int(1.4*SR))
    for i,n in enumerate([0,4,7,12]): x=t(.6); y=(np.sin(2*np.pi*440*2**(n/12)*x)+.3*np.sin(2*np.pi*880*2**(n/12)*x))*np.exp(-x*3); j=int(i*.12*SR); s[j:j+len(y)]+=y*.3
    return s
def boom(): x=t(1.2); return (np.sin(2*np.pi*(40+80*np.exp(-x*8))*x)*np.exp(-x*3)+lp(noise(1.2),.05)*np.exp(-x*4)*.5)
for kind,o,d,s in segs:
    if kind=='menu': continue
    F,T=s['from'],s['to']; prev=None
    me=None
    for r in rec['states']:
        at=r['at']; st=r['st']
        if at<F or at>=T: continue
        ot=o+(at-F)/1000; me=st['you']['id']
        for e in st.get('events') or []:
            ty=e['type']; mine=e.get('pid')==me
            if ty=='stolen': add(sfx,ot,glass(),1 if mine else .35)
            elif ty=='deposit': add(sfx,ot,cash(),1 if mine else .4)
            elif ty=='dash': add(sfx,ot,whoosh(),.8 if mine else .3)
            elif ty in('push','hit'): add(sfx,ot,thud(),.9)
            elif ty=='caught': add(sfx,ot,zap(),1 if mine else .4)
            elif ty=='cabinet' and mine: add(sfx,ot,creak(),1)
            elif ty=='coin' and mine: add(sfx,ot,beep(1760),.6)
            elif ty=='start': add(sfx,ot,beep(1320),.8)
        if st['phase']=='countdown':
            c=math.ceil(st['countdown'])
            if prev is not None and c!=prev and c>0: add(sfx,ot,beep(),1)
            prev=c
        if st['phase']=='results' and prev!='res': add(sfx,ot,fanfare(),1); prev='res'
        # сирена, пока есть тревога
        if st['phase']=='playing' and st['alarms']:
            y=st['you']; dmin=min(math.hypot(a['x']-y['x'],a['z']-y['z']) for a in st['alarms']); lvl=max(.15,1-dmin/26)*.22
            x=np.arange(int(.2*SR))/SR+ (at/1000); f=750+200*np.sin(2*np.pi*1.6*x)
            add(sfx,ot,np.sin(2*np.pi*np.cumsum(f)/SR)*lvl*env(len(x),.02,.02))
add(sfx,total-END_FRAMES/FPS,boom(),.9)
out=mix*.55+sfx*.8; out=np.tanh(out*1.1)*.9
pcm=(out[:int(total*SR)]*32767).astype(np.int16)
with wave.open('/data/qa/trailer.wav','wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('total',round(total,2),[ (k,round(o,2),round(d,2)) for k,o,d,_ in segs])
