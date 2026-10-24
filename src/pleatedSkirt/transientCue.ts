/** A view-only cue: repeated renders do not prolong its lifetime. */
export class TransientCue {
 private key='';private until=-Infinity;
 constructor(private hold=2200,private fade=450){}
 update(key:string,now:number){if(key!==this.key){this.key=key;this.until=now+this.hold;}}
 alpha(now:number){return Math.max(0,Math.min(1,1-(now-this.until)/this.fade));}
 nextDelay(now:number){return now<this.until?this.until-now:this.alpha(now)>0?40:undefined;}
}
