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
  if(d.__rcCmd){const c=d.__rcCmd;
   if(c.type==='view'){const b=document.querySelector('[data-v="'+c.arg+'"]');if(b)b.click();}
   else if(c.type==='fly')flyTo(c.arg.cam,c.arg.tgt,c.arg.fov);
   else if(c.type==='walk'){const b=document.getElementById('bWalk');if(b)b.click();}}});
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
