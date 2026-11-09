package org.aniplayer.tv;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.*;
import android.webkit.CookieManager;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Local, trusted Angular UI. External pages always open outside this WebView. */
public class MainActivity extends Activity {
 private static final String ORIGIN="https://appassets.androidplatform.net";
 private WebView web;
 private boolean ready=false;
 private String requestAgent="AniPlayerTV";
 private String launchUrl="";
 private final ExecutorService network=Executors.newFixedThreadPool(6);
 private final Map<String,HttpURLConnection> connections=new ConcurrentHashMap<>();
 private final Set<String> cancelled=ConcurrentHashMap.newKeySet();
 private final Map<String,Future<?>> jobs=new ConcurrentHashMap<>();

 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
  web=new WebView(this);setContentView(web);
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setMediaPlaybackRequiresUserGesture(false);
  settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);requestAgent=settings.getUserAgentString();
  settings.setSupportMultipleWindows(false);settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);
  CookieManager.getInstance().setAcceptCookie(true);
  web.setWebChromeClient(new WebChromeClient());web.addJavascriptInterface(new NativeBridge(),"AniPlayerNative");
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    Uri uri=request.getUrl();if(!ORIGIN.equals(uri.getScheme()+"://"+uri.getAuthority()))return null;
    try{
     String path=uri.getPath();if(path==null||!path.startsWith("/assets/")||path.contains("..")||!request.getMethod().equals("GET"))return empty(404);
     path=path.substring(8);if(path.isEmpty())path="index.html";
     String ext=MimeTypeMap.getFileExtensionFromUrl(path),mime=MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
     if(path.endsWith(".js"))mime="application/javascript";if(path.endsWith(".json"))mime="application/json";
     if(mime==null)mime="application/octet-stream";
     Map<String,String> headers=new HashMap<>();headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src https: http:; media-src https: blob:; object-src 'none'; frame-src 'none'; base-uri 'self'");
     return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open("web/"+path));
    }catch(IOException error){return empty(404);}
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    Uri uri=request.getUrl();if(ORIGIN.equals(uri.getScheme()+"://"+uri.getAuthority()))return false;
    if(request.isForMainFrame())openBrowser(uri.toString());return true;
   }
   @Override public void onPageFinished(WebView view,String url){ready=true;sendLaunch();}
  });
  acceptIntent(getIntent());web.loadUrl(ORIGIN+"/assets/index.html");
 }
 private WebResourceResponse empty(int status){return new WebResourceResponse("text/plain","UTF-8",status,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 private void evaluate(String script){runOnUiThread(()->{if(!isFinishing()&&web!=null)web.evaluateJavascript(script,null);});}
 private void openBrowser(String value){try{Uri uri=Uri.parse(value);if(!"https".equals(uri.getScheme())&&!"http".equals(uri.getScheme()))return;startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}}
 private void acceptIntent(Intent intent){Uri uri=intent.getData();if(uri!=null&&"aniplayer".equals(uri.getScheme())&&"mal".equals(uri.getHost())&&"/callback".equals(uri.getPath()))launchUrl=uri.toString();}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);acceptIntent(intent);sendLaunch();}
 private void sendLaunch(){if(!ready||launchUrl.isEmpty())return;String uri=launchUrl;launchUrl="";evaluate("window.dispatchEvent(new CustomEvent('aniplayer-open-url',{detail:"+JSONObject.quote(uri)+"}));");}
 private void sendKey(String type,String key,int code,boolean repeat){
  evaluate("(function(){var e=new KeyboardEvent("+JSONObject.quote(type)+",{key:"+JSONObject.quote(key)+",keyCode:"+code+",which:"+code+",repeat:"+repeat+",bubbles:true,cancelable:true});var el=document.activeElement||document;var ok=el.dispatchEvent(e);if(ok&&"+JSONObject.quote(type)+"==='keydown'&&"+JSONObject.quote(key)+"==='Enter'&&!"+repeat+"&&el.matches&&el.matches('button,[data-tv-click]'))el.click();})();");
 }
 @Override public boolean dispatchKeyEvent(KeyEvent event){
  int code=event.getKeyCode(),js=0;String key=null;
  switch(code){
   case KeyEvent.KEYCODE_BACK:key="Back";js=10009;break;
   case KeyEvent.KEYCODE_DPAD_UP:key="ArrowUp";js=38;break;case KeyEvent.KEYCODE_DPAD_DOWN:key="ArrowDown";js=40;break;
   case KeyEvent.KEYCODE_DPAD_LEFT:key="ArrowLeft";js=37;break;case KeyEvent.KEYCODE_DPAD_RIGHT:key="ArrowRight";js=39;break;
   case KeyEvent.KEYCODE_DPAD_CENTER:case KeyEvent.KEYCODE_ENTER:key="Enter";js=13;break;
   case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:key="MediaPlayPause";js=10252;break;
   case KeyEvent.KEYCODE_MEDIA_PLAY:key="MediaPlay";js=415;break;case KeyEvent.KEYCODE_MEDIA_PAUSE:key="MediaPause";js=19;break;
   case KeyEvent.KEYCODE_MEDIA_STOP:key="MediaStop";js=413;break;case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:key="MediaFastForward";js=417;break;case KeyEvent.KEYCODE_MEDIA_REWIND:key="MediaRewind";js=412;break;
  }
  if(ready&&key!=null){sendKey(event.getAction()==KeyEvent.ACTION_UP?"keyup":"keydown",key,js,event.getRepeatCount()>0);return true;}return super.dispatchKeyEvent(event);
 }
 @Override public void onBackPressed(){if(ready)sendKey("keydown","Back",10009,false);else super.onBackPressed();}
 @Override protected void onPause(){super.onPause();if(web!=null){evaluate("document.querySelectorAll('video').forEach(function(v){v.pause();});window.dispatchEvent(new Event('aniplayer-suspend'));");web.onPause();}}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onDestroy(){for(HttpURLConnection connection:connections.values())connection.disconnect();network.shutdownNow();if(web!=null){web.removeJavascriptInterface("AniPlayerNative");web.destroy();web=null;}super.onDestroy();}

 private class NativeBridge {
  @JavascriptInterface public void exit(){runOnUiThread(()->finish());}
  @JavascriptInterface public void setKeyboard(boolean visible){runOnUiThread(()->{InputMethodManager ime=(InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);if(visible)web.postDelayed(()->{if(web!=null)ime.showSoftInput(web,InputMethodManager.SHOW_IMPLICIT);},100);else ime.hideSoftInputFromWindow(web.getWindowToken(),0);});}
  @JavascriptInterface public void openExternal(String url){runOnUiThread(()->openBrowser(url));}
  @JavascriptInterface public String consumeLaunchUrl(){String value=launchUrl;launchUrl="";return value;}
  @JavascriptInterface public void cancelRequest(String id){cancelled.add(id);HttpURLConnection connection=connections.remove(id);if(connection!=null)connection.disconnect();/* Queued jobs observe cancellation and clean up in finally. */}
  @JavascriptInterface public void request(String id,String address,String method,String headerJson,String body,boolean credentials){
   if(jobs.size()>=32){respondError(id,"Troppe richieste di rete");return;}
   FutureTask<Void> job=new FutureTask<>(()->{
    try{
     boolean includeCredentials=credentials;
     JSONObject headers=new JSONObject(headerJson);URL url=new URL(address);String currentMethod=method,currentBody=body;
     for(int redirects=0;redirects<=5;redirects++){
      if(cancelled.contains(id)||Thread.currentThread().isInterrupted())return;
      if(!allowed(url))throw new IOException("Indirizzo di rete non consentito");
      HttpURLConnection connection=(HttpURLConnection)url.openConnection();connections.put(id,connection);
      connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(25000);connection.setRequestMethod(currentMethod);
      connection.setRequestProperty("User-Agent",requestAgent);connection.setRequestProperty("Accept-Encoding","identity");
      Iterator<String> names=headers.keys();while(names.hasNext()){String name=names.next();if(!name.equalsIgnoreCase("host")&&!name.equalsIgnoreCase("connection")&&!name.equalsIgnoreCase("cookie"))connection.setRequestProperty(name,headers.getString(name));}
      if(includeCredentials){String cookie=CookieManager.getInstance().getCookie(url.toString());if(cookie!=null)connection.setRequestProperty("Cookie",cookie);}
      if(currentBody!=null&&!currentMethod.equals("GET")&&!currentMethod.equals("HEAD")){connection.setDoOutput(true);try(OutputStream out=connection.getOutputStream()){out.write(currentBody.getBytes(StandardCharsets.UTF_8));}}
      int status=connection.getResponseCode();
      if(includeCredentials)for(Map.Entry<String,List<String>> entry:connection.getHeaderFields().entrySet())if(entry.getKey()!=null&&entry.getKey().equalsIgnoreCase("Set-Cookie"))for(String cookie:entry.getValue())CookieManager.getInstance().setCookie(url.toString(),cookie);
      if(status>=300&&status<=399&&status!=304){String location=connection.getHeaderField("Location");if(location!=null){URL next=new URL(url,location);if(!url.getAuthority().equals(next.getAuthority())||!url.getProtocol().equals(next.getProtocol())){headers.remove("Authorization");headers.remove("authorization");includeCredentials=false;}
       if(status==303||((status==301||status==302)&&currentMethod.equals("POST"))){currentMethod="GET";currentBody=null;}connection.disconnect();url=next;continue;}}
      JSONObject result=new JSONObject(),responseHeaders=new JSONObject();for(Map.Entry<String,List<String>> entry:connection.getHeaderFields().entrySet())if(entry.getKey()!=null&&!entry.getKey().equalsIgnoreCase("Set-Cookie"))responseHeaders.put(entry.getKey(),String.join(", ",entry.getValue()));
      byte[] bytes;InputStream input=status>=400?connection.getErrorStream():connection.getInputStream();try(InputStream stream=input;ByteArrayOutputStream output=new ByteArrayOutputStream()){if(stream!=null){byte[] buffer=new byte[16384];int count;while((count=stream.read(buffer))!=-1){if(output.size()+count>40*1024*1024)throw new IOException("Risposta troppo grande");if(cancelled.contains(id))return;output.write(buffer,0,count);}}bytes=output.toByteArray();}
      result.put("status",status);result.put("url",url.toString());result.put("headers",responseHeaders);result.put("body",android.util.Base64.encodeToString(bytes,android.util.Base64.NO_WRAP));connection.disconnect();respond(id,result);return;
     }throw new IOException("Troppi reindirizzamenti");
    }catch(Exception error){respondError(id,"Richiesta di rete non riuscita: "+error.getClass().getSimpleName());}
    finally{HttpURLConnection connection=connections.remove(id);if(connection!=null)connection.disconnect();jobs.remove(id);cancelled.remove(id);}
   },null);jobs.put(id,job);network.execute(job);
  }
 }
 private boolean allowed(URL url){if(url.getUserInfo()!=null)return false;if(url.getProtocol().equals("https"))return true;if(!url.getProtocol().equals("http")||url.getPort()!=8766)return false;String host=url.getHost();return host.matches("192\\.168\\.\\d{1,3}\\.\\d{1,3}")||host.matches("10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}")||host.matches("172\\.(1[6-9]|2\\d|3[01])\\.\\d{1,3}\\.\\d{1,3}");}
 private void respondError(String id,String error){try{respond(id,new JSONObject().put("error",error));}catch(Exception ignored){}}
 private void respond(String id,JSONObject result){
  if(cancelled.contains(id))return;String body=result.optString("body","");
  if(body.length()<=131072){evaluate("window.__aniPlayerNativeResponse&&window.__aniPlayerNativeResponse("+JSONObject.quote(id)+","+result+");");return;}
  result.remove("body");
  for(int start=0;start<body.length();start+=131072){if(cancelled.contains(id))return;int end=Math.min(start+131072,body.length());boolean last=end==body.length();evaluate("window.__aniPlayerNativeChunk&&window.__aniPlayerNativeChunk("+JSONObject.quote(id)+","+JSONObject.quote(body.substring(start,end))+","+last+","+(last?result:"null")+");");}
 }
}
