export type DimensionMode='hidden'|'summary'|'diagram';
const KEY='pleated-skirt-dimension-mode';
const normalize=(value:unknown):DimensionMode=>value==='hidden'||value==='summary'?value:'diagram';
let current:DimensionMode|undefined;
const listeners=new Set<()=>void>();
export function readDimensionMode():DimensionMode {
 if(current===undefined){try{current=normalize(localStorage.getItem(KEY));}catch{current='diagram';}}
 return current;
}
export function setDimensionMode(mode:DimensionMode){
 current=normalize(mode);try{localStorage.setItem(KEY,current);}catch{/* Keep the session preference if storage is blocked. */}
 for(const listener of listeners)listener();
}
function storageChanged(event:StorageEvent){
 if(event.key!==null&&event.key!==KEY)return;
 current=normalize(event.newValue);for(const listener of listeners)listener();
}
export function subscribeDimensionMode(listener:()=>void):()=>void {
 if(!listeners.size&&typeof window!=='undefined'){
  // Re-read after a period with no consumers, when storage events were unbound.
  try{const saved=localStorage.getItem(KEY);if(saved!==null)current=normalize(saved);}catch{/* Retain the in-memory value. */}
  window.addEventListener('storage',storageChanged);
 }
 listeners.add(listener);
 return ()=>{listeners.delete(listener);if(!listeners.size&&typeof window!=='undefined')window.removeEventListener('storage',storageChanged);};
}
