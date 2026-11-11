import type {IntroWindow} from './intro.service';
/** Translate only at/after a compatible opening; a pre-opening recap may differ. */
export function audioPosition(position:number,from:IntroWindow|null,to:IntroWindow|null){
 if(!from||!to)return {position,aligned:false};
 const numbers=[position,from.start,from.end,to.start,to.end];
 const a=from.end-from.start,b=to.end-to.start,offset=to.start-from.start;
 if(!numbers.every(Number.isFinite)||from.start<0||to.start<0||position<from.start||a<20||a>180||b<20||b>180||Math.abs(a-b)>2||Math.abs(offset)>300)return {position,aligned:false};
 const target=position+offset;return target>=0?{position:target,aligned:true}:{position,aligned:false};
}
