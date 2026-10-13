import {DEFAULT_STAMP_SETTINGS,normalizeStampSettings,type StampDefinition,type StampSettings} from './stamps';

export type MaterialTab='stamp'|'ribbon'|'fabric'|'outfit';
export type MotifMode=StampSettings['mode'];
export const motifMode=(definition:StampDefinition):MotifMode=>definition.settings?.mode??'stamp';
/** Library recipes share geometry; switching use never rewrites the saved source. */
export function definitionForMode(definition:StampDefinition,mode:MotifMode,current?:StampSettings):StampDefinition {
  const settings=normalizeStampSettings({...DEFAULT_STAMP_SETTINGS,...current,...definition.settings,mode});
  return {...definition,settings:{...settings,recolor:{...settings.recolor},skipColors:[...settings.skipColors]}};
}
export function libraryForMode(library:StampDefinition[],mode:MotifMode):StampDefinition[]{return library.filter(d=>motifMode(d)===mode);}
/** Fit the strip preview without changing the actual production recipe. */
export function ribbonTileSettings(definition:StampDefinition):StampSettings {
  const settings=definitionForMode(definition,'ribbon').settings!,ratio=Math.min(32/settings.size,42/settings.ribbonWidth);
  return {...settings,size:settings.size*ratio,ribbonWidth:settings.ribbonWidth*ratio,ribbonEdge:settings.ribbonEdge*ratio,
    selvageWidth:settings.selvageWidth*ratio,selvageDepth:settings.selvageDepth*ratio,selvageSpacing:settings.selvageSpacing*ratio,selvageInset:settings.selvageInset*ratio};
}
