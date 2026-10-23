import * as THREE from 'three';
import { Viewer,SceneFormat } from './vendor/gaussian-splats-3d.module.js';
let viewer;
const status=document.querySelector('#status');
window.lucide?.createIcons();
try {
  const response=await fetch('/api/assets');if(!response.ok)throw new Error('无法读取资产');
  const {assets}=await response.json(),id=new URLSearchParams(location.search).get('asset');
  const asset=assets.find(a=>a.id===id && a.kind==='gaussian');if(!asset)throw new Error('此3DGS资产尚未公开');
  const format=asset.filename.toLowerCase().endsWith('.ply')?SceneFormat.Ply:asset.filename.toLowerCase().endsWith('.ksplat')?SceneFormat.KSplat:SceneFormat.Splat;
  viewer=new Viewer({rootElement:document.querySelector('#scene'),cameraUp:[0,1,0],initialCameraPosition:[0,-1,5],initialCameraLookAt:[0,0,0],sharedMemoryForWorkers:false,gpuAcceleratedSort:false,sceneRevealMode:0});
  await viewer.addSplatScene(asset.url,{format,showLoadingUI:false,splatAlphaRemovalThreshold:5,progressiveLoad:false});
  const camera=viewer.camera,controls=viewer.controls;
  const bounds=viewer.splatMesh.computeBoundingBox(true),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const radius=Math.max(size.length()/2,.1),distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*0.55;
  camera.position.copy(center).add(new THREE.Vector3(0,-.1,1).normalize().multiplyScalar(distance));
  camera.near=Math.max(distance/10000,.001);camera.far=Math.max(distance*100,100);camera.updateProjectionMatrix();
  controls?.target.copy(center);controls?.update();
  const original={position:camera.position.clone(),target:controls?.target.clone() || new THREE.Vector3()};
  document.querySelector('#reset').addEventListener('click',()=>{camera.position.copy(original.position);controls?.target.copy(original.target);controls?.update();});
  viewer.start();status.textContent='3DGS实景已加载';window.__songgaiSplatReady=true;
} catch(error) {
  status.textContent=`场景无法加载：${error.message}。请核对高斯资产格式及设备图形能力。`;
}
window.addEventListener('pagehide',()=>{viewer?.dispose();});
