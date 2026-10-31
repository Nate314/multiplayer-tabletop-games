import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import * as THREE from 'three';
import { SIMULATION_TICK_MS } from '../../../shared/gameDefinition.ts';
import { BLOCK, IDENTITY, LEVELS, TURNTABLE, toTable } from '../physics.ts';
import { dropInReach, freeDropPose, placementTargets } from '../rules.ts';
import type { Block, Pose, Quat, Slot, Vec3 } from '../types.ts';
import { DEFAULT_ORBIT, cameraPosition, dragView, spinSpeed, tiltBy, zoomBy, type Orbit } from './orbit.ts';
import { restPose, snapSlot } from './placeInput.ts';
import { throttleDrag } from './pullInput.ts';

type Interactive = {
  canGrab(block: number): boolean;
  onGrab(block: number, anchor: Vec3): void;
  onDrag(target: Vec3): void;
  onRelease(): void;
  // The pulled block came out under the pointer; the server has already ended the grab, so nothing is sent
  onCarry(): void;
  onTurn(speed: number | null): void;
  onPlace(slot: Slot): void;
  onDrop(at: [number, number]): void;
};

// The held block, yours to place; ready is false while the tower still settles
type Carry = { block: number; free: boolean; ready: boolean };
// A pointer position on the page, kept so a carry can be redone without a new event
type At = { clientX: number; clientY: number };

// The preview draws its frames through this, without a React render each frame
export type TowerHandle = { draw(blocks: Block[], turntable?: Quat): void; camera(): Orbit; setCamera(orbit: Orbit): void };

// turning: dragging empty space turns the turntable instead of swinging the camera round
type TowerViewProps = {
  blocks: Block[]; turntable?: Quat; highlight?: number | null; ghost?: Pose | null; interactive?: Interactive; turning?: boolean;
  carry?: Carry | null; ref?: Ref<TowerHandle>;
};
type Drawn = Required<Pick<TowerViewProps, 'blocks' | 'turntable' | 'highlight' | 'ghost'>>;

const BLOCK_COUNT = LEVELS * 3;
const LOOK_Y = BLOCK.height * LEVELS / 2;
const HALF: Vec3 = [BLOCK.length / 2, BLOCK.height / 2, BLOCK.width / 2];
const WHEEL_ZOOM = 0.001;
const GHOST_OPACITY = 0.35;
const MARK = { width: 0.25, height: 0.04, tick: 1, front: 2 };
// The rim ticks sit between the front and the sides, so the front mark stands alone
const TICK_ANGLES = [1, 3, 5, 7].map(n => n * Math.PI / 4);

// Colors come from the game's CSS so dark mode recolors the tower; the fallbacks keep it drawable without the stylesheet
function themeColors(canvas: HTMLCanvasElement) {
  const style = getComputedStyle(canvas.closest('[data-game="jenga"]') ?? canvas);
  const read = (name: string, fallback: string) => new THREE.Color(style.getPropertyValue(name).trim() || fallback);
  return {
    wood: read('--jenga-wood', '#d9b98a'),
    highlight: read('--jenga-highlight', '#f2a33a'),
    sky: read('--jenga-light', '#ffffff'),
    ground: read('--jenga-shadow', '#6b5a48'),
    turntable: read('--jenga-turntable', '#6f5640'),
    mark: read('--jenga-mark', '#eadbc4'),
  };
}

// A small lightness step by id, so neighbours read apart; never grip, which the browser must not learn
const shade = (wood: THREE.Color, id: number) => wood.clone().offsetHSL(0, 0, ((id * 7) % 5 - 2) * 0.025);

const place = (object: THREE.Object3D, pose: Pose) => {
  object.position.set(...pose.p);
  object.quaternion.set(...pose.q);
};

// A mark lying on the turntable's top, running in from the rim along the direction `angle` about +Y from the front
function rimMark(geometry: THREE.BoxGeometry, material: THREE.Material, length: number, angle: number) {
  const mark = new THREE.Mesh(geometry, material);
  const r = TURNTABLE.radius - length / 2;
  mark.position.set(r * Math.sin(angle), MARK.height / 2, r * Math.cos(angle));
  mark.rotation.y = angle;
  return mark;
}

export default function TowerView({ blocks, turntable = IDENTITY, highlight = null, ghost = null, interactive, turning = false, carry = null, ref }: TowerViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paintRef = useRef<(() => void) | null>(null);
  const drawnRef = useRef<Drawn>({ blocks, turntable, highlight, ghost });
  const interactiveRef = useRef(interactive);
  const turningRef = useRef(turning);
  const carryRef = useRef(carry);
  const carryChangedRef = useRef<(() => void) | null>(null);
  const orbitRef = useRef<Orbit>(DEFAULT_ORBIT);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    interactiveRef.current = interactive;
    turningRef.current = turning;
  }, [interactive, turning]);

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

    // The disc, its top at y = 0, and its rim marks turn together as one group
    const discGeometry = new THREE.CylinderGeometry(TURNTABLE.radius, TURNTABLE.radius, TURNTABLE.height, 64);
    const tickGeometry = new THREE.BoxGeometry(MARK.width, MARK.height, MARK.tick);
    const frontGeometry = new THREE.BoxGeometry(MARK.width, MARK.height, MARK.front);
    const discMaterial = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const markMaterial = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const frontMaterial = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const disc = new THREE.Mesh(discGeometry, discMaterial);
    disc.position.y = -TURNTABLE.height / 2;
    const table = new THREE.Group();
    table.add(disc, ...TICK_ANGLES.map(angle => rimMark(tickGeometry, markMaterial, MARK.tick, angle)), rimMark(frontGeometry, frontMaterial, MARK.front, 0));
    scene.add(table);

    const render = () => {
      camera.position.set(...cameraPosition(orbitRef.current, LOOK_Y));
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

    // Where the held block is drawn while carried or let go onto the tower; null lies it at rest
    let heldPose: Pose | null = null;
    const paint = () => {
      const { blocks, turntable, highlight, ghost } = drawnRef.current;
      hemisphere.color.copy(colors.sky);
      hemisphere.groundColor.copy(colors.ground);
      table.quaternion.set(...turntable);
      discMaterial.color.copy(colors.turntable);
      markMaterial.color.copy(colors.mark);
      frontMaterial.color.copy(colors.highlight);
      const shown = new Map(blocks.map(block => [block.id, block]));
      meshes.forEach((mesh, id) => {
        const block = shown.get(id);
        // Blocks taken out of the tower are simply not drawn
        mesh.visible = !!block;
        if (!block) return;
        place(mesh, block.pose);
        mesh.material.color.copy(id === highlight ? colors.highlight : shades[id]);
      });
      // The held block is out of the tower, so it is drawn where it is carried, or lying at rest
      const carried = carryRef.current;
      if (carried && !shown.has(carried.block)) {
        const mesh = meshes[carried.block];
        mesh.visible = true;
        place(mesh, heldPose ?? restPose(orbitRef.current.yaw));
        mesh.material.color.copy(colors.highlight);
      }
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
    const castFrom = (event: At) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
    };

    // A press on a block that may be pulled grabs it; any other press orbits (or turns the turntable), and two pointers pinch to zoom
    const pointers = new Map<number, { x: number; y: number }>();
    let pulling: { pointer: number; plane: THREE.Plane; lastSent: number; pending: Vec3 | null; timer: number | null } | null = null;
    // dx is dragged since `since`; sent is the last speed sent, null before the first
    let spin: { pointer: number; dx: number; since: number; lastSent: number; sent: number | null; timer: number | null } | null = null;
    // at is the table-frame point a free drop would go to, null when not over the tower; placed once a snap has sent the place;
    // last is the pointer's last position, so a carry turning ready can snap without a move
    let carrying: { pointer: number; at: [number, number] | null; placed: boolean; last: At | null } | null = null;
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

    const sendSpin = (now: number) => {
      if (!spin) return;
      const speed = spinSpeed(spin.dx, now - spin.since);
      spin.dx = 0;
      spin.since = now;
      spin.lastSent = now;
      // A press that has not moved sends nothing, since any speed claims the turn
      if (speed !== spin.sent && (spin.sent !== null || speed !== 0)) {
        spin.sent = speed;
        interactiveRef.current?.onTurn(speed);
      }
      // A finger held still sends no moves, so one more window brings the speed down to 0
      if (spin.sent) spin.timer ??= window.setTimeout(flushSpin, SIMULATION_TICK_MS);
    };
    const flushSpin = () => {
      if (!spin) return;
      spin.timer = null;
      sendSpin(performance.now());
    };
    const endSpin = () => {
      if (!spin) return;
      if (spin.timer !== null) clearTimeout(spin.timer);
      if (spin.sent !== null) interactiveRef.current?.onTurn(null);
      spin = null;
    };
    // Throttled like drags, the last speed skipped still going out once the window ends
    const spinBy = (dx: number, now: number) => {
      if (!spin) return;
      spin.dx += dx;
      if (!throttleDrag(spin.lastSent, now)) {
        spin.timer ??= window.setTimeout(flushSpin, SIMULATION_TICK_MS - (now - spin.lastSent));
        return;
      }
      if (spin.timer !== null) clearTimeout(spin.timer);
      spin.timer = null;
      sendSpin(now);
    };

    const screenOf = (p: Vec3, rect: DOMRect) => {
      const v = new THREE.Vector3(...p).project(camera);
      return { x: (v.x + 1) / 2 * rect.width, y: (1 - v.y) / 2 * rect.height };
    };

    // Only previews and requests: the server decides where the block ends up
    const carryTo = (event: At) => {
      const carried = carryRef.current;
      if (!carrying || !carried || carrying.placed) return;
      carrying.last = { clientX: event.clientX, clientY: event.clientY };
      castFrom(event);
      const { blocks, turntable } = drawnRef.current;
      const drop = freeDropPose(blocks, turntable, [0, 0]);
      carrying.at = null;
      if (carried.free) {
        const hit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -drop.p[1]), new THREE.Vector3());
        const [x, , z] = hit ? toTable({ p: hit.toArray(), q: IDENTITY }, turntable).p : [Infinity, 0, Infinity];
        const at: [number, number] = [x, z];
        if (dropInReach(at)) {
          carrying.at = at;
          heldPose = freeDropPose(blocks, turntable, at);
          return paint();
        }
      } else if (carried.ready) {
        const rect = canvas.getBoundingClientRect();
        const targets = placementTargets(blocks, turntable);
        const slot = snapSlot({ x: event.clientX - rect.left, y: event.clientY - rect.top }, targets.map(t => ({ slot: t.slot, ...screenOf(t.pose.p, rect) })));
        if (slot !== null) {
          carrying.placed = true;
          heldPose = targets.find(t => t.slot === slot)!.pose;
          paint();
          interactiveRef.current?.onPlace(slot);
          return;
        }
      }
      // Elsewhere it follows the pointer on the upright plane through the tower's axis, facing the camera
      const { yaw } = orbitRef.current;
      const hit = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), 0), new THREE.Vector3());
      if (hit) heldPose = { p: hit.toArray(), q: drop.q };
      paint();
    };
    const endCarry = () => {
      if (!carrying) return;
      const { at, placed } = carrying;
      carrying = null;
      const carried = carryRef.current;
      if (placed) return;
      // The block stays drawn over the tower until the server's state shows it falling
      if (at && carried?.free && carried.ready) return interactiveRef.current?.onDrop(at);
      heldPose = null;
      paint();
    };
    carryChangedRef.current = () => {
      const carried = carryRef.current;
      if (!carried) {
        carrying = null;
        heldPose = null;
      } else if (pulling && !carrying) {
        // The block came out under the pointer, so the same press carries on from where it was last drawn
        const { pointer, timer } = pulling;
        if (timer !== null) clearTimeout(timer);
        pulling = null;
        interactiveRef.current?.onCarry();
        const mesh = meshes[carried.block];
        heldPose = { p: mesh.position.toArray(), q: mesh.quaternion.toArray() as Quat };
        carrying = { pointer, at: null, placed: false, last: null };
      } else if (carrying?.last) {
        // ready may have just turned true with the pointer resting over a slot
        return carryTo(carrying.last);
      }
      paint();
    };

    const onDown = (event: PointerEvent) => {
      if (pulling || carrying || (event.pointerType === 'mouse' && event.button !== 0)) return;
      castFrom(event);
      const hit = raycaster.intersectObjects(meshes.filter(mesh => mesh.visible), false)[0];
      const id = hit ? meshes.indexOf(hit.object as (typeof meshes)[number]) : -1;
      const controls = interactiveRef.current;
      canvas.setPointerCapture(event.pointerId);
      if (hit && id === carryRef.current?.block && pointers.size === 0) {
        carrying = { pointer: event.pointerId, at: null, placed: false, last: null };
        carryTo(event);
        return;
      }
      if (hit && controls?.canGrab(id) && pointers.size === 0) {
        const local = hit.object.worldToLocal(hit.point.clone());
        const anchor = local.toArray().map((n, i) => Math.max(-HALF[i], Math.min(HALF[i], n))) as Vec3;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y);
        pulling = { pointer: event.pointerId, plane, lastSent: event.timeStamp, pending: null, timer: null };
        controls.onGrab(id, anchor);
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      // A second finger pinches instead, letting go of the turntable
      if (pointers.size === 1 && turningRef.current) {
        spin = { pointer: event.pointerId, dx: 0, since: event.timeStamp, lastSent: -Infinity, sent: null, timer: null };
      } else {
        endSpin();
      }
    };

    const onMove = (event: PointerEvent) => {
      if (carrying?.pointer === event.pointerId) return carryTo(event);
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
        if (before > 0 && after > 0) orbitRef.current = zoomBy(orbitRef.current, before / after);
      } else if (spin?.pointer === event.pointerId) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        orbitRef.current = tiltBy(orbitRef.current, event.clientY - last.y);
        spinBy(event.clientX - last.x, event.timeStamp);
      } else {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        // A finger left over from a pinch on your turn has no spin, and must still not swing the view round
        orbitRef.current = dragView(orbitRef.current, event.clientX - last.x, event.clientY - last.y, turningRef.current);
      }
      render();
    };

    const onUp = (event: PointerEvent) => {
      if (pulling?.pointer === event.pointerId) endPull();
      if (carrying?.pointer === event.pointerId) endCarry();
      if (spin?.pointer === event.pointerId) endSpin();
      pointers.delete(event.pointerId);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      orbitRef.current = zoomBy(orbitRef.current, Math.exp(event.deltaY * WHEEL_ZOOM));
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
      // Unmounting mid-drag must not leave the server holding the grab or driving the turntable
      endPull();
      endSpin();
      dark.removeEventListener('change', recolor);
      theme.disconnect();
      observer.disconnect();
      for (const shape of [geometry, discGeometry, tickGeometry, frontGeometry]) shape.dispose();
      for (const material of [...meshes.map(mesh => mesh.material), ghostMesh.material, discMaterial, markMaterial, frontMaterial]) material.dispose();
      renderer.dispose();
      // History mounts one view per step, and browsers cap live WebGL contexts
      renderer.forceContextLoss();
      canvas.remove();
      paintRef.current = null;
      carryChangedRef.current = null;
    };
  }, []);

  useEffect(() => {
    carryRef.current = carry;
    carryChangedRef.current?.();
  }, [carry]);

  useEffect(() => {
    drawnRef.current = { blocks, turntable, highlight, ghost };
    paintRef.current?.();
  }, [blocks, turntable, highlight, ghost]);

  useImperativeHandle(ref, () => ({
    draw(blocks: Block[], turntable?: Quat) {
      drawnRef.current = { ...drawnRef.current, blocks, turntable: turntable ?? drawnRef.current.turntable };
      paintRef.current?.();
    },
    camera: () => orbitRef.current,
    setCamera(orbit: Orbit) {
      orbitRef.current = orbit;
      paintRef.current?.();
    }
  }), []);

  if (failed) return <p className="jenga-no-webgl">This device cannot draw the 3D tower</p>;
  return <div ref={containerRef} data-block-count={blocks.length} />;
}
