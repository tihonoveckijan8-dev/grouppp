/* BandPlan local audio metronome. Audio analysis runs entirely on-device; per-song settings are isolated. */
(function(){
'use strict';
var DB='bandplan-audio-metro-v1',STORE='files',KEY='bandplan.audio-metro.settings.v1',dbp=null,ctx=null,interval=0,active=null,urls={},beatEnginePromise=null;
var css=".bp-am[hidden]{display:none!important}.bp-am{--metro-line:color-mix(in srgb,var(--text) 10%,transparent);margin-top:18px;padding:clamp(16px,3vw,24px);border:1px solid var(--border);border-radius:22px;background:var(--surface,var(--card));color:var(--text);display:grid;gap:18px;min-width:0;box-shadow:0 8px 26px color-mix(in srgb,var(--text) 7%,transparent)}.bp-am *{box-sizing:border-box}.bp-am-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.bp-am-head-copy{display:grid;gap:5px}.bp-am h3{font-size:var(--fs-h3,18px);font-weight:750;letter-spacing:-.025em;margin:0}.bp-am-muted,.bp-am-status,.bp-am-name{font-size:12px;color:var(--text-2);line-height:1.5}.bp-am-local{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid var(--border);border-radius:999px;white-space:nowrap}.bp-am-local .bp-am-pulse{margin:0}.bp-am-upload{border:1px dashed color-mix(in srgb,var(--accent) 42%,var(--border));border-radius:16px;padding:17px;display:grid;gap:7px;text-align:center;overflow-wrap:anywhere;background:color-mix(in srgb,var(--accent) 4%,var(--surface,var(--card)));transition:border-color .18s,background .18s}.bp-am-upload:focus-within,.bp-am-upload:hover{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 7%,var(--surface,var(--card)))}.bp-am-upload strong{font-size:14px;font-weight:700}.bp-am-upload input{width:100%;max-width:100%;font-size:12px;color:var(--text);margin-top:4px}.bp-am-name{overflow-wrap:anywhere;padding:0 2px}.bp-am audio{width:100%;height:40px;border-radius:12px}.bp-am-tempo{display:grid;justify-items:center;gap:10px;padding:22px 12px 18px;border:1px solid var(--border);border-radius:18px;background:var(--surface-2,var(--card));position:relative;overflow:hidden}.bp-am-tempo:before{content:\"\";position:absolute;inset:0 0 auto;height:3px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.8}.bp-am-tempo-label{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-2);font-weight:750}.bp-am-tempo-readout{display:flex;align-items:baseline;gap:8px;justify-content:center}.bp-am-bpm{font-size:clamp(56px,10vw,76px);line-height:.98;font-weight:800;letter-spacing:-.075em;font-variant-numeric:tabular-nums;text-align:center}.bp-am-unit{font-size:14px;font-weight:700;color:var(--text-2)}.bp-am-range{width:100%;max-width:480px;accent-color:var(--accent);cursor:pointer;margin:3px 0 0}.bp-am-row{display:flex;gap:8px;flex-wrap:wrap;min-width:0}.bp-am-row .btn{flex:1;min-width:100px;min-height:42px}.bp-am-adjust .btn{min-width:70px;flex:0 1 110px}.bp-am-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.bp-am-grid label{display:grid;align-content:start;gap:8px;font-size:12px;font-weight:650;color:var(--text-2);min-width:0}.bp-am select{width:100%;min-height:44px;border:1px solid var(--border);border-radius:12px;padding:9px 12px;background:var(--surface-2,var(--card));color:var(--text);font:inherit}.bp-am-check{display:flex;align-items:center;gap:9px;min-height:44px;padding:0 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2,var(--card));color:var(--text);font-size:13px}.bp-am-check input{width:17px;height:17px;accent-color:var(--accent)}.bp-am-pulse{display:inline-block;flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:var(--border);transition:background .12s,box-shadow .12s}.bp-am-pulse.on{background:var(--accent);box-shadow:0 0 0 4px var(--accent-ring)}.bp-am-wave{height:4px;background:var(--border);border-radius:8px;overflow:hidden}.bp-am-wave i{display:block;height:100%;width:0;background:var(--accent);border-radius:inherit;transition:width .08s linear}.bp-am-status{margin:0;padding:10px 12px;border-radius:12px;background:var(--surface-2,var(--card));overflow-wrap:anywhere}.bp-am-status[data-kind=error]{color:var(--danger,#c33);background:color-mix(in srgb,var(--danger,#c33) 8%,var(--surface,var(--card)))}.bp-am-status[data-kind=ok]{color:var(--success,#198754);background:color-mix(in srgb,var(--success,#198754) 8%,var(--surface,var(--card)))}.bp-am-candidates{display:flex;gap:7px;flex-wrap:wrap}.bp-am-candidates:empty{display:none}.bp-am-candidates button{border:1px solid var(--border);border-radius:10px;padding:8px 11px;background:var(--surface-2,var(--card));color:var(--text);font:inherit;font-size:12px;font-weight:650;cursor:pointer}.bp-am-candidates button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-ring)}.bp-am-actions{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:9px}.bp-am-actions .btn{min-width:0;min-height:46px}.bp-am-actions [data-bpam=toggle]{font-weight:750}.bp-am:focus-within{scroll-margin-block:20px}@media(max-width:520px){.bp-am{padding:13px;border-radius:18px;gap:14px}.bp-am-head{gap:9px}.bp-am-local{font-size:11px}.bp-am-upload{padding:14px 10px}.bp-am-tempo{padding:20px 10px 16px}.bp-am-bpm{font-size:64px}.bp-am-grid{grid-template-columns:1fr;gap:10px}.bp-am-row .btn{min-width:0}.bp-am-adjust .btn{flex:1}.bp-am-actions{grid-template-columns:1fr}.bp-am-actions .btn{min-height:44px}}@media(prefers-reduced-motion:reduce){.bp-am *{transition:none!important}}";
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
function pref(id){return Object.assign({bpm:120,beats:4,accent:true},all()[id]||{})}
function savePref(id,p){var a=all();a[id]=Object.assign(pref(id),p);try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}return a[id]}
function songId(){var m=(location.hash||'').match(/^#\/song\/([^/?#]+)/);return m?decodeURIComponent(m[1]):''}
function currentId(){return songId()||'__tool__'}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function audioType(file){if(file&&file.type&&file.type.indexOf('audio/')===0)return file.type;var ext=String(file&&file.name||'').split('.').pop().toLowerCase();return ({mp3:'audio/mpeg',wav:'audio/wav',wave:'audio/wav',m4a:'audio/mp4',mp4:'audio/mp4',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',aac:'audio/aac',flac:'audio/flac',webm:'audio/webm',aiff:'audio/aiff',aif:'audio/aiff', '3gp':'audio/3gpp'})[ext]||'application/octet-stream'}
function context(){var C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio не поддерживается');ctx=ctx||new C();return ctx}
function click(at,accent){var c=context(),o=c.createOscillator(),g=c.createGain();o.frequency.value=accent?1450:900;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.24,at+.004);g.gain.exponentialRampToValueAtTime(.0001,at+.06);o.connect(g);g.connect(c.destination);o.start(at);o.stop(at+.07)}
function stop(){if(interval)clearTimeout(interval);interval=0;active=null;document.querySelectorAll('.bp-am-pulse').forEach(function(p){p.classList.remove('on')});document.querySelectorAll('[data-bpam=toggle]').forEach(function(b){b.textContent='▶ Запустить метроном';b.setAttribute('aria-pressed','false')})}
async function start(root){stop();var c=context();await c.resume();if(c.state!=='running')throw Error('Не удалось запустить аудио. Нажми кнопку ещё раз и проверь громкость устройства.');active=root;var beat=0,next=c.currentTime+.04;function tick(){if(active!==root)return;var bpmNow=Number(root.querySelector('[data-bpam=bpm]').value)||120,beats=Number(root.querySelector('[data-bpam=beats]').value)||4;while(next<c.currentTime+.14){var at=next,ix=beat;click(at,root.querySelector('[data-bpam=accent]').checked&&ix===0);setTimeout(function(ix){return function(){if(active===root){var p=root.querySelector('.bp-am-pulse');if(p)p.classList.add('on');setTimeout(function(){if(p)p.classList.remove('on')},75);var w=root.querySelector('.bp-am-wave i');if(w)w.style.width=((ix+1)/Number(root.querySelector('[data-bpam=beats]').value)*100)+'%'}}}(ix),Math.max(0,(at-c.currentTime)*1000));beat=(beat+1)%beats;next+=60/bpmNow}interval=setTimeout(tick,25)}tick();var b=root.querySelector('[data-bpam=toggle]');b.textContent='Ⅱ Остановить метроном';b.setAttribute('aria-pressed','true')}
function bpm(root,v){v=Math.max(40,Math.min(240,Math.round(Number(v)||120)));root.querySelector('[data-bpam=bpm]').value=v;root.querySelector('.bp-am-bpm').textContent=v;savePref(root.dataset.songid,{bpm:v})}
function status(root,t,k){var s=root.querySelector('.bp-am-status');s.textContent=t;s.dataset.kind=k||''}
function attach(root,blob,name){var id=root.dataset.songid;if(urls[id])URL.revokeObjectURL(urls[id]);root.__bpAudioBlob=blob;urls[id]=URL.createObjectURL(blob);var a=root.querySelector('audio');a.src=urls[id];a.load();a.hidden=false;root.querySelector('.bp-am-name').textContent=name||'Аудиофайл готов';root.dataset.audio='1';root.querySelector('[data-bpam=analyze]').disabled=false;root.querySelector('[data-bpam=play]').disabled=false}
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
  return {bpm:best.bpm,alts:alts,confidence:confidence,rawScore:best.raw};
}
async function loadBeatEngine(){if(window.BandPlanBeat)return window.BandPlanBeat;if(!beatEnginePromise)beatEnginePromise=import('./vendor/audio-beat.bundle.js').then(function(){return window.BandPlanBeat||null}).catch(function(){return null});return beatEnginePromise}
async function analyze(file){
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
  var opts={fs:fs,minBpm:40,maxBpm:240},a=engine.detect(mono,opts),b=engine.beatTrack(mono,opts);
  var raw=[Number(a.bpm),Number(b.bpm)].filter(function(v){return Number.isFinite(v)&&v>=40&&v<=240});
  if(!raw.length)throw Error('Алгоритм не смог найти устойчивый темп. Попробуй другой фрагмент.');
  function confidence(v){v=Number(v)||0;if(v>1)v/=100;return Math.max(0,Math.min(1,v))}
  var ca=confidence(a.confidence),cb=confidence(b.confidence),same=Math.abs(raw[0]-raw[raw.length-1])<=Math.max(3,raw[0]*.05),octave=raw.length>1&&(Math.abs(raw[0]/2-raw[1])<=3||Math.abs(raw[0]*2-raw[1])<=5);
  var best=raw.length===1?raw[0]:(cb>ca?raw[1]:raw[0]),score=Math.max(ca,cb);
  if(raw.length>1&&!same&&!octave)score*=.72;
  var alternatives=[];
  function add(v){v=Math.round(v);if(v>=40&&v<=240&&!alternatives.some(function(x){return Math.abs(x-v)<=2}))alternatives.push(v)}
  add(best);raw.forEach(add);add(best/2);add(best*2);
  return {bpm:Math.round(best),alts:alternatives.slice(0,5),confidence:Math.round(score*100),engine:'@audio/beat',agreement:same||octave};
}
function panel(id,tool){var p=pref(id);return '<section class="bp-am" data-bp-am data-songid="'+esc(id)+'"><div class="bp-am-head"><div class="bp-am-head-copy"><h3>'+(tool?'Метроном и анализ песни':'Метроном этой песни')+'</h3><span class="bp-am-muted">Точный темп и удобный контроль ритма</span></div><span class="bp-am-local"><i class="bp-am-pulse"></i><span>Обработка на устройстве</span></span></div><label class="bp-am-upload"><strong>'+(tool?'Выбрать музыкальный файл':'Загрузить аудиофайл для этой песни')+'</strong><span class="bp-am-muted">MP3, WAV, M4A, OGG и другие аудиоформаты</span><input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" data-bpam="file" aria-label="Выбрать аудиофайл"></label><div class="bp-am-name">Аудиофайл ещё не загружен</div><audio controls preload="metadata" hidden></audio><div class="bp-am-tempo"><span class="bp-am-tempo-label">Темп</span><div class="bp-am-tempo-readout"><div class="bp-am-bpm">'+p.bpm+'</div><span class="bp-am-unit">BPM</span></div><input type="range" class="bp-am-range" min="40" max="240" value="'+p.bpm+'" data-bpam="bpm" aria-label="Темп в BPM"><div class="bp-am-row bp-am-adjust"><button class="btn btn-secondary" data-bpam="minus" type="button" aria-label="Уменьшить темп на 1 BPM">−1</button><button class="btn btn-secondary" data-bpam="plus" type="button" aria-label="Увеличить темп на 1 BPM">+1</button><button class="btn btn-secondary" data-bpam="analyze" type="button" disabled>Определить BPM</button></div></div><div class="bp-am-grid"><label>Размер такта<select data-bpam="beats">'+[[2,'2/4'],[3,'3/4'],[4,'4/4'],[5,'5/4'],[6,'6/8'],[7,'7/8']].map(function(x){return '<option value="'+x[0]+'"'+(p.beats===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select></label><label>Акцент первой доли<span class="bp-am-check"><input type="checkbox" data-bpam="accent"'+(p.accent?' checked':'')+'> Включён</span></label></div><div class="bp-am-wave" aria-hidden="true"><i></i></div><div class="bp-am-actions"><button class="btn btn-primary" data-bpam="toggle" type="button" aria-pressed="false">▶ Запустить метроном</button><button class="btn btn-secondary" data-bpam="play" type="button" disabled>▶ Воспроизвести песню</button></div><div class="bp-am-candidates" aria-label="Другие варианты темпа"></div><p class="bp-am-status" aria-live="polite">Загрузи песню для автоматического определения темпа или выставь BPM вручную.</p></section>'}
function load(root){get(root.dataset.songid).then(function(r){if(r&&r.blob){attach(root,r.blob,r.name);status(root,'Аудиозапись восстановлена из локального хранилища.','ok')}}).catch(function(){status(root,'Не удалось восстановить локальный аудиофайл.','error')})}
function addTool(){var host=document.querySelector('#view [data-bp-am-tool-host]');if(!host||host.querySelector('[data-bp-am]'))return;host.insertAdjacentHTML('beforeend',panel('__tool__',true));load(host.querySelector('[data-bp-am]'))}
function addSong(){var id=songId();if(!id)return;var actions=document.querySelector('#view .song-detail-work-actions');if(!actions)return;var trigger=actions.querySelector('[data-bpam-open-song]');if(!trigger){trigger=document.createElement('button');trigger.type='button';trigger.className='btn btn-secondary btn-block';trigger.dataset.bpamOpenSong='1';trigger.textContent='Метроном';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','bp-am-song-'+esc(id));actions.appendChild(trigger)}var stack=actions.closest('.stack');if(!stack)return;var root=Array.from(stack.querySelectorAll('[data-bp-am]')).find(function(x){return x.dataset.songid===id});if(!root){stack.insertAdjacentHTML('beforeend',panel(id,false).replace('<section class="bp-am"','<section hidden id="bp-am-song-'+esc(id)+'" class="bp-am"'));root=Array.from(stack.querySelectorAll('[data-bp-am]')).find(function(x){return x.dataset.songid===id});if(root)load(root)}}
function scan(){styles();addTool();addSong()}
var observer=new MutationObserver(scan);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('hashchange',function(){stop();setTimeout(scan,0)});document.addEventListener('visibilitychange',function(){if(document.hidden)stop()});
document.addEventListener('change',async function(e){var el=e.target;if(el.matches('[data-bpam=file]')){var root=el.closest('[data-bp-am]'),f=el.files&&el.files[0];if(!root||!f)return;stop();status(root,'Читаю аудиофайл…');try{var bytes=await readBytes(f);if(!bytes||!bytes.byteLength)throw Error('Выбранный файл пустой или недоступен. Скачай его на устройство и выбери снова.');var stableBlob=new Blob([bytes],{type:audioType(f)});attach(root,stableBlob,f.name);try{await put(root.dataset.songid,f,f.name,bytes);status(root,'Файл прочитан и сохранён на устройстве. Можно воспроизвести и определить BPM.','ok')}catch(saveError){status(root,'Файл прочитан и готов к воспроизведению и анализу, но сохранить его после закрытия приложения не удалось: '+(saveError&&saveError.message||'ошибка локального хранилища')+'. Не закрывай страницу до завершения работы.','error')}}catch(err){root.__bpAudioBlob=null;root.dataset.audio='';root.querySelector('[data-bpam=analyze]').disabled=true;root.querySelector('[data-bpam=play]').disabled=true;status(root,'Не удалось прочитать выбранный аудиофайл: '+(err&&err.message||'ошибка чтения')+'. На телефоне сначала скачай файл в память устройства, затем выбери его снова.','error')}}else if(el.matches('[data-bpam=beats],[data-bpam=accent]')){var r=el.closest('[data-bp-am]');if(r)savePref(r.dataset.songid,{beats:Number(r.querySelector('[data-bpam=beats]').value),accent:r.querySelector('[data-bpam=accent]').checked})}});
document.addEventListener('input',function(e){if(e.target.matches('[data-bpam=bpm]'))bpm(e.target.closest('[data-bp-am]'),e.target.value)});
document.addEventListener('click',function(e){var trigger=e.target.closest('[data-bpam-open-song]');if(!trigger)return;var id=songId(),root=Array.from(document.querySelectorAll('#view [data-bp-am]')).find(function(x){return x.dataset.songid===id});if(!root)return;root.hidden=!root.hidden;trigger.setAttribute('aria-expanded',String(!root.hidden));trigger.textContent=root.hidden?'Метроном':'Скрыть метроном';if(root.hidden&&active===root)stop();if(!root.hidden)root.scrollIntoView({behavior:'smooth',block:'nearest'})});
document.addEventListener('click',async function(e){var b=e.target.closest('[data-bpam]');if(!b)return;var root=b.closest('[data-bp-am]');if(!root)return;var a=b.dataset.bpam;try{if(a==='toggle'){if(active===root)stop();else await start(root)}else if(a==='candidate'){stop();bpm(root,b.dataset.v);root.querySelectorAll('[data-bpam=candidate]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});status(root,'Выбран вариант '+b.dataset.v+' BPM.','ok')}else if(a==='plus'||a==='minus'){stop();bpm(root,Number(root.querySelector('[data-bpam=bpm]').value)+(a==='plus'?1:-1))}else if(a==='analyze'){var f=root.__bpAudioBlob||(root.querySelector('[data-bpam=file]').files&&root.querySelector('[data-bpam=file]').files[0]);if(!f){var r=await get(root.dataset.songid);f=r&&r.blob}if(!f){status(root,'Сначала загрузи аудиофайл.','error');return}b.disabled=true;b.textContent='Анализирую…';status(root,'Анализирую ритм на устройстве…');var result=await analyze(f);bpm(root,result.bpm);var choices=root.querySelector('.bp-am-candidates');choices.innerHTML=result.alts.map(function(v){return '<button type="button" data-bpam="candidate" data-v="'+v+'" aria-pressed="'+(v===result.bpm)+'">'+v+' BPM</button>'}).join('');status(root,(result.engine?'@audio/beat: ':'Алгоритм анализа: ')+result.bpm+' BPM · оценка уверенности '+result.confidence+'/100'+(result.agreement===false?' · методы расходятся, проверь альтернативы':'')+'. Это оценка алгоритма, не гарантия.','ok')}else if(a==='play'){var audio=root.querySelector('audio');if(!audio.src){var saved=await get(root.dataset.songid);if(saved)attach(root,saved.blob,saved.name)}if(!audio.src){status(root,'Сначала загрузи аудиофайл.','error');return}if(audio.paused){await audio.play();b.textContent='Ⅱ Пауза песни'}else{audio.pause();b.textContent='▶ Воспроизвести песню'}}}catch(err){status(root,err.message||'Ошибка выполнения.','error')}finally{if(a==='analyze'){b.disabled=!root.dataset.audio;b.textContent='Определить BPM'}}});
document.addEventListener('play',function(e){if(e.target.matches('.bp-am audio')){var r=e.target.closest('[data-bp-am]');if(r&&active!==r)start(r).catch(function(err){status(r,err.message||'Не удалось запустить метроном.','error')})}},true);document.addEventListener('pause',function(e){if(e.target.matches('.bp-am audio')){var r=e.target.closest('[data-bp-am]');if(active===r)stop();var b=r.querySelector('[data-bpam=play]');if(b)b.textContent='▶ Воспроизвести песню'}},true);document.addEventListener('ended',function(e){if(e.target.matches('.bp-am audio')){stop();var b=e.target.closest('.bp-am').querySelector('[data-bpam=play]');if(b)b.textContent='▶ Воспроизвести песню'}},true);
scan();
})();