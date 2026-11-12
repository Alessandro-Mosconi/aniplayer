import {Injectable,computed} from '@angular/core';
import {StorageService} from './storage.service';
import {RouteName} from './navigation.service';

export const sidebarItems:{id:RouteName;label:string;icon:string}[]=[
 {id:'home',label:'Home',icon:'⌂'}, {id:'catalog',label:'Catalogo',icon:'⌕'},
 {id:'favorites',label:'Preferiti',icon:'♡'}, {id:'explore',label:'Esplora',icon:'✧'},
 {id:'my-anime',label:'I miei anime',icon:'▥'}, {id:'history',label:'Cronologia',icon:'◷'},
 {id:'settings',label:'Impostazioni',icon:'⚙'}
];
export function normalizeSidebar(saved:any){
 const order:RouteName[]=[];
 for(const id of Array.isArray(saved?.order)?saved.order:[])if(sidebarItems.some(item=>item.id===id)&&!order.includes(id))order.push(id);
 for(const item of sidebarItems)if(!order.includes(item.id))order.push(item.id);
 const hidden=Array.isArray(saved?.hidden)?saved.hidden.filter((id:unknown)=>id!=='settings'&&sidebarItems.some(item=>item.id===id)):[];
 return {order,hidden: hidden as RouteName[]};
}
@Injectable({providedIn:'root'})
export class SidebarService {
 readonly configuration=computed(()=>normalizeSidebar(this.storage.settings()['sidebar']));
 readonly items=computed(()=>this.configuration().order.map(id=>({...sidebarItems.find(item=>item.id===id)!,visible:!this.configuration().hidden.includes(id)})));
 constructor(private storage:StorageService){}
 toggle(id:RouteName){if(id==='settings')return;const config=this.configuration();this.storage.setSetting('sidebar',{...config,hidden:config.hidden.includes(id)?config.hidden.filter(value=>value!==id):[...config.hidden,id]});}
 move(id:RouteName,direction:-1|1){const config=this.configuration(),order=[...config.order],index=order.indexOf(id),target=index+direction;if(index<0||target<0||target>=order.length)return;[order[index],order[target]]=[order[target],order[index]];this.storage.setSetting('sidebar',{...config,order});}
 reset(){this.storage.setSetting('sidebar',null);}
}
