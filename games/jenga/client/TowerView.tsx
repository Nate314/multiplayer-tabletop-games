import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import * as THREE from 'three';
import { SIMULATION_TICK_MS } from '../../../shared/gameDefinition.ts';
import { BLOCK, LEVELS } from '../physics.ts';
import type { Block, Pose, Vec3 } from '../types.ts';
import { DEFAULT_ORBIT, cameraPosition, orbitBy, zoomBy, type Orbit } from './orbit.ts';
import { throttleDrag } from './pullInput.ts';

type Interactive = {
  canGrab(block: number): boolean;
  onGrab(block: number, anchor: Vec3): void;
  onDrag(target: Vec3): void;
  onRelease(): void;
};

// The preview draws its frames through this, without a React render each frame
export type TowerHandle = { draw(blocks: Block[]): void };

type TowerViewProps = { blocks: Block[]; highlight?: number | null; ghost?: Pose | null; interactive?: Interactive; ref?: Ref<TowerHandle> };
type Drawn = Pick<TowerViewProps, 'blocks' | 'highlight' | 'ghost'>;

const BLOCK_COUNT = LEVELS * 3;
const LOOK_Y = BLOCK.height * LEVELS / 2;
const HALF: Vec3 = [BLOCK.length / 2, BLOCK.height / 2, BLOCK.width / 2];
const WHEEL_ZOOM = 0.001;
const GHOST_OPACITY = 0.35;

// Colors come from the game's CSS so dark mode recolors the tower; the fallbacks keep it drawable without the stylesheet
function themeColors(canvas: HTMLCanvasElement) {
  const style = getComputedStyle(canvas.closest('[data-game="jenga"]') ?? canvas);
  const read = (name: string, fallback: string) => new THREE.Color(style.getPropertyValue(name).trim() || fallback);
  return {
    wood: read('--jenga-wood', '#d9b98a'),
    highlight: read('--jenga-highlight', '#f2a33a'),
    sky: read('--jenga-light', '#ffffff'),
    ground: read('--jenga-shadow', '#6b5a48'),
  };
}

// A small lightness step by id, so neighbours read apart; never grip, which the browser must not learn
const shade = (wood: THREE.Color, id: number) => wood.clone().offsetHSL(0, 0, ((id * 7) % 5 - 2) * 0.025);

const place = (object: THREE.Object3D, pose: Pose) => {
  object.position.set(...pose.p);
  object.quaternion.set(...pose.q);
};

export default function TowerView({ blocks, highlight = null, ghost = null, interactive, ref }: TowerViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<(() => void) | null>(null);
  const drawnRef = useRef<Drawn>({ blocks, highlight, ghost });
  const interactiveRef = useRef(interactive);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);

  useEffect(() => {
    // A fresh canvas per mount: StrictMode remounts, and a canvas whose context was force-lost cannot get a new one
    const canvas = document.createElement('canvas');
    canvas.className = 'jenga-tower';
    canvas.style.touchAction = 'none';
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    containerRef.current!.append(canvas);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      canvas.remove();
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(window.devicePixelRatio);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 400);
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x000000, 2);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(30, 60, 40);
    scene.add(hemisphere, sun);
    const geometry = new THREE.BoxGeometry(BLOCK.length, BLOCK.height, BLOCK.width);
    const meshes = Array.from({ length: BLOCK_COUNT }, () => new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ roughness: 0.8 })));
    const ghostMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ transparent: true, opacity: GHOST_OPACITY, depthWrite: false }));
    scene.add(...meshes, ghostMesh);

    let orbit: Orbit = DEFAULT_ORBIT;
    const render = () => {
      camera.position.set(...cameraPosition(orbit, LOOK_Y));
      camera.lookAt(0, LOOK_Y, 0);
      renderer.render(scene, camera);
    };

    // Read from the CSS only on a theme change, not on every frame
    let colors = themeColors(canvas);
    let shades = meshes.map((_, id) => shade(colors.wood, id));
    const recolor = () => {
      colors = themeColors(canvas);
      shades = meshes.map((_, id) => shade(colors.wood, id));
      paint();
    };

    const paint = () => {
      const { blocks, highlight, ghost } = drawnRef.current;
      hemisphere.color.copy(colors.sky);
      hemisphere.groundColor.copy(colors.ground);
      const shown = new Map(blocks.map(block => [block.id, block]));
      meshes.forEach((mesh, id) => {
        const block = shown.get(id);
        // Blocks taken out of the tower are simply not drawn
        mesh.visible = !!block;
        if (!block) return;
        place(mesh, block.pose);
        mesh.material.color.copy(id === highlight ? colors.highlight : shades[id]);
      });
      ghostMesh.visible = !!ghost;
      if (ghost) {
        place(ghostMesh, ghost);
        ghostMesh.material.color.copy(colors.wood);
      }
      render();
    };
    paintRef.current = paint;
    paint();

    // A light or dark switch changes the CSS colors without any new props
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    dark.addEventListener('change', recolor);
    const theme = new MutationObserver(recolor);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = height ? width / height : 1;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const castFrom = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    };

    // A press on a block that may be pulled grabs it; any other press orbits, and two pointers pinch to zoom
    const pointers = new Map<number, { x: number; y: number }>();
    let pulling: { pointer: number; plane: THREE.Plane; lastSent: number; pending: Vec3 | null; timer: number | null } | null = null;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const sendDrag = (target: Vec3, now: number) => {
      if (!pulling) return;
      pulling.lastSent = now;
      pulling.pending = null;
      interactiveRef.current?.onDrag(target);
    };
    // The last position skipped by the throttle still goes out once the window ends, so the block ends where the pointer stopped
    const flushDrag = () => {
      if (!pulling) return;
      if (pulling.timer !== null) clearTimeout(pulling.timer);
      pulling.timer = null;
      if (pulling.pending) sendDrag(pulling.pending, performance.now());
    };
    const endPull = () => {
      if (!pulling) return;
      flushDrag();
      pulling = null;
      interactiveRef.current?.onRelease();
    };

    const onDown = (event: PointerEvent) => {
      if (pulling || (event.pointerType === 'mouse' && event.button !== 0)) return;
      castFrom(event);
      const hit = raycaster.intersectObjects(meshes.filter(mesh => mesh.visible), false)[0];
      const id = hit ? meshes.indexOf(hit.object as (typeof meshes)[number]) : -1;
      const controls = interactiveRef.current;
      canvas.setPointerCapture(event.pointerId);
      if (hit && controls?.canGrab(id) && pointers.size === 0) {
        const local = hit.object.worldToLocal(hit.point.clone());
        const anchor = local.toArray().map((n, i) => Math.max(-HALF[i], Math.min(HALF[i], n))) as Vec3;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y);
        pulling = { pointer: event.pointerId, plane, lastSent: event.timeStamp, pending: null, timer: null };
        controls.onGrab(id, anchor);
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };

    const onMove = (event: PointerEvent) => {
      if (pulling?.pointer === event.pointerId) {
        castFrom(event);
        const hit = raycaster.ray.intersectPlane(pulling.plane, new THREE.Vector3());
        if (!hit) return;
        const target = hit.toArray();
        if (throttleDrag(pulling.lastSent, event.timeStamp)) return sendDrag(target, event.timeStamp);
        pulling.pending = target;
        pulling.timer ??= window.setTimeout(flushDrag, SIMULATION_TICK_MS - (event.timeStamp - pulling.lastSent));
        return;
      }
      const last = pointers.get(event.pointerId);
      if (!last) return;
      if (pointers.size === 2) {
        const before = spread();
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const after = spread();
        if (before > 0 && after > 0) orbit = zoomBy(orbit, before / after);
      } else {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        orbit = orbitBy(orbit, event.clientX - last.x, event.clientY - last.y);
      }
      render();
    };

    const onUp = (event: PointerEvent) => {
      if (pulling?.pointer === event.pointerId) endPull();
      pointers.delete(event.pointerId);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      orbit = zoomBy(orbit, Math.exp(event.deltaY * WHEEL_ZOOM));
      render();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    // Capture can end without a pointerup (the pointer leaves the window, the OS takes it)
    canvas.addEventListener('lostpointercapture', onUp);
    // Not passive, so the wheel zooms the tower instead of scrolling the page
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      // Unmounting mid-drag must not leave the server holding the grab
      endPull();
      dark.removeEventListener('change', recolor);
      theme.disconnect();
      observer.disconnect();
      geometry.dispose();
      for (const mesh of [...meshes, ghostMesh]) mesh.material.dispose();
      renderer.dispose();
      // History mounts one view per step, and browsers cap live WebGL contexts
      renderer.forceContextLoss();
      canvas.remove();
      paintRef.current = null;
    };
  }, []);

  useEffect(() => {
    drawnRef.current = { blocks, highlight, ghost };
    paintRef.current?.();
  }, [blocks, highlight, ghost]);

  useImperativeHandle(ref, () => ({
    draw(blocks: Block[]) {
      drawnRef.current = { ...drawnRef.current, blocks };
      paintRef.current?.();
    }
  }), []);

  if (failed) return <p className="jenga-no-webgl">This device cannot draw the 3D tower</p>;
  return <div ref={containerRef} />;
}
