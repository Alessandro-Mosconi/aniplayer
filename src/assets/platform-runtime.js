/* Load Samsung's device SDK only on Samsung; other platforms use HTML5 video. */
(function () {
 if (/Tizen/i.test(navigator.userAgent) || window.tizen) {
  var sdk = document.createElement('script'); sdk.src = '$WEBAPIS/webapis/webapis.js'; document.head.appendChild(sdk);
 }
 if (!window.AniPlayerNative) return;
 // Android TV WebView may report 960 CSS px on a 1920px display (density 2).
 // Keep the shared 1920px layout fully inside the visible viewport.
 var viewport=document.querySelector&&document.querySelector('meta[name="viewport"]');
 if(viewport&&window.screen&&window.screen.width>0){var scale=window.screen.width/1920;viewport.setAttribute('content','width=1920,initial-scale='+scale+',minimum-scale='+scale+',maximum-scale='+scale+',user-scalable=no');}
 document.addEventListener('focusin',function(event){var field=event.target;if(window.AniPlayerNative.setKeyboard)window.AniPlayerNative.setKeyboard(!!(field&&field.matches&&field.matches('input,textarea')&&!field.readOnly));});
 document.addEventListener('focusout',function(){if(window.AniPlayerNative.setKeyboard)window.AniPlayerNative.setKeyboard(false);});
 document.addEventListener('keydown',function(event){
  var field=document.activeElement;
  if(event.isTrusted||!field||!field.matches||!field.matches('input,textarea')||field.readOnly||['ArrowLeft','ArrowRight'].indexOf(event.key)<0)return;
  if(typeof field.selectionStart==='number'){var position=event.key==='ArrowLeft'?Math.max(0,field.selectionStart-1):Math.min(field.value.length,field.selectionEnd+1);field.setSelectionRange(position,position);event.preventDefault();}
 },true);
 var pending = new Map(), counter = 0, originalFetch = window.fetch.bind(window);
 window.__aniPlayerNativeChunk = function(id, chunk, last, metadata) {
  var job=pending.get(id);if(!job)return;
  if(!job.chunks)job.chunks=[];job.chunks.push(chunk);
  if(last){metadata.body=job.chunks.join('');job.chunks=null;window.__aniPlayerNativeResponse(id,metadata);}
 };
 window.__aniPlayerNativeResponse = function(id, result) {
  var job = pending.get(id); if (!job) return; pending.delete(id); job.cleanup();
  if (result.error) { job.reject(new TypeError(result.error)); return; }
  var raw = atob(result.body || ''), bytes = new Uint8Array(raw.length);
  for (var i=0; i<raw.length; i++) bytes[i]=raw.charCodeAt(i);
  var response = new Response([204,205,304].indexOf(result.status)>=0?null:bytes,{status:result.status,statusText:result.statusText||'',headers:result.headers||{}});
  Object.defineProperty(response,'url',{value:result.url}); job.resolve(response);
 };
 window.fetch = async function(input, init) {
  var request = new Request(input,init), url = new URL(request.url);
  if (url.origin === location.origin) return originalFetch(input,init);
  if (url.protocol!=='https:' && url.protocol!=='http:') throw new TypeError('Protocollo di rete non supportato');
  var body = ['GET','HEAD'].indexOf(request.method)>=0?null:await request.text();
  return new Promise(function(resolve,reject) {
   var id=String(++counter), signal=request.signal;
   var abort=function(){var job=pending.get(id);if(!job)return;pending.delete(id);job.cleanup();window.AniPlayerNative.cancelRequest(id);reject(new DOMException('Richiesta annullata','AbortError'));};
   if(signal.aborted){reject(new DOMException('Richiesta annullata','AbortError'));return;}
   var timer=setTimeout(abort,45000);
   pending.set(id,{resolve:resolve,reject:reject,cleanup:function(){clearTimeout(timer);signal.removeEventListener('abort',abort);}});
   signal.addEventListener('abort',abort,{once:true});
   try{window.AniPlayerNative.request(id,request.url,request.method,JSON.stringify(Object.fromEntries(request.headers)),body,request.credentials==='include');}
   catch(error){pending.delete(id);clearTimeout(timer);signal.removeEventListener('abort',abort);reject(error);}
  });
 };
})();
