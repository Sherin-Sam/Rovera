import * as THREE from "three";
import type { Obstacle, World } from "./types";
export const surfaceColors: Record<string, string> = {
  road: "#777d79",
  trail: "#a39475",
  paving: "#8b948d",
  grass: "#597753",
  gravel: "#ac9e82",
};
export function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  color: string,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.86 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function buildObject(o: Obstacle) {
  const g = new THREE.Group();
  g.position.set(o.x, 0, o.y);
  const c = o.color || "#8b9085",
    h = o.height || 1,
    r = o.radius;
  if (o.kind === "tree") {
    mesh(
      g,
      new THREE.CylinderGeometry(0.12, 0.23, h * 0.7, 9),
      "#6a5944",
      0,
      h * 0.35,
      0,
    );
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.4;
      const crown = mesh(
        g,
        new THREE.IcosahedronGeometry(r * (i === 0 ? 1 : 0.72), 2),
        i % 2 ? "#4d7249" : "#608651",
        Math.cos(angle) * r * 0.35,
        h * 0.57 + i * 0.27,
        Math.sin(angle) * r * 0.35,
      );
      crown.scale.y = 1.15;
    }
  } else if (o.kind === "vehicle") {
    const w = o.width || 1.7,
      l = o.length || 3.2;
    mesh(g, new THREE.BoxGeometry(w, 0.65, l), c, 0, 0.7, 0);
    mesh(
      g,
      new THREE.BoxGeometry(w * 0.82, 0.6, l * 0.52),
      "#344c55",
      0,
      1.25,
      -0.1,
    );
    mesh(g, new THREE.BoxGeometry(w * 0.84, 0.06, l * 0.54), c, 0, 1.56, -0.1);
    for (const side of [-1, 1])
      for (const axle of [-1, 1]) {
        const wheel = mesh(
          g,
          new THREE.CylinderGeometry(0.31, 0.31, 0.2, 16),
          "#292d2d",
          side * w * 0.48,
          0.33,
          axle * l * 0.32,
        );
        wheel.rotation.z = Math.PI / 2;
      }
    for (const side of [-1, 1])
      mesh(
        g,
        new THREE.BoxGeometry(0.28, 0.16, 0.05),
        "#f9e9b7",
        side * w * 0.3,
        0.79,
        l / 2 + 0.02,
      );
  } else if (o.kind === "pedestrian") {
    for (const side of [-1, 1]) {
      mesh(
        g,
        new THREE.CylinderGeometry(0.075, 0.09, 0.75, 10),
        "#425364",
        side * 0.12,
        0.4,
        0,
      );
      mesh(
        g,
        new THREE.BoxGeometry(0.16, 0.1, 0.29),
        "#303735",
        side * 0.12,
        0.06,
        0.05,
      );
      const arm = mesh(
        g,
        new THREE.CylinderGeometry(0.065, 0.075, 0.55, 8),
        c,
        side * 0.25,
        1.05,
        0,
      );
      arm.rotation.z = side * 0.12;
    }
    mesh(g, new THREE.CylinderGeometry(0.21, 0.17, 0.58, 12), c, 0, 1.07, 0);
    mesh(g, new THREE.SphereGeometry(0.145, 16, 12), "#c59f7d", 0, 1.55, 0);
    mesh(
      g,
      new THREE.SphereGeometry(0.153, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      "#f7dc8d",
      0,
      1.56,
      0,
    );
    mesh(g, new THREE.BoxGeometry(0.39, 0.07, 0.3), "#e2e4cd", 0, 1.07, 0.015);
  } else if (o.kind === "cone") {
    mesh(g, new THREE.BoxGeometry(0.46, 0.07, 0.46), "#353833", 0, 0.035, 0);
    mesh(g, new THREE.ConeGeometry(0.21, 0.59, 16), c, 0, 0.36, 0);
    mesh(
      g,
      new THREE.CylinderGeometry(0.1, 0.135, 0.1, 16),
      "#f1f0df",
      0,
      0.37,
      0,
    );
  } else if (o.kind === "barrier") {
    mesh(g, new THREE.BoxGeometry(o.width || 2.3, 0.65, 0.35), c, 0, 0.65, 0);
    for (let i = -2; i <= 2; i++) {
      const strip = mesh(
        g,
        new THREE.BoxGeometry(0.18, 0.65, 0.36),
        "#eae8d5",
        i * 0.43,
        0.65,
        0,
      );
      strip.rotation.z = -0.35;
    }
    for (const x of [-0.8, 0.8])
      mesh(g, new THREE.BoxGeometry(0.16, 0.6, 0.48), "#535a55", x, 0.3, 0);
  } else if (o.kind === "crate") {
    mesh(
      g,
      new THREE.BoxGeometry(o.width || 1.3, h, o.length || 1.3),
      c,
      0,
      h / 2,
      0,
    );
    for (const y of [0.12, h - 0.12])
      for (const z of [-0.66, 0.66])
        mesh(g, new THREE.BoxGeometry(1.32, 0.12, 0.045), "#675643", 0, y, z);
    for (const x of [-0.5, 0.5])
      mesh(g, new THREE.BoxGeometry(0.1, h, 0.04), "#675643", x, h / 2, 0.67);
  } else if (o.kind === "building") {
    const w = o.width || 3,
      l = o.length || 3;
    mesh(g, new THREE.BoxGeometry(w, h, l), c, 0, h / 2, 0);
    mesh(
      g,
      new THREE.BoxGeometry(w + 0.18, 0.18, l + 0.18),
      "#58635e",
      0,
      h + 0.09,
      0,
    );
    for (const y of [1.3, 2.8])
      for (const x of [-0.85, 0.85])
        mesh(
          g,
          new THREE.BoxGeometry(0.62, 0.72, 0.025),
          "#42606a",
          x,
          y,
          l / 2 + 0.02,
        );
    mesh(
      g,
      new THREE.BoxGeometry(0.66, 1.8, 0.03),
      "#52625c",
      0,
      0.9,
      l / 2 + 0.025,
    );
  } else if (o.kind === "pothole" || o.kind === "water") {
    const depression = mesh(g, new THREE.CircleGeometry(r, 32), c, 0, 0.045, 0);
    depression.rotation.x = -Math.PI / 2;
    if (o.kind === "water") {
      const material = depression.material as THREE.MeshStandardMaterial;
      material.roughness = 0.18;
      material.metalness = 0.35;
    } else {
      const ring = mesh(
        g,
        new THREE.RingGeometry(r * 0.8, r, 20),
        "#807464",
        0,
        0.05,
        0,
      );
      ring.rotation.x = -Math.PI / 2;
    }
  } else {
    const rock = mesh(
      g,
      new THREE.DodecahedronGeometry(r, 1),
      c,
      0,
      r * 0.4,
      0,
    );
    rock.scale.set(1, 0.64, 0.85);
    rock.rotation.y = o.x * 0.7;
  }
  return g;
}
export function buildGround(scene: THREE.Scene, world?: World) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = world?.ground || "#7d8866";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4500; i++) {
    const x = (i * 73) % 128,
      y = (i * 37 + Math.floor(i / 128) * 13) % 128;
    ctx.fillStyle = i % 2 ? "#ffffff0d" : "#00000012";
    ctx.fillRect(x, y, 1 + (i % 2), 1 + (i % 3));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(35, 35);
  const ground = mesh(scene, new THREE.PlaneGeometry(100, 100), "#ffffff");
  ground.rotation.x = -Math.PI / 2;
  (ground.material as THREE.MeshStandardMaterial).map = texture;
  ground.castShadow = false;
  for (const s of world?.surfaces || []) {
    const patch = mesh(
      scene,
      new THREE.PlaneGeometry(s.width, s.height),
      surfaceColors[s.kind] || "#a99c80",
      s.x,
      0.02,
      s.y,
    );
    patch.rotation.x = -Math.PI / 2;
    patch.castShadow = false;
    if (s.kind === "road") {
      const vertical = s.height > s.width,
        length = vertical ? s.height : s.width;
      for (let t = -length / 2 + 0.8; t < length / 2; t += 1.7) {
        const mark = mesh(
          scene,
          new THREE.PlaneGeometry(vertical ? 0.07 : 0.8, vertical ? 0.8 : 0.07),
          "#e1dac0",
          s.x + (vertical ? 0 : t),
          0.032,
          s.y + (vertical ? t : 0),
        );
        mark.rotation.x = -Math.PI / 2;
        mark.castShadow = false;
      }
    }
  }
  return texture;
}
