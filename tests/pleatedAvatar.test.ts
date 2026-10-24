import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GarmentBinding,sampleClip,type AvatarManifest} from '../src/pleatedSkirt/avatar';
import {buildMesh} from '../src/pleatedSkirt/geometry';
import {createDesign} from '../src/pleatedSkirt/model';

const asset = (name:string) => new URL(`../public/pleated-avatar/${name}`, import.meta.url);
const manifest = JSON.parse(readFileSync(asset('manifest.json'), 'utf8')) as AvatarManifest;
const frameBytes = readFileSync(asset('frames.bin'));
assert.equal(frameBytes.byteLength % 4, 0, 'frames.bin should contain float32 values');
const data = new Float32Array(frameBytes.byteLength / 4);
new Uint8Array(data.buffer).set(frameBytes);

const REFERENCE_BOTTOM = .2;
const REFERENCE_TOP = 1.31;
const REFERENCE_VERTICAL = (REFERENCE_TOP - REFERENCE_BOTTOM) / .88;
const SX = .28 / (.68 / (Math.PI * 2));
const SZ = .202 / (.68 / (Math.PI * 2));
const TOLERANCE = 1e-4;

const reference = {...createDesign().parameters, pleat_count:16};
const variants = [
  {name:'default', parameters:reference},
  {name:'length 40', parameters:{...reference, length_cm:40}},
  {name:'length 120', parameters:{...reference, length_cm:120}},
  {name:'hem 100', parameters:{...reference, hem_cm:100}},
  {name:'hem 360', parameters:{...reference, hem_cm:360}},
];

function assertClose(actual:number, expected:number, label:string, tolerance=TOLERANCE){
  if(!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    assert.fail(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertFinite(values:Float32Array, label:string){
  for(let i = 0; i < values.length; i++){
    if(!Number.isFinite(values[i])) assert.fail(`${label}[${i}] is ${values[i]}`);
  }
}

test('rest cage reproduces the scaled reference skirt positions',()=>{
  const cage = manifest.cage;
  assert.equal(cage.restPositions.length, cage.vertexCount * 3);
  assertClose(cage.rowsY[0], REFERENCE_BOTTOM, 'cage bottom', 1e-9);
  assertClose(cage.rowsY[cage.rowsY.length - 1], REFERENCE_TOP, 'cage top', 1e-9);

  const p = variants[0].parameters;
  const mesh = buildMesh(p);
  const binding = new GarmentBinding(mesh, cage, p.length_cm).deform(new Float32Array(cage.restPositions));
  const top = cage.rowsY[cage.rowsY.length - 1];
  for(let i = 0; i < mesh.positions.length / 3; i++){
    const at = i * 3;
    assertClose(binding.positions[at], mesh.positions[at] * SX, `rest x[${i}]`);
    assertClose(
      binding.positions[at + 1],
      top - p.length_cm / 100 * REFERENCE_VERTICAL + mesh.positions[at + 1] * REFERENCE_VERTICAL,
      `rest y[${i}]`,
    );
    assertClose(binding.positions[at + 2], mesh.positions[at + 2] * SZ, `rest z[${i}]`);
  }
});

test('rigid cage rotation and translation transforms bound vertices consistently',()=>{
  const p = variants[0].parameters;
  const mesh = buildMesh(p);
  const binding = new GarmentBinding(mesh, manifest.cage, p.length_cm);
  binding.deform(new Float32Array(manifest.cage.restPositions));
  const restPositions = new Float32Array(binding.positions);
  const restNormals = new Float32Array(binding.normals);

  const ca = Math.cos(.61), sa = Math.sin(.61);
  const cb = Math.cos(-.43), sb = Math.sin(-.43);
  const translate = [.37, -.11, .62];
  const rotate = (x:number, y:number, z:number):[number, number, number] => {
    const y1 = ca * y - sa * z, z1 = sa * y + ca * z;
    return [cb * x + sb * z1, y1, -sb * x + cb * z1];
  };

  const rest = manifest.cage.restPositions;
  const moved = new Float32Array(rest.length);
  for(let at = 0; at < rest.length; at += 3){
    const [x, y, z] = rotate(rest[at], rest[at + 1], rest[at + 2]);
    moved[at] = x + translate[0];
    moved[at + 1] = y + translate[1];
    moved[at + 2] = z + translate[2];
  }

  binding.deform(moved);
  for(let at = 0; at < restPositions.length; at += 3){
    const i = at / 3;
    const [x, y, z] = rotate(restPositions[at], restPositions[at + 1], restPositions[at + 2]);
    assertClose(binding.positions[at], x + translate[0], `rigid x[${i}]`);
    assertClose(binding.positions[at + 1], y + translate[1], `rigid y[${i}]`);
    assertClose(binding.positions[at + 2], z + translate[2], `rigid z[${i}]`);
    const [nx, ny, nz] = rotate(restNormals[at], restNormals[at + 1], restNormals[at + 2]);
    assertClose(binding.normals[at], nx, `rigid nx[${i}]`);
    assertClose(binding.normals[at + 1], ny, `rigid ny[${i}]`);
    assertClose(binding.normals[at + 2], nz, `rigid nz[${i}]`);
  }
});

test('all action frames produce finite garment positions and normals',()=>{
  const vertexFloats = manifest.vertexCount * 3;
  const cageFloats = manifest.cage.vertexCount * 3;
  const cage = new Float32Array(cageFloats);

  for(const variant of variants){
    const mesh = buildMesh(variant.parameters);
    const binding = new GarmentBinding(mesh, manifest.cage, variant.parameters.length_cm);
    for(const [action, clip] of Object.entries(manifest.actions)){
      assert.ok(clip.frames.length > 0, `${variant.name} ${action} has no frames`);
      for(let frameIndex = 0; frameIndex < clip.frames.length; frameIndex++){
        const frame = clip.frames[frameIndex];
        const label = `${variant.name} ${action} frame ${frameIndex}`;
        assert.ok(frame.offset >= 0 && frame.offset + manifest.frameStride <= data.length, `${label} is outside frames.bin`);
        const cageStart = frame.offset + vertexFloats * 2;
        assert.ok(cageStart + cageFloats <= data.length, `${label} cage is outside frames.bin`);
        cage.set(data.subarray(cageStart, cageStart + cageFloats));
        binding.deform(cage);
        assertFinite(binding.positions, `${label} positions`);
        assertFinite(binding.normals, `${label} normals`);
      }
    }
  }
});

test('sampleClip clamps endpoints and wraps the loop seam',()=>{
  for(const [action, clip] of Object.entries(manifest.actions)){
    const first = clip.frames[0], last = clip.frames[clip.frames.length - 1];
    const start = sampleClip(clip, 0), before = sampleClip(clip, -1);
    const end = sampleClip(clip, 1), after = sampleClip(clip, 2);
    assert.equal(start.a, first, `${action} start a`);
    assert.equal(start.b, clip.frames[Math.min(1, clip.frames.length - 1)], `${action} start b`);
    assert.equal(start.mix, 0, `${action} start mix`);
    assert.equal(before.a, first, `${action} clamped start a`);
    assert.equal(before.b, start.b, `${action} clamped start b`);
    assert.equal(before.mix, 0, `${action} clamped start mix`);
    assert.equal(end.a, last, `${action} end a`);
    assert.equal(end.b, last, `${action} end b`);
    assert.equal(end.mix, 0, `${action} end mix`);
    assert.equal(after.a, last, `${action} clamped end a`);
    assert.equal(after.b, last, `${action} clamped end b`);
    assert.equal(after.mix, 0, `${action} clamped end mix`);
  }

  const walk = manifest.actions.walk;
  assert.ok(walk.frames.length > 1, 'walk clip needs at least two frames');
  const seam = sampleClip(walk, 1, true);
  assert.equal(seam.a, walk.frames[walk.frames.length - 1]);
  assert.equal(seam.b, walk.frames[0]);
  assert.equal(seam.mix, 1);
  const loopStart = sampleClip(walk, 0, true);
  assert.equal(loopStart.a, walk.frames[0]);
  assert.equal(loopStart.b, walk.frames[1]);
  assert.equal(loopStart.mix, 0);
});
