/* BandPlan local audio metronome. Audio analysis runs entirely on-device; per-song settings are isolated. */
(function(){
'use strict';
var DB='bandplan-audio-metro-v1',STORE='files',KEY='bandplan.audio-metro.settings.v1',dbp=null,ctx=null,interval=0,active=null,urls={};
var css=".bp-am{margin-top:16px;padding:16px;border:1px solid var(--border);border-radius:18px;background:var(--surface,var(--card));color:var(--text);display:grid;gap:13px;min-width:0}.bp-am *{box-sizing:border-box}.bp-am-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.bp-am h3{font-size:var(--fs-h3,18px);margin:0}.bp-am-muted,.bp-am-status,.bp-am-name{font-size:12px;color:var(--text-2)}.bp-am-upload{border:1px dashed var(--border);border-radius:13px;padding:14px;display:grid;gap:7px;text-align:center;overflow-wrap:anywhere}.bp-am-upload input{width:100%;font-size:12px}.bp-am-bpm{font-size:44px;font-weight:850;letter-spacing:-.05em;text-align:center;font-variant-numeric:tabular-nums}.bp-am-range{width:100%;accent-color:var(--accent)}.bp-am-row{display:flex;gap:8px;flex-wrap:wrap}.bp-am-row .btn{flex:1;min-width:90px}.bp-am-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bp-am-grid label{display:grid;gap:6px;font-size:12px;color:var(--text-2)}.bp-am select{width:100%;min-height:40px;border:1px solid var(--border);border-radius:10px;padding:8px;background:var(--surface-2,var(--card));color:var(--text)}.bp-am audio{width:100%;height:38px}.bp-am-pulse{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--border);margin-right:5px}.bp-am-pulse.on{background:var(--accent);box-shadow:0 0 0 5px var(--accent-ring)}.bp-am-wave{height:4px;background:var(--border);border-radius:8px;overflow:hidden}.bp-am-wave i{display:block;height:100%;width:0;background:var(--accent)}.bp-am-status[data-kind=error]{color:var(--danger,#c33)}.bp-am-status[data-kind=ok]{color:var(--success,#198754)}.bp-am-candidates{display:flex;gap:7px;flex-wrap:wrap}.bp-am-candidates:empty{display:none}.bp-am-candidates button{border:1px solid var(--border);border-radius:9px;padding:7px 10px;background:var(--surface-2,var(--card));color:var(--text);font:inherit;font-size:12px;cursor:pointer}.bp-am-candidates button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-ring)}@media(max-width:520px){.bp-am{padding:12px}.bp-am-grid{grid-template-columns:1fr}.bp-am-row .btn{min-width:100%}}";
function styles(){if(document.getElementById('bp-am-css'))return;var s=document.createElement('style');s.id='bp-am-css';s.textContent=css;document.head.appendChild(s)}
function db(){if(dbp)return dbp;dbp=new Promise(function(ok,no){var r=indexedDB.open(DB,1);r.onupgradeneeded=function(){if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}});return dbp}
function put(id,blob,name){return db().then(function(d){return new Promise(function(ok,no){var t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put({blob:blob,name:name},id);t.oncomplete=ok;t.onerror=function(){no(t.error)}})})}
function get(id){return db().then(function(d){return new Promise(function(ok,no){var r=d.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=function(){ok(r.result||null)};r.onerror=function(){no(r.error)}})})}
function all(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}}
function pref(id){return Object.assign({bpm:120,beats:4,accent:true},all()[id]||{})}
function savePref(id,p){var a=all();a[id]=Object.assign(pref(id),p);try{localStorage.setItem(KEY,JSON.stringify(a))}catch(e){}return a[id]}
function songId(){var m=(location.hash||'').match(/^#\/song\/([^/?#]+)/);return m?decodeURIComponent(m[1]):''}
function currentId(){return songId()||'__tool__'}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function context(){var C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio не поддерживается');ctx=ctx||new C();return ctx}
function click(at,accent){var c=context(),o=c.createOscillator(),g=c.createGain();o.frequency.value=accent?1450:900;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.24,at+.004);g.gain.exponentialRampToValueAtTime(.0001,at+.06);o.connect(g);g.connect(c.destination);o.start(at);o.stop(at+.07)}
function stop(){if(interval)clearInterval(interval);interval=0;active=null;document.querySelectorAll('.bp-am-pulse').forEach(function(p){p.classList.remove('on')});document.querySelectorAll('[data-bpam=toggle]').forEach(function(b){b.textContent='▶ Запустить метроном';b.setAttribute('aria-pressed','false')})}
function start(root){stop();var c=context();c.resume();active=root;var beat=0,next=c.currentTime+.04;function tick(){if(active!==root)return;while(next<c.currentTime+.12){click(next,root.querySelector('[data-bpam=accent]').checked&&beat===0);(function(ix){setTimeout(function(){if(active===root){var p=root.querySelector('.bp-am-pulse');if(p)p.classList.add('on');setTimeout(function(){if(p)p.classList.remove('on')},75);var w=root.querySelector('.bp-am-wave i');if(w)w.style.width=((ix+1)/Number(root.querySelector('[data-bpam=beats]').value)*100)+'%'}},Math.max(0,(next-c.currentTime)*1000))})(beat);beat=(beat+1)%Number(root.querySelector('[data-bpam=beats]').value);next+=60/Number(root.querySelector('[data-bpam=bpm]').value)}}tick();interval=setInterval(tick,25);var b=root.querySelector('[data-bpam=toggle]');b.textContent='Ⅱ Остановить метроном';b.setAttribute('aria-pressed','true')}
function bpm(root,v){v=Math.max(40,Math.min(240,Math.round(Number(v)||120)));root.querySelector('[data-bpam=bpm]').value=v;root.querySelector('.bp-am-bpm').textContent=v;savePref(root.dataset.songid,{bpm:v})}
function status(root,t,k){var s=root.querySelector('.bp-am-status');s.textContent=t;s.dataset.kind=k||''}
function attach(root,blob,name){var id=root.dataset.songid;if(urls[id])URL.revokeObjectURL(urls[id]);urls[id]=URL.createObjectURL(blob);var a=root.querySelector('audio');a.src=urls[id];a.hidden=false;root.querySelector('.bp-am-name').textContent=name||'Аудиофайл готов';root.dataset.audio='1';root.querySelector('[data-bpam=analyze]').disabled=false;root.querySelector('[data-bpam=play]').disabled=false}
async function analyze(file){
  var c=context(),buf=await file.arrayBuffer(),audio=await c.decodeAudioData(buf.slice(0));
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
function panel(id,tool){var p=pref(id);return '<section class="bp-am" data-bp-am data-songid="'+esc(id)+'"><div class="bp-am-head"><h3>'+(tool?'Метроном и анализ песни':'Метроном этой песни')+'</h3><span class="bp-am-muted"><i class="bp-am-pulse"></i>Аудио обрабатывается на устройстве</span></div><label class="bp-am-upload"><strong>'+(tool?'Загрузить музыкальный файл':'Загрузить аудиофайл для этой песни')+'</strong><span class="bp-am-muted">MP3, WAV, M4A, OGG и другие аудиоформаты</span><input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" data-bpam="file" aria-label="Выбрать аудиофайл"></label><div class="bp-am-name">Аудиофайл ещё не загружен</div><audio controls preload="metadata" hidden></audio><div class="bp-am-bpm">'+p.bpm+'</div><input type="range" class="bp-am-range" min="40" max="240" value="'+p.bpm+'" data-bpam="bpm" aria-label="Темп в BPM"><div class="bp-am-row"><button class="btn btn-secondary" data-bpam="minus" type="button">−1 BPM</button><button class="btn btn-secondary" data-bpam="plus" type="button">+1 BPM</button><button class="btn btn-secondary" data-bpam="analyze" type="button" disabled>Определить BPM</button></div><div class="bp-am-grid"><label>Размер такта<select data-bpam="beats">'+[[2,'2/4'],[3,'3/4'],[4,'4/4'],[5,'5/4'],[6,'6/8'],[7,'7/8']].map(function(x){return '<option value="'+x[0]+'"'+(p.beats===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select></label><label>Акцент первой доли<span><input type="checkbox" data-bpam="accent"'+(p.accent?' checked':'')+'> Включён</span></label></div><div class="bp-am-wave"><i></i></div><div class="bp-am-row"><button class="btn btn-primary" data-bpam="toggle" type="button" aria-pressed="false">▶ Запустить метроном</button><button class="btn btn-secondary" data-bpam="play" type="button" disabled>▶ Воспроизвести песню</button></div><div class="bp-am-candidates" aria-label="Другие варианты темпа"></div><p class="bp-am-status" aria-live="polite">Загрузи песню для автоматического определения темпа или выставь BPM вручную.</p></section>'}
function load(root){get(root.dataset.songid).then(function(r){if(r&&r.blob){attach(root,r.blob,r.name);status(root,'Аудиозапись восстановлена из локального хранилища.','ok')}}).catch(function(){status(root,'Не удалось восстановить локальный аудиофайл.','error')})}
function addTool(){var host=document.querySelector('#view [data-bp-am-tool-host]');if(!host||host.querySelector('[data-bp-am]'))return;host.insertAdjacentHTML('beforeend',panel('__tool__',true));load(host.querySelector('[data-bp-am]'))}
function addSong(){var id=songId();if(!id)return;var stack=document.querySelector('#view .setlist-detail .stack');if(!stack||stack.querySelector('[data-bp-am]'))return;var first=stack.querySelector(':scope > .card');if(first)first.insertAdjacentHTML('afterend',panel(id,false));else stack.insertAdjacentHTML('afterbegin',panel(id,false));load(stack.querySelector('[data-bp-am]'))}
function scan(){styles();addTool();addSong()}
var observer=new MutationObserver(scan);observer.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('hashchange',function(){stop();setTimeout(scan,0)});document.addEventListener('visibilitychange',function(){if(document.hidden)stop()});
document.addEventListener('change',async function(e){var el=e.target;if(el.matches('[data-bpam=file]')){var root=el.closest('[data-bp-am]'),f=el.files&&el.files[0];if(!root||!f)return;stop();try{await put(root.dataset.songid,f,f.name);attach(root,f,f.name);status(root,'Файл сохранён локально. Можно определить BPM.','ok')}catch(err){attach(root,f,f.name);status(root,'Файл открыт, но локально не сохранён: '+err.message,'error')}}else if(el.matches('[data-bpam=beats],[data-bpam=accent]')){var r=el.closest('[data-bp-am]');if(r)savePref(r.dataset.songid,{beats:Number(r.querySelector('[data-bpam=beats]').value),accent:r.querySelector('[data-bpam=accent]').checked})}});
document.addEventListener('input',function(e){if(e.target.matches('[data-bpam=bpm]'))bpm(e.target.closest('[data-bp-am]'),e.target.value)});
document.addEventListener('click',async function(e){var b=e.target.closest('[data-bpam]');if(!b)return;var root=b.closest('[data-bp-am]');if(!root)return;var a=b.dataset.bpam;try{if(a==='toggle'){if(active===root)stop();else start(root)}else if(a==='candidate'){stop();bpm(root,b.dataset.v);root.querySelectorAll('[data-bpam=candidate]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});status(root,'Выбран вариант '+b.dataset.v+' BPM.','ok')}else if(a==='plus'||a==='minus'){stop();bpm(root,Number(root.querySelector('[data-bpam=bpm]').value)+(a==='plus'?1:-1))}else if(a==='analyze'){var f=root.querySelector('[data-bpam=file]').files[0];if(!f){var r=await get(root.dataset.songid);f=r&&r.blob}if(!f){status(root,'Сначала загрузи аудиофайл.','error');return}b.disabled=true;b.textContent='Анализирую…';status(root,'Анализирую ритм на устройстве…');var result=await analyze(f);bpm(root,result.bpm);var choices=root.querySelector('.bp-am-candidates');choices.innerHTML=result.alts.map(function(v){return '<button type="button" data-bpam="candidate" data-v="'+v+'" aria-pressed="'+(v===result.bpm)+'">'+v+' BPM</button>'}).join('');status(root,'Оценка: '+result.bpm+' BPM · относительная уверенность алгоритма '+result.confidence+'/100 (не вероятность). Варианты ниже помогают проверить половинный/двойной темп.','ok')}else if(a==='play'){var audio=root.querySelector('audio');if(!audio.src){var saved=await get(root.dataset.songid);if(saved)attach(root,saved.blob,saved.name)}if(!audio.src){status(root,'Сначала загрузи аудиофайл.','error');return}if(audio.paused){await audio.play();b.textContent='Ⅱ Пауза песни'}else{audio.pause();b.textContent='▶ Воспроизвести песню'}}}catch(err){status(root,err.message||'Ошибка выполнения.','error')}finally{if(a==='analyze'){b.disabled=!root.dataset.audio;b.textContent='Определить BPM'}}});
document.addEventListener('play',function(e){if(e.target.matches('.bp-am audio')){var r=e.target.closest('[data-bp-am]');if(r&&active!==r)start(r)}},true);document.addEventListener('pause',function(e){if(e.target.matches('.bp-am audio')&&active===e.target.closest('[data-bp-am]'))stop()},true);document.addEventListener('ended',function(e){if(e.target.matches('.bp-am audio')){stop();var b=e.target.closest('.bp-am').querySelector('[data-bpam=play]');if(b)b.textContent='▶ Воспроизвести песню'}},true);
scan();
})();