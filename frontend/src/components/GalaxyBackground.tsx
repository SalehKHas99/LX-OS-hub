
// @ts-nocheck

/**
 * GalaxyBackground.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent Milky Way canvas rendered behind every page of Andromeda.
 * Uses double domain-warped fBm noise for organic nebula structure.
 *
 * Usage:
 *   import GalaxyBackground from '@/components/GalaxyBackground';
 *   // In your layout or _app.tsx:
 *   <GalaxyBackground />
 *
 * The component positions itself fixed at z-index 0, full-screen.
 * All other UI should have z-index ≥ 1.
 */

import { useEffect, useRef } from "react";

// ── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────────
const mulberry32 = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ── Value noise ──────────────────────────────────────────────────────────────
function buildValueNoise(seed) {
  const rng = mulberry32(seed);
  const T = new Float32Array(512);
  for (let i = 0; i < 512; i++) T[i] = rng();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp  = (a, b, t) => a + (b - a) * t;
  const h = (ix, iy) => T[((Math.imul(ix|0, 1664525) ^ Math.imul(iy|0, 1013904223)) >>> 0) & 511];
  return (x, y) => {
    const ix=Math.floor(x)|0, iy=Math.floor(y)|0;
    const fx=x-ix, fy=y-iy, u=fade(fx), v=fade(fy);
    return lerp(lerp(h(ix,iy),h(ix+1,iy),u), lerp(h(ix,iy+1),h(ix+1,iy+1),u), v);
  };
}

const fbm = (noise, x, y, oct=6, lac=2.02, gain=0.50) => {
  let v=0, amp=0.5, f=1, sum=0;
  for (let i=0; i<oct; i++) { v+=noise(x*f,y*f)*amp; sum+=amp; amp*=gain; f*=lac; }
  return v/sum;
};

const PARALLAX_RANGE = 55;
const BLEED = 140;

// ── Build static galaxy offscreen canvas ─────────────────────────────────────
function buildGalaxyBase(W, H) {
  const BW = W + BLEED*2, BH = H + BLEED*2;
  const SCALE = 3;
  const RW = Math.ceil(BW/SCALE)|0, RH = Math.ceil(BH/SCALE)|0;

  const n1=buildValueNoise(101), n2=buildValueNoise(202);
  const n3=buildValueNoise(303), n4=buildValueNoise(404);
  const n5=buildValueNoise(505), n6=buildValueNoise(606);

  const warpFBM = (x, y, oct=5) => {
    const wx  = fbm(n2,x+1.70,y+9.20,4)-0.5, wy  = fbm(n3,x+8.30,y+2.80,4)-0.5;
    const wx2 = fbm(n4,x+4.0*wx+1.70,y+4.0*wy+9.20,3)-0.5;
    const wy2 = fbm(n5,x+4.0*wx+8.30,y+4.0*wy+2.80,3)-0.5;
    return fbm(n1,x+3.8*wx2,y+3.8*wy2,oct);
  };

  const ANGLE=-0.720, ca=Math.cos(ANGLE), sa=Math.sin(ANGLE);
  const CX=RW*0.5, CY=RH*0.5;
  const DIAG=Math.sqrt(RW*RW+RH*RH);
  const NX=CX-RW*0.040, NY=CY+RH*0.032;
  const S_OUTER=DIAG*0.192, S_MID=DIAG*0.078, S_INNER=DIAG*0.032, S_STREAK=DIAG*0.010;

  const nc=document.createElement("canvas"); nc.width=RW; nc.height=RH;
  const nctx=nc.getContext("2d");
  const img=nctx.createImageData(RW,RH), dat=img.data;

  for (let py=0; py<RH; py++) {
    for (let px=0; px<RW; px++) {
      const dx=px-CX, dy=py-CY;
      const along=dx*ca+dy*sa, perp=-dx*sa+dy*ca;
      const nx2=along/(DIAG*0.35)+4.50, ny2=perp/(DIAG*0.17)+4.50;
      const cloud=warpFBM(nx2*0.88,ny2*1.25,5);
      const detail=fbm(n4,nx2*2.40+3.8,ny2*3.20+1.4,4);
      const macro=fbm(n6,nx2*0.28,ny2*0.38,3);
      const twist=fbm(n2,nx2*1.50+7.0,ny2*2.00+2.5,4);
      const warpAmt=(cloud-0.5)*DIAG*0.24+(twist-0.5)*DIAG*0.06;
      const wPerp=perp+warpAmt;
      const G=(p,s)=>Math.exp(-(p*p)/(2*s*s));
      const gOuter=G(wPerp,S_OUTER), gMid=G(wPerp,S_MID);
      const gInner=G(wPerp,S_INNER), gStreak=G(wPerp,S_STREAK);
      let density=Math.max(
        gOuter*(0.22+macro*0.78),
        gMid  *(0.38+cloud*0.62)*1.05,
        gInner*(0.52+detail*0.48)*1.22,
        gStreak*(0.60+detail*0.40)*1.50
      );
      const ndx=px-NX, ndy=py-NY;
      const nBoost=Math.exp(-((ndx/(RW*0.22))**2+(ndy/(RH*0.16))**2)*2.8);
      density=Math.min(1.0,density+nBoost*0.30);
      const dustA=fbm(n3,nx2*3.2+6.5,ny2*10.5+2.8,4);
      const dustB=fbm(n5,nx2*4.0+1.2,ny2*13.0+9.0,4);
      const dustC=fbm(n6,nx2*2.6+3.1,ny2*8.5+5.5,3);
      const dustMask=Math.min(0.94,(G(perp-DIAG*0.018,DIAG*0.0115)*dustA*0.88+G(perp+DIAG*0.011,DIAG*0.0080)*dustB*0.72+G(perp-DIAG*0.005,DIAG*0.0062)*dustC*0.58)*density*1.55);
      const nebA=fbm(n2,nx2*1.6+5.8,ny2*2.4+4.2,5), nebB=fbm(n4,nx2*2.0+3.1,ny2*3.0+8.6,4);
      const nebMask=gMid*Math.max(0,(nebA+nebB)*0.5-0.48)*4.8;
      const blueNeb=fbm(n5,nx2*1.2+9.0,ny2*1.8+1.5,4);
      const blueMask=gOuter*(1-gMid)*Math.max(0,blueNeb-0.46)*3.2;

      let R=0,Gv=0,B=0,A=0;
      if (density>0.015) {
        const d=density;
        if(d<0.05){const t=d/0.05;R=t*16;Gv=t*4;B=0;A=t*0.28;}
        else if(d<0.12){const t=(d-0.05)/0.07;R=16+t*38;Gv=4+t*9;B=0;A=0.28+t*0.24;}
        else if(d<0.22){const t=(d-0.12)/0.10;R=54+t*64;Gv=13+t*21;B=0;A=0.52+t*0.18;}
        else if(d<0.36){const t=(d-0.22)/0.14;R=118+t*74;Gv=34+t*50;B=0;A=0.70+t*0.13;}
        else if(d<0.52){const t=(d-0.36)/0.16;R=192+t*46;Gv=84+t*68;B=t*12;A=0.83+t*0.10;}
        else if(d<0.68){const t=(d-0.52)/0.16;R=238+t*17;Gv=152+t*72;B=12+t*34;A=0.93+t*0.05;}
        else if(d<0.82){const t=(d-0.68)/0.14;R=255;Gv=224+t*22;B=46+t*56;A=0.98+t*0.02;}
        else{const t=Math.min(1,(d-0.82)/0.18);R=255;Gv=246+t*9;B=102+t*98;A=1.00;}
        const nf=Math.min(1.0,nBoost*0.62);
        R=Math.min(255,R+nf*(255-R)); Gv=Math.min(255,Gv+nf*(255-Gv)*0.88); B=Math.min(255,B+nf*(255-B)*0.50);
        const ds=1.0-dustMask*0.88;
        R=Math.round(R*(ds+dustMask*0.04)); Gv=Math.round(Gv*(ds+dustMask*0.02)); B=Math.round(B*ds*0.92);
        if(nebMask>0.008){const nm=Math.min(0.55,nebMask);R=Math.min(255,Math.round(R+nm*78));Gv=Math.round(Gv*(1-nm*0.22));B=Math.min(255,Math.round(B+nm*34));}
      }
      if(density<0.12){const sf=(1-density/0.12),sn=fbm(n6,nx2*0.42+13.0,ny2*0.42+8.5,3),ba=sf*sn*0.42;if(ba>0.004){R=Math.round(R*(1-ba)+5*ba);Gv=Math.round(Gv*(1-ba)+9*ba);B=Math.round(B*(1-ba)+44*ba);A=Math.max(A,ba*0.50);}}
      if(blueMask>0.01){const bm=Math.min(0.35,blueMask);R=Math.round(R*(1-bm)+R*0.55*bm);Gv=Math.round(Gv*(1-bm)+Gv*0.72*bm);B=Math.min(255,Math.round(B*(1-bm)+180*bm));A=Math.max(A,bm*0.35);}
      const idx=(py*RW+px)*4;
      dat[idx]=Math.min(255,Math.max(0,R|0)); dat[idx+1]=Math.min(255,Math.max(0,Gv|0));
      dat[idx+2]=Math.min(255,Math.max(0,B|0)); dat[idx+3]=Math.min(255,Math.round(Math.min(1.0,A)*255));
    }
  }
  nctx.putImageData(img,0,0);

  const oc=document.createElement("canvas"); oc.width=BW; oc.height=BH;
  const ctx=oc.getContext("2d");
  ctx.fillStyle="#000408"; ctx.fillRect(0,0,BW,BH);
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
  ctx.drawImage(nc,0,0,BW,BH);

  const NXF=NX*SCALE+BLEED, NYF=NY*SCALE+BLEED;
  const nucLayers=[
    [BW*0.260,[[0,"rgba(255,228,140,0.82)"],[0.05,"rgba(255,202,75,0.72)"],[0.14,"rgba(238,148,16,0.48)"],[0.30,"rgba(175,80,4,0.22)"],[0.52,"rgba(82,28,0,0.07)"],[1,"rgba(0,0,0,0)"]]],
    [BW*0.080,[[0,"rgba(255,252,210,1.00)"],[0.05,"rgba(255,232,142,0.95)"],[0.16,"rgba(255,188,48,0.75)"],[0.34,"rgba(238,130,9,0.44)"],[0.62,"rgba(142,58,2,0.13)"],[1,"rgba(0,0,0,0)"]]],
    [BW*0.028,[[0,"rgba(255,255,255,1.00)"],[0.08,"rgba(255,252,228,0.98)"],[0.24,"rgba(255,228,128,0.86)"],[0.50,"rgba(255,178,38,0.46)"],[0.80,"rgba(200,100,8,0.12)"],[1,"rgba(0,0,0,0)"]]],
    [BW*0.006,[[0,"rgba(255,255,255,1.00)"],[0.30,"rgba(255,248,215,0.88)"],[0.70,"rgba(255,218,102,0.28)"],[1,"rgba(0,0,0,0)"]]],
  ];
  for(const[r,stops]of nucLayers){const g=ctx.createRadialGradient(NXF,NYF,0,NXF,NYF,r);for(const[t,c]of stops)g.addColorStop(t,c);ctx.fillStyle=g;ctx.fillRect(0,0,BW,BH);}
  const KX=NXF+BW*0.165, KY=NYF+BH*0.068;
  const kg=ctx.createRadialGradient(KX,KY,0,KX,KY,BW*0.040);
  kg.addColorStop(0,"rgba(255,235,145,0.72)"); kg.addColorStop(0.12,"rgba(255,205,65,0.55)");
  kg.addColorStop(0.30,"rgba(225,135,10,0.28)"); kg.addColorStop(0.60,"rgba(140,60,2,0.08)"); kg.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=kg; ctx.fillRect(0,0,BW,BH);
  return oc;
}

// ── Build live star data ─────────────────────────────────────────────────────
function buildStars(W, H) {
  const rng=mulberry32(77);
  const ANGLE=-0.720, sa=Math.sin(ANGLE), ca2=Math.cos(ANGLE);
  const CX=W*0.5, CY=H*0.5, DIAG=Math.sqrt(W*W+H*H);
  const stars=[];
  for(let i=0;i<480;i++){
    const x=rng()*W, y=rng()*H;
    const dx=x-CX, dy=y-CY;
    const perp=Math.abs(-dx*sa+dy*ca2);
    const inCore=perp<DIAG*0.055, inBand=perp<DIAG*0.210;
    const t=rng(); let R,G,B,baseA,sz;
    if(inCore){R=255;G=195+rng()*60|0;B=75+rng()*85|0;baseA=0.65+rng()*0.35;sz=0.9+rng()*2.5;}
    else if(inBand){if(t<0.50){R=255;G=198+rng()*57|0;B=98+rng()*82|0;}else{R=222+rng()*33|0;G=232+rng()*23|0;B=255;}baseA=0.48+rng()*0.52;sz=0.7+rng()*2.0;}
    else{if(t<0.62){R=142+rng()*96|0;G=165+rng()*72|0;B=255;}else{R=225+rng()*30|0;G=235+rng()*20|0;B=255;}baseA=0.22+rng()*0.58;sz=0.5+rng()*1.7;}
    stars.push({x,y,R,G,B,baseA,sz,bloom:sz>2.1||rng()<0.06,spike:sz>2.8||rng()<0.025,layer:rng()<0.33?0:rng()<0.50?1:2,twinkleSpeed:0.35+rng()*1.85,twinklePhase:rng()*Math.PI*2});
  }
  return stars;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GalaxyBackground({ opacity = 1 }: { opacity?: number }) {
  const canvasRef=useRef(null);
  const stateRef=useRef({mx:0,my:0,sx:0,sy:0,shoots:[],shootTimer:0});
  const assetsRef=useRef(null);

  useEffect(()=>{
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    let W=window.innerWidth, H=window.innerHeight;
    canvas.width=W; canvas.height=H;

    const build=()=>{ assetsRef.current={base:buildGalaxyBase(W,H),stars:buildStars(W,H)}; };
    setTimeout(build,0);

    const spawnShoot=()=>{
      stateRef.current.shoots.push({x:W*(0.14+Math.random()*0.64),y:H*(0.03+Math.random()*0.36),vx:3.2+Math.random()*3.0,vy:0.4+Math.random()*0.9,len:68+Math.random()*118,life:0,maxLife:50+Math.random()*50});
    };

    const onMouse=(e)=>{stateRef.current.mx=e.clientX/W-0.5;stateRef.current.my=e.clientY/H-0.5;};
    window.addEventListener("mousemove",onMouse);

    let raf;
    const loop=(ts)=>{
      raf=requestAnimationFrame(loop);
      const s=stateRef.current, A=assetsRef.current, t=ts*0.001;
      s.sx+=(s.mx-s.sx)*0.028; s.sy+=(s.my-s.sy)*0.028;
      const px=s.sx*PARALLAX_RANGE*0.55, py=s.sy*PARALLAX_RANGE*0.55;
      if(!A){ctx.fillStyle="#000408";ctx.fillRect(0,0,W,H);return;}

      ctx.drawImage(A.base,-BLEED+px,-BLEED+py);

      const LX=[px*0.18,px*0.52,px], LY=[py*0.18,py*0.52,py];
      for(const st of A.stars){
        const sx=st.x+LX[st.layer], sy=st.y+LY[st.layer];
        const tw=0.58+0.42*Math.sin(t*st.twinkleSpeed+st.twinklePhase);
        const a=st.baseA*tw;
        if(st.bloom){const gr=ctx.createRadialGradient(sx,sy,0,sx,sy,st.sz*4.2);gr.addColorStop(0,`rgba(${st.R},${st.G},${st.B},${(a*0.50).toFixed(3)})`);gr.addColorStop(0.38,`rgba(${st.R},${st.G},${st.B},${(a*0.12).toFixed(3)})`);gr.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=gr;ctx.beginPath();ctx.arc(sx,sy,st.sz*4.2,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle=`rgba(${st.R},${st.G},${st.B},${a.toFixed(3)})`;ctx.beginPath();ctx.arc(sx,sy,Math.max(0.45,st.sz*0.50),0,Math.PI*2);ctx.fill();
        if(st.spike&&tw>0.76){const sl=st.sz*3.8*tw;ctx.strokeStyle=`rgba(${st.R},${st.G},${st.B},${(a*0.30).toFixed(3)})`;ctx.lineWidth=0.7;ctx.beginPath();ctx.moveTo(sx-sl,sy);ctx.lineTo(sx+sl,sy);ctx.stroke();ctx.beginPath();ctx.moveTo(sx,sy-sl);ctx.lineTo(sx,sy+sl);ctx.stroke();}
      }

      s.shootTimer++;
      if(s.shootTimer>280+(Math.random()*100|0)){spawnShoot();s.shootTimer=0;}
      s.shoots=s.shoots.filter((sh)=>{
        sh.life++;sh.x-=sh.vx;sh.y+=sh.vy;
        const p=sh.life/sh.maxLife,op=p<0.18?p/0.18:p>0.62?1-(p-0.62)/0.38:0.92;
        const gr=ctx.createLinearGradient(sh.x,sh.y,sh.x+sh.len,sh.y-sh.len*0.13);
        gr.addColorStop(0,`rgba(255,252,228,${(op*0.94).toFixed(2)})`);gr.addColorStop(0.52,`rgba(255,240,190,${(op*0.32).toFixed(2)})`);gr.addColorStop(1,"rgba(0,0,0,0)");
        ctx.strokeStyle=gr;ctx.lineWidth=1.35;ctx.beginPath();ctx.moveTo(sh.x,sh.y);ctx.lineTo(sh.x+sh.len,sh.y-sh.len*0.13);ctx.stroke();
        return sh.life<sh.maxLife;
      });

      const vig=ctx.createRadialGradient(W*.5,H*.5,Math.min(W,H)*0.15,W*.5,H*.5,Math.max(W,H)*0.86);
      vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(0,0,0,0.82)");
      ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
    };
    raf=requestAnimationFrame(loop);

    const onResize=()=>{
      W=window.innerWidth;H=window.innerHeight;canvas.width=W;canvas.height=H;
      assetsRef.current=null;
      setTimeout(()=>{assetsRef.current={base:buildGalaxyBase(W,H),stars:buildStars(W,H)};},0);
    };
    window.addEventListener("resize",onResize);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("mousemove",onMouse);window.removeEventListener("resize",onResize);};
  },[]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        display: "block",
        opacity,
        transition: "opacity 260ms cubic-bezier(0.16,1,0.3,1)",
      }}
    />
  );
}
