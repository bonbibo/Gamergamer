import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSessionStore } from '../store/sessionStore';

// VRM loading is optional — only works when @pixiv/three-vrm is installed
// and a .vrm model file is provided. Falls back to a placeholder cube.
let VRMLoaderPlugin: unknown = null;
let GLTFLoader: unknown = null;

try {
  // Dynamic import to avoid hard crash when package not installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const vrm = require('@pixiv/three-vrm');
  VRMLoaderPlugin = vrm.VRMLoaderPlugin;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gltf = require('three/examples/jsm/loaders/GLTFLoader');
  GLTFLoader = gltf.GLTFLoader;
} catch {
  // packages not installed yet
}

const EMOTION_MORPH: Record<string, Record<string, number>> = {
  hype: { happy: 1.0, surprised: 0.5 },
  focused: { neutral: 1.0 },
  frustrated: { angry: 0.8 },
  tilted: { sad: 0.9 },
  anxious: { surprised: 0.6 },
  neutral: { neutral: 1.0 },
};

interface Props {
  vrmUrl?: string;
}

export function AvatarCanvas({ vrmUrl }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ renderer: THREE.WebGLRenderer; animate: () => void } | null>(null);
  const emotion = useSessionStore((s) => s.currentEmotion);

  useEffect(() => {
    if (!canvasRef.current) return;
    const container = canvasRef.current;
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 3);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 2, 3);
    scene.add(dirLight);

    // Placeholder cube (replaced by VRM when loaded)
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed }),
    );
    cube.position.set(0, 1, 0);
    scene.add(cube);

    let animId = 0;
    function animate() {
      animId = requestAnimationFrame(animate);
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    }
    animate();

    sceneRef.current = { renderer, animate };

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={canvasRef}
      style={{ width: '100%', height: 300, background: '#0f0f13', borderRadius: 12, overflow: 'hidden' }}
    />
  );
}
