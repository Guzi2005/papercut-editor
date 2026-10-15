import test from 'node:test';
import assert from 'node:assert/strict';
import { PROPERTY_GESTURE_EVENT, beginPropertyGesture,finishPropertyGesture,previewPropertyChange,isPropertyPreview,type PropertyGestureDetail } from '../src/utils/propertyGesture';

test('property gesture begins before previews and finishes once', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const events: Array<PropertyGestureDetail | 'preview'> = [];
  const target = new EventTarget();
  target.addEventListener(PROPERTY_GESTURE_EVENT, event => events.push((event as CustomEvent<PropertyGestureDetail>).detail));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  try {
    const gesture = beginPropertyGesture('scrub');
    events.push('preview');
    events.push('preview');
    gesture.end();
    gesture.end();
    assert.deepEqual(events.map(event => typeof event === 'string' ? event : event.phase), ['begin', 'preview', 'preview', 'end']);
    const begin = events[0] as PropertyGestureDetail;
    const end = events[3] as PropertyGestureDetail;
    assert.equal(begin.id, end.id);
    assert.equal(begin.kind, 'scrub');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('another property or an edit command finishes the previous gesture; only synchronous previews batch',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),target=new EventTarget(),events:PropertyGestureDetail[]=[];
  target.addEventListener(PROPERTY_GESTURE_EVENT,event=>events.push((event as CustomEvent<PropertyGestureDetail>).detail));
  Object.defineProperty(globalThis,'window',{configurable:true,value:target});
  try{
    const first=beginPropertyGesture('wheel');
    assert.equal(isPropertyPreview(),false);
    previewPropertyChange(()=>assert.equal(isPropertyPreview(),true));
    assert.equal(isPropertyPreview(),false);
    const second=beginPropertyGesture('scrub');assert.equal(first.isActive(),false);assert.equal(second.isActive(),true);
    first.end();finishPropertyGesture();assert.equal(second.isActive(),false);
    assert.deepEqual(events.map(e=>e.phase),['begin','end','begin','end']);
    assert.throws(()=>previewPropertyChange(()=>{throw new Error('cancelled');}));assert.equal(isPropertyPreview(),false);
  }finally{finishPropertyGesture();if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});

test('cancelled and subsequent gestures have separate identities', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const events: PropertyGestureDetail[] = [];
  const target = new EventTarget();
  target.addEventListener(PROPERTY_GESTURE_EVENT, event => events.push((event as CustomEvent<PropertyGestureDetail>).detail));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  try {
    const cancelled = beginPropertyGesture('scrub');
    cancelled.end(true);
    cancelled.end();
    const wheel = beginPropertyGesture('wheel');
    wheel.end();
    assert.deepEqual(events.map(event => event.phase), ['begin', 'cancel', 'begin', 'end']);
    assert.equal(events[0].id, events[1].id);
    assert.notEqual(events[0].id, events[2].id);
    assert.equal(events[2].kind, 'wheel');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
