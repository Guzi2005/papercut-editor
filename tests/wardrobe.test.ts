import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PapercutItem } from '../src/types/papercut';
import { applyOutfit, assignWardrobeCategory, captureOutfit, createWardrobeTemplate, normalizeOutfits, setWardrobeItemVisible, WARDROBE_BODY_ID, WARDROBE_CLOTHES_LAYER_ID, wardrobeItemVisible } from '../src/utils/wardrobe';
import { layerContent } from '../src/utils/layerContent';

test('template is an ordinary canvas with locked body and exactly three editable categories', () => {
  const p = createWardrobeTemplate();
  assert.equal(p.width, 512); assert.equal(p.height, 768);
  assert.deepEqual(p.items!.map(item => item.wardrobeCategory).sort(), ['clothes', 'headwear', 'shoes']);
  assert.equal(p.layers[WARDROBE_BODY_ID].locked, true);
  assert.equal(p.groups.length, 0);
  assert.ok(layerContent(p.layers[WARDROBE_BODY_ID]).bounds);
  for (const item of p.items!) {
    assert.equal(p.layers[item.partIds[0]].locked, false);
    assert.equal(p.layers[item.partIds[0]].unclippedDrawings, true);
    assert.equal(p.layers[item.partIds[0]].baseShape.d, '');
  }
  const square = createWardrobeTemplate(256, 256);
  assert.ok(layerContent(square.layers[WARDROBE_BODY_ID]).bounds!.height <= 256);
  assert.throws(() => createWardrobeTemplate(0, 256), /模板尺寸/);
});

test('capture stores category item identities and switching an outfit leaves body and scene objects intact', () => {
  const p = createWardrobeTemplate();
  p.layers.scene = { ...p.layers[WARDROBE_CLOTHES_LAYER_ID], id: 'scene', name: '柜台', visible: true };
  p.items!.push({ id: 'counter', name: '柜台', partIds: ['scene'], pivot: { x: 0, y: 0 }, sockets: [] });
  const outfit = captureOutfit(p, '蓝印套装');
  assert.deepEqual(outfit.clothes, ['item_clothes']);
  assert.deepEqual(outfit.shoes, ['item_shoes']);
  assert.deepEqual(outfit.headwear, ['item_headwear']);
  assert.equal(outfit.name, '蓝印套装');
  const next = applyOutfit(p, { ...outfit, shoes: [], headwear: [] });
  assert.equal(next.layers.wardrobe_shoes.visible, false);
  assert.equal(next.layers.wardrobe_headwear.visible, false);
  assert.equal(next.layers.wardrobe_clothes.visible, true);
  assert.equal(next.layers[WARDROBE_BODY_ID], p.layers[WARDROBE_BODY_ID]);
  assert.equal(next.layers.scene, p.layers.scene);
  assert.equal(p.layers.wardrobe_shoes.visible, true, 'source project remains unchanged');
  assert.deepEqual(captureOutfit(next, '仅衣服').shoes, []);
});

test('item visibility changes just its own parts and one project update restores the outfit', () => {
  const p = createWardrobeTemplate(), original = captureOutfit(p, '原套装');
  const hidden = setWardrobeItemVisible(p, 'item_clothes', false);
  assert.equal(hidden.layers.wardrobe_clothes.visible, false);
  assert.equal(hidden.layers.wardrobe_shoes, p.layers.wardrobe_shoes);
  assert.equal(wardrobeItemVisible(hidden, hidden.items!.find(item => item.id === 'item_clothes')!), false);
  assert.equal(applyOutfit(hidden, original).layers.wardrobe_clothes.visible, true);
  assert.equal(setWardrobeItemVisible(p, 'missing', false), p);
});

test('locked template and ordinary items stay protected even with malformed shared ownership', () => {
  const p = createWardrobeTemplate();
  p.items!.find(item => item.id === 'item_clothes')!.partIds.push(WARDROBE_BODY_ID);
  p.items!.push({ id: 'ordinary', name: '普通物件', partIds: ['wardrobe_shoes'], pivot: { x: 0, y: 0 }, sockets: [] });
  const next = applyOutfit(p, { id: 'empty', name: 'empty', clothes: [], shoes: [], headwear: [] });
  assert.equal(next.layers[WARDROBE_BODY_ID], p.layers[WARDROBE_BODY_ID]);
  assert.equal(next.layers.wardrobe_shoes, p.layers.wardrobe_shoes);
  assert.throws(() => setWardrobeItemVisible(p, 'item_clothes', false), /素体或普通物件/);
  assert.throws(() => setWardrobeItemVisible(p, 'item_shoes', false), /素体或普通物件/);
});

test('outfit import removes missing and wrong-category references and assignment keeps records consistent', () => {
  const p = createWardrobeTemplate();
  const [outfit] = normalizeOutfits([{ id: 'saved', name: '套装', clothes: ['item_clothes', 'item_clothes', 'item_shoes', 'missing'], shoes: ['item_shoes'], headwear: ['item_headwear'] }], p.items!);
  assert.deepEqual(outfit.clothes, ['item_clothes']);
  p.outfits = [outfit];
  const reassigned = assignWardrobeCategory(p, 'item_clothes', 'headwear');
  assert.equal(reassigned.items!.find(item => item.id === 'item_clothes')!.wardrobeCategory, 'headwear');
  assert.deepEqual(reassigned.outfits![0].clothes, []);
  const ordinary = assignWardrobeCategory(p, 'item_clothes', undefined);
  assert.equal(ordinary.items!.find(item => item.id === 'item_clothes')!.wardrobeCategory, undefined);
  assert.deepEqual(ordinary.outfits![0].clothes, []);
});

test('a visible shared wardrobe part is not hidden by an unselected outfit item', () => {
  const p = createWardrobeTemplate();
  const duplicate: PapercutItem = { ...p.items!.find(item => item.id === 'item_clothes')!, id: 'second_clothes', name: '第二衣服' };
  p.items!.push(duplicate);
  const outfit = { id: 'one', name: 'one', clothes: ['item_clothes'], shoes: [], headwear: [] };
  assert.equal(applyOutfit(p, outfit).layers.wardrobe_clothes.visible, true);
  assert.throws(() => setWardrobeItemVisible(p, 'second_clothes', false), /共用图层/);
});
