/** Numeric property previews form one undo transaction, even across many pointer events. */
export const PROPERTY_GESTURE_EVENT = 'papercut:property-gesture';
export type PropertyGestureKind = 'scrub' | 'wheel';
export interface PropertyGestureDetail {
  id: string;
  kind: PropertyGestureKind;
  phase: 'begin' | 'end' | 'cancel';
}

let sequence = 0;
let active: (()=>void)|null=null;
export const finishPropertyGesture=()=>active?.();
let previewing=false;
export const isPropertyPreview=()=>previewing;
export function previewPropertyChange(change:()=>void){
  const previous=previewing;previewing=!!active;
  try{change();}finally{previewing=previous;}
}
export function beginPropertyGesture(kind: PropertyGestureKind) {
  active?.();
  const id = `property-${++sequence}`;
  let finished = false;
  const emit = (phase: PropertyGestureDetail['phase']) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<PropertyGestureDetail>(PROPERTY_GESTURE_EVENT, { detail: { id, kind, phase } }));
    }
  };
  emit('begin');
  const gesture = {
    isActive:()=>!finished,
    end(cancelled = false) {
      if (finished) return;
      finished = true;
      if(active===finish)active=null;
      emit(cancelled ? 'cancel' : 'end');
    },
  };
  const finish=()=>gesture.end();
  active=finish;
  return gesture;
}
