export class WatchProgress{
 duration:number;ranges:number[][];last:{position:number;time:number;playing:boolean}|null;continuous:number;
 constructor(saved:any=null){this.duration=Number(saved?.duration)||0;this.ranges=Array.isArray(saved?.ranges)?saved.ranges.filter((r:any)=>Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)&&r[0]>=0&&r[1]>r[0]).map((r:number[])=>r.slice()):[];this.last=null;this.continuous=0;}
 sample(position:number,duration:number,playing:boolean,now=Date.now()){
  if(!Number.isFinite(position)||position<0||!Number.isFinite(duration)||duration<=0){this.last=null;return false;}
  if(this.duration&&Math.abs(this.duration-duration)>Math.max(5,duration*.01))this.ranges=[];
  this.duration=duration;const previous=this.last;this.last={position,time:now,playing};
  const elapsed=previous?(now-previous.time)/1000:0,delta=previous?position-previous.position:0;
  if(previous?.playing&&playing&&elapsed>0&&elapsed<=15&&delta>0&&delta<=elapsed*1.5+.5){
   this.continuous+=delta;this.ranges.push([previous.position,Math.min(position,duration)]);this.merge();
  }else this.continuous=0;
  return this.complete(position);
 }
 merge(){const merged:number[][]=[];for(const r of this.ranges.sort((a,b)=>a[0]-b[0])){const end=merged[merged.length-1];if(end&&r[0]<=end[1]+.25)end[1]=Math.max(end[1],r[1]);else merged.push(r.slice());}this.ranges=merged.slice(-300);}
 interrupt(){this.last=null;this.continuous=0;}
 watched(){return this.ranges.reduce((sum,r)=>sum+Math.max(0,Math.min(r[1],this.duration)-r[0]),0);}
 complete(position:number,endingStart?:number){const nearEnd=typeof endingStart==='number'&&Number.isFinite(endingStart)&&endingStart>=this.duration*.5&&endingStart<this.duration?endingStart:this.duration-Math.min(180,this.duration*.1);return this.duration>0&&position>=nearEnd&&this.watched()>=this.duration*.75&&this.continuous>=10;}
 snapshot(){return {duration:this.duration,ranges:this.ranges.map((r:number[])=>r.slice()),updated:Date.now()};}
}
