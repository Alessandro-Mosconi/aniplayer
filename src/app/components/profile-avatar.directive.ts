import {Directive,ElementRef,HostListener,inject} from '@angular/core';
import {avatarUrl} from '../core/profiles';
@Directive({selector:'img[profileAvatar]',standalone:true})
export class ProfileAvatarDirective {
 private readonly element:ElementRef<HTMLImageElement>=inject(ElementRef);
 @HostListener('error') fallback(){const image=this.element.nativeElement;const fallback=avatarUrl('generated:0');if(image.getAttribute('src')!==fallback){image.src=fallback;image.title='Immagine non disponibile. Riprova tra poco.';}}
}
