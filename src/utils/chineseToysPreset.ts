import type { Layer, PapercutProject, Point } from '../types/papercut';
import { CHINESE_TOY_PARTS, CHINESE_TOY_CORDS } from './chineseToysTrace';
import { transformPathD } from './pathTransform';
import { strokeOutline, type StrokeStyle } from './strokePath';
import { generateWillowShape } from './willowShape';

const C={blue:'#3052BA',orange:'#F67736',pink:'#EF57AC',red:'#D93535',ink:'#302B39',white:'#F1E9DE',yellow:'#EEE78D',mint:'#B9D8BA',green:'#386C67',cyan:'#91C8D3',purple:'#8C577E',bamboo:'#A69875'};
const ellipse=(x:number,y:number,rx:number,ry=rx)=>`M${x-rx} ${y} A${rx} ${ry} 0 1 0 ${x+rx} ${y} A${rx} ${ry} 0 1 0 ${x-rx} ${y} Z`;
const poly=(p:number[][])=>`M${p.map(v=>v.join(' ')).join(' L')} Z`;
const diamond=(x:number,y:number,w:number,h:number)=>poly([[x,y-h],[x+w,y],[x,y+h],[x-w,y]]);
const scale=(d:string)=>transformPathD(d,[2,0,0,2,0,0]);

/** Physical paper pieces and clipped surface painting, reconstructed in reference coordinates. */
export function createChineseToysPreset():PapercutProject {
  let seq=0,category='hanging',object='';
  const layers:Record<string,Layer>={},order:string[]=[],categories:Record<string,string[]>={hanging:[],girl:[],wheels:[],toys:[]};
  const objects:Record<string,{name:string;ids:string[];x:number;y:number}>={};
  const begin=(id:string,name:string,x:number,y:number)=>{object=id;objects[id]={name,ids:[],x,y};};
  const paper=(id:string,name:string,color:string,d:string):Layer=>{
    const key=`ct_${id}`,l:Layer={id:key,name,color,texture:'smooth',grain:0,opacity:1,blendMode:'normal',visible:true,locked:false,baseShape:{type:'freeform',d:scale(d)},cutouts:[],positiveElements:[],drawings:[]};
    layers[key]=l;order.push(key);categories[category]?.push(key);if(object)objects[object].ids.push(key);return l;
  };
  const paint=(l:Layer,d:string,color:string,brushType:'pen'|'willow'='pen')=>l.drawings!.push({id:`ct_paint_${seq++}`,brushType,d:scale(d),color,opacity:1,strokeWidth:0,fill:true});
  const pen=(l:Layer,d:string,color:string,width=.8)=>l.drawings!.push({id:`ct_pen_${seq++}`,brushType:'pen',d:scale(d),color,opacity:1,strokeWidth:width*2,strokeLinecap:'round',strokeLinejoin:'round'});
  const leaf=(l:Layer,x:number,y:number,dx:number,dy:number,w:number,color:string)=>{
    const n=Math.hypot(dx,dy),nx=-dy/n*w,ny=dx/n*w;
    const points:Point[]=[{x,y},{x:x+dx*.3+nx,y:y+dy*.3+ny},{x:x+dx*.7+nx,y:y+dy*.7+ny},{x:x+dx,y:y+dy}];
    paint(l,generateWillowShape(points,'symmetric'),color,'willow');
  };
  const line=(l:Layer,name:string,pts:number[][],color:string,width:number)=>{
    const points=pts.map(([x,y])=>({x:x*2,y:y*2})),stroke:StrokeStyle={width:width*2,round:.08,cap:'round',smooth:points.map(()=>false)};
    l.positiveElements.push({id:`ct_line_${seq++}`,name,type:'geom_shape',geomType:'path',points,stroke,d:strokeOutline(points,stroke),isHole:false,fillColor:color,createdAt:seq});
  };
  const applique=(l:Layer,name:string,d:string,color:string)=>l.positiveElements.push({id:`ct_applique_${seq++}`,name,type:'custom_polygon',d:scale(d),isHole:false,fillColor:color,createdAt:seq});
  category='';paper('ground','橙色桌面',C.orange,'M0 372 L500 377 V500 H0 Z').locked=true;
  category='hanging';begin('cords','吊饰悬线',250,0);
  const cords=paper('cords','悬挂绳 · 矢量连线',C.white,'');
  CHINESE_TOY_CORDS.forEach((p,i)=>line(cords,`悬线 ${i+1}`,p,C.white,.9));
  const tassel=(id:string,x:number,y:number,h:number,a:string,b:string)=>{
    paper(`${id}_a`,'流苏 · 左纸条',a,poly([[x-2,y],[x,y],[x,y+h],[x-7,y+h]]));
    paper(`${id}_b`,'流苏 · 右纸条',b,poly([[x,y],[x+2,y],[x+7,y+h],[x,y+h]]));
  };
  const lozenge=(id:string,x:number,y:number,w:number,h:number,a:string,b:string)=>{
    const l=paper(id,'方胜 · 折纸菱花',a,diamond(x,y,w,h));
    applique(l,'内菱花',diamond(x,y,w*.63,h*.63),b);applique(l,'菱花心',diamond(x,y,w*.35,h*.35),a);
    const pts=[[x,y-h],[x+w,y],[x,y+h],[x-w,y]];
    for(let edge=0;edge<4;edge++)for(let k=0;k<3;k++){
      const p=pts[edge],q=pts[(edge+1)%4],t=(k+.5)/3,dx=q[0]-p[0],dy=q[1]-p[1],cx=p[0]+dx*t,cy=p[1]+dy*t,n=Math.hypot(dx,dy),nx=-dy/n*1.8,ny=dx/n*1.8,s=.1;
      applique(l,'纸边方格',poly([[cx-dx*s+nx,cy-dy*s+ny],[cx+dx*s+nx,cy+dy*s+ny],[cx+dx*s-nx,cy+dy*s-ny],[cx-dx*s-nx,cy-dy*s-ny]]),C.white);
    }return l;
  };
  const fish=(id:string,x:number,y:number)=>paper(id,'红鱼 · 纸片',C.red,`M${x+12} ${y-5} L${x+22} ${y-8} V${y+9} L${x+12} ${y+6} Q${x-5} ${y+18} ${x-19} ${y+4} Q${x-22} ${y} ${x-16} ${y-7} Q${x} ${y-23} ${x+12} ${y-5} Z`);
  const heart=(id:string,x:number,y:number)=>{
    const l=paper(id,'心形 · 拼色纸',C.red,`M${x} ${y+20} C${x-28} ${y-8} ${x-12} ${y-18} ${x} ${y-10} C${x+17} ${y-23} ${x+25} ${y} ${x} ${y+20} Z`);
    applique(l,'心形右半',`M${x} ${y-10} C${x+17} ${y-23} ${x+25} ${y} ${x} ${y+20} Z`,C.green);
  };
  const swallow=(id:string,x:number,y:number)=>{
    const l=paper(id,'燕形 · 拼色纸',C.ink,`M${x-20} ${y-10} Q${x} ${y-7} ${x+20} ${y-10} V${y+3} Q${x+18} ${y+18} ${x} ${y+14} Q${x-20} ${y+18} ${x-20} ${y+3} Z`);
    applique(l,'折叠三角',poly([[x-20,y-10],[x+20,y-10],[x,y+13]]),x>300?C.green:C.red);
    if(x>150)applique(l,'燕尾色片',`M${x} ${y+14} L${x+20} ${y-10} V${y+3} Q${x+18} ${y+18} ${x} ${y+14} Z`,x>300?C.yellow:C.cyan);
  };
  const doll=(id:string,x:number,y:number,color:string)=>{
    const l=paper(id,'人形吊饰 · 剪纸',color,`M${x-6} ${y-9} Q${x-17} ${y-16} ${x-11} ${y-2} L${x-5} ${y+7} L${x-18} ${y+23} L${x-4} ${y+20} L${x} ${y+14} L${x+4} ${y+20} L${x+19} ${y+23} L${x+7} ${y+7} Q${x+23} ${y-17} ${x+6} ${y-9} Q${x+2} ${y-23} ${x-6} ${y-9} Z`);
    if(y<18)l.baseShape.d=scale(`M${x-15} 0 H${x+16} L${x+7} ${y+7} L${x+19} ${y+23} L${x+4} ${y+20} L${x} ${y+14} L${x-4} ${y+20} L${x-18} ${y+23} L${x-5} ${y+7} Z`);
    paint(l,ellipse(x,y-5,5,7),color===C.pink?C.red:C.white);paint(l,poly([[x-7,y+9],[x+7,y+9],[x,y+18]]),C.red);
  };
  begin('hang_1','菱花长串',35,130);
  lozenge('diamond_1',39,32,19,14,C.cyan,C.green);lozenge('diamond_2',37,80,24,18,C.green,C.ink);lozenge('diamond_3',35,136,28,20,C.pink,C.red);lozenge('diamond_4',33,193,26,18,C.cyan,C.green);lozenge('diamond_5',33,241,17,12,C.purple,C.ink);tassel('tassel_1',32,270,58,C.pink,C.green);
  begin('hang_2','燕子与心',97,130);swallow('swallow_1',99,28);doll('doll_1',98,74,C.cyan);
  const ring=paper('ring','圆环 · 折纸',C.green,ellipse(96,129,15));
  ring.cutouts.push({id:`ct_hole_${seq++}`,name:'菱形镂空',type:'custom_polygon',d:scale(diamond(96,129,8,10)),isHole:true,createdAt:seq});
  for(let i=0;i<22;i++){const a=i*Math.PI*2/22,cs=Math.cos(a),sn=Math.sin(a);applique(ring,'环边刻纹',poly([[96+cs*11-sn,129+sn*11+cs],[96+cs*15-sn,129+sn*15+cs],[96+cs*15+sn,129+sn*15-cs],[96+cs*11+sn,129+sn*11-cs]]),C.white);}
  heart('heart_1',94,169);tassel('tassel_2',94,199,41,C.yellow,C.cyan);
  begin('hang_3','气球与红鱼',155,100);paper('balloon','气球 · 粉纸',C.pink,'M158 0 H145 C138 12 149 31 157 36 Z');paper('balloon_half','气球 · 蓝纸',C.cyan,'M158 0 H170 C179 9 170 26 157 36 Z');lozenge('diamond_6',156,61,20,14,C.cyan,C.green);fish('fish_1',157,103);tassel('tassel_3',155,130,47,C.yellow,C.pink);
  begin('hang_4','方胜与花',216,100);lozenge('diamond_7',217,33,16,18,C.red,C.white);swallow('swallow_2',218,68);doll('doll_2',217,112,C.pink);tassel('tassel_4',216,142,49,C.green,C.red);
  begin('hang_5','红鱼长串',275,100);lozenge('diamond_8',276,17,22,18,C.cyan,C.mint);heart('heart_2',276,58);fish('fish_2',279,104);tassel('tassel_5',274,131,49,C.pink,C.cyan);
  begin('hang_6','小人与方胜',335,60);doll('doll_3',335,7,C.yellow);lozenge('diamond_9',334,66,20,16,C.red,C.white);tassel('tassel_6',336,95,44,C.red,C.green);
  begin('hang_7','燕子长穗',393,55);swallow('swallow_3',395,33);tassel('tassel_7',393,62,41,C.green,C.yellow);
  begin('hang_8','重菱长串',455,65);lozenge('diamond_10',455,37,21,14,C.cyan,C.green);lozenge('diamond_11',455,82,20,16,C.red,C.white);tassel('tassel_8',455,112,43,C.yellow,C.green);

  category='wheels';begin('windmill','七轮风车',380,375);
  const frame=paper('frame','竹架 · 矢量连线',C.bamboo,'');
  [[[381,140],[377,375]],[[334,191],[332,345],[425,345],[430,195]],[[300,247],[463,252]],[[334,193],[429,194]],[[333,304],[427,309]]].forEach((p,i)=>line(frame,`竹架连杆 ${i+1}`,p,C.bamboo,3.5));
  const wheels:[number,number,number,string[]][]=[
    [381,141,28,[C.red,C.mint,C.yellow,C.red,C.yellow,C.mint]],[334,193,28,[C.white,C.pink,C.green,C.white,C.pink,C.green]],
    [429,194,28,[C.yellow,C.mint,C.purple,C.yellow,C.mint,C.purple]],[299,248,29,[C.purple,C.yellow,C.purple,C.yellow,C.mint,C.yellow]],
    [463,252,28,[C.pink,C.mint,C.pink,C.white,C.green,C.white]],[333,304,29,[C.white,C.green,C.pink,C.white,C.pink,C.green]],
    [427,309,29,[C.red,C.yellow,C.cyan,C.red,C.yellow,C.cyan]],
  ];
  wheels.forEach(([x,y,r,colors],wi)=>{
    paper(`wheel_${wi}_rim`,`风车 ${wi+1} · 圆纸边`,C.pink,ellipse(x,y,r+1.5));
    for(let i=0;i<6;i++){const a=(i*60-8)*Math.PI/180,b=((i+1)*60-8)*Math.PI/180;paper(`wheel_${wi}_blade_${i}`,`风车 ${wi+1} · 扇面 ${i+1}`,colors[i],`M${x} ${y} L${x+Math.cos(a)*r} ${y+Math.sin(a)*r} A${r} ${r} 0 0 1 ${x+Math.cos(b)*r} ${y+Math.sin(b)*r} Z`);}
    paper(`wheel_${wi}_hub`,`风车 ${wi+1} · 轴心`,C.purple,ellipse(x,y,2.2));
  });
  const flags:[number[][],string][]=[[[[273,205],[294,187],[295,212]],C.red],[[[359,96],[382,77],[383,96]],C.red],[[[307,148],[328,128],[330,152]],C.yellow],[[[464,189],[490,198],[464,213]],C.yellow],[[[425,132],[443,137],[425,151]],C.green],[[[416,247],[435,252],[416,272]],C.red]];
  flags.forEach(([p,c],i)=>paper(`flag_${i}`,'风车 · 彩旗',c,poly(p)));

  category='girl';begin('girl','女孩与拨浪鼓',180,373);
  const shirt=paper('shirt','女孩 · 粉色上衣',C.pink,'M143 282 C123 293 101 317 99 341 Q97 369 120 373 L239 374 Q266 366 259 336 C254 311 236 292 211 282 Z');
  pen(shirt,'M149 287 L158 312 M205 285 L198 313',C.white,.8);
  for(const [x,y] of [[131,325],[207,317]])paint(shirt,ellipse(x,y,2),C.ink);
  pen(shirt,'M130 328 Q139 334 143 325 M204 319 Q197 329 188 321',C.yellow,1);
  for(const side of [-1,1]){
    for(let i=0;i<5;i++)paper(`braid_${side}_${i}`,'女孩 · 辫节',i%2?C.green:C.ink,ellipse(180+side*(54+i*8),259+i*8,9,7));
    const x=180+side*86;paper(`braid_end_${side}`,'女孩 · 辫梢',C.ink,poly([[x-5,292],[x+5,292],[x+10,302],[x+6,303],[x+4,298],[x+4,305],[x,306],[x-1,300],[x-3,307],[x-7,305],[x-4,298],[x-10,303],[x-12,300]]));
  }
  paper('hair','女孩 · 后发',C.ink,'M127 253 C123 220 150 211 176 211 C204 209 223 224 225 252 L217 279 H138 Z');
  const face=paper('face','女孩 · 脸与耳',C.white,'M137 241 Q175 228 215 241 L221 263 Q230 255 229 268 Q228 279 216 277 Q205 296 180 297 Q151 297 137 279 Q126 282 127 269 Q126 258 134 263 Z');
  paper('fringe','女孩 · 锯齿刘海',C.ink,'M129 238 Q174 214 222 237 L217 255 L210 241 L205 251 L195 251 L190 240 L185 251 L175 251 L170 238 L165 251 L155 251 L150 239 L145 251 L134 251 Z');
  leaf(face,145,265,22,3,3,C.ink);leaf(face,189,268,21,-3,3,C.ink);
  pen(face,'M148 260 Q157 256 166 260 M191 260 Q200 256 208 260',C.ink,.7);paint(face,'M167 283 Q178 287 191 283 Q180 291 167 283 Z',C.red);
  paper('fan_handle','拨浪鼓 · 手柄',C.white,'M175 360 Q180 352 187 360 L188 375 H173 Z');
  paper('fan_body','拨浪鼓 · 红纸扇面',C.red,'M143 351 Q148 321 164 316 Q195 306 214 337 L222 353 Q182 363 143 351 Z');
  const fan=paper('fan_medallion','拨浪鼓 · 圆形贴片',C.green,ellipse(167,323,19,20));
  leaf(fan,158,329,-3,-14,1.7,C.pink);leaf(fan,165,323,2,-14,2,C.pink);leaf(fan,171,323,7,-10,1.6,C.pink);leaf(fan,170,331,10,-3,2,C.ink);

  category='toys';
  const toy=(id:string,name:string,color:string,x:number,y:number)=>{
    begin(id,name,x,y);const traced=CHINESE_TOY_PARTS.find(p=>p.id===id)!;
    const d=traced.outline.map(p=>transformPathD(p.d,[1,0,0,1,p.offset[0],p.offset[1]]).match(/M[^M]+/g)?.[0]??'').join(' ');
    return paper(id,`${name} · 底形`,color,d);
  };
  const horse=toy('horse','泥马与骑手',C.yellow,62,481);
  paint(horse,'M20 450 Q45 461 55 451 Q69 463 96 448 L99 481 H19 Z',C.cyan);paint(horse,'M31 382 Q40 370 65 377 L73 402 L65 447 Q49 457 37 446 Z',C.red);
  paint(horse,'M39 416 Q49 414 54 421 L52 440 L65 440 L62 447 L42 445 Z',C.ink);paint(horse,'M45 350 Q60 341 69 352 L71 367 L42 369 Z',C.ink);
  paint(horse,ellipse(58,353,4,2),C.red);paint(horse,'M45 369 L70 370 Q70 391 57 391 Q44 389 45 369 Z',C.white);
  paint(horse,'M49 374 Q55 370 58 380 Q62 368 66 374 Q65 383 58 386 Q51 382 49 374 Z',C.pink);paint(horse,ellipse(82,396,7,8),C.mint);
  pen(horse,'M79 387 L85 391 L93 391 M95 398 L108 405 M96 409 L112 409',C.green,.7);paint(horse,ellipse(96,397,1.1),C.ink);paint(horse,'M99 409 Q108 402 116 410 L113 417 L100 417 Z',C.red);
  for(let i=0;i<4;i++){pen(horse,`M${23+i*5} ${418+i%2*4} q-5 12 1 15 q6 -3 5 -12`,C.green,.7);pen(horse,`M${73+i*5} ${418+i%2*5} q-2 12 2 16 q5 -3 4 -12`,C.green,.7);}
  paint(horse,'M35 478 Q36 456 45 455 Q54 456 54 479 Z M70 479 Q69 463 76 463 Q87 463 87 479 Z',C.green);
  const rooster=toy('rooster','泥鸡',C.green,159,438);
  paint(rooster,'M137 397 Q142 384 149 391 L151 405 L141 407 Z',C.yellow);paint(rooster,ellipse(144,396,2),C.ink);paint(rooster,'M139 412 Q153 420 171 409 Q184 414 171 427 Q153 441 139 424 Z',C.red);
  paint(rooster,'M148 415 Q160 420 168 414 Q163 429 151 424 Z',C.ink);leaf(rooster,173,403,4,-9,1.6,C.yellow);leaf(rooster,178,405,6,-9,1.4,C.yellow);paint(rooster,'M144 432 L170 431 L166 438 L148 439 Z',C.white);
  const black=toy('black_horse','黑泥马',C.ink,226,417);
  [[207,378,1,9],[211,399,1,11],[218,393,1,9],[226,391,1,10],[234,391,0,11],[241,393,0,10]].forEach(([x,y,dx,dy],i)=>leaf(black,x,y,dx,dy,1.5,[C.red,C.yellow,C.cyan][i%3]));paint(black,ellipse(207,377,1.2),C.white);
  const lionFace=(l:Layer,x:number,y:number,s:number)=>{
    const t=(d:string)=>transformPathD(d,[s,0,0,s,x,y]);
    paint(l,t('M-13 -10 Q-8 -14 -3 -10 Q-8 -7 -13 -10 Z M3 -10 Q8 -14 13 -10 Q8 -7 3 -10 Z'),C.ink);
    pen(l,t('M-14 -15 Q-8 -19 -3 -14 M3 -14 Q8 -19 14 -15'),C.green,.9*s);paint(l,t('M-3 -4 L0 -8 L3 -4 L0 -2 Z'),C.red);
    pen(l,t('M-2 0 Q-9 -4 -17 -1 M2 0 Q9 -4 17 -1 M-2 2 L-16 5 M2 2 L16 5'),C.ink,.7*s);
    paint(l,t('M-14 13 C-15 0 15 0 14 13 Q4 7 0 11 Q-5 7 -14 13 Z'),C.red);pen(l,t('M-10 12 Q0 6 10 12 M-7 12 L-6 17 M0 11 L0 17 M7 12 L6 17'),C.ink,.7*s);
    leaf(l,x-2*s,y-18*s,-2*s,-6*s,1.2*s,C.red);leaf(l,x+2*s,y-18*s,2*s,-6*s,1.2*s,C.red);
  };
  const blue=toy('blue_lion','蓝泥狮',C.cyan,200,491);
  paint(blue,'M165 490 L162 496 L239 496 L235 489 Z',C.white);pen(blue,'M162 475 Q167 462 170 478 Q173 481 177 474 M181 477 L183 482',C.ink,1);
  const blueFace=paper('blue_lion_face','蓝泥狮 · 白脸纸片',C.white,'M195 439 Q195 431 203 432 L213 435 L230 432 Q239 436 240 452 L237 470 Q215 479 195 470 Z');lionFace(blueFace,216,452,.9);
  for(let i=0;i<6;i++)paint(blue,ellipse(196+i*8,474,2,3),i%2?C.red:C.green);
  const yellow=toy('yellow_lion','黄泥狮',C.yellow,334,468);
  paint(yellow,'M277 466 L278 453 Q287 446 295 453 L296 463 L305 463 L306 455 Q312 449 318 456 L320 465 L339 465 L341 456 Q349 453 361 457 L369 464 L385 464 L384 471 Z',C.ink);
  pen(yellow,'M277 467 L294 469 L295 460 M320 466 L338 467 M361 458 L367 467 L384 469',C.white,2);paint(yellow,'M381 411 Q393 405 400 414 Q406 423 398 431 L393 421 Z',C.green);
  [[351,437,0,-8],[359,435,-2,-10],[367,433,0,-11],[375,435,4,-8]].forEach(([x,y,dx,dy])=>leaf(yellow,x,y,dx,dy,1.6,C.green));leaf(yellow,382,440,6,-9,2,C.red);leaf(yellow,352,441,-5,-7,1.8,C.red);paint(yellow,ellipse(368,444,6,2.1),C.ink);
  const mane=paper('yellow_lion_mane','黄泥狮 · 鬃圈',C.purple,'M275 377 Q301 359 326 377 Q342 396 330 421 Q302 438 273 422 Q262 398 275 377 Z');
  const yellowFace=paper('yellow_lion_face','黄泥狮 · 白脸纸片',C.white,'M282 369 Q298 376 312 369 Q326 369 328 386 L329 413 Q317 426 300 426 Q284 426 273 413 L274 386 Q273 374 282 369 Z');lionFace(yellowFace,301,394,1.15);
  for(const [x,y] of [[275,379],[271,389],[272,402],[276,415],[282,427],[294,430],[307,430],[320,427],[329,416],[333,403],[332,389],[326,377]])paint(mane,ellipse(x,y,3.7,5.1),Math.round(x)%2?C.green:C.ink);
  for(const [x,y] of [[284,370],[294,368],[306,368],[316,370]])paint(yellowFace,ellipse(x,y,3.5,4),x%3?C.green:C.red);
  const clayDoll=toy('doll','彩绘泥娃娃',C.green,452,484);
  paint(clayDoll,'M428 436 L438 434 Q451 441 466 433 L472 479 Q455 474 426 480 Z',C.white);paint(clayDoll,ellipse(449,410,16,18),C.white);
  paint(clayDoll,'M433 408 Q437 389 452 390 Q467 390 472 408 L462 398 L442 398 Z',C.ink);paint(clayDoll,'M441 405 Q447 400 450 412 Q454 401 460 407 Q462 415 451 423 Q441 421 441 405 Z',C.pink);paint(clayDoll,ellipse(451,399,2.7),C.red);
  for(const [x,y] of [[441,377],[456,376]])paint(clayDoll,ellipse(x,y,5,5),C.pink);leaf(clayDoll,449,383,-5,-7,1.5,C.yellow);leaf(clayDoll,451,383,5,-7,1.4,C.red);
  [[445,450,-4,-10],[450,448,0,-11],[456,449,4,-9],[459,456,8,3],[445,456,-7,4],[452,458,-1,9]].forEach(([x,y,dx,dy],i)=>leaf(clayDoll,x,y,dx,dy,1.5,i%2?C.red:C.green));paint(clayDoll,ellipse(451,453,2),C.ink);paint(clayDoll,ellipse(432,477,9,6),C.ink);paint(clayDoll,ellipse(472,477,9,6),C.ink);
  const names:Record<string,string>={hanging:'悬挂纸玩具',girl:'女孩与拨浪鼓',wheels:'七轮风车',toys:'泥玩具 · 纸底与彩绘'};
  return {id:'proj_chinese_toys',name:'中国玩具',width:1000,height:1000,canvasBg:{kind:'solid',color:C.blue},backgroundColor:C.blue,backgroundStyle:'rice_paper',paperMode:'vector',shadowStrength:0,groups:[],layers,rootOrder:order.map(id=>({type:'layer',id})),
    drawingGroups:Object.entries(categories).map(([id,layerIds])=>({id:`ct_group_${id}`,name:names[id],layerIds,collapsed:true,visible:true,locked:false})),
    items:Object.entries(objects).map(([id,v])=>({id:`ct_item_${id}`,name:v.name,partIds:v.ids,pivot:{x:v.x*2,y:v.y*2},sockets:[]}))};
}
