(() => {
"use strict";
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const status=t=>$("#status").textContent=t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot((b.x-a.x),(b.y-a.y));
const EPS=1e-6;
const announceChange=detail=>window.dispatchEvent(new CustomEvent("texturestudio:changed",{detail}));

function downloadBlob(name,blob){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=name;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
function hexToRgb(hex){
  const n=parseInt(hex.slice(1),16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function rgbToHex(r,g,b){
  return "#"+[r,g,b].map(x=>clamp(Math.round(x),0,255).toString(16).padStart(2,"0")).join("");
}
function norm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function add(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]]}
function muls(a,s){return[a[0]*s,a[1]*s,a[2]*s]}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function vecKey(v,eps=1e-6){
  return `${Math.round(v[0]/eps)}|${Math.round(v[1]/eps)}|${Math.round(v[2]/eps)}`
}

/* ---------- Tool state ---------- */
let tool="brush";
function setTool(t){
  tool=t;
  $$(".tool").forEach(b=>b.classList.toggle("active",b.dataset.tool===t));
  status(`Werkzeug: ${t}. 3D- und UV-Malen aktiv.`);
  window.dispatchEvent(new CustomEvent("texturestudio:tool",{detail:{tool:t}}));
}
$$(".tool").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));

const swatchColors=["#000000","#ffffff","#ef4444","#f97316","#facc15","#22c55e","#14b8a6","#06b6d4",
"#3b82f6","#6366f1","#8b5cf6","#d946ef","#ec4899","#7c2d12","#78716c","#94a3b8"];
const sw=$("#swatches");
for(const c of swatchColors){
  const b=document.createElement("button");
  b.className="swatch";b.style.background=c;b.title=c;
  b.onclick=()=>{$("#brushColor").value=c};
  sw.appendChild(b);
}
const bindRange=(id,out,suffix="")=>{
  const el=$(id),o=$(out);
  const f=()=>{o.textContent=el.value+suffix; if(tool==="text") renderUVOverlay();};
  el.oninput=f;f();
};
bindRange("#brushSize","#brushSizeVal");
bindRange("#brushOpacity","#brushOpacityVal","%");
bindRange("#brushHardness","#brushHardnessVal","%");
bindRange("#fillTolerance","#fillToleranceVal");
bindRange("#textSize","#textSizeVal");
bindRange("#textAngle","#textAngleVal","°");

["#textInput","#fontFamily","#textBold","#textItalic","#textOutline","#textFlipX","#textFlipY"].forEach(sel=>{
  $(sel).onchange=()=>renderUVOverlay();
  $(sel).oninput=()=>renderUVOverlay();
});

/* ---------- Texture canvas ---------- */
const tex=$("#texcanvas"), tctx=tex.getContext("2d",{willReadFrequently:true});
const uvO=$("#uvOverlay"), uctx=uvO.getContext("2d");
const historyUndo=[],historyRedo=[]; const HISTORY_MAX=12;

function resizeOverlay(){uvO.width=tex.width;uvO.height=tex.height;renderUVOverlay();}
function currentImage(){return tctx.getImageData(0,0,tex.width,tex.height)}
function pushHistory(){
  try{
    historyUndo.push(currentImage());
    if(historyUndo.length>HISTORY_MAX)historyUndo.shift();
    historyRedo.length=0;
    updateHistoryButtons();
  }catch(e){console.warn(e)}
}
function updateHistoryButtons(){
  $("#undoBtn").disabled=!historyUndo.length;
  $("#redoBtn").disabled=!historyRedo.length;
}
function undo(){
  if(!historyUndo.length)return;
  historyRedo.push(currentImage());
  tctx.putImageData(historyUndo.pop(),0,0);
  uploadTexture();
  updateHistoryButtons();
  status("Undo.");
}
function redo(){
  if(!historyRedo.length)return;
  historyUndo.push(currentImage());
  tctx.putImageData(historyRedo.pop(),0,0);
  uploadTexture();
  updateHistoryButtons();
  status("Redo.");
}
$("#undoBtn").onclick=undo;
$("#redoBtn").onclick=redo;

function fillBase(){
  tctx.save();
  tctx.setTransform(1,0,0,1,0,0);
  tctx.globalCompositeOperation="source-over";
  tctx.globalAlpha=1;
  tctx.fillStyle="#d8dadd";
  tctx.fillRect(0,0,tex.width,tex.height);
  tctx.strokeStyle="rgba(0,0,0,.06)";
  tctx.lineWidth=1;
  const step=Math.max(32,tex.width/16);
  for(let x=0;x<=tex.width;x+=step){tctx.beginPath();tctx.moveTo(x,0);tctx.lineTo(x,tex.height);tctx.stroke()}
  for(let y=0;y<=tex.height;y+=step){tctx.beginPath();tctx.moveTo(0,y);tctx.lineTo(tex.width,y);tctx.stroke()}
  tctx.restore();
  uploadTexture();
}
$("#newTex").onclick=()=>{
  const n=+$("#texSize").value;
  tex.width=n;tex.height=n;
  historyUndo.length=0;historyRedo.length=0;
  resizeOverlay();fillBase();updateHistoryButtons();
  status(`Neue ${n}×${n} Textur.`);
};
$("#clearBtn").onclick=()=>{
  pushHistory();
  tctx.clearRect(0,0,tex.width,tex.height);
  uploadTexture();
  status("Textur geleert.");
};
$("#imgFile").onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  const img=new Image();
  img.onload=()=>{
    pushHistory();
    tctx.clearRect(0,0,tex.width,tex.height);
    const s=Math.min(tex.width/img.width,tex.height/img.height),w=img.width*s,h=img.height*s;
    tctx.drawImage(img,(tex.width-w)/2,(tex.height-h)/2,w,h);
    uploadTexture();
    URL.revokeObjectURL(img.src);
    status(`Textur geladen: ${f.name}`);
  };
  img.src=URL.createObjectURL(f);
};

function canvasPoint(e){
  const r=tex.getBoundingClientRect();
  return{x:(e.clientX-r.left)*tex.width/r.width,y:(e.clientY-r.top)*tex.height/r.height};
}
function rgbaCss(rgb,a=1){return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`}

function stamp(p,kind=tool){
  const size=+$("#brushSize").value,op=+$("#brushOpacity").value/100,hard=+$("#brushHardness").value/100;
  const rgb=hexToRgb($("#brushColor").value),r=size/2;
  tctx.save();
  if(kind==="eraser")tctx.globalCompositeOperation="destination-out";
  else tctx.globalCompositeOperation="source-over";
  tctx.globalAlpha=op;

  if(kind==="spray"){
    const count=Math.max(8,Math.round(size*.75));
    tctx.fillStyle=kind==="eraser"?"rgba(0,0,0,1)":rgbaCss(rgb,1);
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,d=Math.sqrt(Math.random())*r;
      const rr=Math.max(0.8,size*.025*Math.random()+.7);
      tctx.beginPath();tctx.arc(p.x+Math.cos(a)*d,p.y+Math.sin(a)*d,rr,0,Math.PI*2);tctx.fill();
    }
  }else if(kind==="pencil"){
    tctx.fillStyle=rgbaCss(rgb,1);
    const s=Math.max(1,Math.round(size));
    tctx.fillRect(Math.round(p.x-s/2),Math.round(p.y-s/2),s,s);
  }else{
    let style;
    if(hard>=.995){
      style=kind==="eraser"?"rgba(0,0,0,1)":rgbaCss(rgb,1);
    }else{
      const g=tctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
      const inner=clamp(hard,0,.98);
      if(kind==="eraser"){
        g.addColorStop(0,"rgba(0,0,0,1)");
        g.addColorStop(inner,"rgba(0,0,0,1)");
        g.addColorStop(1,"rgba(0,0,0,0)");
      }else{
        g.addColorStop(0,rgbaCss(rgb,1));
        g.addColorStop(inner,rgbaCss(rgb,1));
        g.addColorStop(1,rgbaCss(rgb,0));
      }
      style=g;
    }
    tctx.fillStyle=style;
    tctx.beginPath();
    tctx.arc(p.x,p.y,r,0,Math.PI*2);
    tctx.fill();
  }
  tctx.restore();
}
function strokeBetween(a,b,kind=tool){
  const d=Math.hypot(b.x-a.x,b.y-a.y),step=Math.max(1,+$("#brushSize").value*.12);
  const n=Math.max(1,Math.ceil(d/step));
  for(let i=1;i<=n;i++)stamp({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},kind);
}
function blendPixel(data,i,rgb,alpha){
  const sa=alpha,da=data[i+3]/255,outA=sa+da*(1-sa);
  if(outA<=0){data[i]=data[i+1]=data[i+2]=data[i+3]=0;return}
  data[i]=Math.round((rgb[0]*sa+data[i]*da*(1-sa))/outA);
  data[i+1]=Math.round((rgb[1]*sa+data[i+1]*da*(1-sa))/outA);
  data[i+2]=Math.round((rgb[2]*sa+data[i+2]*da*(1-sa))/outA);
  data[i+3]=Math.round(outA*255);
}
function floodFill(p){
  const w=tex.width,h=tex.height,x0=clamp(Math.floor(p.x),0,w-1),y0=clamp(Math.floor(p.y),0,h-1);
  const img=tctx.getImageData(0,0,w,h),d=img.data,pi0=(y0*w+x0)*4;
  const target=[d[pi0],d[pi0+1],d[pi0+2],d[pi0+3]];
  const tol=+$("#fillTolerance").value*2.55,rgb=hexToRgb($("#brushColor").value),alpha=+$("#brushOpacity").value/100;
  const visited=new Uint8Array(w*h),stack=new Uint32Array(w*h);let top=0;stack[top++]=y0*w+x0;visited[y0*w+x0]=1;
  const matches=idx=>{
    const i=idx*4;
    return Math.max(Math.abs(d[i]-target[0]),Math.abs(d[i+1]-target[1]),Math.abs(d[i+2]-target[2]),Math.abs(d[i+3]-target[3]))<=tol;
  };
  while(top){
    const idx=stack[--top];if(!matches(idx))continue;
    const i=idx*4;blendPixel(d,i,rgb,alpha);
    const x=idx%w,y=(idx/w)|0;
    let n;
    if(x>0){n=idx-1;if(!visited[n]){visited[n]=1;stack[top++]=n}}
    if(x<w-1){n=idx+1;if(!visited[n]){visited[n]=1;stack[top++]=n}}
    if(y>0){n=idx-w;if(!visited[n]){visited[n]=1;stack[top++]=n}}
    if(y<h-1){n=idx+w;if(!visited[n]){visited[n]=1;stack[top++]=n}}
  }
  tctx.putImageData(img,0,0);
  uploadTexture();
}
function pickColor(p){
  const d=tctx.getImageData(clamp(Math.floor(p.x),0,tex.width-1),clamp(Math.floor(p.y),0,tex.height-1),1,1).data;
  $("#brushColor").value=rgbToHex(d[0],d[1],d[2]);
  $("#brushOpacity").value=Math.max(1,Math.round(d[3]/255*100));
  $("#brushOpacity").dispatchEvent(new Event("input"));
  status(`Farbe aufgenommen: ${$("#brushColor").value}`);
}
function drawShape(kind,a,b,preview=false){
  const ctx=preview?uctx:tctx,size=+$("#brushSize").value,op=+$("#brushOpacity").value/100,rgb=hexToRgb($("#brushColor").value);
  ctx.save();
  ctx.globalAlpha=preview?.75:op;
  ctx.lineWidth=size;
  ctx.lineCap="round";
  ctx.lineJoin="round";
  ctx.strokeStyle=rgbaCss(rgb,1);
  ctx.fillStyle=rgbaCss(rgb,1);
  if(kind==="gradient"){
    if(preview){
      ctx.lineWidth=Math.max(2,size*.2);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }else{
      const g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
      g.addColorStop(0,rgbaCss(rgb,1));
      g.addColorStop(1,rgbaCss(rgb,0));
      ctx.fillStyle=g;
      ctx.fillRect(0,0,tex.width,tex.height);
    }
  }else if(kind==="line"){
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }else if(kind==="rect"){
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
    if($("#shapeFill").checked)ctx.fillRect(x,y,w,h);else ctx.strokeRect(x,y,w,h);
  }else if(kind==="ellipse"){
    const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,rx=Math.abs(b.x-a.x)/2,ry=Math.abs(b.y-a.y)/2;
    ctx.beginPath();ctx.ellipse(cx,cy,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);
    if($("#shapeFill").checked)ctx.fill();else ctx.stroke();
  }
  ctx.restore();
  if(!preview)uploadTexture();
}
function drawTextAt(p, preview=false){
  const ctx=preview?uctx:tctx;
  const lines=($("#textInput").value||"Text").split(/\r?\n/);
  const fontFamily=$("#fontFamily").value || "Arial";
  const size=+$("#textSize").value;
  const angle=(+$("#textAngle").value||0)*Math.PI/180;
  const bold=$("#textBold").checked ? "bold " : "";
  const italic=$("#textItalic").checked ? "italic " : "";
  const outline=$("#textOutline").checked;
  const flipX=$("#textFlipX").checked ? -1 : 1;
  const flipY=$("#textFlipY").checked ? -1 : 1;
  const rgb=hexToRgb($("#brushColor").value);
  const op=+$("#brushOpacity").value/100;
  const lineHeight=size*1.15;

  ctx.save();
  ctx.translate(p.x,p.y);
  ctx.rotate(angle);
  ctx.scale(flipX, flipY);
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.font=`${italic}${bold}${size}px ${fontFamily}`;
  ctx.fillStyle=rgbaCss(rgb,1);
  ctx.strokeStyle="rgba(0,0,0,.85)";
  ctx.lineWidth=Math.max(2,size*0.1);
  ctx.globalAlpha=preview?0.75:op;

  const totalHeight=(lines.length-1)*lineHeight;
  lines.forEach((line,idx)=>{
    const y=idx*lineHeight-totalHeight/2;
    if(outline)ctx.strokeText(line,0,y);
    ctx.fillText(line,0,y);
  });

  ctx.restore();
  if(!preview)uploadTexture();
}
const isStrokeTool=t=>["brush","pencil","eraser","spray"].includes(t);
const isShapeTool=t=>["line","rect","ellipse","gradient"].includes(t);

/* ---------- Mesh / OBJ ---------- */
let mesh=null;
let currentObjText="";
let currentObjName="";
function triCenter(verts){
  return muls(add(add(verts[0], verts[1]), verts[2]), 1/3);
}
function canonicalNormal(normal){
  const n=[...normal];
  const a=n.map(Math.abs),major=a[0]>=a[1]&&a[0]>=a[2]?0:(a[1]>=a[2]?1:2);
  if(n[major]<0)return[-n[0],-n[1],-n[2]];
  return n;
}
function planarProjectionBasis(normal){
  const n=canonicalNormal(norm(normal));
  const helper=Math.abs(n[1])<.9?[0,1,0]:[1,0,0];
  const tangent=norm(cross(helper,n));
  const bitangent=norm(cross(n,tangent));
  return p=>[dot(p,tangent),dot(p,bitangent)];
}
function edgeKey(a,b,eps){
  const ka=vecKey(a,eps), kb=vecKey(b,eps);
  return ka<kb ? ka+"__"+kb : kb+"__"+ka;
}
function parseOBJ(text){
  const V=[],VN=[],tris=[],triMaterials=[];
  let currentMaterial="";
  for(const raw of text.split(/\r?\n/)){
    const line=raw.trim();if(!line||line.startsWith("#"))continue;
    const p=line.split(/\s+/);
    if(p[0]==="v"&&p.length>=4)V.push([+p[1],+p[2],+p[3]]);
    else if(p[0]==="vn"&&p.length>=4)VN.push(norm([+p[1],+p[2],+p[3]]));
    else if(p[0]==="usemtl")currentMaterial=p.slice(1).join(" ");
    else if(p[0]==="f"&&p.length>=4){
      const refs=p.slice(1).map(tok=>{
        const q=tok.split("/"),idx=(s,n)=>{if(!s)return null;const i=parseInt(s,10);return i<0?n+i:i-1};
        return{v:idx(q[0],V.length),vn:idx(q[2],VN.length)}
      });
      for(let i=1;i<refs.length-1;i++){
        tris.push([refs[0],refs[i],refs[i+1]]);
        triMaterials.push(currentMaterial);
      }
    }
  }
  if(!V.length||!tris.length)throw new Error("Keine brauchbaren Vertices/Faces gefunden.");
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  V.forEach(v=>{for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k])}});
  const center=min.map((v,k)=>(v+max[k])/2),extent=Math.max(...max.map((v,k)=>v-min[k]))||1,scale=2/extent;

  const pos=[],rawPos=[],uv=[],nor=[],triNormals=[],triCenters=[],triRawVerts=[];
  for(const tri of tris){
    const p0=V[tri[0].v],p1=V[tri[1].v],p2=V[tri[2].v],faceN=norm(cross(sub(p1,p0),sub(p2,p0)));
    triNormals.push(faceN);
    triCenters.push(triCenter([p0,p1,p2]));
    triRawVerts.push([p0,p1,p2]);
    for(const r of tri){
      const v=V[r.v];
      rawPos.push(...v);
      pos.push((v[0]-center[0])*scale,(v[1]-center[1])*scale,(v[2]-center[2])*scale);
      uv.push(0,0);
      if(r.vn!=null&&VN[r.vn])nor.push(...VN[r.vn]);else{nor.push(...faceN)}
    }
  }

  return{
    pos:new Float32Array(pos),
    rawPos:new Float32Array(rawPos),
    uv:new Float32Array(uv),
    nor:new Float32Array(nor),
    count:pos.length/3,
    triangles:tris.length,
    sourceVertices:V.length,
    triNormals,
    triCenters,
    triRawVerts,
    triMaterials,
    modelExtent:extent,
    triSurface:new Int32Array(tris.length).fill(-1),
    surfaces:[]
  };
}
function updateUVModeBadge(){
  $("#uvModeBadge").textContent = mesh ? `Flächen-Atlas (${mesh.surfaces.length} Inseln)` : "—";
  $("#meshInfo").textContent = mesh ? `${mesh.triangles.toLocaleString()} Triangles · ${mesh.sourceVertices.toLocaleString()} Vertices · ${mesh.surfaces.length.toLocaleString()} Flächen` : "—";
}
function buildTriangleAdjacency(){
  const edgeMap = new Map();
  const triCount = mesh.triangles;
  const adjacency = Array.from({length: triCount}, ()=>[]);
  const weldEps=Math.max(mesh.modelExtent*1e-6,1e-8);
  for(let t=0;t<triCount;t++){
    const verts = mesh.triRawVerts[t];
    const edges = [[verts[0],verts[1]],[verts[1],verts[2]],[verts[2],verts[0]]];
    for(const [a,b] of edges){
      const key = edgeKey(a,b,weldEps);
      if(!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push(t);
    }
  }
  for(const arr of edgeMap.values()){
    if(arr.length<2) continue;
    for(let i=0;i<arr.length;i++){
      for(let j=i+1;j<arr.length;j++){
        adjacency[arr[i]].push(arr[j]);
        adjacency[arr[j]].push(arr[i]);
      }
    }
  }
  return adjacency;
}
function buildFaceIslands(){
  const triCount=mesh.triangles;
  const adjacency=buildTriangleAdjacency();
  const visited=new Uint8Array(triCount);
  const islands=[];
  const NORMAL_DOT_THRESHOLD = Math.cos(2*Math.PI/180); // max. 2° Abweichung
  const PLANE_DIST_THRESHOLD = Math.max(mesh.modelExtent*5e-5,1e-7);
  for(let start=0; start<triCount; start++){
    if(visited[start]) continue;
    visited[start]=1;
    const queue=[start];
    const island=[];
    const refN=canonicalNormal(mesh.triNormals[start]);
    const refPoint=mesh.triRawVerts[start][0];
    while(queue.length){
      const t=queue.pop();
      island.push(t);
      for(const n of adjacency[t]){
        if(visited[n]) continue;
        const N=canonicalNormal(mesh.triNormals[n]);
        const maxPlaneError=Math.max(...mesh.triRawVerts[n].map(p=>Math.abs(dot(refN,sub(p,refPoint)))));
        const sameMaterial=mesh.triMaterials[n]===mesh.triMaterials[start];
        if(sameMaterial&&dot(refN,N) >= NORMAL_DOT_THRESHOLD && maxPlaneError <= PLANE_DIST_THRESHOLD){
          visited[n]=1;
          queue.push(n);
        }
      }
    }
    islands.push(island);
  }
  islands.sort((a,b)=>b.length-a.length);
  mesh.triSurface.fill(-1);
  islands.forEach((tris,surface)=>tris.forEach(t=>mesh.triSurface[t]=surface));
  mesh.surfaces=islands;
  return islands;
}
function packProjectedIslands(islands){
  if(!mesh){status("Bitte zuerst ein OBJ laden.");return;}
  if(!islands.length)return;

  const islandData = islands.map((tris, islandIndex)=>{
    const refN=mesh.triNormals[tris[0]];
    const projector=planarProjectionBasis(refN);
    let pts2=[], refs=[];
    for(const t of tris){
      const verts = mesh.triRawVerts[t];
      for(let k=0;k<3;k++){
        const p2 = projector(verts[k]);
        pts2.push(p2);
        refs.push({tri:t, corner:k, p:p2});
      }
    }
    let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
    for(const p of pts2){
      minU=Math.min(minU,p[0]);maxU=Math.max(maxU,p[0]);
      minV=Math.min(minV,p[1]);maxV=Math.max(maxV,p[1]);
    }
    if(maxU-minU<EPS) maxU=minU+EPS;
    if(maxV-minV<EPS) maxV=minV+EPS;
    const w=maxU-minU,h=maxV-minV;
    const rotate=h>w;
    return {
      tris, refs, minU,maxU,minV,maxV,
      w,h,rotate,packW:rotate?h:w,packH:rotate?w:h,
      area:w*h,
      islandIndex
    };
  });

  islandData.sort((a,b)=>b.packH-a.packH||b.packW-a.packW||a.islandIndex-b.islandIndex);
  const count=islandData.length;
  const gutter=Math.min(8/Math.max(tex.width,tex.height),.18/Math.ceil(Math.sqrt(count)));
  const tryPack=scale=>{
    let x=0,y=0,rowH=0;
    const placements=[];
    for(const isl of islandData){
      const boxW=isl.packW*scale+gutter*2;
      const boxH=isl.packH*scale+gutter*2;
      if(boxW>1+EPS||boxH>1+EPS)return null;
      if(x+boxW>1+EPS&&x>0){x=0;y+=rowH;rowH=0}
      if(y+boxH>1+EPS)return null;
      placements.push({isl,x,y,scale});
      x+=boxW;
      rowH=Math.max(rowH,boxH);
    }
    return placements;
  };
  const maxDim=Math.max(...islandData.map(i=>Math.max(i.packW,i.packH)),EPS);
  let low=0,high=1/maxDim,placements=tryPack(0);
  for(let i=0;i<42;i++){
    const mid=(low+high)/2,candidate=tryPack(mid);
    if(candidate){low=mid;placements=candidate}else high=mid;
  }
  if(!placements||low<=EPS){
    status("Fehler: Flächen-Atlas konnte nicht gepackt werden.");
    return;
  }

  const newUV = new Float32Array(mesh.count*2);
  for(const pl of placements){
    const {isl,x,y,scale}=pl;
    for(const ref of isl.refs){
      const localU=ref.p[0]-isl.minU,localV=ref.p[1]-isl.minV;
      const packedU=isl.rotate?localV:localU;
      const packedV=isl.rotate?(isl.w-localU):localV;
      const uu=x+gutter+packedU*scale;
      const vv=y+gutter+packedV*scale;
      const idx = ref.tri*3 + ref.corner;
      newUV[idx*2] = clamp(uu,gutter,1-gutter);
      newUV[idx*2+1] = clamp(vv,gutter,1-gutter);
    }
  }

  mesh.uv = newUV;
  uploadMesh();
  renderUVOverlay();
  updateUVModeBadge();
}
function colorFromMaterialName(name){
  const match=String(name||"").match(/TMS_COLOR_([0-9a-f]{6})/i);
  return match?`#${match[1]}`:"#94a3b8";
}
function bakeMaterialColors(){
  if(!mesh)return;
  tctx.save();
  tctx.setTransform(1,0,0,1,0,0);
  tctx.globalCompositeOperation="source-over";
  tctx.globalAlpha=1;
  tctx.clearRect(0,0,tex.width,tex.height);
  tctx.lineJoin="round";
  tctx.lineWidth=Math.max(2,tex.width/512);
  for(let tri=0;tri<mesh.triangles;tri++){
    const color=colorFromMaterialName(mesh.triMaterials[tri]);
    tctx.fillStyle=color;
    tctx.strokeStyle=color;
    tctx.beginPath();
    for(let corner=0;corner<3;corner++){
      const idx=tri*3+corner;
      const x=mesh.uv[idx*2]*tex.width,y=mesh.uv[idx*2+1]*tex.height;
      corner?tctx.lineTo(x,y):tctx.moveTo(x,y);
    }
    tctx.closePath();
    tctx.fill();
    tctx.stroke();
  }
  tctx.restore();
  uploadTexture();
  renderUVOverlay();
  announceChange({type:"texture",source:"material-bake"});
}
function rebuildFaceIslandUVs(){
  if(!mesh){status("Bitte zuerst ein OBJ laden.");return;}
  const islands = buildFaceIslands();
  packProjectedIslands(islands);
  status(`Flächen-Atlas neu berechnet: ${islands.length} Inseln.`);
}
$("#repairFaceIslandsBtn").onclick=rebuildFaceIslandUVs;

async function loadOBJText(text,name="model.obj",{colorFromMaterials=false}={}){
  try{
    mesh=parseOBJ(text);
    currentObjText=text;
    currentObjName=name;
    const islands=buildFaceIslands();
    packProjectedIslands(islands);
    if(colorFromMaterials)bakeMaterialColors();
    resetCamera();
    renderUVOverlay();
    updateUVModeBadge();
    $("#modelEmpty")?.classList.add("hidden");
    status(`OBJ geladen: ${name} · ${islands.length.toLocaleString()} Flächen erkannt und abgewickelt.`);
    announceChange({type:"model",name});
    return mesh;
  }catch(err){
    console.error(err);
    status("OBJ-Fehler: "+err.message);
    throw err;
  }
}
$("#objFile").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{await loadOBJText(await f.text(),f.name)}catch{}
};

/* ---------- UV overlay ---------- */
let textPreviewUV=null;
let textPreview3D=null;
$("#showUV").onchange=()=>renderUVOverlay();
function renderUVOverlay(){
  uctx.clearRect(0,0,uvO.width,uvO.height);

  if($("#showUV").checked&&mesh){
    uctx.save();
    uctx.strokeStyle="rgba(90,180,255,.58)";
    uctx.lineWidth=Math.max(1,tex.width/1024);
    for(let i=0;i<mesh.count;i+=3){
      const pts=[];
      for(let j=0;j<3;j++)pts.push({x:mesh.uv[(i+j)*2]*tex.width,y:mesh.uv[(i+j)*2+1]*tex.height});
      uctx.beginPath();
      uctx.moveTo(pts[0].x,pts[0].y);
      uctx.lineTo(pts[1].x,pts[1].y);
      uctx.lineTo(pts[2].x,pts[2].y);
      uctx.closePath();
      uctx.stroke();
    }
    uctx.restore();
  }

  if(uvPainting&&isShapeTool(tool)&&uvStart&&uvEnd)drawShape(tool,uvStart,uvEnd,true);
  if(painting3D&&isShapeTool(tool)&&p3Start&&p3End)drawShape(tool,p3Start,p3End,true);
  if(tool==="text"&&textPreviewUV&&!uvPainting)drawTextAt(textPreviewUV,true);
  if(tool==="text"&&textPreview3D&&!painting3D)drawTextAt(textPreview3D,true);
}

/* ---------- UV 2D input ---------- */
let uvPainting=false,uvStart=null,uvLast=null,uvEnd=null;
tex.addEventListener("pointerdown",e=>{
  if(e.button!==0)return;
  const p=canvasPoint(e);
  tex.setPointerCapture(e.pointerId);

  if(tool==="picker"){pickColor(p);return}
  pushHistory();

  if(tool==="fill"){floodFill(p);return}
  if(tool==="text"){drawTextAt(p,false);status("Text platziert.");return}

  uvPainting=true;uvStart=uvLast=uvEnd=p;
  if(isStrokeTool(tool)){stamp(p);uploadTexture()}
  renderUVOverlay();
});
tex.addEventListener("pointermove",e=>{
  const p=canvasPoint(e);
  if(uvPainting){
    uvEnd=p;
    if(isStrokeTool(tool)){strokeBetween(uvLast,p);uvLast=p;uploadTexture()}
    renderUVOverlay();
  }else if(tool==="text"){
    textPreviewUV=p;
    renderUVOverlay();
  }
});
function finishUV(){
  if(!uvPainting)return;
  if(isShapeTool(tool)&&uvStart&&uvEnd)drawShape(tool,uvStart,uvEnd,false);
  uvPainting=false;uvStart=uvLast=uvEnd=null;
  renderUVOverlay();
}
tex.addEventListener("pointerup",finishUV);
tex.addEventListener("pointercancel",finishUV);
tex.addEventListener("pointerleave",()=>{textPreviewUV=null;renderUVOverlay()});

/* ---------- WebGL ---------- */
const glc=$("#glcanvas"),gl=glc.getContext("webgl",{alpha:false,antialias:true,preserveDrawingBuffer:true});
if(!gl){status("WebGL ist in diesem Browser nicht verfügbar.");return}

const VS=`
attribute vec3 aPos;attribute vec2 aUV;attribute vec3 aNor;
uniform mat4 uMVP;uniform mat4 uModel;varying vec2 vUV;varying vec3 vN;
void main(){vUV=aUV;vN=mat3(uModel)*aNor;gl_Position=uMVP*vec4(aPos,1.0);}
`;
const FS=`
precision mediump float;varying vec2 vUV;varying vec3 vN;uniform sampler2D uTex;
void main(){
  vec4 t=texture2D(uTex,vUV);
  vec3 base=mix(vec3(.15,.17,.20),t.rgb,t.a);
  vec3 N=normalize(vN),L=normalize(vec3(.55,.85,.7));
  float d=max(dot(N,L),0.0);
  float hemi=.35+.25*(N.y*.5+.5);
  gl_FragColor=vec4(base*(hemi+.75*d),1.0);
}
`;
function mkShader(type,src){
  const s=gl.createShader(type);
  gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
  return s
}
const prog=gl.createProgram();
gl.attachShader(prog,mkShader(gl.VERTEX_SHADER,VS));
gl.attachShader(prog,mkShader(gl.FRAGMENT_SHADER,FS));
gl.linkProgram(prog);
gl.useProgram(prog);

const loc={pos:gl.getAttribLocation(prog,"aPos"),uv:gl.getAttribLocation(prog,"aUV"),nor:gl.getAttribLocation(prog,"aNor"),
mvp:gl.getUniformLocation(prog,"uMVP"),model:gl.getUniformLocation(prog,"uModel"),tex:gl.getUniformLocation(prog,"uTex")};

const bPos=gl.createBuffer(),bUV=gl.createBuffer(),bNor=gl.createBuffer();
function bindBuffer(buf,loca,size,data){
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loca);
  gl.vertexAttribPointer(loca,size,gl.FLOAT,false,0,0);
}
function uploadMesh(){
  if(!mesh)return;
  bindBuffer(bPos,loc.pos,3,mesh.pos);
  bindBuffer(bUV,loc.uv,2,mesh.uv);
  bindBuffer(bNor,loc.nor,3,mesh.nor);
}
const glTex=gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D,glTex);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.uniform1i(loc.tex,0);

function uploadTexture(){
  if(!gl)return;
  gl.bindTexture(gl.TEXTURE_2D,glTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,tex);
  announceChange({type:"texture"});
}
function perspective(fovy,aspect,near,far){
  const f=1/Math.tan(fovy/2),nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
}
function mul4(a,b){
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return o;
}
function rotXY(rx,ry){
  const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry);
  return new Float32Array([cy,sx*sy,-cx*sy,0,0,cx,sx,0,sy,-sx*cy,cx*cy,0,0,0,0,1]);
}
function translate3(x,y,z){
  return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);
}
let rx=-.25,ry=.6,zoom=3.2,panX=0,panY=0;
function resetCamera(){rx=-.25;ry=.6;zoom=3.2;panX=0;panY=0}
$("#resetView").onclick=resetCamera;

function invRotate(m,v){
  return [
    m[0]*v[0]+m[1]*v[1]+m[2]*v[2],
    m[4]*v[0]+m[5]*v[1]+m[6]*v[2],
    m[8]*v[0]+m[9]*v[1]+m[10]*v[2]
  ];
}
function rayTriangle(o,d,a,b,c,cull){
  const EPS2=1e-8,e1=sub(b,a),e2=sub(c,a),p=cross(d,e2),det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];
  if(cull){if(det<EPS2)return null}else if(Math.abs(det)<EPS2)return null;
  const inv=1/det,tv=sub(o,a),u=(tv[0]*p[0]+tv[1]*p[1]+tv[2]*p[2])*inv;if(u<0||u>1)return null;
  const q=cross(tv,e1),v=(d[0]*q[0]+d[1]*q[1]+d[2]*q[2])*inv;if(v<0||u+v>1)return null;
  const t=(e2[0]*q[0]+e2[1]*q[1]+e2[2]*q[2])*inv;if(t<=EPS2)return null;
  return{t,u,v};
}
function raycast(clientX,clientY){
  if(!mesh)return null;
  const r=glc.getBoundingClientRect();
  const x=(clientX-r.left)/r.width*2-1;
  const y=1-(clientY-r.top)/r.height*2;
  const tan=Math.tan(Math.PI/8),aspect=r.width/Math.max(1,r.height);
  const dirCamera=norm([x*tan*aspect,y*tan,-1]);
  const modelRot=rotXY(rx,ry);
  const cameraWorld=[-panX,-panY,zoom];
  const o=invRotate(modelRot,cameraWorld);
  const d=norm(invRotate(modelRot,dirCamera));
  let best=null,bestT=Infinity;
  const cull=!$("#backfacePaint").checked,P=mesh.pos;
  for(let i=0;i<mesh.count;i+=3){
    const a=[P[i*3],P[i*3+1],P[i*3+2]],b=[P[(i+1)*3],P[(i+1)*3+1],P[(i+1)*3+2]],c=[P[(i+2)*3],P[(i+2)*3+1],P[(i+2)*3+2]];
    const hit=rayTriangle(o,d,a,b,c,cull);
    if(hit&&hit.t<bestT){bestT=hit.t;best={i,...hit}}
  }
  if(!best)return null;
  const w=1-best.u-best.v,i=best.i,U=mesh.uv;
  const uu=U[i*2]*w+U[(i+1)*2]*best.u+U[(i+2)*2]*best.v;
  const vv=U[i*2+1]*w+U[(i+1)*2+1]*best.u+U[(i+2)*2+1]*best.v;
  const triIndex=Math.floor(i/3);
  const n=mesh.triNormals[triIndex];
  return{u:clamp(uu,0,1),v:clamp(vv,0,1),triangle:triIndex,surface:mesh.triSurface[triIndex],normal:n};
}
function uvPix(h){return{x:h.u*tex.width,y:h.v*tex.height}}

/* ---------- 3D input ---------- */
let navMode=null;
let painting3D=false;
let p3Start=null,p3End=null;
let last3DHit=null,lastPointer=null;

glc.addEventListener("contextmenu",e=>e.preventDefault());

glc.addEventListener("pointerdown",e=>{
  glc.setPointerCapture(e.pointerId);

  if(e.shiftKey||e.button===1){
    navMode="pan";
    lastPointer={x:e.clientX,y:e.clientY};
    glc.style.cursor="move";
    return;
  }
  if(e.altKey||e.button===2||!$("#paint3D").checked){
    navMode="rotate";
    lastPointer={x:e.clientX,y:e.clientY};
    glc.style.cursor="grabbing";
    return;
  }

  if(e.button!==0||!mesh)return;

  const hit=raycast(e.clientX,e.clientY);
  if(!hit){status("Kein 3D-Treffer — auf das Modell klicken.");return}
  const p=uvPix(hit);

  if(tool==="picker"){pickColor(p);return}

  pushHistory();

  if(tool==="fill"){floodFill(p);return}
  if(tool==="text"){drawTextAt(p,false);status("Text auf 3D-Modell platziert.");return}

  painting3D=true;
  last3DHit=hit;
  lastPointer={x:e.clientX,y:e.clientY};
  p3Start=p3End=p;

  if(isStrokeTool(tool)){stamp(p);uploadTexture()}
  renderUVOverlay();
});

function panScale(){ return Math.max(.0015, zoom*.0012); }
function canConnectHits(prevHit, hit){
  if(!prevHit || !hit) return false;
  const uvA=uvPix(prevHit), uvB=uvPix(hit);
  const uvGap=dist(uvA, uvB);
  const normalDot=dot(prevHit.normal, hit.normal);
  const brush=+$("#brushSize").value;
  if(!$("#seamSafe").checked) return true;
  if(prevHit.surface<0||hit.surface<0||prevHit.surface!==hit.surface)return false;
  return normalDot > 0.96 && uvGap < brush * 2.25;
}
function apply3DStrokeAlongScreen(x0,y0,x1,y1){
  const move=Math.hypot(x1-x0,y1-y0);
  const stepPx=Math.max(1, +$("#brushSize").value*0.18);
  const steps=Math.max(1, Math.ceil(move/stepPx));
  let prevHit=last3DHit;
  for(let s=1;s<=steps;s++){
    const t=s/steps;
    const sx=x0+(x1-x0)*t;
    const sy=y0+(y1-y0)*t;
    const hit=raycast(sx,sy);
    if(!hit)continue;
    const p=uvPix(hit);
    if(canConnectHits(prevHit, hit) && isStrokeTool(tool)) strokeBetween(uvPix(prevHit), p, tool);
    else stamp(p, tool);
    prevHit=hit;
    last3DHit=hit;
    p3End=p;
  }
  uploadTexture();
}

glc.addEventListener("pointermove",e=>{
  if(navMode==="rotate"){
    ry+=(e.clientX-lastPointer.x)*.008;
    rx+=(e.clientY-lastPointer.y)*.008;
    lastPointer={x:e.clientX,y:e.clientY};
    return;
  }
  if(navMode==="pan"){
    const s=panScale();
    panX+=(e.clientX-lastPointer.x)*s;
    panY-=(e.clientY-lastPointer.y)*s;
    lastPointer={x:e.clientX,y:e.clientY};
    return;
  }

  const hoverHit=mesh?raycast(e.clientX,e.clientY):null;
  textPreview3D=(tool==="text"&&hoverHit)?uvPix(hoverHit):null;

  if(painting3D){
    apply3DStrokeAlongScreen(lastPointer.x,lastPointer.y,e.clientX,e.clientY);
    lastPointer={x:e.clientX,y:e.clientY};
  }
  renderUVOverlay();
});

function finish3D(){
  if(navMode){
    navMode=null;
    glc.style.cursor="crosshair";
    return;
  }
  if(!painting3D)return;
  if(isShapeTool(tool)&&p3Start&&p3End)drawShape(tool,p3Start,p3End,false);
  painting3D=false;
  last3DHit=null;
  p3Start=p3End=null;
  renderUVOverlay();
}
glc.addEventListener("pointerup",finish3D);
glc.addEventListener("pointercancel",finish3D);
glc.addEventListener("pointerleave",()=>{textPreview3D=null;renderUVOverlay()});
glc.addEventListener("wheel",e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(e.deltaY*.001),1.45,12)},{passive:false});

/* ---------- Export ---------- */
function mtlText(textureFile="texture.png"){return`newmtl Material_Texture
Ka 1.000000 1.000000 1.000000
Kd 1.000000 1.000000 1.000000
Ks 0.000000 0.000000 0.000000
d 1.0
illum 1
map_Kd ${textureFile}
`}
function objText(materialFile="material.mtl"){
  if(!mesh)return null;
  let s=`# Exported by OBJ Texture Studio Pro Surface Atlas\nmtllib ${materialFile}\nusemtl Material_Texture\n`;
  for(let i=0;i<mesh.count;i++)s+=`v ${mesh.rawPos[i*3]} ${mesh.rawPos[i*3+1]} ${mesh.rawPos[i*3+2]}\n`;
  for(let i=0;i<mesh.count;i++)s+=`vt ${mesh.uv[i*2]} ${1-mesh.uv[i*2+1]}\n`;
  for(let i=0;i<mesh.count;i++)s+=`vn ${mesh.nor[i*3]} ${mesh.nor[i*3+1]} ${mesh.nor[i*3+2]}\n`;
  for(let i=0;i<mesh.count;i+=3){const a=i+1,b=i+2,c=i+3;s+=`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`}
  return s;
}
function safeAssetName(name="textured_model"){
  return String(name).replace(/\.obj$/i,"").replace(/[^a-z0-9_-]+/gi,"_").replace(/^_+|_+$/g,"")||"textured_model";
}
function exportPackage(name="textured_model"){
  if(!mesh){status("Bitte zuerst ein OBJ laden.");return false}
  const base=safeAssetName(name);
  const textureFile=`${base}_texture.png`;
  const materialFile=`${base}.mtl`;
  const objFile=`${base}.obj`;
  tex.toBlob(blob=>downloadBlob(textureFile,blob),"image/png");
  setTimeout(()=>downloadBlob(materialFile,new Blob([mtlText(textureFile)],{type:"text/plain"})),160);
  setTimeout(()=>downloadBlob(objFile,new Blob([objText(materialFile)],{type:"text/plain"})),320);
  status(`Export gestartet: ${objFile} + ${materialFile} + ${textureFile}.`);
  return true;
}
function exportGLB(name="roblox_model"){
  return new Promise((resolve,reject)=>{
    if(!mesh){status("Bitte zuerst ein OBJ laden.");reject(new Error("Kein Modell geladen."));return}
    if(!window.THREE||!THREE.GLTFExporter){
      const error=new Error("GLB-Exporter konnte nicht geladen werden.");
      status(error.message);reject(error);return;
    }
    try{
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(mesh.rawPos),3));
      geometry.setAttribute("normal",new THREE.BufferAttribute(new Float32Array(mesh.nor),3));
      geometry.setAttribute("uv",new THREE.BufferAttribute(new Float32Array(mesh.uv),2));
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const texture=new THREE.CanvasTexture(tex);
      texture.flipY=false;
      texture.encoding=THREE.sRGBEncoding;
      texture.needsUpdate=true;
      texture.name="TextureMap_Atlas";
      const material=new THREE.MeshStandardMaterial({
        name:"TextureMap_Material",map:texture,color:0xffffff,metalness:0,roughness:1,side:THREE.DoubleSide
      });
      const exportMesh=new THREE.Mesh(geometry,material);
      exportMesh.name=safeAssetName(name);
      const exportScene=new THREE.Scene();
      exportScene.add(exportMesh);
      const cleanup=()=>{geometry.dispose();material.dispose();texture.dispose()};

      new THREE.GLTFExporter().parse(exportScene,result=>{
        if(!(result instanceof ArrayBuffer)){
          cleanup();reject(new Error("GLB konnte nicht binär erzeugt werden."));return;
        }
        const fileName=`${safeAssetName(name)}.glb`;
        downloadBlob(fileName,new Blob([result],{type:"model/gltf-binary"}));
        cleanup();
        status(`Roblox-GLB exportiert: ${fileName} · Texturemap ist eingebettet.`);
        resolve(fileName);
      },{binary:true,embedImages:true,onlyVisible:true,truncateDrawRange:true});
    }catch(error){status(`GLB-Exportfehler: ${error.message}`);reject(error)}
  });
}
function robloxAssetId(value){
  const raw=String(value||"").trim();
  const direct=raw.match(/^\d+$/);
  const embedded=raw.match(/(?:rbxassetid:\/\/|\/library\/|\/store\/asset\/|[?&]id=)(\d+)/i);
  const id=(direct?direct[0]:embedded?.[1])||"";
  return id&&!/^0+$/.test(id)?id:null;
}
function meshSize(){
  if(!mesh?.rawPos?.length)return[1,1,1];
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(let i=0;i<mesh.rawPos.length;i+=3){
    const x=mesh.rawPos[i],y=mesh.rawPos[i+1],z=mesh.rawPos[i+2];
    minX=Math.min(minX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);
    maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxZ=Math.max(maxZ,z);
  }
  return[Math.max(.001,maxX-minX),Math.max(.001,maxY-minY),Math.max(.001,maxZ-minZ)];
}
async function exportRBXM(name="roblox_model",meshAssetValue,textureAssetValue){
  if(!mesh)throw new Error("Bitte zuerst ein OBJ laden oder ein Code-Modell texturieren.");
  const meshId=robloxAssetId(meshAssetValue),textureId=robloxAssetId(textureAssetValue);
  if(!meshId||!textureId)throw new Error("Bitte gültige Roblox Mesh- und Texture-Asset-IDs eingeben.");
  status("RBXM wird binär erzeugt …");
  try{
    const rbxm=await import("https://esm.sh/rbxm-parser@1.1.4?bundle");
    const {RobloxFile,Model,MeshPart,SurfaceAppearance,Vector3,Color3}=rbxm;
    if(!RobloxFile||!MeshPart)throw new Error("RBXM-Modul ist unvollständig.");
    const file=new RobloxFile();
    const model=new Model();
    model.Name=safeAssetName(name);
    file.AddRoot(model);

    const part=new MeshPart();
    part.Name="GeneratedMesh";
    part.Parent=model;
    part.MeshId=`rbxassetid://${meshId}`;
    part.TextureID=`rbxassetid://${textureId}`;
    const [sx,sy,sz]=meshSize();
    part.Size=new Vector3(sx,sy,sz);
    part.InitialSize=new Vector3(sx,sy,sz);
    part.Anchored=true;
    part.DoubleSided=true;
    part.Color3uint8=new Color3(1,1,1);
    model.PrimaryPart=part;

    const surface=new SurfaceAppearance();
    surface.Name="TextureAtlas";
    surface.ColorMap=`rbxassetid://${textureId}`;
    surface.Parent=part;

    const buffer=file.WriteToBuffer();
    const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
    const fileName=`${safeAssetName(name)}.rbxm`;
    downloadBlob(fileName,new Blob([bytes],{type:"application/octet-stream"}));
    status(`Echte RBXM exportiert: ${fileName} · MeshPart und Texturemap sind über Roblox-Asset-IDs verbunden.`);
    return fileName;
  }catch(error){
    status(`RBXM-Exportfehler: ${error.message}`);
    throw error;
  }
}

function loadTextureDataUrl(dataUrl,{push=true}={}){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      if(push)pushHistory();
      tex.width=img.naturalWidth||img.width;
      tex.height=img.naturalHeight||img.height;
      tctx.clearRect(0,0,tex.width,tex.height);
      tctx.drawImage(img,0,0,tex.width,tex.height);
      resizeOverlay();
      uploadTexture();
      renderUVOverlay();
      resolve();
    };
    img.onerror=()=>reject(new Error("Texturbild konnte nicht geladen werden."));
    img.src=dataUrl;
  });
}
$("#savePng").onclick=()=>tex.toBlob(b=>downloadBlob("texture.png",b),"image/png");
$("#saveGlb").onclick=()=>exportGLB(currentObjName||"roblox_model").catch(()=>{});
$("#saveRbxm").onclick=()=>exportRBXM(currentObjName||"roblox_model",$("#rbxmMeshId").value,$("#rbxmTextureId").value).catch(error=>alert(error.message));
$("#saveMtl").onclick=()=>downloadBlob("material.mtl",new Blob([mtlText()],{type:"text/plain"}));
$("#saveObj").onclick=()=>{
  const s=objText();
  if(!s){status("Bitte zuerst ein OBJ laden.");return}
  downloadBlob("textured_model.obj",new Blob([s],{type:"text/plain"}))
};
$("#saveAll").onclick=()=>{
  const s=objText();
  if(!s){status("Bitte zuerst ein OBJ laden.");return}
  tex.toBlob(b=>downloadBlob("texture.png",b),"image/png");
  setTimeout(()=>downloadBlob("material.mtl",new Blob([mtlText()],{type:"text/plain"})),160);
  setTimeout(()=>downloadBlob("textured_model.obj",new Blob([s],{type:"text/plain"})),320);
  status("Export gestartet: OBJ + MTL + PNG. Alle drei Dateien in denselben Ordner legen.");
};

/* ---------- Keyboard ---------- */
window.addEventListener("keydown",e=>{
  const tag=(e.target.tagName||"").toLowerCase();
  if(["input","select","textarea"].includes(tag))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){
    e.preventDefault();
    e.shiftKey?redo():undo();
    return;
  }
  const map={b:"brush",p:"pencil",e:"eraser",f:"fill",i:"picker",s:"spray",l:"line",r:"rect",o:"ellipse",g:"gradient",t:"text"};
  if(map[e.key.toLowerCase()])setTool(map[e.key.toLowerCase()]);
});

/* ---------- Render ---------- */
function resizeGL(){
  const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.floor(glc.clientWidth*dpr)),h=Math.max(1,Math.floor(glc.clientHeight*dpr));
  if(glc.width!==w||glc.height!==h){glc.width=w;glc.height=h}
  gl.viewport(0,0,w,h)
}
function render(){
  resizeGL();
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(.035,.043,.055,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  if(mesh){
    gl.useProgram(prog);
    bindBuffer(bPos,loc.pos,3,mesh.pos);
    bindBuffer(bUV,loc.uv,2,mesh.uv);
    bindBuffer(bNor,loc.nor,3,mesh.nor);

    const model=rotXY(rx,ry);
    const view=translate3(panX,panY,-zoom);
    const proj=perspective(Math.PI/4,glc.width/Math.max(1,glc.height),.05,50);
    gl.uniformMatrix4fv(loc.model,false,model);
    gl.uniformMatrix4fv(loc.mvp,false,mul4(proj,mul4(view,model)));
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }
  requestAnimationFrame(render);
}

resizeOverlay();
fillBase();
updateHistoryButtons();
updateUVModeBadge();
render();
window.TextureStudio={
  version:2,
  tex,
  overlay:uvO,
  glCanvas:glc,
  getMesh:()=>mesh,
  getTool:()=>tool,
  setTool,
  getObjSource:()=>currentObjText,
  getObjName:()=>currentObjName,
  loadOBJText,
  loadTextureDataUrl,
  objText,
  mtlText,
  exportPackage,
  exportGLB,
  exportRBXM,
  downloadBlob,
  renderUVOverlay,
  uploadTexture,
  status,
  resetCamera
};
window.dispatchEvent(new CustomEvent("texturestudio:ready"));
})();
