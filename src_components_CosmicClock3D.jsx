import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

export default function CosmicClock3D({ initialTimeZone = 'local' }) {
  const mountRef = useRef(null);
  const composerRef = useRef(null);
  const reqRef = useRef(null);
  const prevSysRef = useRef(Date.now());
  const simElapsedRef = useRef(0);

  const [timeZoneMode, setTimeZoneMode] = useState(initialTimeZone); // 'local' | 'utc' | 'offset'
  const [offsetHours, setOffsetHours] = useState(0);
  const [timeScale, setTimeScale] = useState(1);
  const [showHUD, setShowHUD] = useState(true);
  const [currentTimeString, setCurrentTimeString] = useState('');

  useEffect(() => {
    const mount = mountRef.current;
    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020312);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(0, 120, 320);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputEncoding = THREE.sRGBEncoding;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 50;
    controls.maxDistance = 1200;

    const ambient = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(ambient);
    const sunLight = new THREE.PointLight(0xfff6c6, 2.4, 2000, 2.0);
    scene.add(sunLight);

    const world = new THREE.Object3D();
    scene.add(world);

    // Starfield
    function makeStarfield(count = 1200, spread = 1600) {
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = spread * Math.cbrt(Math.random());
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ size: 1.2, sizeAttenuation: true, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
      const pts = new THREE.Points(geom, mat);
      pts.frustumCulled = false;
      return pts;
    }
    scene.add(makeStarfield());

    // Sun
    const sunGroup = new THREE.Object3D();
    world.add(sunGroup);

    const sunRadius = 28;
    const sunGeo = new THREE.SphereGeometry(sunRadius, 48, 32);
    const sunMat = new THREE.MeshStandardMaterial({ emissive: new THREE.Color(0xffe7b7), emissiveIntensity: 1.6, metalness: 0.0, roughness: 1.0 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunGroup.add(sunMesh);

    // Glow sprite
    const spriteSVG = `data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><defs><radialGradient id='g' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='white' stop-opacity='1'/><stop offset='30%' stop-color='#fff4d1' stop-opacity='0.85'/><stop offset='60%' stop-color='#ffd89b' stop-opacity='0.35'/><stop offset='100%' stop-color='#000000' stop-opacity='0'/></radialGradient></defs><rect width='100%' height='100%' fill='url(#g)'/></svg>")}`;
    const texLoader = new THREE.TextureLoader();
    const spriteMap = texLoader.load(spriteSVG);
    const spriteMat = new THREE.SpriteMaterial({ map: spriteMap, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false });
    const glowSprite = new THREE.Sprite(spriteMat);
    glowSprite.scale.set(220, 220, 1);
    sunGroup.add(glowSprite);

    // Lensflare
    function makeFlareTexture(color = '#ffffff') {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      grad.addColorStop(0, color);
      grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,size,size);
      return new THREE.CanvasTexture(canvas);
    }
    const lensflare = new Lensflare();
    lensflare.addElement(new LensflareElement(makeFlareTexture('#fff7d9'), 350, 0.0, sunLight.color));
    lensflare.addElement(new LensflareElement(makeFlareTexture('#ffd89b'), 120, 0.2));
    lensflare.addElement(new LensflareElement(makeFlareTexture('#ff9aa8'), 60, 0.45));
    sunLight.add(lensflare);

    sunLight.position.copy(sunGroup.position);

    // Orbits and bodies
    function makeOrbitRing(radius, segments = 256) {
      const geom = new THREE.BufferGeometry();
      const vertices = [];
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
      }
      geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const mat = new THREE.LineBasicMaterial({ color: 0x5b6b9a, transparent: true, opacity: 0.18 });
      const line = new THREE.Line(geom, mat);
      line.rotation.x = Math.PI / 2;
      return line;
    }

    const hourPivot = new THREE.Object3D();
    world.add(hourPivot);
    const hourOrbitR = 120;
    hourPivot.add(makeOrbitRing(hourOrbitR));

    const hourPlanet = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 24), new THREE.MeshStandardMaterial({ color: 0x5f9eff, roughness: 0.7 }));
    hourPlanet.position.set(hourOrbitR, 0, 0);
    hourPivot.add(hourPlanet);

    const minutePivot = new THREE.Object3D();
    hourPlanet.add(minutePivot);
    const minuteOrbitR = 44;
    minutePivot.add(makeOrbitRing(minuteOrbitR));

    const minuteMoon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 18), new THREE.MeshStandardMaterial({ color: 0xcaa3ff, roughness: 0.6 }));
    minuteMoon.position.set(minuteOrbitR, 0, 0);
    minutePivot.add(minuteMoon);

    const secondPivot = new THREE.Object3D();
    minuteMoon.add(secondPivot);
    const secondOrbitR = 18;
    const secondDot = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 10), new THREE.MeshStandardMaterial({ color: 0xff7a9a, roughness: 0.3, emissive: 0xff7a9a, emissiveIntensity: 0.9 }));
    secondDot.position.set(secondOrbitR, 0, 0);
    secondPivot.add(secondDot);

    // Post-processing
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;
    composer.setSize(width, height);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.9, 0.6, 0.3);
    bloomPass.threshold = 0.1;
    bloomPass.strength = 1.3;
    bloomPass.radius = 0.6;
    composer.addPass(bloomPass);

    function onWindowResize() {
      width = mount.clientWidth;
      height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      composer.setSize(width, height);
    }
    window.addEventListener('resize', onWindowResize, { passive: true });

    function initSim() {
      const now = new Date();
      let secondsSinceMidnight;
      if (timeZoneMode === 'utc') {
        secondsSinceMidnight = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCMilliseconds() / 1000 + now.getUTCSeconds();
      } else if (timeZoneMode === 'offset') {
        const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
        const localMs = utc.getTime() + offsetHours * 3600 * 1000;
        const d = new Date(localMs);
        secondsSinceMidnight = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
      } else {
        secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
      }
      simElapsedRef.current = secondsSinceMidnight;
      prevSysRef.current = Date.now();
      updateHUD();
    }
    initSim();

    function updateHUD() {
      const now = new Date();
      let display;
      if (timeZoneMode === 'utc') {
        display = new Date(now.getTime() + now.getTimezoneOffset() * 60000).toUTCString();
      } else if (timeZoneMode === 'offset') {
        const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
        const localMs = utc.getTime() + offsetHours * 3600 * 1000;
        display = new Date(localMs).toString();
      } else {
        display = now.toString();
      }
      setCurrentTimeString(display);
    }

    function animate() {
      reqRef.current = requestAnimationFrame(animate);
      const nowMs = Date.now();
      const sysDelta = (nowMs - prevSysRef.current) / 1000;
      prevSysRef.current = nowMs;
      simElapsedRef.current += sysDelta * timeScale;

      const secondsInDay = 24 * 3600;
      const totalSeconds = simElapsedRef.current % secondsInDay;
      const s = totalSeconds % 60;
      const minutesF = Math.floor((totalSeconds % 3600) / 60) + (s / 60);
      const hoursF = (totalSeconds / 3600);
      const hours12 = hoursF % 12;

      const twoPi = Math.PI * 2;
      const hourAngle = (hours12 / 12) * twoPi;
      const minuteAngle = (minutesF / 60) * twoPi;
      const secondAngle = (s / 60) * twoPi;

      hourPivot.rotation.y = -hourAngle;
      minutePivot.rotation.y = -minuteAngle;
      secondPivot.rotation.y = -secondAngle;

      hourPlanet.rotation.y += 0.003 * timeScale;
      minuteMoon.rotation.y += 0.01 * timeScale;
      secondDot.rotation.y += 0.02 * timeScale;

      const t = performance.now() * 0.001;
      glowSprite.material.opacity = 0.85 + Math.sin(t * 0.9) * 0.06 * Math.max(1, timeScale);

      controls.update();
      composer.render();

      if (Math.random() < 0.02) updateHUD();
    }
    animate();

    return () => {
      cancelAnimationFrame(reqRef.current);
      window.removeEventListener('resize', onWindowResize);
      mount.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
        if (o.texture) o.texture.dispose && o.texture.dispose();
      });
    };
  }, [timeZoneMode, offsetHours, timeScale]);

  function handleResync() {
    prevSysRef.current = Date.now();
    const now = new Date();
    let secondsSinceMidnight;
    if (timeZoneMode === 'utc') {
      secondsSinceMidnight = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCMilliseconds() / 1000 + now.getUTCSeconds();
    } else if (timeZoneMode === 'offset') {
      const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
      const localMs = utc.getTime() + offsetHours * 3600 * 1000;
      const d = new Date(localMs);
      secondsSinceMidnight = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
    } else {
      secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
    }
    simElapsedRef.current = secondsSinceMidnight;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480, borderRadius: 12, overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 20, padding: 10, borderRadius: 10, background: 'rgba(8,10,20,0.5)', color: '#e8f3ff', fontFamily: 'Inter, system-ui, -apple-system, Roboto, Arial', backdropFilter: 'blur(6px)' }}>
        <div style={{ fontSize: 13, marginBottom: 6 }}>Time zone:</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <select value={timeZoneMode} onChange={(e) => setTimeZoneMode(e.target.value)} style={({ padding: '6px 8px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.04)', color: '#dfefff' })}>
            <option value="local">Local</option>
            <option value="utc">UTC</option>
            <option value="offset">Custom offset</option>
          </select>
          {timeZoneMode === 'offset' && (
            <input type="number" value={offsetHours} onChange={(e) => setOffsetHours(parseFloat(e.target.value) || 0)} style={{ width: 80, padding: '6px 8px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.04)', color: '#dfefff' }} />
          )}
          <button onClick={handleResync} style={{ marginLeft: 6, padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>Resync</button>
        </div>
        <div style={{ fontSize: 13, marginBottom: 6 }}>Time speed: <strong>{timeScale.toFixed(2)}×</strong></div>
        <input type="range" min={0} max={10} step={0.01} value={timeScale} onChange={(e) => setTimeScale(parseFloat(e.target.value))} style={{ width: 220 }} />
        <div style={{ marginTop: 8, fontSize: 12, color: '#b7c7e6' }}>{showHUD ? currentTimeString : ''}</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type='checkbox' checked={showHUD} onChange={(e) => setShowHUD(e.target.checked)} /> Show time</label>
          <button onClick={() => setShowHUD(s => !s)} style={{ padding: '6px 8px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>Toggle HUD</button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#9fb0df' }}>Tip: press Resync when you change timezone or offset.</div>
      </div>
    </div>
);
}
