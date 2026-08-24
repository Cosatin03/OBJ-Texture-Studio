(() => {
"use strict";
const $=selector=>document.querySelector(selector);
const studio=window.TextureStudio;
const container=$("#modelerCanvas");
if(!container)return;

const presets={
tank:`// Sci-Fi Bio-Reaktor / Tank
const tankMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, roughness: 0.1 });
const liquidMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.6 });
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7 });

const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, 0.8, 24), tankMat);
base.position.y = 0.4;
const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2, 0.6, 24), tankMat);
topCap.position.y = 5.2;
const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 4.4, 24, 1, true), glassMat);
glass.position.y = 2.8;
const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.2, 24), liquidMat);
liquid.position.y = 2.4;

for(let i=0; i<4; i++) {
  const angle = (i / 4) * Math.PI * 2;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.8, 12), pipeMat);
  pipe.position.set(Math.cos(angle)*1.9, 2.8, Math.sin(angle)*1.9);
  modelGroup.add(pipe);
}

const valve = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 12, 24), tankMat);
valve.rotation.x = Math.PI / 2;
valve.position.y = 5.8;
modelGroup.add(base, topCap, glass, liquid, valve);`,

conveyor:`// Förderband-Einheit mit Kontrollmodul
const metalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.35 });
const beltMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.3 });

const frame = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 2.2), metalMat);
frame.position.y = 1.8;
const belt = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.1, 1.8), beltMat);
belt.position.y = 2.15;

for (const x of [-4, 0, 4]) {
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.8, 12), metalMat);
  legL.position.set(x, 0.9, 0.9);
  const legR = legL.clone();
  legR.position.z = -0.9;
  modelGroup.add(legL, legR);
}

const railL = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 0.1), accentMat);
railL.position.set(0, 2.3, 1.05);
const railR = railL.clone();
railR.position.z = -1.05;
modelGroup.add(frame, belt, railL, railR);`,

dome:`// Gewächshaus-Kuppel
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.38, roughness: 0.12, side: THREE.DoubleSide });
const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.55 });
const plantMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 });

const domeGeo = new THREE.SphereGeometry(6, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
const domeGlass = new THREE.Mesh(domeGeo, glassMat);
const ring = new THREE.Mesh(new THREE.CylinderGeometry(6.1, 6.2, 0.6, 32), baseMat);
ring.position.y = 0.3;

for(let i=0;i<9;i++){
  const plant=new THREE.Mesh(new THREE.ConeGeometry(0.35,1.2,8),plantMat);
  const angle=i/9*Math.PI*2, radius=2.7+(i%2)*1.1;
  plant.position.set(Math.cos(angle)*radius,0.9,Math.sin(angle)*radius);
  modelGroup.add(plant);
}
modelGroup.add(domeGlass, ring);`,

terminal:`// Sci-Fi Computer Terminal
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.32 });
const screenMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.9 });
const buttonMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });

const base = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 1.2), bodyMat);
base.position.y = 1.1;
const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 1.4), bodyMat);
desk.position.set(0, 2.2, 0.2);
desk.rotation.x = 0.3;
const screen = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.08), screenMat);
screen.position.set(0, 2.8, -0.35);
screen.rotation.x = -0.2;

for(let x=-0.55;x<=0.55;x+=0.55){
  const button=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,0.05,12),buttonMat);
  button.rotation.x=Math.PI/2;
  button.position.set(x,2.34,0.58);
  modelGroup.add(button);
}
modelGroup.add(base, desk, screen);`
};

if(!window.THREE||!THREE.OrbitControls||!THREE.OBJExporter){
  container.innerHTML='<div class="empty-state"><h2>Three.js konnte nicht geladen werden</h2><p>Bitte Internetverbindung und CDN-Zugriff prüfen.</p></div>';
  studio.status("Code-Modellierer: Three.js-Abhängigkeiten fehlen.");
  return;
}

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b1018);
const camera=new THREE.PerspectiveCamera(45,1,.1,2000);
camera.position.set(12,10,16);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;
renderer.outputEncoding=THREE.sRGBEncoding;
container.appendChild(renderer.domElement);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.06;

scene.add(new THREE.GridHelper(30,30,0x2b9bd6,0x273244));
scene.add(new THREE.HemisphereLight(0xbfe5ff,0x152030,1.2));
const keyLight=new THREE.DirectionalLight(0xffffff,1.15);
keyLight.position.set(12,20,10);keyLight.castShadow=true;scene.add(keyLight);
const rimLight=new THREE.PointLight(0x38bdf8,1.5,40);rimLight.position.set(-6,8,-5);scene.add(rimLight);

let modelGroup=new THREE.Group();
scene.add(modelGroup);
const editor=$("#modelCode"),presetSelect=$("#modelPreset");

function disposeObject(object){
  object.traverse(child=>{
    child.geometry?.dispose?.();
    const materials=Array.isArray(child.material)?child.material:[child.material];
    materials.filter(Boolean).forEach(material=>{
      Object.values(material).forEach(value=>value?.isTexture&&value.dispose());
      material.dispose?.();
    });
  });
}
function clearModel(){
  scene.remove(modelGroup);
  disposeObject(modelGroup);
  modelGroup=new THREE.Group();
  scene.add(modelGroup);
}
function updateStats(){
  let meshes=0,vertices=0;
  modelGroup.traverse(child=>{
    if(!child.isMesh)return;
    meshes++;
    vertices+=child.geometry?.attributes?.position?.count||0;
  });
  $("#modelerMeshCount").textContent=meshes.toLocaleString();
  $("#modelerVertexCount").textContent=vertices.toLocaleString();
  return{meshes,vertices};
}
function fitCamera(){
  const box=new THREE.Box3().setFromObject(modelGroup);
  if(box.isEmpty())return;
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const radius=Math.max(size.x,size.y,size.z,1);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(radius*1.25,radius*.95,radius*1.55));
  camera.near=Math.max(.01,radius/1000);camera.far=Math.max(100,radius*100);
  camera.updateProjectionMatrix();controls.update();
}
function runCode(){
  clearModel();
  try{
    const execute=new Function("scene","modelGroup","THREE",`"use strict";\n${editor.value}`);
    execute(scene,modelGroup,THREE);
    modelGroup.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true}});
    const stats=updateStats();
    fitCamera();
    studio.status(`Code-Modell gerendert: ${stats.meshes} Meshes · ${stats.vertices.toLocaleString()} Vertices.`);
  }catch(error){
    console.error(error);
    studio.status(`Fehler im Modellcode: ${error.message}`);
    alert(`Fehler im JavaScript-3D-Code:\n${error.message}`);
  }
}
function loadPreset(name,{run=true}={}){
  editor.value=presets[name]||presets.tank;
  if(run)runCode();
}
function promptToPreset(prompt){
  const text=prompt.toLowerCase();
  if(/förder|conveyor|band|factory|fabrik/.test(text))return"conveyor";
  if(/kuppel|dome|greenhouse|gewächs|pflanz/.test(text))return"dome";
  if(/terminal|computer|konsole|screen|bildschirm/.test(text))return"terminal";
  return"tank";
}
function applyPrompt(){
  const prompt=$("#modelPrompt").value.trim();
  if(!prompt){studio.status("Bitte zuerst eine Modellbeschreibung eingeben.");return}
  const preset=promptToPreset(prompt);
  presetSelect.value=preset;
  loadPreset(preset);
  studio.status(`Prompt-Assistent: passende ${preset}-Vorlage erzeugt. Code kann jetzt angepasst werden.`);
}
function markMaterialNames(){
  modelGroup.traverse(child=>{
    if(!child.isMesh)return;
    const materials=Array.isArray(child.material)?child.material:[child.material];
    materials.filter(Boolean).forEach(material=>{
      const hex=material.color?.getHexString?.()||"94a3b8";
      material.name=`TMS_COLOR_${hex}`;
    });
  });
  modelGroup.updateMatrixWorld(true);
}
function generatedObj(){
  if(!updateStats().meshes)throw new Error("Keine 3D-Objekte vorhanden.");
  markMaterialNames();
  return new THREE.OBJExporter().parse(modelGroup);
}
function outputName(){return`${presetSelect.value||"code-model"}.obj`}
async function sendToPaint(){
  try{
    const obj=generatedObj();
    await studio.loadOBJText(obj,outputName(),{colorFromMaterials:true});
    document.querySelector('.segmented [data-view="split"]')?.click();
    studio.status("Code-Modell übernommen: UV-Atlas und Material-Texturemap wurden automatisch erstellt.");
  }catch(error){studio.status(`Übernahme fehlgeschlagen: ${error.message}`)}
}
function exportObj(){
  try{
    studio.downloadBlob(outputName(),new Blob([generatedObj()],{type:"text/plain"}));
    studio.status("Generiertes OBJ exportiert.");
  }catch(error){studio.status(`Export fehlgeschlagen: ${error.message}`)}
}
function resize(){
  const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
  renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();
}

presetSelect.addEventListener("change",()=>loadPreset(presetSelect.value));
$("#runModelCode").addEventListener("click",runCode);
$("#promptToCode").addEventListener("click",applyPrompt);
$("#sendModelToPaint").addEventListener("click",sendToPaint);
$("#exportGeneratedObj").addEventListener("click",exportObj);
editor.addEventListener("keydown",event=>{
  if(event.key==="Tab"){
    event.preventDefault();
    const start=editor.selectionStart,end=editor.selectionEnd;
    editor.setRangeText("  ",start,end,"end");
  }
  if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault();runCode()}
});
new ResizeObserver(resize).observe(container);
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
loadPreset("tank");
resize();
})();
