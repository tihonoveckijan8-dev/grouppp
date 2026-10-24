/* BandPlan local audio metronome. Audio analysis runs entirely on-device; per-song settings are isolated. */
(function(){
'use strict';
var DB='bandplan-audio-metro-v1',STORE='files',KEY='bandplan.audio-metro.settings.v1',dbp=null,ctx=null,interval=0,active=null,urls={},beatEnginePromise=null;
var css=".bp-am[hidden]{display:none!important}\n.bp-am{--metro-soft:color-mix(in srgb,var(--accent) 7%,var(--surface,var(--card)));--metro-line:color-mix(in srgb,var(--text) 10%,transparent);display:grid;gap:18px;min-width:0;margin-top:18px;padding:clamp(14px,2.5vw,24px);border:1px solid var(--border);border-radius:24px;background:var(--surface,var(--card));color:var(--text);box-shadow:0 10px 30px color-mix(in srgb,var(--text) 6%,transparent);overflow:hidden}\n.bp-am *{box-sizing:border-box}\n.bp-am-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-width:0}\n.bp-am-head-copy{display:grid;gap:5px;min-width:0}\n.bp-am h3{margin:0;font-size:clamp(17px,2vw,20px);font-weight:780;letter-spacing:-.035em;line-height:1.2}\n.bp-am-muted,.bp-am-status,.bp-am-name{font-size:12px;color:var(--text-2);line-height:1.5}\n.bp-am-muted{display:block}\n.bp-am-local{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;max-width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:999px;background:var(--surface-2,var(--card));font-size:11px;color:var(--text-2);white-space:nowrap}\n.bp-am-local .bp-am-pulse{margin:0}\n.bp-am-upload{display:grid;justify-items:center;gap:7px;min-width:0;padding:20px 16px;border:1.5px dashed color-mix(in srgb,var(--accent) 42%,var(--border));border-radius:18px;background:var(--metro-soft);text-align:center;overflow-wrap:anywhere;transition:border-color .18s,background .18s}\n.bp-am-upload:focus-within,.bp-am-upload:hover{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 11%,var(--surface,var(--card)))}\n.bp-am-upload strong{font-size:14px;font-weight:750;line-height:1.35}\n.bp-am-upload input{display:block;width:100%;max-width:340px;min-width:0;margin-top:5px;font-size:12px;color:var(--text)}\n.bp-am-name{min-width:0;padding:0 2px;overflow-wrap:anywhere}\n.bp-am audio{display:block;width:100%;max-width:100%;height:42px;border-radius:12px}\n.bp-am audio[hidden]{display:none}\n.bp-am-tempo{position:relative;display:grid;justify-items:center;gap:14px;min-width:0;padding:clamp(20px,4vw,30px) 14px 20px;border:1px solid var(--border);border-radius:22px;background:var(--surface-2,var(--card));overflow:hidden}\n.bp-am-tempo:before{content:\"\";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.9}\n.bp-am-tempo-label{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-2);font-weight:800}\n.bp-am-tempo-readout{display:flex;align-items:baseline;justify-content:center;gap:9px;max-width:100%;font-variant-numeric:tabular-nums}\n.bp-am-bpm{font-size:clamp(64px,10vw,92px);line-height:.9;font-weight:820;letter-spacing:-.085em;text-align:center;color:var(--text)}\n.bp-am-unit{font-size:14px;font-weight:750;color:var(--text-2)}\n.bp-am-range{display:block;width:min(100%,520px);height:28px;margin:0;accent-color:var(--accent);cursor:pointer;touch-action:pan-y}\n.bp-am-row{display:flex;flex-wrap:wrap;gap:8px;min-width:0;width:100%}\n.bp-am-row .btn{flex:1 1 100px;min-width:0;min-height:44px}\n.bp-am-adjust{max-width:520px;justify-content:center}\n.bp-am-adjust .btn{flex:1 1 0;min-width:0;padding-inline:10px}\n.bp-am-adjust [data-bpam=analyze]{flex:0 1 auto;min-width:170px;min-height:46px;padding:11px 18px;border:1px solid transparent;border-radius:14px;background:var(--accent);color:#fff;font-weight:800;letter-spacing:-.01em;box-shadow:0 5px 14px color-mix(in srgb,var(--accent) 24%,transparent);transition:transform .16s,box-shadow .16s,opacity .16s}\n.bp-am-adjust [data-bpam=analyze]:before{content:\"✦\";display:inline-block;margin-right:8px;font-size:13px}\n.bp-am-adjust [data-bpam=analyze]:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 7px 18px color-mix(in srgb,var(--accent) 30%,transparent)}\n.bp-am-adjust [data-bpam=analyze]:not(:disabled):active{transform:translateY(0) scale(.985)}\n.bp-am-adjust [data-bpam=analyze]:disabled{opacity:.45;box-shadow:none;cursor:not-allowed}\n.bp-am-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0}\n.bp-am-grid>label{display:grid;align-content:start;gap:8px;min-width:0;font-size:12px;font-weight:700;color:var(--text-2)}\n.bp-am-grid>label:first-child{grid-column:1/-1}\n.bp-am select{display:block;width:100%;min-width:0;min-height:46px;padding:10px 12px;border:1px solid var(--border);border-radius:13px;background:var(--surface-2,var(--card));color:var(--text);font:inherit;font-size:14px}\n.bp-am-check{display:flex;align-items:center;gap:9px;min-height:46px;padding:0 12px;border:1px solid var(--border);border-radius:13px;background:var(--surface-2,var(--card));color:var(--text);font-size:13px}\n.bp-am-check{justify-content:space-between;gap:14px;min-height:54px;padding:10px 13px;border-radius:14px;font-size:13px;font-weight:650;cursor:pointer;transition:border-color .16s,background .16s}\n.bp-am-check:has(input:checked){border-color:color-mix(in srgb,var(--accent) 48%,var(--border));background:color-mix(in srgb,var(--accent) 7%,var(--surface-2,var(--card)))}\n.bp-am-check input{appearance:none;-webkit-appearance:none;position:relative;display:block;width:44px;height:26px;flex:0 0 44px;margin:0;padding:0;border:1px solid var(--border);border-radius:999px;background:var(--border);cursor:pointer;transition:background .18s,border-color .18s,box-shadow .18s}\n.bp-am-check input:before{content:\"\";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--surface,var(--card));box-shadow:0 1px 3px #0002;transition:transform .18s}\n.bp-am-check input:checked{background:var(--accent);border-color:var(--accent)}\n.bp-am-check input:checked:before{transform:translateX(18px)}\n.bp-am-check input:focus-visible{outline:3px solid var(--accent-ring);outline-offset:3px}\n.bp-am-check input:disabled{opacity:.5;cursor:not-allowed}\n.bp-am-pulse{display:inline-block;flex:0 0 9px;width:9px;height:9px;border-radius:50%;background:var(--border);transition:background .12s,box-shadow .12s}\n.bp-am-pulse.on{background:var(--accent);box-shadow:0 0 0 5px var(--accent-ring)}\n.bp-am-wave{height:4px;background:var(--border);border-radius:8px;overflow:hidden}\n.bp-am-wave i{display:block;width:0;height:100%;background:var(--accent);border-radius:inherit;transition:width .08s linear}\n.bp-am-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;min-width:0}\n.bp-am-actions .btn{display:flex;align-items:center;justify-content:center;min-width:0;min-height:48px;padding:11px 14px;white-space:normal;text-align:center;line-height:1.25}\n.bp-am-actions [data-bpam=toggle]{font-weight:780}\n.bp-am-status{margin:0;min-width:0;padding:12px 14px;border:1px solid var(--border);border-radius:13px;background:var(--surface-2,var(--card));overflow-wrap:anywhere}\n.bp-am-status[data-kind=error]{color:var(--danger,#c33);background:color-mix(in srgb,var(--danger,#c33) 8%,var(--surface,var(--card)))}\n.bp-am-status[data-kind=ok]{color:var(--success,#198754);background:color-mix(in srgb,var(--success,#198754) 8%,var(--surface,var(--card)))}\n.bp-am-candidates{display:flex;gap:8px;flex-wrap:wrap;min-width:0}\n.bp-am-candidates:empty{display:none}\n.bp-am-candidates button{min-height:40px;padding:8px 12px;border:1px solid var(--border);border-radius:11px;background:var(--surface-2,var(--card));color:var(--text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}\n.bp-am-candidates button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-ring)}\n.bp-am:focus-within{scroll-margin-block:20px}\n@media(max-width:600px){\n .bp-am{gap:14px;margin-top:14px;padding:13px;border-radius:19px;box-shadow:0 6px 20px color-mix(in srgb,var(--text) 5%,transparent)}\n .bp-am-head{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}\n .bp-am-local{justify-self:start;white-space:normal}\n .bp-am-upload{padding:16px 12px;border-radius:15px}\n .bp-am-upload input{max-width:100%;font-size:12px}\n .bp-am-tempo{gap:12px;padding:22px 10px 16px;border-radius:17px}\n .bp-am-bpm{font-size:clamp(60px,18vw,78px)}\n .bp-am-adjust{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}\n .bp-am-adjust [data-bpam=analyze]{grid-column:1/-1;justify-self:center;width:max-content;max-width:100%;min-width:min(100%,210px);min-height:48px;padding-inline:22px}\n .bp-am-grid{grid-template-columns:minmax(0,1fr);gap:10px}\n .bp-am-actions{grid-template-columns:minmax(0,1fr);gap:8px}\n .bp-am-actions .btn{min-height:48px}\n .bp-am-status{padding:11px 12px}\n}\n@media(max-width:360px){\n .bp-am{padding:10px;gap:12px}\n .bp-am h3{font-size:16px}\n .bp-am-bpm{font-size:58px}\n .bp-am-tempo{padding-inline:8px}\n .bp-am-adjust .btn{font-size:13px;padding-inline:8px}\n .bp-am-upload strong{font-size:13px}\n}\n@media(prefers-reduced-motion:reduce){.bp-am *{transition:none!important}}";
function styles(){if(document.getElementById('bp-am-css'))return;var s=document.createElement('style');s.id='bp-am-css';s.textContent=css;document.head.appendChild(s)}
function db(){if(dbp)return dbp;dbp=new Promise(function(ok,no){var r=indexedDB.open(DB,1);r.onupgradeneeded=function(){if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}});return dbp}
async function readBytes(file){
  // WHY: Android document providers can expose Files whose backing file disappears before arrayBuffer() resolves.
  // FileReader is a compatibility fallback; IndexedDB stores bytes rather than a provider-backed File/Blob.
  try{return await file.arrayBuffer()}catch(firstError){
    return await new Promise(function(resolve,reject){
      if(typeof FileReader==='undefined'){reject(firstError);return}
      var reader=new FileReader();reader.onload=function(){resolve(reader.result)};reader.onerror=function(){reject(reader.error||firstError)};reader.onabort=function(){reject(new Error('Чтение аудиофайла было прервано. Выбери файл ещё раз.'))};
      try{reader.readAsArrayBuffer(file)}catch(error){reject(error||firstError)}
    });
  }
}
function put(id,file,name,bytes){return db().then(function(d){return new Promise(function(ok,no){var t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put({bytes:bytes,type:audioType(file),name:name},id);t.oncomplete=ok;t.onerror=function(){no(t.error||new Error('Не удалось записать аудио в локальное хранилище'))};t.onabort=function(){no(t.error||new Error('Запись аудио в локальное хранилище отменена'))}})})}
function get(id){return db().then(function(d){return new Promise(function(ok,no){var r=d.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=function(){var v=r.result||null;if(v&&v.bytes){v.blob=new Blob([v.bytes],{type:v.type||'audio/mpeg'});delete v.bytes}ok(v)};r.onerror=function(){no(r.error)}})})}
function all(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}}
function pref(id){return Object.assign({bpm:120,beats:4,accent:true,adaptive:true},all()[id]||{})}
function savePref(id,p){var a=all();a[id]=Object.assign(pref(id),p);try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}return a[id]}
function songId(){var m=(location.hash||'').match(/^#\/song\/([^/?#]+)/);return m?decodeURIComponent(m[1]):''}
function currentId(){return songId()||'__tool__'}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function audioType(file){if(file&&file.type&&file.type.indexOf('audio/')===0)return file.type;var ext=String(file&&file.name||'').split('.').pop().toLowerCase();return ({mp3:'audio/mpeg',wav:'audio/wav',wave:'audio/wav',m4a:'audio/mp4',mp4:'audio/mp4',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',aac:'audio/aac',flac:'audio/flac',webm:'audio/webm',aiff:'audio/aiff',aif:'audio/aiff', '3gp':'audio/3gpp'})[ext]||'application/octet-stream'}
function context(){var C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio не поддерживается');ctx=ctx||new C();return ctx}
function click(at,accent){var c=context(),o=c.createOscillator(),g=c.createGain();o.frequency.value=accent?1450:900;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.24,at+.004);g.gain.exponentialRampToValueAtTime(.0001,at+.06);o.connect(g);g.connect(c.destination);o.start(at);o.stop(at+.07)}
function stop(){if(interval)clearTimeout(interval);interval=0;active=null;document.querySelectorAll('.bp-am-pulse').forEach(function(p){p.classList.remove('on')});document.querySelectorAll('[data-bpam=toggle]').forEach(function(b){b.textContent='▶ Запустить метроном';b.setAttribute('aria-pressed','false')})}
async function start(root){
 stop();
 var c=context();await c.resume();
 if(c.state!=='running')throw Error('Не удалось запустить аудио. Нажми кнопку ещё раз и проверь громкость устройства.');
 active=root;
 var audioAtStart=root.querySelector('audio'),adaptiveAtStart=root.querySelector('[data-bpam=adaptive]');
 if(adaptiveAtStart&&adaptiveAtStart.checked&&audioAtStart&&!audioAtStart.paused&&!root.__bpTempoMap)status(root,'Автоподстройка включена, но карта темпа ещё не построена. Нажми «Определить BPM» перед воспроизведением.','ok');
 var beat=0,next=c.currentTime+.04,lastAutoBpm=0,nextTimelineIndex=0,lastAudioTime=null,lastWallTime=performance.now(),syncWasActive=false;
 function lowerBound(values,target){var lo=0,hi=values.length;while(lo<hi){var mid=(lo+hi)>>1;if(values[mid]<target)lo=mid+1;else hi=mid}return lo}
 function tick(){
  if(active!==root)return;
  var audio=root.querySelector('audio'),adaptive=root.querySelector('[data-bpam=adaptive]'),map=root.__bpTempoMap,times=root.__bpBeatTimes;
  var syncing=!!(audio&&!audio.paused&&times&&times.length>=4);
  if(adaptive&&adaptive.checked&&audio&&!audio.paused&&map&&map.length){
   var t=audio.currentTime,point=map[0];
   for(var mi=1;mi<map.length&&map[mi].time<=t;mi++)point=map[mi];
   if(point.bpm!==lastAutoBpm){bpm(root,point.bpm,true);lastAutoBpm=point.bpm;var s=root.querySelector('.bp-am-status');if(s&&s.dataset.kind!=='error')status(root,'Автоподстройка: '+point.bpm+' BPM · '+Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'),'ok')}
  }
  if(syncing){
   var audioTime=audio.currentTime,rate=Math.max(.25,Math.min(4,Number(audio.playbackRate)||1)),wall=performance.now();
   // WHY: reset the beat cursor after playback starts or the playhead jumps, so seeking never reuses stale scheduled beats.
   var expected=lastAudioTime===null?null:lastAudioTime+(wall-lastWallTime)/1000*rate;
   if(!syncWasActive||expected===null||Math.abs(audioTime-expected)>.28)nextTimelineIndex=lowerBound(times,Math.max(0,audioTime-.012));
   while(nextTimelineIndex<times.length&&times[nextTimelineIndex]<=audioTime+rate*.16){
    var beatTime=times[nextTimelineIndex],delta=beatTime-audioTime;
    if(delta<-.025){nextTimelineIndex++;continue}
    var at=c.currentTime+Math.max(.003,delta/rate),ix=nextTimelineIndex,beats=Number(root.querySelector('[data-bpam=beats]').value)||4;
    click(at,root.querySelector('[data-bpam=accent]').checked&&(ix%beats===0));
    (function(ix,at){setTimeout(function(){if(active===root){var p=root.querySelector('.bp-am-pulse');if(p)p.classList.add('on');setTimeout(function(){if(p)p.classList.remove('on')},75);var beatsNow=Number(root.querySelector('[data-bpam=beats]').value)||4;var w=root.querySelector('.bp-am-wave i');if(w)w.style.width=((ix%beatsNow+1)/beatsNow*100)+'%'}},Math.max(0,(at-c.currentTime)*1000))})(ix,at);
    nextTimelineIndex++;
   }
   lastAudioTime=audioTime;lastWallTime=wall;syncWasActive=true;
  }else{
   syncWasActive=false;lastAudioTime=null;lastWallTime=performance.now();
   var bpmNow=Number(root.querySelector('[data-bpam=bpm]').value)||120,beats=Number(root.querySelector('[data-bpam=beats]').value)||4;
   if(next<c.currentTime-.2){next=c.currentTime+.03;beat=0}
   while(next<c.currentTime+.14){
    var freeAt=next,freeIx=beat;
    click(freeAt,root.querySelector('[data-bpam=accent]').checked&&freeIx===0);
    (function(ix,at){setTimeout(function(){if(active===root){var p=root.querySelector('.bp-am-pulse');if(p)p.classList.add('on');setTimeout(function(){if(p)p.classList.remove('on')},75);var beatsNow=Number(root.querySelector('[data-bpam=beats]').value)||4;var w=root.querySelector('.bp-am-wave i');if(w)w.style.width=((ix+1)/beatsNow*100)+'%'}},Math.max(0,(at-c.currentTime)*1000))})(freeIx,freeAt);
    beat=(beat+1)%beats;next+=60/bpmNow;
   }
  }
  interval=setTimeout(tick,25)
 }
 tick();
 var b=root.querySelector('[data-bpam=toggle]');b.textContent='Ⅱ Остановить метроном';b.setAttribute('aria-pressed','true')
}
function bpm(root,v,transient){v=Math.max(40,Math.min(240,Math.round(Number(v)||120)));root.querySelector('[data-bpam=bpm]').value=v;root.querySelector('.bp-am-bpm').textContent=v;if(!transient)savePref(root.dataset.songid,{bpm:v})}
function status(root,t,k){var s=root.querySelector('.bp-am-status');s.textContent=t;s.dataset.kind=k||''}
function attach(root,blob,name){var id=root.dataset.songid;if(urls[id])URL.revokeObjectURL(urls[id]);root.__bpTempoMap=null;root.__bpBeatTimes=null;root.__bpAudioBlob=blob;urls[id]=URL.createObjectURL(blob);var a=root.querySelector('audio');a.src=urls[id];a.load();a.hidden=false;root.querySelector('.bp-am-name').textContent=name||'Аудиофайл готов';root.dataset.audio='1';root.querySelector('[data-bpam=analyze]').disabled=false;root.querySelector('[data-bpam=play]').disabled=false}
async function analyzeFallback(file){
  var c=context(),buf=await readBytes(file),audio=await c.decodeAudioData(buf.slice(0));
  var sr=audio.sampleRate,channels=[];
  for(var ch=0;ch<audio.numberOfChannels;ch++)channels.push(audio.getChannelData(ch));
  // WHY: 10 ms frames retain beat onsets while keeping analysis fast on phones.
  var frame=Math.max(1,Math.round(sr*.01)),step=Math.max(1,Math.floor(sr/11025)),rms=[],hf=[];
  var previous=[];
  for(var pos=0;pos<audio.length;pos+=frame){
    var energy=0,derivative=0,count=0;
    for(var ci=0;ci<channels.length;ci++){
      var data=channels[ci],prev=previous[ci]||0;
      for(var ix=pos;ix<Math.min(audio.length,pos+frame);ix+=step){
        var sample=data[ix],delta=sample-prev;
        energy+=sample*sample;derivative+=delta*delta;count++;prev=sample;
      }
      previous[ci]=prev;
    }
    rms.push(Math.sqrt(energy/(count||1)));
    hf.push(Math.sqrt(derivative/(count||1)));
  }
  if(rms.length<200)throw Error('Нужно не менее 2 секунд аудио для анализа.');
  // Positive energy changes emphasize attacks (drums, claps, picked strings),
  // rather than the sustained notes that can mislead plain loudness autocorrelation.
  var onset=new Array(rms.length),prevR=0,prevH=0;
  for(var i=0;i<rms.length;i++){
    var lr=Math.log(1e-5+rms[i]),lh=Math.log(1e-5+hf[i]);
    var riseR=Math.max(0,lr-prevR),riseH=Math.max(0,lh-prevH);
    onset[i]=riseR*.72+riseH*.28;
    prevR=lr;prevH=lh;
  }
  // Light smoothing suppresses single-frame codec clicks without erasing transients.
  var smooth=onset.map(function(_,i){var total=0;for(var j=Math.max(0,i-1);j<=Math.min(onset.length-1,i+1);j++)total+=onset[j];return total/(Math.min(onset.length-1,i+1)-Math.max(0,i-1)+1)});
  var mean=smooth.reduce(function(a,b){return a+b},0)/smooth.length;
  smooth=smooth.map(function(v){return v-mean});
  var energyAll=smooth.reduce(function(a,b){return a+b*b},0);
  if(energyAll<1e-7)throw Error('В аудио недостаточно выраженных ритмических ударов. Попробуй фрагмент с более отчётливым ритмом.');
  var minLag=25,maxLag=Math.min(150,Math.floor(smooth.length*.45)),corr=new Array(maxLag+1).fill(0);
  for(var lag=minLag;lag<=maxLag;lag++){
    var dot=0,left=0,right=0;
    for(var k=lag;k<smooth.length;k++){
      var a=smooth[k],b=smooth[k-lag];dot+=a*b;left+=a*a;right+=b*b;
    }
    corr[lag]=dot/Math.sqrt((left*right)||1);
  }
  var candidates=[];
  for(var l=minLag;l<=maxLag;l++){
    var bpmValue=6000/l;
    if(bpmValue<40||bpmValue>240)continue;
    // Blend the beat period with its harmonics; octave variants remain explicit choices.
    var harmonic2=l*2<=maxLag?Math.max(0,corr[l*2]):0;
    var harmonicHalf=Math.round(l/2)>=minLag?Math.max(0,corr[Math.round(l/2)]):0;
    var score=corr[l]+harmonic2*.18+harmonicHalf*.10;
    if(l>minLag&&corr[l]<corr[l-1]&&corr[l]<corr[Math.min(maxLag,l+1)])continue;
    candidates.push({bpm:Math.round(bpmValue),lag:l,score:score,raw:corr[l]});
  }
  candidates.sort(function(a,b){return b.score-a.score});
  // Collapse near-identical BPM estimates while preserving half/double-time alternatives.
  var ranked=[];
  candidates.forEach(function(cand){
    if(cand.score<=0)return;
    if(!ranked.some(function(old){return Math.abs(old.bpm-cand.bpm)<=Math.max(2,old.bpm*.025)}))ranked.push(cand);
  });
  if(!ranked.length)throw Error('Не удалось найти устойчивый ритмический рисунок. Выбери более ритмичный участок или выставь BPM вручную.');
  var best=ranked[0],second=ranked[1],margin=second?Math.max(0,best.score-second.score):best.score;
  // This is a relative algorithm score, not a calibrated probability.
  var confidence=Math.round(Math.max(12,Math.min(98,35+Math.max(0,best.raw)*42+margin*65)));
  var alts=[];
  function addTempo(v){v=Math.round(v);if(v>=40&&v<=240&&!alts.some(function(x){return Math.abs(x-v)<=2}))alts.push(v)}
  addTempo(best.bpm);addTempo(best.bpm/2);addTempo(best.bpm*2);
  ranked.slice(1,7).forEach(function(cand){if(alts.length<5)addTempo(cand.bpm)});
  var meter=estimateMeterOnsets(smooth,best.bpm);
  // WHY: fallback mode also needs a phase-anchored beat grid; BPM alone cannot align a click to the song.
  var lagFrames=best.lag,phaseBest=0,phaseScore=-Infinity;
  for(var phase=0;phase<lagFrames;phase++){
    var total=0,count=0;
    for(var beatPos=phase;beatPos<smooth.length;beatPos+=lagFrames){
      var peak=0;
      for(var delta=-2;delta<=2;delta++){var at=beatPos+delta;if(at>=0&&at<smooth.length)peak=Math.max(peak,smooth[at])}
      total+=Math.max(0,peak);count++;
    }
    var score=total/(count||1);
    if(score>phaseScore){phaseScore=score;phaseBest=phase}
  }
  var beatTimes=[];
  for(var frameAt=phaseBest;frameAt<smooth.length;frameAt+=lagFrames)beatTimes.push(frameAt*frame/sr);
  return {bpm:best.bpm,alts:alts,confidence:confidence,rawScore:best.raw,meter:meter,beatTimes:beatTimes};
}
async function loadBeatEngine(){if(window.BandPlanBeat)return window.BandPlanBeat;if(!beatEnginePromise)beatEnginePromise=import('./vendor/audio-beat.bundle.js').then(function(){return window.BandPlanBeat||null}).catch(function(){return null});return beatEnginePromise}
function estimateMeterOnsets(onset,bpmValue){
 var beatFrames=60/bpmValue/.01,beatCount=Math.floor(onset.length/beatFrames);
 if(onset.length<400||beatCount<12)return {beats:4,label:'4/4',confidence:0,uncertain:true};
 var values=new Float32Array(onset.length),mean=0;
 for(var q=0;q<onset.length;q++){values[q]=Math.max(0,Number(onset[q])||0);mean+=values[q]}mean/=values.length;
 for(var z=0;z<values.length;z++)values[z]=Math.max(0,values[z]-mean);
 var bestPhase=0,bestPhaseScore=-Infinity;
 for(var phase=0;phase<beatFrames;phase+=Math.max(1,beatFrames/24)){var total=0;for(var bi=0;bi<beatCount;bi++){var center=Math.round(phase+bi*beatFrames),peak=0;for(var off=-3;off<=3;off++){var ix=center+off;if(ix>=0&&ix<values.length&&values[ix]>peak)peak=values[ix]}total+=peak}var ps=total/beatCount;if(ps>bestPhaseScore){bestPhaseScore=ps;bestPhase=phase}}
 var strength=[];for(var bt=0;bt<beatCount;bt++){var center=Math.round(bestPhase+bt*beatFrames),peak=0;for(var off=-3;off<=3;off++){var ix=center+off;if(ix>=0&&ix<values.length&&values[ix]>peak)peak=values[ix]}strength.push(peak)}
 var avg=strength.reduce(function(a,b){return a+b},0)/(strength.length||1),variance=strength.reduce(function(a,b){return a+(b-avg)*(b-avg)},0)/(strength.length||1);
 var candidates=[2,3,4,5,6,7].map(function(meter){var dot=0,left=0,right=0;for(var k=meter;k<strength.length;k++){dot+=strength[k]*strength[k-meter];left+=strength[k]*strength[k];right+=strength[k-meter]*strength[k-meter]}var repeat=dot/Math.sqrt((left*right)||1),bar=0,other=0,nb=0,no=0;for(var j=0;j<strength.length;j++){if(j%meter===0){bar+=strength[j];nb++}else{other+=strength[j];no++}}var accent=(bar/(nb||1)-other/(no||1))/(Math.sqrt(variance)+1e-6),prior=meter===4?.025:meter===3?.012:0;return {beats:meter,repeat:repeat,score:repeat+Math.max(-.18,Math.min(.18,accent))*.22+prior}}).sort(function(a,b){return b.score-a.score});
 var best=candidates[0],margin=best.score-candidates[1].score,confidence=Math.round(Math.max(0,Math.min(92,margin*230+Math.max(0,best.repeat-.25)*32))),labels={2:'2/4',3:'3/4',4:'4/4',5:'5/4',6:'6/8',7:'7/8'};
 if(confidence<12)return {beats:4,label:'4/4',confidence:confidence,uncertain:true};
 return {beats:best.beats,label:labels[best.beats],confidence:confidence,uncertain:confidence<35};
}
function estimateMeter(mono,fs,bpmValue){
 // WHY: recurring accents help estimate bar cycle; BPM alone cannot determine meter.
 var frame=Math.max(1,Math.round(fs*.01)),step=Math.max(1,Math.floor(fs/11025)),rms=[],hf=[],previous=0;
 for(var pos=0;pos<mono.length;pos+=frame){var energy=0,derivative=0,count=0,prev=previous,end=Math.min(mono.length,pos+frame);for(var i=pos;i<end;i+=step){var sample=mono[i],delta=sample-prev;energy+=sample*sample;derivative+=delta*delta;count++;prev=sample}previous=prev;rms.push(Math.sqrt(energy/(count||1)));hf.push(Math.sqrt(derivative/(count||1)))}
 var onset=new Float32Array(rms.length),pr=0,ph=0;for(var q=0;q<rms.length;q++){var lr=Math.log(1e-5+rms[q]),lh=Math.log(1e-5+hf[q]);onset[q]=Math.max(0,lr-pr)*.72+Math.max(0,lh-ph)*.28;pr=lr;ph=lh}
 return estimateMeterOnsets(onset,bpmValue);
}
async function analyzeTempoMap(mono,fs,engine,baseBpm,onProgress){
  // WHY: overlapping local windows expose tempo changes between sections instead of flattening the whole song to one BPM.
  var duration=mono.length/fs,windowSec=Math.min(10,duration),hop=5,starts=[];
  for(var pos=0;pos+windowSec<=duration+.001;pos+=hop)starts.push(pos);
  var finalStart=Math.max(0,duration-windowSec);
  if(!starts.length)starts.push(finalStart);
  else if(finalStart-starts[starts.length-1]>2.5)starts.push(finalStart);
  starts=starts.filter(function(v,i,a){return i===0||v-a[i-1]>.25});
  var points=[],previous=baseBpm;
  for(var wi=0;wi<starts.length;wi++){
    var from=Math.floor(starts[wi]*fs),to=Math.min(mono.length,Math.floor((starts[wi]+windowSec)*fs)),segment=mono.subarray(from,to);
    if(segment.length<fs*7)continue;
    var opts={fs:fs,minBpm:40,maxBpm:240},a=null,b=null;
    try{a=engine.detect(segment,opts)}catch(e){}
    try{b=engine.beatTrack(segment,opts)}catch(e){}
    function val(x){var n=Number(x&&x.bpm);return Number.isFinite(n)&&n>=40&&n<=240?n:0}
    function conf(x){var n=Number(x&&x.confidence)||0;if(n>1)n/=100;return Math.max(0,Math.min(1,n))}
    var av=val(a),bv=val(b),ac=conf(a),bc=conf(b),chosen=0,quality=0;
    if(av&&bv){
      var agree=Math.abs(av-bv)<=Math.max(4,Math.min(av,bv)*.06),octave=Math.abs(av/2-bv)<=4||Math.abs(av*2-bv)<=6;
      if(agree){chosen=(av*ac+bv*bc)/(ac+bc||1);quality=Math.max(ac,bc)}
      else if(octave&&Math.abs(ac-bc)<.18){chosen=Math.abs(av-previous)<=Math.abs(bv-previous)?av:bv;quality=Math.max(ac,bc)*.82}
      else{chosen=bc>ac?bv:av;quality=Math.max(ac,bc)*.8}
    }else if(av||bv){chosen=av||bv;quality=Math.max(ac,bc)*.7}
    if(!chosen||quality<.16)chosen=previous;
    // WHY: suppress a lone low-confidence octave jump without hiding a tempo shift that persists across windows.
    if(points.length>=2){var before=points[points.length-2].bpm,last=points[points.length-1].bpm;if(Math.abs(chosen-last)>Math.max(18,last*.22)&&Math.abs(before-last)<Math.max(7,last*.07)&&quality<.72)chosen=last}
    chosen=Math.round(chosen);
    points.push({time:Math.max(0,starts[wi]+windowSec/2),bpm:chosen,confidence:Math.round(quality*100)});
    previous=chosen;
    if(onProgress&&(wi%3===0||wi===starts.length-1))onProgress(wi+1,starts.length);
    // WHY: yield between DSP windows so uploads and controls stay responsive on phones.
    if(wi%2===1)await new Promise(function(resolve){setTimeout(resolve,0)});
  }
  if(points.length>2)for(var pi=1;pi<points.length-1;pi++){
    var left=points[pi-1].bpm,mid=points[pi].bpm,right=points[pi+1].bpm;
    if(Math.abs(left-right)<=Math.max(6,left*.06)&&Math.abs(mid-left)>Math.max(14,left*.16)&&points[pi].confidence<75)points[pi].bpm=Math.round((left+right)/2);
  }
  return points;
}
async function analyze(file,root){
  // WHY: use the same resilient reader as upload/persistence; Android document-provider files may reject File.arrayBuffer().
  var c=context(),buf=await readBytes(file),audio;
  try{audio=await c.decodeAudioData(buf.slice(0))}catch(decodeError){
    var type=file.type||'неизвестный формат';
    throw Error('Файл прочитан ('+Math.round(buf.byteLength/1024)+' КБ), но браузер не смог декодировать аудио ('+type+'). Попробуй MP3 или WAV. Подробности: '+(decodeError&&decodeError.message||'формат не поддерживается'));
  }
  if(audio.duration<8)throw Error('Для надёжного определения BPM выбери фрагмент песни не короче 8 секунд.');
  var engine=await loadBeatEngine();
  if(!engine||typeof engine.detect!=='function'||typeof engine.beatTrack!=='function')return analyzeFallback(file);
  // WHY: @audio/beat uses spectral-flux onset detection and a comb-filter tempo estimator, then cross-checks with a dynamic-programming beat tracker.
  var sourceRate=audio.sampleRate,factor=Math.max(1,Math.floor(sourceRate/22050)),fs=sourceRate/factor,length=Math.floor(audio.length/factor),mono=new Float32Array(length);
  var channels=[];for(var ch=0;ch<audio.numberOfChannels;ch++)channels.push(audio.getChannelData(ch));
  for(var i=0;i<length;i++){var sum=0,count=0,start=i*factor,end=Math.min(audio.length,start+factor);for(var j=start;j<end;j++){var frameSum=0;for(var ci=0;ci<channels.length;ci++)frameSum+=channels[ci][j];sum+=frameSum/channels.length;count++}mono[i]=sum/(count||1)}
  var opts={fs:fs,minBpm:40,maxBpm:240},a=engine.detect(mono,opts),b=engine.beatTrack(mono,opts),c=null;
  // WHY: comb-filter tempo is a third estimate using a different periodicity scoring path; it cross-checks the two beat trackers without replacing their beat timestamps.
  if(typeof engine.combTempo==='function'){try{c=engine.combTempo(mono,opts)}catch(e){c=null}}
  var raw=[Number(a.bpm),Number(b.bpm)].filter(function(v){return Number.isFinite(v)&&v>=40&&v<=240});
  if(!raw.length)throw Error('Алгоритм не смог найти устойчивый темп. Попробуй другой фрагмент.');
  function confidence(v){v=Number(v)||0;if(v>1)v/=100;return Math.max(0,Math.min(1,v))}
  var ca=confidence(a.confidence),cb=confidence(b.confidence),cv=Number(c&&c.bpm),validC=Number.isFinite(cv)&&cv>=40&&cv<=240,same=Math.abs(raw[0]-raw[raw.length-1])<=Math.max(3,raw[0]*.05),octave=raw.length>1&&(Math.abs(raw[0]/2-raw[1])<=3||Math.abs(raw[0]*2-raw[1])<=5);
  var combAgrees=validC&&raw.some(function(v){return Math.abs(v-cv)<=Math.max(4,Math.min(v,cv)*.06)||Math.abs(v/2-cv)<=4||Math.abs(v*2-cv)<=6});
  var best=raw.length===1?raw[0]:(cb>ca?raw[1]:raw[0]),score=Math.max(ca,cb);
  if(raw.length>1&&!same&&!octave)score*=.72;
  var alternatives=[];
  function add(v){v=Math.round(v);if(v>=40&&v<=240&&!alternatives.some(function(x){return Math.abs(x-v)<=2}))alternatives.push(v)}
  add(best);raw.forEach(add);if(validC)add(cv);add(best/2);add(best*2);
  var tempoMap=await analyzeTempoMap(mono,fs,engine,Math.round(best),function(done,total){if(root)status(root,'Анализ темпа по фрагментам '+done+'/'+total+'…')});
  var meter=estimateMeter(mono,fs,Math.round(best));
  // WHY: @audio/beat returns beat positions in seconds; use its adaptive tracker for synchronization, not only its average BPM.
  var tracked=b&&b.beats&&b.beats.length>=4?b.beats:(a&&a.beats&&a.beats.length>=4?a.beats:[]);
  var beatTimes=Array.from(tracked).map(Number).filter(function(t,i,all){return Number.isFinite(t)&&t>=0&&t<audio.duration&&(i===0||t>Number(all[i-1]))});
  return {bpm:Math.round(best),alts:alternatives.slice(0,5),confidence:Math.round(score*100),engine:'@audio/beat',agreement:(same||octave)&&(!validC||combAgrees),tempoMap:tempoMap,meter:meter,beatTimes:beatTimes};
}
function panel(id,tool){var p=pref(id);return '<section class="bp-am" data-bp-am data-songid="'+esc(id)+'"><div class="bp-am-head"><div class="bp-am-head-copy"><h3>'+(tool?'Метроном и анализ песни':'Метроном этой песни')+'</h3><span class="bp-am-muted">Точный темп и удобный контроль ритма</span></div><span class="bp-am-local"><i class="bp-am-pulse"></i><span>Обработка на устройстве</span></span></div><label class="bp-am-upload"><strong>'+(tool?'Выбрать музыкальный файл':'Загрузить аудиофайл для этой песни')+'</strong><span class="bp-am-muted">MP3, WAV, M4A, OGG и другие аудиоформаты</span><input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" data-bpam="file" aria-label="Выбрать аудиофайл"></label><div class="bp-am-name">Аудиофайл ещё не загружен</div><audio controls preload="metadata" hidden></audio><div class="bp-am-tempo"><span class="bp-am-tempo-label">Темп</span><div class="bp-am-tempo-readout"><div class="bp-am-bpm">'+p.bpm+'</div><span class="bp-am-unit">BPM</span></div><input type="range" class="bp-am-range" min="40" max="240" value="'+p.bpm+'" data-bpam="bpm" aria-label="Темп в BPM"><div class="bp-am-row bp-am-adjust"><button class="btn btn-secondary" data-bpam="minus" type="button" aria-label="Уменьшить темп на 1 BPM">−1</button><button class="btn btn-secondary" data-bpam="plus" type="button" aria-label="Увеличить темп на 1 BPM">+1</button><button class="btn btn-secondary" data-bpam="analyze" type="button" disabled>Определить BPM</button></div></div><div class="bp-am-grid"><label>Автоподстройка темпа<span class="bp-am-check"><input type="checkbox" data-bpam="adaptive"'+(p.adaptive!==false?' checked':'')+'> Менять BPM по ходу песни</span></label><label>Размер такта · автоопределение<select data-bpam="beats">'+[[2,'2/4'],[3,'3/4'],[4,'4/4'],[5,'5/4'],[6,'6/8'],[7,'7/8']].map(function(x){return '<option value="'+x[0]+'"'+(p.beats===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select></label><label>Акцент первой доли<span class="bp-am-check"><input type="checkbox" data-bpam="accent"'+(p.accent?' checked':'')+'> Подчеркнуть первую долю</span></label></div><div class="bp-am-wave" aria-hidden="true"><i></i></div><div class="bp-am-actions"><button class="btn btn-primary" data-bpam="toggle" type="button" aria-pressed="false">▶ Запустить метроном</button><button class="btn btn-secondary" data-bpam="play" type="button" disabled>▶ Воспроизвести песню</button></div><div class="bp-am-candidates" aria-label="Другие варианты темпа"></div><p class="bp-am-status" aria-live="polite">Загрузи песню для автоматического определения темпа или выставь BPM вручную.</p></section>'}
function load(root){get(root.dataset.songid).then(function(r){if(r&&r.blob){attach(root,r.blob,r.name);status(root,'Аудиозапись восстановлена из локального хранилища.','ok')}}).catch(function(){status(root,'Не удалось восстановить локальный аудиофайл.','error')})}
function addTool(){var host=document.querySelector('#view [data-bp-am-tool-host]');if(!host||host.querySelector('[data-bp-am]'))return;host.insertAdjacentHTML('beforeend',panel('__tool__',true));load(host.querySelector('[data-bp-am]'))}
function addSong(){var id=songId();if(!id)return;var actions=document.querySelector('#view .song-detail-work-actions');if(!actions)return;var trigger=actions.querySelector('[data-bpam-open-song]');if(!trigger){trigger=document.createElement('button');trigger.type='button';trigger.className='btn btn-secondary btn-block';trigger.dataset.bpamOpenSong='1';trigger.textContent='Метроном';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','bp-am-song-'+esc(id));actions.appendChild(trigger)}var stack=actions.closest('.stack');if(!stack)return;var root=Array.from(stack.querySelectorAll('[data-bp-am]')).find(function(x){return x.dataset.songid===id});if(!root){stack.insertAdjacentHTML('beforeend',panel(id,false).replace('<section class="bp-am"','<section hidden id="bp-am-song-'+esc(id)+'" class="bp-am"'));root=Array.from(stack.querySelectorAll('[data-bp-am]')).find(function(x){return x.dataset.songid===id});if(root)load(root)}}
function scan(){styles();addTool();addSong()}
var observer=new MutationObserver(scan);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('hashchange',function(){stop();setTimeout(scan,0)});document.addEventListener('visibilitychange',function(){if(document.hidden)stop()});
document.addEventListener('change',async function(e){var el=e.target;if(el.matches('[data-bpam=file]')){var root=el.closest('[data-bp-am]'),f=el.files&&el.files[0];if(!root||!f)return;stop();status(root,'Читаю аудиофайл…');try{var bytes=await readBytes(f);if(!bytes||!bytes.byteLength)throw Error('Выбранный файл пустой или недоступен. Скачай его на устройство и выбери снова.');var stableBlob=new Blob([bytes],{type:audioType(f)});attach(root,stableBlob,f.name);try{await put(root.dataset.songid,f,f.name,bytes);status(root,'Файл прочитан и сохранён на устройстве. Можно воспроизвести и определить BPM.','ok')}catch(saveError){status(root,'Файл прочитан и готов к воспроизведению и анализу, но сохранить его после закрытия приложения не удалось: '+(saveError&&saveError.message||'ошибка локального хранилища')+'. Не закрывай страницу до завершения работы.','error')}}catch(err){root.__bpAudioBlob=null;root.dataset.audio='';root.querySelector('[data-bpam=analyze]').disabled=true;root.querySelector('[data-bpam=play]').disabled=true;status(root,'Не удалось прочитать выбранный аудиофайл: '+(err&&err.message||'ошибка чтения')+'. На телефоне сначала скачай файл в память устройства, затем выбери его снова.','error')}}else if(el.matches('[data-bpam=beats],[data-bpam=accent],[data-bpam=adaptive]')){var r=el.closest('[data-bp-am]');if(r)savePref(r.dataset.songid,{beats:Number(r.querySelector('[data-bpam=beats]').value),accent:r.querySelector('[data-bpam=accent]').checked,adaptive:r.querySelector('[data-bpam=adaptive]').checked});if(r&&el.matches('[data-bpam=adaptive]'))status(r,el.checked?(r.__bpTempoMap&&r.__bpTempoMap.length?'Автоподстройка включена: темп будет меняться при воспроизведении песни.':'Автоподстройка включена. Сначала нажми «Определить BPM», чтобы построить карту темпа.'):'Автоподстройка выключена: метроном будет держать выбранный BPM.','ok')}});
document.addEventListener('input',function(e){if(e.target.matches('[data-bpam=bpm]'))bpm(e.target.closest('[data-bp-am]'),e.target.value)});
document.addEventListener('click',function(e){var trigger=e.target.closest('[data-bpam-open-song]');if(!trigger)return;var id=songId(),root=Array.from(document.querySelectorAll('#view [data-bp-am]')).find(function(x){return x.dataset.songid===id});if(!root)return;root.hidden=!root.hidden;trigger.setAttribute('aria-expanded',String(!root.hidden));trigger.textContent=root.hidden?'Метроном':'Скрыть метроном';if(root.hidden&&active===root)stop();if(!root.hidden)root.scrollIntoView({behavior:'smooth',block:'nearest'})});
document.addEventListener('click',async function(e){var b=e.target.closest('[data-bpam]');if(!b)return;var root=b.closest('[data-bp-am]');if(!root)return;var a=b.dataset.bpam;try{if(a==='toggle'){if(active===root)stop();else await start(root)}else if(a==='candidate'){stop();bpm(root,b.dataset.v);root.querySelectorAll('[data-bpam=candidate]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});status(root,'Выбран вариант '+b.dataset.v+' BPM.','ok')}else if(a==='plus'||a==='minus'){stop();bpm(root,Number(root.querySelector('[data-bpam=bpm]').value)+(a==='plus'?1:-1))}else if(a==='analyze'){var f=root.__bpAudioBlob||(root.querySelector('[data-bpam=file]').files&&root.querySelector('[data-bpam=file]').files[0]);if(!f){var r=await get(root.dataset.songid);f=r&&r.blob}if(!f){status(root,'Сначала загрузи аудиофайл.','error');return}b.disabled=true;b.textContent='Анализирую…';status(root,'Анализирую ритм на устройстве…');var result=await analyze(f,root);bpm(root,result.bpm);root.__bpTempoMap=result.tempoMap||[{time:0,bpm:result.bpm,confidence:result.confidence}];root.__bpBeatTimes=Array.isArray(result.beatTimes)?result.beatTimes.filter(function(t){return Number.isFinite(t)&&t>=0}).sort(function(a,b){return a-b}):[];var choices=root.querySelector('.bp-am-candidates');choices.innerHTML=result.alts.map(function(v){return '<button type="button" data-bpam="candidate" data-v="'+v+'" aria-pressed="'+(v===result.bpm)+'">'+v+' BPM</button>'}).join('');var range=root.__bpTempoMap,meter=result.meter||{beats:4,label:'4/4',confidence:0,uncertain:true};if(meter.confidence>=12){root.querySelector('[data-bpam=beats]').value=String(meter.beats);savePref(root.dataset.songid,{beats:meter.beats,meterAuto:true})}var changes=range.filter(function(p,i){return i&&p.bpm!==range[i-1].bpm}).length;status(root,(result.engine?'@audio/beat: ':'Алгоритм анализа: ')+result.bpm+' BPM · размер '+meter.label+' (уверенность '+meter.confidence+'/100)'+(meter.uncertain?' · размер определён неуверенно, проверь вручную':'')+' · уверенность темпа '+result.confidence+'/100'+(range.length>1?' · карта темпа: '+range.length+' участков, '+changes+' смен':'')+(result.agreement===false?' · методы расходятся, проверь альтернативы':'')+'. Размер можно изменить вручную. Автоподстройка BPM действует во время воспроизведения песни.','ok')}else if(a==='play'){var audio=root.querySelector('audio');if(!audio.src){var saved=await get(root.dataset.songid);if(saved)attach(root,saved.blob,saved.name)}if(!audio.src){status(root,'Сначала загрузи аудиофайл.','error');return}if(audio.paused){await audio.play();b.textContent='Ⅱ Пауза песни'}else{audio.pause();b.textContent='▶ Воспроизвести песню'}}}catch(err){status(root,err.message||'Ошибка выполнения.','error')}finally{if(a==='analyze'){b.disabled=!root.dataset.audio;b.textContent='Определить BPM'}}});
document.addEventListener('play',function(e){if(e.target.matches('.bp-am audio')){var r=e.target.closest('[data-bp-am]');if(r&&active!==r)start(r).catch(function(err){status(r,err.message||'Не удалось запустить метроном.','error')})}},true);document.addEventListener('pause',function(e){if(e.target.matches('.bp-am audio')){var r=e.target.closest('[data-bp-am]');if(active===r)stop();var b=r.querySelector('[data-bpam=play]');if(b)b.textContent='▶ Воспроизвести песню'}},true);document.addEventListener('ended',function(e){if(e.target.matches('.bp-am audio')){stop();var b=e.target.closest('.bp-am').querySelector('[data-bpam=play]');if(b)b.textContent='▶ Воспроизвести песню'}},true);
scan();
})();