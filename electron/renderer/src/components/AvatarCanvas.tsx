import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSessionStore } from '../store/sessionStore';

// ─── Optional VRM packages (may not be installed yet) ───────────────────────
let VRMLoaderPlugin: unknown = null;
let GLTFLoader: unknown = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vrmPkg = require('@pixiv/three-vrm');
  VRMLoaderPlugin = vrmPkg.VRMLoaderPlugin;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gltfPkg = require('three/examples/jsm/loaders/GLTFLoader');
  GLTFLoader = gltfPkg.GLTFLoader;
} catch {
  // packages not installed — placeholder only mode
}

// ─── Emotion → Three.js hex color ───────────────────────────────────────────
const EMOTION_COLOR: Record<string, number> = {
  hype:       0xf59e0b,
  focused:    0x3b82f6,
  frustrated: 0xef4444,
  tilted:     0x8b5cf6,
  anxious:    0xf97316,
  neutral:    0x7c3aed,
};

// ─── Emotion → VRM expression names (VRM 1.0 / UniVRM) ──────────────────────
const EMOTION_EXPRESSION: Record<string, Record<string, number>> = {
  hype:       { happy: 1.0, surprised: 0.4 },
  focused:    { neutral: 1.0 },
  frustrated: { angry: 0.8 },
  tilted:     { sad: 0.9 },
  anxious:    { surprised: 0.6 },
  neutral:    { neutral: 1.0 },
};

interface Props {
  vrmUrl?: string;
}

export function AvatarCanvas({ vrmUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    animId: number;
    cubeMaterial: THREE.MeshStandardMaterial;
    vrm: unknown | null;
  } | null>(null);
  const emotion = useSessionStore((s) => s.currentEmotion);

  // ── Scene setup (run once) ──────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = 300;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f13);

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 3);
    camera.lookAt(0, 1, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(1, 2, 3);
    scene.add(dirLight);

    // Placeholder rotating cube (replaced by VRM when loaded)
    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: EMOTION_COLOR['neutral'],
      roughness: 0.3,
      metalness: 0.2,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), cubeMaterial);
    cube.position.set(0, 1, 0);
    scene.add(cube);

    let vrm: unknown = null;

    // Animate
    let animId = 0;
    const clock = new THREE.Clock();
    function animate() {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      cube.rotation.y += 0.8 * delta;
      cube.rotation.x += 0.3 * delta;
      // Pulse scale based on emotion
      const s = 1 + 0.05 * Math.sin(clock.getElapsedTime() * 3);
      cube.scale.set(s, s, s);
      renderer.render(scene, camera);
    }
    animate();

    stateRef.current = { renderer, animId, cubeMaterial, vrm: null };

    // Load VRM if URL provided
    if (vrmUrl && GLTFLoader && VRMLoaderPlugin) {
      const loader = new (GLTFLoader as new () => { register: (cb: unknown) => void; load: (url: string, onLoad: (g: unknown) => void, onProgress?: unknown, onError?: (e: Error) => void) => void })();
      loader.register((parser: unknown) => new (VRMLoaderPlugin as new (parser: unknown) => unknown)(parser));
      loader.load(
        vrmUrl,
        (gltf: { userData: { vrm: unknown } }) => {
          vrm = gltf.userData.vrm;
          scene.add(gltf as unknown as THREE.Object3D);
          cube.visible = false;
          if (stateRef.current) stateRef.current.vrm = vrm;
        },
        undefined,
        (err: Error) => logger.warn('VRM load failed:', err),
      );
    }

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [vrmUrl]);

  // ── React to emotion changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!stateRef.current) return;
    const { cubeMaterial, vrm } = stateRef.current;
    const key = emotion ?? 'neutral';
    const hex = EMOTION_COLOR[key] ?? EMOTION_COLOR['neutral'];

    // Update placeholder cube color
    cubeMaterial.color.setHex(hex);

    // Apply VRM blend shapes / expressions
    if (vrm) {
      const expressions = EMOTION_EXPRESSION[key] ?? {};
      const allExpNames = ['happy', 'sad', 'angry', 'surprised', 'neutral'];
      const vrmAny = vrm as Record<string, unknown>;

      // Try VRM 1.0 expressionManager
      if (vrmAny.expressionManager) {
        const em = vrmAny.expressionManager as { setValue: (name: string, v: number) => void };
        allExpNames.forEach((n) => em.setValue(n, expressions[n] ?? 0));
      }
      // Try VRM 0.x blendShapeProxy
      if (vrmAny.blendShapeProxy) {
        const bp = vrmAny.blendShapeProxy as { setValue: (name: string, v: number) => void };
        allExpNames.forEach((n) => bp.setValue(n.toUpperCase(), expressions[n] ?? 0));
      }
    }
  }, [emotion]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: 300, borderRadius: 12, overflow: 'hidden' }}
      />
      {emotion && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '3px 12px',
          color: `#${(EMOTION_COLOR[emotion] ?? EMOTION_COLOR['neutral']).toString(16).padStart(6, '0')}`,
          fontSize: 12, fontWeight: 700, letterSpacing: 1,
        }}>
          {emotion.toUpperCase()}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const logger = { warn: (...args: any[]) => console.warn('[AvatarCanvas]', ...args) };
