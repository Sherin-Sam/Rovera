import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Telemetry } from "./types";
import { buildObject, buildGround, mesh } from "./worldScene";
export default function SimulationView({
  data,
  mask,
  features,
}: {
  data: Telemetry;
  mask: boolean;
  features: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef({ data, mask, features });
  current.current = { data, mask, features };
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      el.textContent =
        "3D renderer unavailable. Follow the rover in the spatial map.";
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    const world = current.current.data.world,
      scene = new THREE.Scene();
    const sky = world?.sky || "#bdcfc9";
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, 20, 60);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
    const ambient = new THREE.HemisphereLight("#e7eff0", "#657554", 2);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight("#fff0d4", 3);
    sun.position.set(-9, 24, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    const groundTexture = buildGround(scene, world);
    for (let i = 0; i < 28; i++) {
      const angle = i * 2.399,
        r = 19 + (i % 6);
      scene.add(
        buildObject({
          id: "background-" + i,
          kind: "tree",
          x: 10 + Math.cos(angle) * r,
          y: 10 + Math.sin(angle) * r,
          radius: 0.8 + (i % 3) * 0.15,
          height: 4 + (i % 4) * 0.45,
          color: "#557749",
        }),
      );
    }
    const base = current.current.data.base || [2, 2];
    const pad = mesh(
      scene,
      new THREE.CylinderGeometry(0.85, 0.85, 0.035, 40),
      "#637d82",
      base[0],
      0.035,
      base[1],
    );
    pad.castShadow = false;
    for (const x of [-0.27, 0.27])
      mesh(
        scene,
        new THREE.BoxGeometry(0.08, 0.01, 0.65),
        "#d9eff0",
        base[0] + x,
        0.06,
        base[1],
      );
    mesh(
      scene,
      new THREE.BoxGeometry(0.54, 0.01, 0.08),
      "#d9eff0",
      base[0],
      0.06,
      base[1],
    );
    const grid = new THREE.GridHelper(40, 40, "#bcd9c5", "#a4c9b0");
    grid.position.set(10, 0.045, 10);
    const gm = grid.material as THREE.Material;
    gm.transparent = true;
    gm.opacity = 0.17;
    scene.add(grid);
    const objects = new Map<string, THREE.Group>(),
      tags = new Map<string, HTMLDivElement>();
    let line: THREE.Line | undefined,
      lineKey = "";
    const resize = new ResizeObserver(() => {
      if (el.clientWidth && el.clientHeight) {
        renderer.setSize(el.clientWidth, el.clientHeight);
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
      }
    });
    resize.observe(el);
    const dispose = (object: THREE.Object3D) =>
      object.traverse((child) => {
        const m = child as THREE.Mesh;
        m.geometry?.dispose();
        if (m.material)
          for (const material of Array.isArray(m.material)
            ? m.material
            : [m.material])
            material.dispose();
      });
    let raf = 0,
      last = 0;
    const render = (timestamp: number) => {
      raf = requestAnimationFrame(render);
      if (timestamp - last < 33) return;
      last = timestamp;
      const { data: d, mask: m, features: f } = current.current;
      for (const o of d.obstacles) {
        if (!objects.has(o.id)) {
          const g = buildObject(o);
          objects.set(o.id, g);
          scene.add(g);
        }
      }
      for (const [id, object] of objects) {
        if (!d.obstacles.some((o) => o.id === id)) {
          scene.remove(object);
          dispose(object);
          objects.delete(id);
        }
      }
      const routeKey = JSON.stringify(d.route) + d.returning_to_base;
      if (routeKey !== lineKey) {
        lineKey = routeKey;
        if (line) {
          scene.remove(line);
          dispose(line);
        }
        line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(
            d.route.map((p) => new THREE.Vector3(p[0], 0.1, p[1])),
          ),
          new THREE.LineBasicMaterial({
            color: d.returning_to_base ? "#8cd7ff" : "#99ffc0",
          }),
        );
        scene.add(line);
      }
      if (line) line.visible = m;
      grid.visible = f;
      const yaw = (d.pose.yaw * Math.PI) / 180;
      camera.position.set(d.pose.x, 1.25, d.pose.y);
      camera.lookAt(
        d.pose.x + Math.cos(yaw) * 10,
        0.9,
        d.pose.y + Math.sin(yaw) * 10,
      );
      camera.updateMatrixWorld();
      renderer.toneMappingExposure =
        d.fault === "low_light" ? 0.43 : d.fault === "glare" ? 2.1 : 1.15;
      renderer.render(scene, camera);
      const seen = new Set<string>();
      for (const detection of d.detections || []) {
        const object = objects.get(detection.id);
        if (!object) continue;
        const box = new THREE.Box3().setFromObject(object),
          pts = [];
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z])
              pts.push(new THREE.Vector3(x, y, z).project(camera));
        if (pts.some((p) => p.z < 0 || p.z > 1)) continue;
        const left = Math.max(
            0,
            Math.min(...pts.map((p) => ((p.x + 1) * el.clientWidth) / 2)),
          ),
          right = Math.min(
            el.clientWidth,
            Math.max(...pts.map((p) => ((p.x + 1) * el.clientWidth) / 2)),
          ),
          top = Math.max(
            44,
            Math.min(...pts.map((p) => ((1 - p.y) * el.clientHeight) / 2)),
          ),
          bottom = Math.min(
            el.clientHeight - 32,
            Math.max(...pts.map((p) => ((1 - p.y) * el.clientHeight) / 2)),
          );
        if (right - left < 4 || bottom - top < 4) continue;
        seen.add(detection.id);
        let tag = tags.get(detection.id);
        if (!tag) {
          tag = document.createElement("div");
          tag.className = "object-track";
          const caption = document.createElement("span");
          tag.appendChild(caption);
          el.appendChild(tag);
          tags.set(detection.id, tag);
        }
        tag.style.left = left + "px";
        tag.style.top = top + "px";
        tag.style.width = right - left + "px";
        tag.style.height = bottom - top + "px";
        tag.style.display = "block";
        tag.dataset.risk = detection.risk || "high";
        tag.firstElementChild!.textContent = `${detection.label || detection.kind} · ${detection.id} | ${detection.distance_m.toFixed(1)} m`;
      }
      for (const [id, tag] of tags)
        if (!seen.has(id)) tag.style.display = "none";
    };
    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      dispose(scene);
      groundTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      for (const tag of tags.values()) tag.remove();
    };
  }, [data.world?.id]);
  return <div className="simulation-render" ref={host} />;
}
