import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawingPreviewStyle} from '../src/utils/drawingPreview';

test('immediate drawing feedback uses the chosen color without an outline',()=>{
  for(const color of ['#D90B20','#000000','#F6EEE2'])for(const zoom of [.25,1,4]){
    const appearance=drawingPreviewStyle('filled',color,zoom);
    assert.equal(appearance.fill,color);assert.equal(appearance.fillOpacity,1);assert.equal(appearance.stroke,'none');assert.equal(appearance.strokeWidth,0);assert.equal(appearance.strokeDasharray,undefined);
  }
});
test('outline feedback remains unfilled with a constant screen-space dashed edge',()=>{
  for(const zoom of [.25,1,4]){const appearance=drawingPreviewStyle('outline','#D90B20',zoom);assert.equal(appearance.fill,'none');assert.equal(appearance.fillOpacity,0);assert.equal(appearance.strokeWidth*zoom,1.8);assert.deepEqual(appearance.strokeDasharray!.split(' ').map(Number).map(n=>n*zoom),[5,3]);}
  assert.equal(drawingPreviewStyle('outline','#fff',0).strokeWidth,1.8);
});
