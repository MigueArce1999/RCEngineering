/**
 * Enganche con el modelo 3D (HTML autocontenido). Se inserta en tiempo de carga, así sirve para cualquier versión
 * del modelo que conserve la función `go(k)` y no obliga a volver a subirlo.
 * Dentro del modelo: elegir un punto con un toque (modo comentar), dibujar alfileres numerados en 3D,
 * volar la cámara a un punto y ejecutar acciones simples (vista, nombres, recorrido).
 */
const HOOK = `
(function(){
 const el=renderer.domElement,V3=THREE.Vector3;
 const st={comment:false,pins:[],preview:null};
 const css=document.createElement('style');
 css.textContent='#rcPins{position:fixed;inset:0;pointer-events:none;z-index:9;overflow:hidden}'
 +'.rcpin{position:absolute;left:0;top:0;pointer-events:auto;border:0;cursor:pointer;width:34px;height:34px;border-radius:50% 50% 50% 3px;background:#d9541e;color:#fff;font:700 13px Inter,system-ui,sans-serif;display:grid;place-items:center;box-shadow:0 3px 10px rgba(0,0,0,.35);border:2px solid #fff;transition:opacity .2s,filter .2s}'

 +'.rcpin.s-in_progress{background:#d18a1f}.rcpin.s-done{background:#1b7a50}.rcpin.s-dismissed{background:#7b8580}'
 +'.rcpin.new{background:#1f5fd1;animation:rcpop .5s cubic-bezier(.16,1,.3,1)}.rcpin.on{filter:brightness(1.15);outline:3px solid rgba(255,255,255,.7)}.rcpin.dim{opacity:.6}'
 +'@keyframes rcpop{from{scale:.2;opacity:0}to{scale:1;opacity:1}}';
 document.head.appendChild(css);
 const layer=document.createElement('div');layer.id='rcPins';document.body.appendChild(layer);
 const els=new Map(),tmp=new V3(),rc=new THREE.Raycaster();rc.camera=camera;   // los sprites del modelo (halos de luz) necesitan la cámara para el rayo
 const r2=a=>a.map(n=>Math.round(n*100)/100);
 function opaque(o){let v=o;while(v){if(v.visible===false)return false;v=v.parent;}
  const m=Array.isArray(o.material)?o.material[0]:o.material;if(m&&(m.opacity<.6||m.wireframe||m.visible===false))return false;return !o.isReflector&&!o.isSprite&&!o.isLine&&!o.isPoints;}
 function pickAt(cx,cy){const r=el.getBoundingClientRect();rc.setFromCamera(new THREE.Vector2((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height)*2+1),camera);
  let hs=[];try{hs=rc.intersectObjects(scene.children,true);}catch(e){}
  for(const h of hs){if(h.object.isMesh&&h.distance>.4&&opaque(h.object))return h.point;}
  for(const h of hs){if(h.object.isMesh&&h.distance>.4&&!h.object.isReflector)return h.point;}   // cualquier superficie visible
  const o=rc.ray.origin,d=rc.ray.direction;if(d.y<-.01){const t=-o.y/d.y;if(t>.4&&t<120)return new V3(o.x+d.x*t,0,o.z+d.z*t);}   // si no hay nada: el piso
  return null;}
 function sync(){const list=st.pins.concat(st.preview?[{id:'__new',n:'+',p:st.preview.p,preview:true}]:[]);
  for(const [id,d] of els)if(!list.some(x=>x.id===id)){d.remove();els.delete(id);}
  for(const it of list){let d=els.get(it.id);
   if(!d){d=document.createElement('button');d.type='button';d.setAttribute('aria-label','Comentario');d.innerHTML='<b></b>';d.onclick=e=>{e.stopPropagation();parent.postMessage({__rcPinClick:it.id},'*');};layer.appendChild(d);els.set(it.id,d);}
   d.firstChild.textContent=it.n;d.className='rcpin'+(it.preview?' new':'')+' s-'+(it.status||'new')+(it.active?' on':'');d._p=it.p;}}
 let last=0;
 function place(t){const dim=t-last>260;if(dim)last=t;
  for(const d of els.values()){const p=d._p;tmp.set(p[0],p[1],p[2]);const dist=tmp.distanceTo(camera.position);tmp.project(camera);
   const vis=tmp.z>-1&&tmp.z<1&&Math.abs(tmp.x)<1.15&&Math.abs(tmp.y)<1.15;d.style.display=vis?'':'none';if(!vis)continue;
   d.style.transform='translate('+((tmp.x+1)/2*innerWidth)+'px,'+((1-tmp.y)/2*innerHeight)+'px) translate(0,-100%)';
   if(dim){rc.set(camera.position,new V3(p[0],p[1],p[2]).sub(camera.position).normalize());let hid=false;
    let hs=[];try{hs=rc.intersectObjects(scene.children,true);}catch(e){}
    for(const h of hs){if(h.distance>=dist-.5)break;if(h.object.isMesh&&opaque(h.object)){hid=true;break;}}
    d.classList.toggle('dim',hid);}}}
 (function loop(t){try{if(els.size)place(t||0);}catch(e){}window.requestAnimationFrame(loop);})();
 let down=null;
 el.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()};},true);
 el.addEventListener('pointerup',e=>{if(!st.comment||!down)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||performance.now()-down.t>600;down=null;if(moved||e.button>0)return;
  const p=pickAt(e.clientX,e.clientY);if(!p)return;st.preview={p:r2([p.x,p.y,p.z])};sync();
  parent.postMessage({__rcPick:{p:st.preview.p,cam:r2(camera.position.toArray()),tgt:r2(controls.target.toArray()),fov:Math.round(camera.fov),sx:e.clientX,sy:e.clientY}},'*');},true);
 let fly=null;
 function stepFly(t){if(!fly)return;const k=Math.min(1,(t-fly.t0)/fly.d),e=1-Math.pow(1-k,3);
  camera.position.lerpVectors(fly.c0,fly.c1,e);controls.target.lerpVectors(fly.g0,fly.g1,e);camera.fov=fly.f0+(fly.f1-fly.f0)*e;camera.updateProjectionMatrix();controls.update();
  if(k<1)window.requestAnimationFrame(stepFly);else fly=null;}
 function flyTo(c,g,f){fly={t0:performance.now(),d:900,c0:camera.position.clone(),c1:new V3(...c),g0:controls.target.clone(),g1:new V3(...g),f0:camera.fov,f1:f||camera.fov};window.requestAnimationFrame(stepFly);}
 const root=document.documentElement;
 addEventListener('message',e=>{const d=e.data;if(!d||typeof d!=='object')return;
  if(d.__rcG!==undefined){const g=d.__rcG;
   if('guest' in g){root.classList.toggle('rc-guest',!!g.guest);
    if(g.guest){controls.enableDamping=true;controls.dampingFactor=.08;controls.rotateSpeed=.55;controls.zoomSpeed=.8;controls.panSpeed=.6;controls.screenSpacePanning=false;}}
   if('labels' in g)root.classList.toggle('rc-showlbl',!!g.labels);
   if('comment' in g){st.comment=!!g.comment;window.__rcBlock=st.comment;el.style.cursor=st.comment?'crosshair':'';if(!st.comment&&st.preview){st.preview=null;sync();}}
   if('pins' in g){st.pins=g.pins||[];if(!g.keepPreview)st.preview=null;sync();}
   if(g.clearPreview){st.preview=null;sync();}}
  if(d.__rcCmd)runCmd(d.__rcCmd);});
 function runCmd(c){
  if(c.type==='batch'){(c.arg||[]).forEach(runCmd);return;}
  if(c.type==='view'){const b=document.querySelector('[data-v="'+c.arg+'"]');if(b)b.click();}
  else if(c.type==='fly')flyTo(c.arg.cam,c.arg.tgt,c.arg.fov);
  else if(c.type==='walk'){const b=document.getElementById('bWalk');if(b)b.click();}
  else if(c.type==='roof'){const t=document.getElementById('tRoof');if(t){t.checked=!!c.arg;t.dispatchEvent(new Event('change',{bubbles:true}));}}
  else if(c.type==='run'){try{if(c.arg)W.keys.add('shift');else W.keys.delete('shift');}catch(e){}}
  else if(c.type==='next'){const b=document.getElementById('wNext');if(b)b.click();}
  else if(c.type==='prev'){const b=document.getElementById('wPrev');if(b)b.click();}
  else if(c.type==='exitwalk'){const b=document.getElementById('wExit');if(b)b.click();try{W.keys.delete('shift');}catch(e){}}
  else if(c.type==='lamas')setLamas(!!c.arg);
  else if(c.type==='win'){if(window.__setWin)window.__setWin(!!c.arg);}
  else if(c.type==='cart'){if(window.__setCart)window.__setCart(!!c.arg);}
  else if(c.type==='mini')document.body.classList.toggle('mini-on');}
 function stopInfo(){try{const s=STOPS[W.stop];if(s)parent.postMessage({__rcStop:{n:W.stop,total:STOPS.length,title:s[0],text:s[1]}},'*');}catch(e){}}
 const wt=document.getElementById('wTitle');if(wt)new MutationObserver(stopInfo).observe(wt,{childList:true,characterData:true,subtree:true});

 /* Opción: lamas de madera en todas las ventanas (la fachada social ya tiene sus hojas). Una sola malla instanciada: liviana. */
 const LAM={g:null};
 function buildLamas(){const items=[];
  GEO.glass.forEach(([x,z,w,d,f,t])=>{let top=Math.abs(t-f-2.2)<.05?t+.3:t;top=Math.min(top,4.2);const H=top-f;if(H<.9)return;
   const hor=w>=d,L=hor?w:d;if(L<.5)return;try{if(isSocialFacade(x,z,w,d))return;}catch(e){}
   const n=Math.max(4,Math.round(H/.09));for(let i=0;i<n;i++)items.push([x+w/2-OX,f+H/n*(i+.5),z+d/2-OZ,L-.04,hor]);});
  const mat=new THREE.MeshStandardMaterial({color:'#8a5d3d',roughness:.6,metalness:.05});
  const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,Math.max(1,items.length));
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),qt=new THREE.Quaternion().setFromAxisAngle(new V3(1,0,0),-.7),qy=new THREE.Quaternion().setFromAxisAngle(new V3(0,1,0),Math.PI/2),s=new V3(),p=new V3();
  items.forEach((it,i)=>{p.set(it[0],it[1],it[2]);if(it[4])q.copy(qt);else q.copy(qy).multiply(qt);s.set(it[3],.022,.105);m4.compose(p,q,s);im.setMatrixAt(i,m4);});
  im.count=items.length;im.castShadow=true;im.receiveShadow=true;im.instanceMatrix.needsUpdate=true;
  const g=new THREE.Group();g.add(im);scene.add(g);return g;}
 function setLamas(on){try{if(on&&!LAM.g)LAM.g=buildLamas();if(LAM.g)LAM.g.visible=!!on;const t=document.getElementById('tLamas');if(t&&t.checked!==!!on)t.checked=!!on;}catch(e){}}
 {const lst=document.querySelector('.pane[data-p=capas] .list');
  if(lst&&!document.getElementById('tLamas')){const lb=document.createElement('label');lb.className='sw';lb.innerHTML='<span>Lamas en todas las ventanas<small>Celosía de madera</small></span><input type="checkbox" id="tLamas"><i></i>';lst.appendChild(lb);lb.querySelector('input').addEventListener('change',e=>setLamas(e.target.checked));}}

 /* Jardín vertical en el patio interno: frente al ventanal del baño principal (muro norte del patio). */
 {const W_=264/S,H_=2.75,cx=X(3082),cz=Z(1953),y0=.5,g=new THREE.Group();
  const sd=(n=>()=>{n=(n*16807)%2147483647;return n/2147483647;})(7);
  // fondo vegetal oscuro + marco de madera
  const back=new THREE.Mesh(new THREE.PlaneGeometry(W_,H_),new THREE.MeshStandardMaterial({color:'#1d4427',roughness:1}));back.position.set(cx,y0+H_/2,cz);g.add(back);
  const wood=new THREE.MeshStandardMaterial({color:'#6b452c',roughness:.7});
  const fb=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wood);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);};
  fb(W_+.12,.07,.1,cx,y0+H_+.035,cz+.05);fb(.07,H_,.1,cx-W_/2-.035,y0+H_/2,cz+.05);fb(.07,H_,.1,cx+W_/2+.035,y0+H_/2,cz+.05);
  // jardinera inferior (con riego) y canal
  fb(W_+.3,.32,.34,cx,y0-.02,cz+.2);
  // hojas: una sola malla instanciada, con tonos verdes variados y relieve
  const leaf=canvasTex0((c,z)=>{c.clearRect(0,0,z,z);c.fillStyle='#ffffff';c.beginPath();c.moveTo(z*.5,z*.04);c.bezierCurveTo(z*.95,z*.3,z*.9,z*.75,z*.5,z*.97);c.bezierCurveTo(z*.1,z*.75,z*.05,z*.3,z*.5,z*.04);c.fill();
   c.strokeStyle='rgba(0,0,0,.28)';c.lineWidth=z*.03;c.beginPath();c.moveTo(z*.5,z*.08);c.lineTo(z*.5,z*.94);c.stroke();},128);
  const N=1100,im=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1.35),new THREE.MeshStandardMaterial({map:leaf,alphaTest:.5,side:THREE.DoubleSide,roughness:.85}),N);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new V3(),sc=new V3(),col=new THREE.Color();
  for(let i=0;i<N;i++){const lx=(sd()-.5)*W_,ly=sd()*H_;p.set(cx+lx,y0+ly,cz+.03+sd()*.13);
   e.set((sd()-.5)*.9,(sd()-.5)*.9,sd()*Math.PI*2);q.setFromEuler(e);const k=.12+sd()*.13;sc.set(k,k,1);m4.compose(p,q,sc);im.setMatrixAt(i,m4);
   const r=sd();col.setHSL(.24+sd()*.12,.45+sd()*.25,.2+sd()*.2+(r>.93?.12:0));im.setColorAt(i,col);}
  im.castShadow=true;im.receiveShadow=true;im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;g.add(im);
  // flores pequeñas de acento (rosadas y blancas)
  const fl=new THREE.InstancedMesh(new THREE.SphereGeometry(.035,6,5),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.7}),70);
  for(let i=0;i<70;i++){p.set(cx+(sd()-.5)*W_,y0+.3+sd()*(H_-.4),cz+.1+sd()*.1);q.identity();sc.set(1,1,1);m4.compose(p,q,sc);fl.setMatrixAt(i,m4);col.set(sd()>.5?'#f4b6c8':'#fbf6ea');fl.setColorAt(i,col);}
  fl.instanceMatrix.needsUpdate=true;if(fl.instanceColor)fl.instanceColor.needsUpdate=true;g.add(fl);
  g.name='jardinVertical';scene.add(g);
  const lst=document.querySelector('.pane[data-p=capas] .list');
  if(lst&&!document.getElementById('tJV')){const lb=document.createElement('label');lb.className='sw';lb.innerHTML='<span>Jardín vertical<small>Patio del baño principal</small></span><input type="checkbox" id="tJV" checked><i></i>';lst.appendChild(lb);lb.querySelector('input').addEventListener('change',e=>{g.visible=e.target.checked;});}}
 addEventListener('contextmenu',e=>{if(root.classList.contains('rc-guest'))e.preventDefault();});
 const hud=document.getElementById('walkHud');
 if(hud){let w=null;const rep=()=>{const on=hud.style.display!=='none'&&getComputedStyle(hud).display!=='none';if(on!==w){w=on;parent.postMessage({__rcWalk:on},'*');}};new MutationObserver(rep).observe(hud,{attributes:true,attributeFilter:['style']});rep();}
 parent.postMessage({__rcReady:1},'*');
})();
`;

/** Estilos del modo invitado: el modelo queda limpio (sin paneles, medidas, lluvia ni edición). */
export const GUEST_CSS =
  "html.rc-guest .ui,html.rc-guest #info,html.rc-guest .compass,html.rc-guest #badges,html.rc-guest #rsPanel,html.rc-guest #splitBar,html.rc-guest .wlight,html.rc-guest .dimL,html.rc-guest .dimN,html.rc-guest .dimV,html.rc-guest .dimR,html.rc-guest .dimT{display:none!important}" +
  "html.rc-guest:not(.rc-showlbl) .lbl{display:none!important}" +
  // Tocar o mantener presionado nunca selecciona texto ni abre "Copiar / Buscar con Google"
  "html.rc-guest,html.rc-guest *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;-webkit-tap-highlight-color:transparent!important}" +
  "html.rc-guest #walkHud button,html.rc-guest #pad .pb{touch-action:manipulation}" +
  // El recorrido usa controles propios de la página: se oculta la tarjeta del modelo y las flechas pasan a la izquierda
  "html.rc-guest .wcard,html.rc-guest .whelp{display:none!important}" +
  "html.rc-guest #pad{left:14px!important;right:auto!important;bottom:calc(env(safe-area-inset-bottom,0px) + 20px)!important}" +
  // Flechas del recorrido: botones redondos de vidrio, sin recuadro
  "@media (max-width:760px){html.rc-guest #pad{gap:8px;grid-template-columns:repeat(3,52px)!important;grid-template-rows:repeat(2,52px)!important}" +
  "html.rc-guest #pad .pb{border-radius:50%!important;background:rgba(15,42,32,.58)!important;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff;font-size:16px;box-shadow:0 4px 14px rgba(0,0,0,.25)}" +
  "html.rc-guest #pad .pb:active{background:#d9541e!important}" +
  "html.rc-guest #mini{display:none!important}html.rc-guest body.mini-on #mini{display:block!important}}";

/**
 * Inserta el enganche antes de `function go(k){` (ya existen scene, camera, controls y renderer) y evita que el modelo
 * reaccione a los toques mientras se está comentando. Si el modelo no tiene esas piezas, se deja intacto.
 */
export function patchModel(html: string): string {
  if (html.includes("__rcPins")) return html;
  const anchor = "function go(k){";
  const at = html.indexOf(anchor);
  if (at < 0 || !/const renderer=/.test(html) || !/const controls=/.test(html)) return html;
  let out = html.slice(0, at) + HOOK + "\n" + html.slice(at);
  out = out.replace("if(moved||e.button!==0)return;setMouse(e);", "if(moved||e.button!==0||window.__rcBlock)return;setMouse(e);");
  return out;
}
