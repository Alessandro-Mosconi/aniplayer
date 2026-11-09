import {Injectable,signal} from '@angular/core';
import {Anime} from './models';
export type RouteName='home'|'catalog'|'detail'|'favorites'|'history'|'settings'|'mal'|'diagnostics'|'related'|'my-anime'|'explore';
export interface RouteState {name:RouteName;anime?:Anime;page?:number;filters?:Record<string,unknown>;}
export function isBaseRoute(name:RouteName){return ['home','catalog','explore','my-anime','favorites','history','settings'].includes(name);}
@Injectable({providedIn:'root'})
export class NavigationService {
 readonly route=signal<RouteState>({name:'home'});private stack:RouteState[]=[];
 open(name:RouteName,params:Omit<RouteState,'name'>={},push=true){if(push)this.stack.push(this.route());this.route.set({name,...params});}
 back(){if(this.stack.length)this.route.set(this.stack.pop()!);else this.route.set({name:'home'});}
 replace(name:RouteName,params:Omit<RouteState,'name'>={}){this.open(name,params,false);}
}
