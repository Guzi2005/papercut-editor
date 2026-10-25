import {mirrorGesture,mirrorNewMarks,splitSeamSpan} from './mirror';
import {effectiveDrape} from './drape';
import {el,button,field,row,select,chooseFile,report,download} from './ui';
import {createDesign,parseDesign,newId,templates,views,fabrics,patterns,silhouettes,limits,type SkirtDesign,type UV,type Template,type CanvasView,type Pattern,type Fabric} from './model';
import {effectiveShape,effectiveHem,setHemParameters,shapeControls,setShapeParameter} from './shape';
import {createHemEditor} from './hemEditor';
import {PatternCanvas} from './canvas';
import {SkirtPreview,readPreviewRenderMode} from './preview';
import {paintTexture} from './texture';
import {skirtZip} from './export';
import './style.css';

interface Host {get:()=>SkirtDesign|undefined;commit:(label:string,d:SkirtDesign)=>void;overlay:(d:SkirtDesign)=>CanvasImageSource|undefined;paintLayer:()=>void;status:(s:string)=>void}
type PreviewAction='stand'|'walk'|'sit'|'lie'|'display'|'spin';
export class SkirtStudio {
  element=el('div','skirt-studio');private controls=el('aside','skirt-controls');private tabs=el('div','skirt-views');private tools=el('div','skirt-tools');
  private pattern:PatternCanvas;private preview?:SkirtPreview;private texture=el('canvas');private info=el('p','skirt-info');private source=el('p','skirt-source');
  private selected='';private tool:'turn'|'select'|'pen'|'patch'='turn';private ink='#c54d70';private brush=.009;
  private draft?:SkirtDesign;private start?:UV;private pointer=-1;private bandStart=0;private bandWidth=0;private dirtyStroke=false;
  private mirror=true;private strokeStart=0;private patchStart=0;private pendingFrame=0;private patchPieces:string[]=[];private patchU=0;private patchLastU=0;private focusView:string|null=null;
  private shapeOpen=false;private readonly shapeDetailsId=`skirt-shape-details-${crypto.randomUUID()}`;
  private focusHem:string|null=null;
  private mobileEvents=new AbortController();
  constructor(private host:Host){
    this.texture.width=this.texture.height=1024;
    const heading=el('div','skirt-heading'),title=el('div');title.append(el('h1','','百褶裙'));
    const actions=row(button('保存设计 JSON',()=>{const d=this.host.get();if(d)download(JSON.stringify(d,null,2),'skirt.json');}),button('导入设计',()=>this.importDesign()),button('导出 Godot 包',()=>{const d=this.host.get();if(d)download(new Blob([skirtZip(d,this.host.overlay(d)) as BlobPart],{type:'application/zip'}),'pleated-skirt.zip');}));heading.append(title,actions);
    const layout=el('div','skirt-layout'),workspace=el('section','skirt-paper-panel'),previewPanel=el('section','skirt-preview-panel');
    const label=el('div','skirt-panel-title');const help=button('ⓘ',()=>{},'三个展开视图共享同一份纹样；展开图用于设计，不是含缝份的裁缝纸样。');help.classList.add('skirt-help');help.setAttribute('aria-label','展开图说明');label.append(el('strong','','纹样'),help);
    const canvas=el('canvas');canvas.setAttribute('aria-label','裙子模板画布');canvas.dataset.tip='平铺图：转裙面工具或右键左右拖动，循环查看；中键平移，滚轮缩放';canvas.dataset.testid='skirt-canvas';
    const wrap=el('div','skirt-canvas-wrap');wrap.append(canvas);this.pattern=new PatternCanvas(canvas);canvas.id='skirt-pattern-panel';canvas.setAttribute('role','tabpanel');
    workspace.append(label,this.tabs,this.tools,wrap);
    const previewTitle=el('div','skirt-panel-title');const renderMode=button(readPreviewRenderMode()==='toon'?'三渲二':'材质预览',()=>{const toon=renderMode.textContent==='材质预览';renderMode.textContent=toon?'三渲二':'材质预览';renderMode.setAttribute('aria-label',toon?'渲染模式：三渲二':'渲染模式：材质预览');renderMode.setAttribute('aria-pressed',String(toon));this.preview?.setRenderMode(toon?'toon':'material');},'切换材质预览 / 游戏纸感：淡分层明暗、纸纹、无高光');renderMode.setAttribute('aria-label','渲染模式：'+renderMode.textContent);renderMode.setAttribute('aria-pressed',String(readPreviewRenderMode()==='toon'));previewTitle.append(el('strong','','立体预览'),renderMode,button('复位视角',()=>this.preview?.reset()));
    const glCanvas=el('canvas');glCanvas.setAttribute('aria-label','百褶裙三维预览');glCanvas.dataset.testid='skirt-preview';
    const stage=el('div','skirt-stage');glCanvas.setAttribute('aria-description','拖动旋转，滚轮缩放');stage.append(glCanvas);
    try{this.preview=new SkirtPreview(glCanvas);}catch(error){stage.append(el('p','skirt-preview-error',String(error)));}
    let chosen:PreviewAction='stand';const motionControls=el('div','skirt-motion-controls'),displayControls=el('div'),spinControls=el('div');
    motionControls.append(displayControls,spinControls);motionControls.hidden=true;
    const option=(group:HTMLElement,label:string,key:'armAngle'|'spread'|'speed'|'uniformity',value:number,min:number,max:number,step:number,tip:string)=>{
     const slider=el('input'),number=el('input');slider.type='range';number.type='number';let current=value;
     for(const c of [slider,number]){c.min=String(min);c.max=String(max);c.step=String(step);c.value=String(value);c.setAttribute('aria-label',label+(c===number?' 数值':''));}
     const update=(raw:number)=>{if(!Number.isFinite(raw))return;current=Math.max(min,Math.min(max,Math.round(raw/step)*step));slider.value=String(current);this.preview?.setMotionOptions({[key]:key==='uniformity'?current/100:current});};
     slider.oninput=()=>{update(Number(slider.value));number.value=String(current);};number.oninput=()=>update(number.valueAsNumber);number.onchange=()=>{update(number.valueAsNumber);number.value=String(current);};
     const controls=el('div','skirt-range');controls.append(slider,number);const f=field(label,controls);f.dataset.tip=tip;group.append(f);
    };
    option(displayControls,'手臂抬角 / °','armAngle',45,0,85,1,'控制抓住手边裙料后向外展开的抬角');
    option(displayControls,'双手 XY 夹角 / °','spread',90,20,150,1,'双手抓住手边裙料后，在正面 XY 平面缓缓展开');
    option(spinControls,'转速 / 圈每秒','speed',.4,.1,1.5,.1,'每秒平均转圈次数');
    option(spinControls,'匀速程度 / %','uniformity',35,0,100,1,'0：明显加减速；100：匀速');
    const showMotion=()=>{motionControls.hidden=!worn||!['display','spin'].includes(chosen);displayControls.hidden=chosen!=='display';spinControls.hidden=chosen!=='spin';};
    const actionTabs=el('div','skirt-action-tabs');for(const [id,name] of [['stand','站立'],['walk','行走'],['sit','坐下'],['lie','躺下'],['display','裙摆展示'],['spin','转圈圈']] as [PreviewAction,string][]) {const b=button(name,()=>{chosen=id;showMotion();this.preview?.setAction(id);actionTabs.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));});b.dataset.action=id;b.title=`预览${name}动作`;if(id==='stand')b.classList.add('active');actionTabs.append(b);}
    const playback=el('div','skirt-preview-tools');let worn=true,playing=true;
    const mode=button('穿着',()=>{worn=!worn;mode.textContent=worn?'穿着':'单裙';this.preview?.setWorn(worn);actionTabs.hidden=!worn;showMotion();timeline.disabled=!worn;},'切换穿着 / 单裙');
    const play=button('暂停',()=>{playing=!playing;this.preview?.setPlaying(playing);},'播放 / 暂停动作');play.setAttribute('aria-label','播放或暂停动作');
    const timeline=el('input');timeline.type='range';timeline.min='0';timeline.max='1';timeline.step='.01';timeline.value='0';timeline.setAttribute('aria-label','动作进度');timeline.oninput=()=>this.preview?.setProgress(Number(timeline.value));
    if(this.preview)this.preview.onProgress=(progress,isPlaying)=>{timeline.value=String(progress);playing=isPlaying;play.textContent=isPlaying?'暂停':'播放';};
    playback.append(mode,play,timeline);previewPanel.append(previewTitle,actionTabs,motionControls,stage,playback,this.info,this.source);
    this.tabs.setAttribute('role','tablist');this.tabs.setAttribute('aria-label','裙子展开图');
    const mobileNav=el('nav','skirt-mobile-nav');mobileNav.setAttribute('aria-label','素材制作工作区');
    this.element.dataset.mobilePane='paper';
    for(const [pane,name] of [['paper','图纸'],['preview','三维'],['controls','参数']]){
      const b=button(name,()=>{
        this.element.dataset.mobilePane=pane;
        mobileNav.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
      });
      b.dataset.pane=pane;b.setAttribute('aria-label',`工作区：${name}`);b.setAttribute('aria-pressed',String(pane==='paper'));mobileNav.append(b);
    }
    layout.append(this.controls,workspace,previewPanel);this.element.append(heading,layout,mobileNav);
    matchMedia('(max-width: 640px)').addEventListener('change',e=>{if(!e.matches&&this.element.dataset.mobilePane==='controls')mobileNav.querySelector<HTMLButtonElement>('[data-pane="paper"]')?.click();},{signal:this.mobileEvents.signal});
    this.pattern.onDown=(uv,e)=>this.down(uv,e);this.pattern.onMove=(uv,e)=>this.move(uv,e);this.pattern.onUp=()=>this.up();this.pattern.onCancel=()=>this.cancel();
  }
  refresh(){const d=this.host.get();if(!d)return;this.draft=undefined;this.start=undefined;this.pointer=-1;this.buildControls(d);this.buildTools(d);this.display(d);}
  restoreTabFocus(){if(this.element.closest('[inert]'))return;if(this.focusView){this.tabs.querySelector<HTMLButtonElement>('button[data-view='+this.focusView+']')?.focus();this.focusView=null;}if(this.focusHem){this.controls.querySelector<SVGElement>(`[data-hem-handle="${this.focusHem}"]`)?.focus();this.focusHem=null;}}
  dispose(){this.mobileEvents.abort();cancelAnimationFrame(this.pendingFrame);this.preview?.dispose();this.pattern.dispose();this.element.remove();}
  private display(d:SkirtDesign){paintTexture(this.texture,d,this.host.overlay(d));this.pattern.update(d,this.texture,this.selected);this.preview?.update(d,this.texture);
    this.info.textContent=`${d.parameters.pleat_count} 道褶 · ${d.parameters.length_cm} cm 裙长 · ${d.parameters.thickness_mm} mm 布厚`;
    this.source.textContent='参考来源 ⓘ';this.source.dataset.tip=d.source.references.map(x=>x.title).join(' / ')||'自由设计 · 尚未添加来源';
  }
  private drawingGesture(){return this.start!==undefined&&(this.tool==='pen'||this.tool==='patch');}
  private displaySoon(){if(this.pendingFrame)return;this.pendingFrame=requestAnimationFrame(()=>{this.pendingFrame=0;if(this.draft)this.display(mirrorGesture(this.draft,this.mirror,this.drawingGesture(),this.strokeStart,this.patchStart));});}
  private commit(label:string,d:SkirtDesign){this.host.commit(label,parseDesign(d));}
  private edit(label:string,fn:(d:SkirtDesign)=>void){const current=this.host.get();if(!current)return;const d=structuredClone(current);fn(d);this.commit(label,d);}
  private choice<T extends string>(options:Record<T,string>,value:T,fn:(v:T)=>void){return select(Object.entries(options).map(([id,name])=>({id,name:String(name)})),value,v=>fn(v as T));}
  private slider(label:string,value:number,min:number,max:number,step:number,fn:(d:SkirtDesign,value:number)=>void,ends?:[string,string]){
    const input=el('input'),number=el('input');input.type='range';number.type='number';
    for(const control of [input,number]){control.min=String(min);control.max=String(max);control.step=String(step);control.value=String(value);control.setAttribute('aria-label',control===input?label:`${label} 数值`);}
    const control=el('div','skirt-range');control.append(input,number);
    input.oninput=()=>{number.value=input.value;const d=structuredClone(this.host.get()!);fn(d,Number(input.value));this.draft=d;this.displaySoon();};
    input.onchange=()=>{const d=structuredClone(this.host.get()!);fn(d,Number(input.value));this.commit(label,d);};
    number.onchange=()=>{if(number.value===''||!Number.isFinite(number.valueAsNumber)){number.value=input.value;return;}const v=Math.max(min,Math.min(max,Math.round(number.valueAsNumber/step)*step));this.edit(label,d=>fn(d,Number(v.toFixed(4))));};
    const result=field(label,control);result.dataset.tip=ends?`${ends[0]} → ${ends[1]}`:`${min}–${max}`;return result;
  }
  private colorControl(label:string,value:string,fn:(d:SkirtDesign,color:string)=>void){const input=el('input');input.type='color';input.value=value;input.setAttribute('aria-label',label);input.oninput=()=>{const d=structuredClone(this.host.get()!);fn(d,input.value);this.draft=d;this.displaySoon();};input.onchange=()=>this.edit(label,d=>fn(d,input.value));return field(label,input);}
  private buildControls(d:SkirtDesign){this.controls.replaceChildren();
    const group=(name:string,tone:string)=>{const section=el('section','skirt-control-group');section.dataset.tone=tone;section.setAttribute('aria-label',name);section.append(el('h2','skirt-group-title',name));this.controls.append(section);return section;};
    const shapeGroup=group('廓形与下摆','shape');
    shapeGroup.append(field('参考起点',this.choice(templates,d.template_id,(id:Template)=>{
      const next=createDesign(id);Object.assign(next,{design_id:d.design_id,item_id:d.item_id,component_id:d.component_id,collection_id:d.collection_id,canvas_view:d.canvas_view});this.selected='';this.commit('应用裙子模板',next);
    })));
    const profile=d.silhouette??'relaxed';
    const details=el('div','skirt-shape-details');details.id=this.shapeDetailsId;
    const toggle=button('',()=>{},'');
    const syncToggle=()=>{const open=this.shapeOpen;toggle.textContent=open?'▲ 参数':'▼ 参数';toggle.dataset.tip=open?'收起廓形参数':'展开廓形与下摆形状参数';toggle.setAttribute('aria-expanded',String(open));details.hidden=!open;};
    const renderDetails=(design:SkirtDesign)=>{
      details.replaceChildren();const current=design.silhouette??'relaxed',settings=effectiveShape(design),values=settings[current] as unknown as Record<string,number>;
      for(const control of shapeControls[current]){
        const item=this.slider(control.label,Math.round(values[control.key]*100),Math.round(control.min*100),Math.round(control.max*100),1,(next,v)=>{setShapeParameter(next,current,control.key,v/100);});
        item.dataset.tip=control.tip;details.append(item);
      }
      const hem=effectiveHem(design),graphic=el('div','skirt-hem-graphic');
      const syncNumbers=(next:SkirtDesign)=>{const h=effectiveHem(next);for(const [label,value] of [['短长轴比 / %',Math.round(h.ratio*100)],['长轴朝向 / °',Math.round(h.angle_deg)],['裙摆大小 / cm',Math.round(next.parameters.hem_cm)]] as const){for(const input of this.controls.querySelectorAll<HTMLInputElement>('input'))if(input.getAttribute('aria-label')===label||input.getAttribute('aria-label')===label+' 数值')input.value=String(value);}};
      const drawGraphic=(next:SkirtDesign)=>graphic.replaceChildren(createHemEditor(next,
        candidate=>{this.draft=candidate;this.displaySoon();syncNumbers(candidate);},
        candidate=>{this.focusHem=document.activeElement?.getAttribute('data-hem-handle')??null;this.commit('调整下摆轮廓',candidate);},
        ()=>{cancelAnimationFrame(this.pendingFrame);this.pendingFrame=0;this.draft=undefined;const current=this.host.get();if(current){this.display(current);syncNumbers(current);}}));
      drawGraphic(design);details.append(graphic);
      const ratio=this.slider('短长轴比 / %',Math.round(hem.ratio*100),35,100,1,(next,v)=>{setHemParameters(next,{ratio:v/100});drawGraphic(next);});
      ratio.dataset.tip='连续调节椭圆率；100 为正圆，越小越扁。';
      const angle=this.slider('长轴朝向 / °',Math.round(hem.angle_deg),0,179,1,(next,v)=>{setHemParameters(next,{angle_deg:v});drawGraphic(next);});
      angle.dataset.tip='0° 左右方向，90° 前后方向；可直接拖图上的外侧圆点旋转。';details.append(ratio,angle);
    };
    const previewDesign=(change:(next:SkirtDesign)=>void)=>{const next=structuredClone(this.host.get()??d);change(next);return next;};
    const silhouette=field('廓形',this.choice(silhouettes,profile,(v)=>{this.shapeOpen=true;this.edit('选择廓形',next=>next.silhouette=v);renderDetails(previewDesign(next=>next.silhouette=v));syncToggle();}));
    silhouette.dataset.tip='静止时裙摆自然垂落的廓形；不改变纹样，也不改变腰围或下摆尺寸。';
    const hemButton=button('编辑轮廓',()=>{this.shapeOpen=true;syncToggle();},'展开下摆俯视编辑图：拖动轴端调节大小、椭圆率，拖外侧点旋转。');hemButton.setAttribute('aria-label','编辑下摆轮廓');hemButton.classList.add('skirt-hem-open');
    const hemShape=field('下摆',hemButton);
    toggle.classList.add('skirt-shape-toggle');toggle.setAttribute('aria-label','廓形参数');toggle.setAttribute('aria-controls',this.shapeDetailsId);toggle.onclick=()=>{this.shapeOpen=!this.shapeOpen;syncToggle();};
    shapeGroup.append(row(silhouette,hemShape),toggle,details);renderDetails(d);syncToggle();
    const sizeGroup=group('尺寸与褶子','size'),fabricGroup=group('面料与垂坠','fabric');
    const labels={length_cm:'裙长 / cm',waist_cm:'腰围 / cm',hem_cm:'裙摆大小 / cm',pleat_count:'褶子数量',pleat_depth_cm:'褶深 / cm',sharpness:'褶子锋利程度',thickness_mm:'布料厚度 / mm'};
    const ends:Partial<Record<keyof typeof limits,[string,string]>>={length_cm:['短裙 · 40','长裙 · 120'],hem_cm:['收拢 · 100','宽摆 · 360']};
    for(const key of Object.keys(limits) as (keyof typeof limits)[]){const [min,max]=limits[key];const control=this.slider(labels[key],d.parameters[key],min,max,['sharpness'].includes(key)?.01:['thickness_mm','pleat_depth_cm'].includes(key)?.1:1,(next,v)=>{next.parameters[key]=v;},ends[key]);if(key==='hem_cm')control.dataset.tip='下摆外轮廓周长 100–360 cm；越大，裙摆越展开。';(key==='thickness_mm'?fabricGroup:sizeGroup).append(control);
    }
    fabricGroup.append(row(this.colorControl('底色',d.parameters.base_color,(next,c)=>next.parameters.base_color=c),field('布料',this.choice(fabrics,d.parameters.fabric,(v:Fabric)=>this.edit('选择布料',next=>next.parameters.fabric=v)))));
    const drape=effectiveDrape(d);
    fabricGroup.append(row(el('span','skirt-subtitle','垂坠'),button(d.drape?.mode==='manual'?'恢复面料默认':'面料默认',()=>this.edit('恢复垂坠默认',next=>{delete next.drape;}),'默认值随面料、布厚、裙长和裙摆计算；改数值后为手动。')));
    for(const [key,label] of [['weight','下垂重量'],['bending','抗弯挺度'],['opening','褶子开放']] as const){fabricGroup.append(this.slider(label,drape[key],0,1,.01,(next,value)=>{next.drape={...effectiveDrape(next),mode:'manual',[key]:value};}));}
    const bandGroup=group('拼接与镶边','bands');bandGroup.replaceChildren();
    const bandHead=row(el('h2','skirt-group-title','拼接与镶边'),button('+ 镶边',()=>this.edit('新增镶边',next=>{if(next.bands.length>=32)throw Error('最多 32 条镶边');const b={id:newId(),start:.84,end:.88,color:this.ink,pattern:'solid' as Pattern,repeat:32};next.bands.push(b);this.selected=b.id;})));
    bandHead.classList.add('skirt-group-heading');bandGroup.append(bandHead);
    const list=el('div','skirt-band-list');d.bands.forEach((b,i)=>{const item=button(`${String(i+1).padStart(2,'0')}　${Math.round(b.start*100)}–${Math.round(b.end*100)}%　${patterns[b.pattern]}`,()=>{this.selected=b.id;this.buildControls(this.host.get()!);this.pattern.update(d,this.texture,this.selected);});item.style.borderLeft=`5px solid ${b.color}`;item.classList.toggle('active',b.id===this.selected);list.append(item);});bandGroup.append(list);
    const b=d.bands.find(x=>x.id===this.selected);if(b){
      bandGroup.append(this.slider('镶边位置 / %',Math.round(b.start*1000)/10,0,99.5,.1,(next,n)=>{const x=next.bands.find(x=>x.id===b.id)!,width=x.end-x.start;x.start=Math.min(n/100,1-width);x.end=x.start+width;}));
      bandGroup.append(this.slider('镶边宽度 / %',Math.round((b.end-b.start)*1000)/10,.5,30,.1,(next,n)=>{const x=next.bands.find(x=>x.id===b.id)!;x.end=Math.min(1,x.start+n/100);if(x.end-x.start<.005)x.start=x.end-.005;}));
      bandGroup.append(row(this.colorControl('镶边颜色',b.color,(next,c)=>next.bands.find(x=>x.id===b.id)!.color=c),field('纹样',this.choice(patterns,b.pattern,(v:Pattern)=>this.edit('镶边纹样',next=>next.bands.find(x=>x.id===b.id)!.pattern=v)))));
      bandGroup.append(this.slider('纹样重复',b.repeat,4,64,1,(next,n)=>next.bands.find(x=>x.id===b.id)!.repeat=n));
      bandGroup.append(button('删除所选镶边',()=>this.edit('删除镶边',next=>{next.bands=next.bands.filter(x=>x.id!==b.id);this.selected='';})));
    }
    bandGroup.append(row(button('清除笔迹',()=>this.edit('清除笔迹',next=>next.strokes=[]),`清除 ${d.strokes.length} 条工作台笔迹`),button('清除拼色',()=>this.edit('清除拼色',next=>next.patches=[]),`清除 ${d.patches.length} 个拼色片`)));
  }
  private buildTools(d:SkirtDesign){this.tabs.replaceChildren();const entries=Object.entries(views);for(const [index,[id,name]] of entries.entries()){const b=button(name.replace(/^\d+ /,''),()=>this.edit('切换裙子画布',next=>next.canvas_view=id as CanvasView));b.classList.add('skirt-view-tab');b.dataset.view=id;b.id=`skirt-tab-${id}`;b.style.setProperty('--tab-color',['#5272df','#d0758e','#9b74ce'][index]);b.setAttribute('role','tab');b.setAttribute('aria-controls','skirt-pattern-panel');b.setAttribute('aria-selected',String(d.canvas_view===id));b.tabIndex=d.canvas_view===id?0:-1;b.classList.toggle('active',d.canvas_view===id);b.onkeydown=e=>{let target=index;if(e.key==='ArrowRight')target=(index+1)%entries.length;else if(e.key==='ArrowLeft')target=(index+entries.length-1)%entries.length;else if(e.key==='Home')target=0;else if(e.key==='End')target=entries.length-1;else return;e.preventDefault();this.focusView=entries[target][0];this.edit('切换裙子画布',next=>next.canvas_view=entries[target][0] as CanvasView);};this.tabs.append(b);}
    this.tools.replaceChildren();this.pattern.turnTool=this.tool==='turn';if(d.canvas_view==='front'){const turn=button('转裙面',()=>{this.tool='turn';this.buildTools(this.host.get()!);},'左右拖动循环查看裙面；绘制时也可用右键拖动');turn.classList.toggle('active',this.tool==='turn');this.tools.append(turn,button('一键反面',()=>this.pattern.flip(),'切到当前面的对面（转半圈）'),button('复位平铺',()=>this.pattern.resetView(),'回到正面并复位缩放和平移')); const link=button(this.mirror?'正反同步':'独立绘制',()=>{this.mirror=!this.mirror;this.buildTools(this.host.get()!);},'只同步之后新画的笔迹与拼色；已有图案不受影响');link.setAttribute('aria-pressed',String(this.mirror));this.tools.append(link);}for(const [id,label] of [['select','移动镶边'],['pen','画笔'],['patch','拼色片']] as const){const b=button(label,()=>{this.tool=id;this.buildTools(this.host.get()!);});b.classList.toggle('active',this.tool===id);this.tools.append(b);}
    const ink=el('input');ink.type='color';ink.value=this.ink;ink.setAttribute('aria-label','裙子画笔颜色');ink.oninput=()=>this.ink=ink.value;this.tools.append(ink);
    const size=el('input');size.type='range';size.min='1';size.max='50';size.step='1';size.value=String(this.brush*1000);size.setAttribute('aria-label','裙子笔宽');size.oninput=()=>this.brush=Number(size.value)/1000;size.style.width='70px';this.tools.append(size);
    this.tools.append(button(this.pattern.guides?'隐藏褶线':'显示褶线',()=>{this.pattern.guides=!this.pattern.guides;this.pattern.draw();this.buildTools(this.host.get()!);}));
  }
  private down(uv:UV,e:PointerEvent){if(this.tool==='turn')return;const current=this.host.get();if(!current)return;this.start=uv;this.pointer=e.pointerId;this.draft=structuredClone(current);this.dirtyStroke=false;this.strokeStart=current.strokes.length;this.patchStart=current.patches.length;this.patchPieces=[];
    if(this.tool==='select'){const b=[...this.draft.bands].reverse().find(x=>uv[1]>=x.start&&uv[1]<=x.end);if(!b){this.cancel();return;}this.selected=b.id;this.bandStart=b.start;this.bandWidth=b.end-b.start;}
    else if(this.tool==='pen'){if(this.draft.strokes.length>=256){this.cancel();this.host.status('笔迹已达 256 条，请整理后继续');return;}this.draft.strokes.push({id:newId(),color:this.ink,width:this.brush,points:[uv]});}
    else {if(this.draft.patches.length>=64){this.cancel();this.host.status('拼色片最多 64 片');return;}this.patchU=uv[0];this.patchLastU=uv[0];}
    this.displaySoon();
  }
  private move(uv:UV|null,e:PointerEvent){if(e.pointerId!==this.pointer||!this.draft||!this.start||!uv)return;
    if(this.tool==='select'){const b=this.draft.bands.find(x=>x.id===this.selected)!;b.start=Math.max(0,Math.min(1-this.bandWidth,this.bandStart+uv[1]-this.start[1]));b.end=b.start+this.bandWidth;}
    else if(this.tool==='pen'){let stroke=this.draft.strokes.at(-1)!;const last=stroke.points.at(-1)!;
      if(Math.abs(last[0]-uv[0])>.5){
        if(this.draft.strokes.length>=256)return;
        const end=uv[0]+(uv[0]<last[0]?1:-1),edge=uv[0]<last[0]?1:0,t=(edge-last[0])/(end-last[0]),v=last[1]+(uv[1]-last[1])*t;
        stroke.points.push([edge,v]);stroke={id:newId(),color:this.ink,width:this.brush,points:[[1-edge,v],uv]};this.draft.strokes.push(stroke);
      }else if(Math.hypot(last[0]-uv[0],last[1]-uv[1])>.0015)stroke.points.push(uv);
    }else {
      let delta=uv[0]-this.patchLastU;if(delta>.5)delta-=1;else if(delta<-.5)delta+=1;this.patchU+=delta;this.patchLastU=uv[0];
      const v0=Math.min(this.start[1],uv[1]),v1=Math.max(this.start[1],uv[1]);
      const pieces=splitSeamSpan(Math.min(this.start[0],this.patchU),Math.max(this.start[0],this.patchU));
      this.draft.patches=this.draft.patches.filter(x=>!this.patchPieces.includes(x.id));
      this.patchPieces=pieces.filter(([u0,u1])=>u1-u0>.001&&v1-v0>.001).map(([u0,u1])=>{const id=newId();this.draft!.patches.push({id,u0,u1,v0,v1,color:this.ink,pattern:'solid' as Pattern,repeat:32});return id;});
    }
    this.dirtyStroke=true;this.displaySoon();
  }
  private up(){if(!this.draft||!this.start)return;const next=this.draft,tool=this.tool;this.draft=undefined;this.start=undefined;this.pointer=-1;
    if(tool==='patch')next.patches=next.patches.filter(x=>!this.patchPieces.includes(x.id)||(x.u1-x.u0>.001&&x.v1-x.v0>.001));
    if(tool==='select'&&!this.dirtyStroke){this.strokeStart=0;this.patchStart=0;this.patchPieces=[];this.refresh();return;}
    const strokeStart=this.strokeStart,patchStart=this.patchStart;this.strokeStart=0;this.patchStart=0;this.patchPieces=[];
    try{const result=next.canvas_view==='front'&&this.mirror&&tool!=='select'?mirrorNewMarks(next,strokeStart,patchStart):next;this.commit(tool==='pen'?'裙面笔迹':tool==='patch'?'绘制拼色片':'移动镶边',result);}catch(e){report(e);this.refresh();}
  }
  private cancel(){if(!this.draft)return;this.draft=undefined;this.start=undefined;this.pointer=-1;this.strokeStart=0;this.patchStart=0;this.patchPieces=[];const d=this.host.get();if(d)this.display(d);}
  private async importDesign(){const file=await chooseFile('.json');if(!file)return;if(file.size>4_000_000)throw Error('设计 JSON 超过 4 MB');const next=parseDesign(JSON.parse(await file.text()));this.selected='';this.commit('导入裙子设计',next);this.host.status('已导入可编辑裙子设计');}
}
