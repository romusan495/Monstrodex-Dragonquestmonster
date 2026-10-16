import random, math
W,H=1920,1080
def ridge(seed,base,amp,rough,n=7,x0=-50,x1=W+50):
    r=random.Random(seed)
    pts=[(x0,base+r.uniform(-amp,amp)),(x1,base+r.uniform(-amp,amp))]
    a=amp
    for _ in range(n):
        new=[]
        for (xa,ya),(xb,yb) in zip(pts,pts[1:]):
            new.append((xa,ya));new.append(((xa+xb)/2,(ya+yb)/2+r.uniform(-a,a)))
        new.append(pts[-1]);pts=new;a*=rough
    return pts
def poly(pts,bottom=H+20):
    return "M"+" L".join(f"{x:.1f},{y:.1f}" for x,y in pts)+f" L{pts[-1][0]},{bottom} L{pts[0][0]},{bottom}Z"
r=random.Random(7)
stars=""
for i in range(260):
    x=r.uniform(0,W);y=r.uniform(0,H*.62)**1 
    y=r.random()**1.6*H*.65
    s=r.choice([.6,.8,1,1.2,1.6,2.2]);o=r.uniform(.35,1)
    stars+=f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{s}" fill="{r.choice(["#fff","#fff","#cfd8ff","#ffd9e8"])}" opacity="{o:.2f}"/>'
# castle on right cliff
cx=1390
def tower(x,w,top,base,spire=True,win=3,seed=0):
    rr=random.Random(seed)
    s=f'<rect x="{x}" y="{top}" width="{w}" height="{base-top}"/>'
    s+=f'<path d="M{x-6},{top} L{x+w+6},{top} L{x+w+6},{top-8} L{x+w-6},{top-8} L{x+w-6},{top-16} L{x+6},{top-16} L{x+6},{top-8} L{x-6},{top-8}Z"/>' if not spire else f'<path d="M{x-5},{top} L{x+w/2},{top-w*2.6} L{x+w+5},{top}Z"/>'
    return s
castle=""
castle+=tower(cx-170,46,470,720,True,seed=1)
castle+=tower(cx-60,70,380,720,True,seed=2)
castle+=tower(cx+60,54,430,720,True,seed=3)
castle+=tower(cx+170,40,500,720,True,seed=4)
castle+=tower(cx+250,34,540,720,False,seed=5)
castle+=f'<rect x="{cx-210}" y="560" width="540" height="160"/>'
for k in range(0,27): castle+=f'<rect x="{cx-210+k*20}" y="548" width="12" height="14"/>'
castle+=f'<path d="M{cx-30},720 L{cx-30},650 Q{cx},620 {cx+30},650 L{cx+30},720Z" fill="#05020d"/>'
castle+=tower(cx-250,30,520,720,True,seed=9)
castle+=tower(cx+300,36,500,720,True,seed=10)
castle+=f'<rect x="{cx-100}" y="470" width="20" height="100"/>'

castle+=f'<path d="M{cx-12},{380-70} l12,-60 l12,60z"/>'
wins=""
for (x,y) in [(cx-150,520),(cx-42,430),(cx-22,430),(cx-30,500),(cx+80,480),(cx+185,545),(cx-100,610),(cx-20,610),(cx+60,610),(cx+140,600),(cx+210,615),(cx-150,650),(cx+20,660)]:
    wins+=f'<rect x="{x}" y="{y}" width="7" height="13" rx="3" fill="#ffb347" opacity="{r.uniform(.6,1):.2f}"/>'
fire=ridge(11,930,40,.55,6)
f1=ridge(21,830,60,.58,7)
f2=ridge(31,720,90,.6,7)
f3=ridge(41,600,130,.6,7)
rk=random.Random(8)
left=[(1150,724),(1120,760),(1085,800),(1100,850),(1040,900),(1000,960),(960,1040)]
right=[(1740,724),(1775,770),(1760,820),(1810,870),(1850,930),(1900,1040)]
mid=[(x,724+rk.uniform(-4,4)) for x in range(1190,1740,60)]
cliff=[(960,H+10)]+left[::-1]+mid+right+[(1920,H+10)]
cl=cliff
trees=""
rr=random.Random(3)
for i in range(26):
    x=rr.uniform(-20,W);h=rr.uniform(90,260)
    base=rr.uniform(960,1100)
    trees+=f'<path d="M{x:.0f},{base:.0f} l{-h*.16:.0f},{-h*.5:.0f} l{h*.08:.0f},0 l{-h*.12:.0f},{-h*.4:.0f} l{h*.08:.0f},0 l{h*.12:.0f},{-h*.6:.0f} l{h*.12:.0f},{h*.6:.0f} l{h*.08:.0f},0 l{-h*.12:.0f},{h*.4:.0f} l{h*.08:.0f},0 l{h*.16:.0f},{h*.5:.0f}Z"/>'
embers=""
for i in range(40):
    embers+=f'<circle class="em" style="--x:{rr.uniform(0,100):.0f}vw;--d:{rr.uniform(9,22):.1f}s;--dl:-{rr.uniform(0,20):.1f}s;--s:{rr.uniform(1.4,3.4):.1f}px;--dx:{rr.uniform(-60,60):.0f}px"/>'
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03011a"/><stop offset=".3" stop-color="#0e0636"/><stop offset=".55" stop-color="#2a0e5a"/><stop offset=".72" stop-color="#5b1468"/><stop offset=".85" stop-color="#9a1f5c"/><stop offset="1" stop-color="#2a0a2a"/></linearGradient>
<radialGradient id="moonhalo" cx="1370" cy="250" r="520" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff3a6a" stop-opacity=".55"/><stop offset=".3" stop-color="#c3144f" stop-opacity=".28"/><stop offset="1" stop-color="#6a0a4a" stop-opacity="0"/></radialGradient>
<radialGradient id="moon" cx="1330" cy="260" r="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffd0c0"/><stop offset=".55" stop-color="#ff6a6a"/><stop offset=".9" stop-color="#b3123f"/><stop offset="1" stop-color="#7a0a3a"/></radialGradient>
<radialGradient id="horizon" cx="1300" cy="720" r="700" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff7a4a" stop-opacity=".5"/><stop offset="1" stop-color="#ff7a4a" stop-opacity="0"/></radialGradient>
<linearGradient id="fadeTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".4" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="mf1" gradientUnits="userSpaceOnUse" x1="0" y1="560" x2="0" y2="900"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="mf2" gradientUnits="userSpaceOnUse" x1="0" y1="720" x2="0" y2="1040"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="mm1"><rect width="{W}" height="{H}" fill="url(#mf1)"/></mask><mask id="mm2"><rect width="{W}" height="{H}" fill="url(#mf2)"/></mask>
<mask id="cloudmask"><rect width="{W}" height="{H}" fill="url(#fadeTop)"/></mask>
<filter id="clouds" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0035 .011" numOctaves="6" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 .62  0 0 0 0 .33  0 0 0 0 .85  0 0 0 2.6 -1.15"/></filter>
<filter id="clouds2" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".006 .02" numOctaves="5" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 .95  0 0 0 0 .3  0 0 0 0 .5  0 0 0 2.4 -1.3"/></filter>
<filter id="mist" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".004 .03" numOctaves="4" seed="21"/><feColorMatrix type="matrix" values="0 0 0 0 .7  0 0 0 0 .55  0 0 0 0 .95  0 0 0 2 -.85"/></filter>
<filter id="moonsurf" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="4" seed="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .3  0 0 0 0 0  0 0 0 0 .1  0 0 0 1.3 -.5" result="c"/><feComposite in="c" in2="SourceGraphic" operator="in"/></filter>
<filter id="blur"><feGaussianBlur stdDeviation="40"/></filter><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 -.18"/></filter>
<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>
<linearGradient id="far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a1f6e"/><stop offset="1" stop-color="#8a2a6e"/></linearGradient>
<linearGradient id="m1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#341557"/><stop offset="1" stop-color="#52195e"/></linearGradient>
<linearGradient id="m2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f0d3d"/><stop offset="1" stop-color="#2c0e46"/></linearGradient>
<linearGradient id="m3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#100622"/><stop offset="1" stop-color="#1a0a30"/></linearGradient>
</defs>
<rect width="{W}" height="{H}" fill="url(#sky)"/>
{stars}
<circle cx="1370" cy="250" r="520" fill="url(#moonhalo)"/>
<g mask="url(#cloudmask)"><rect width="{W}" height="{H}" filter="url(#clouds)" opacity=".75"/></g>
<circle cx="1330" cy="260" r="150" fill="url(#moon)"/>
<circle cx="1330" cy="260" r="150" fill="#000" filter="url(#moonsurf)" opacity=".5"/>
<g mask="url(#cloudmask)" style="mix-blend-mode:screen"><rect y="120" width="{W}" height="{H}" filter="url(#clouds2)" opacity=".55"/></g>
<rect width="{W}" height="{H}" fill="url(#horizon)"/>
<path d="{poly(f3)}" fill="url(#far)" opacity=".85"/>
<path d="{poly(f2)}" fill="url(#m1)"/>
<g mask="url(#mm1)"><rect y="560" width="{W}" height="340" filter="url(#mist)" opacity=".6"/></g>

<path d="{poly(f1)}" fill="url(#m2)"/>
<g mask="url(#mm2)"><rect y="720" width="{W}" height="320" filter="url(#mist)" opacity=".55"/></g>
<path d="{poly(cl)}" fill="#160a2e"/><path d="{poly(cl)}" fill="none" stroke="#7a2a6a" stroke-width="2" opacity=".5"/>
<ellipse cx="1400" cy="640" rx="420" ry="140" fill="#ff5a3c" opacity=".16" filter="url(#blur)"/><g fill="#0e0620">{castle}</g>
<g>{wins}</g>
<path d="{poly(fire)}" fill="url(#m3)"/>
<g fill="#07030f">{trees}</g>
<rect width="{W}" height="{H}" fill="url(#vig)"/>
<rect width="{W}" height="{H}" filter="url(#grain)" opacity=".35" style="mix-blend-mode:overlay"/>
</svg>'''
open('scene.svg','w').write(svg)
open('embers.txt','w').write(embers)
