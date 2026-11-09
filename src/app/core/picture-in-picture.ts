/** Normal background suspension remains active unless video is displayed in PiP. */
export function pictureInPictureActive(host:any,doc:any):boolean {
 try{
  if(host.AniPlayerNative?.isPipActive?.())return true;
  if(doc.pictureInPictureElement)return true;
  return doc.querySelector?.('#html-player')?.webkitPresentationMode==='picture-in-picture';
 }catch{return false;}
}
