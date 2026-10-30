/* BandPlan chord reference UI.
 * WHY: chord definitions and SVG renderers are only needed after a musician opens the chord library.
 */
const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORDS = {
 C:{notes:['C','E','G'],guitar:'x32010',fingers:[0,3,2,0,1,0]},Cm:{notes:['C','Eb','G'],guitar:'x3101x',fingers:[0,3,1,0,1,0]},D:{notes:['D','F#','A'],guitar:'xx0232',fingers:[0,0,0,2,3,2]},Dm:{notes:['D','F','A'],guitar:'xx0231',fingers:[0,0,0,2,3,1]},E:{notes:['E','G#','B'],guitar:'022100',fingers:[0,2,3,1,0,0]},Em:{notes:['E','G','B'],guitar:'022000',fingers:[0,2,3,0,0,0]},F:{notes:['F','A','C'],guitar:'133211',fingers:[1,3,4,2,1,1]},G:{notes:['G','B','D'],guitar:'320003',fingers:[3,2,0,0,0,4]},A:{notes:['A','C#','E'],guitar:'x02220',fingers:[0,0,2,3,4,0]},Am:{notes:['A','C','E'],guitar:'x02210',fingers:[0,0,2,3,1,0]},B:{notes:['B','D#','F#'],guitar:'x24442',fingers:[0,1,3,4,2,1]},Bm:{notes:['B','D','F#'],guitar:'x24432',fingers:[0,1,3,4,2,1]},'C7':{notes:['C','E','G','Bb'],guitar:'x32310',fingers:[0,3,2,4,1,0]},'D7':{notes:['D','F#','A','C'],guitar:'xx0212',fingers:[0,0,0,2,1,3]},'E7':{notes:['E','G#','B','D'],guitar:'020100',fingers:[0,2,0,1,0,0]},'G7':{notes:['G','B','D','F'],guitar:'320001',fingers:[3,2,0,0,0,1]},'Am7':{notes:['A','C','E','G'],guitar:'x02010',fingers:[0,0,2,0,1,0]},'Fmaj7':{notes:['F','A','C','E'],guitar:'xx3210',fingers:[0,0,3,2,1,0]},
 'Cmaj7':{notes:['C','E','G','B'],guitar:'x32000',fingers:[0,3,2,0,0,0]},'Cm7':{notes:['C','Eb','G','Bb'],guitar:'x3131x',fingers:[0,3,1,3,1,0]},'Cadd9':{notes:['C','D','E','G'],guitar:'x32030',fingers:[0,3,2,0,3,0]},'Csus2':{notes:['C','D','G'],guitar:'x30013',fingers:[0,0,0,0,1,3]},'Csus4':{notes:['C','F','G'],guitar:'x33011',fingers:[0,3,4,0,1,1]},
 'Dmaj7':{notes:['D','F#','A','C#'],guitar:'xx0222',fingers:[0,0,0,1,1,1]},'Dm7':{notes:['D','F','A','C'],guitar:'xx0211',fingers:[0,0,0,2,1,1]},'Dsus2':{notes:['D','E','A'],guitar:'xx0230',fingers:[0,0,0,2,3,0]},'Dsus4':{notes:['D','G','A'],guitar:'xx0233',fingers:[0,0,0,1,2,3]},
 'Em7':{notes:['E','G','B','D'],guitar:'020000',fingers:[0,2,0,0,0,0]},'Emaj7':{notes:['E','G#','B','D#'],guitar:'021100',fingers:[0,2,1,1,0,0]},'Esus4':{notes:['E','A','B'],guitar:'022200',fingers:[0,2,3,4,0,0]},
 'A7':{notes:['A','C#','E','G'],guitar:'x02020',fingers:[0,0,2,0,3,0]},'Amaj7':{notes:['A','C#','E','G#'],guitar:'x02120',fingers:[0,0,2,1,3,0]},'Asus2':{notes:['A','B','E'],guitar:'x02200',fingers:[0,0,2,3,0,0]},'Asus4':{notes:['A','D','E'],guitar:'x02230',fingers:[0,0,2,3,4,0]},
 'Bm7':{notes:['B','D','F#','A'],guitar:'x20202',fingers:[0,0,2,0,3,0]},'Bb':{notes:['Bb','D','F'],guitar:'x13331',fingers:[0,1,3,4,1,1]},'F#m':{notes:['F#','A','C#'],guitar:'244222',fingers:[2,4,3,1,1,1]},'Gm':{notes:['G','Bb','D'],guitar:'355333',fingers:[3,4,1,1,1,1]},'Gmaj7':{notes:['G','B','D','F#'],guitar:'320002',fingers:[3,2,0,0,0,1]},'Gm7':{notes:['G','Bb','D','F'],guitar:'353333',fingers:[1,3,1,1,1,1]},'F#m7':{notes:['F#','A','C#','E'],guitar:'242222',fingers:[1,3,1,1,1,1]},'F7':{notes:['F','A','C','Eb'],guitar:'131211',fingers:[1,3,1,2,1,1]},'Bbmaj7':{notes:['Bb','D','F','A'],guitar:'x13231',fingers:[0,1,3,2,4,1]},'Bdim':{notes:['B','D','F'],guitar:'x2343x',fingers:[0,2,3,4,1,0]}
};
function chordNames() { return Object.keys(CHORDS); }
function chordRootIndex(name) {
  const match = /^([A-G](?:#|b)?)/.exec(name);
  return match && NOTE_IDX[match[1]] != null ? NOTE_IDX[match[1]] : 0;
}
function chordQualityRank(name) {
  const suffix = name.replace(/^([A-G](?:#|b)?)/, '');
  // WHY: within each root, familiar triads come first, then seventh and color chords.
  const order = {'':0,'m':1,'7':2,'maj7':3,'m7':4,'dim':5,'aug':6,'sus2':7,'sus4':8,'add9':9};
  return Object.prototype.hasOwnProperty.call(order, suffix) ? order[suffix] : 10;
}
export function renderChordLibraryHTML(tab, selectedChord) {
  const piano = tab === 'piano-chords';
  const names = chordNames();
  const selected = CHORDS[selectedChord] ? selectedChord : 'C';
  const groups = Array.from({length:12}, (_, index) => ({index, label:SHARP[index], names:names.filter(n => chordRootIndex(n) === index).sort((a,b) => chordQualityRank(a)-chordQualityRank(b) || a.localeCompare(b))})).filter(group => group.names.length);
  const picker = groups.map(group => '<div class="chord-root-group"><span class="chord-root-label">'+group.label+'</span><div class="chord-root-chords">'+group.names.map(n=>'<button type="button" class="chord-pick'+(n===selected?' active':'')+'" data-act="chord-pick" data-v="'+n+'" aria-pressed="'+(n===selected)+'">'+n+'</button>').join('')+'</div></div>').join('');
  return '<div class="tool-eyebrow">СПРАВОЧНИК АККОРДОВ</div><h2>'+(piano?'Аккорды для пианино':'Аккорды для гитары')+'</h2><p class="tool-subtitle">Выберите аккорд — схема строится прямо в BandPlan и работает без сторонних библиотек.</p><div class="chord-picker" aria-label="Аккорды по возрастанию тональности"><div class="chord-picker-track">'+picker+'</div></div><div class="chord-detail"><div class="chord-detail-copy"><div class="chord-selected-label">ВЫБРАННЫЙ АККОРД</div><h3>'+selected+'</h3><p class="chord-notes-line">Ноты <strong>'+CHORDS[selected].notes.join(' · ')+'</strong></p><p class="tool-status">'+(piano?'Цветом отмечены клавиши, входящие в аккорд.':'Кружки показывают пальцы; × — не играть струну, ○ — открытая струна.')+'</p></div><div class="chord-lib-canvas" aria-label="'+(piano?'Клавиатура пианино':'Схема аппликатуры гитары')+'">'+(piano?pianoDiagram(CHORDS[selected].notes):guitarDiagram(CHORDS[selected]))+'</div></div>';
}
function guitarDiagram(chord) {
  const frets = chord.guitar.split('');
  const played = frets.map(v => v === 'x' || v === '0' ? 0 : Number(v)).filter(v => v > 0);
  const minFret = played.length ? Math.min(...played) : 1;
  const maxFret = played.length ? Math.max(...played) : 4;
  const firstFret = minFret > 4 && maxFret - minFret < 4 ? minFret : 1;
  const xs = [36, 78, 120, 162, 204, 246];
  const top = 42, fretH = 31, stringEnd = xs[xs.length-1];
  const labels = ['E','A','D','G','B','E'];
  let svg = '<svg class="guitar-chord-svg" viewBox="0 0 278 218" role="img" aria-label="Аппликатура аккорда"><text x="8" y="17" class="chord-svg-muted">Струна</text>';
  xs.forEach((x,i)=>{svg+='<text x="'+x+'" y="17" text-anchor="middle" class="chord-svg-string-label">'+labels[i]+'</text>';});
  frets.forEach((v,i)=>{const x=xs[i];svg+='<text x="'+x+'" y="34" text-anchor="middle" class="chord-svg-muted">'+(v==='x'?'×':v==='0'?'○':'')+'</text>';});
  for(let f=0;f<=4;f++){
    const y=top+f*fretH;
    svg+='<line x1="'+xs[0]+'" y1="'+y+'" x2="'+stringEnd+'" y2="'+y+'" class="'+(f===0&&firstFret===1?'chord-svg-nut':'chord-svg-fret')+'"/>';
    if(f<4) svg+='<text x="15" y="'+(y+fretH/2+4)+'" class="chord-svg-fret-label">'+(firstFret+f)+'</text>';
  }
  xs.forEach((x,i)=>{
    svg+='<line x1="'+x+'" y1="'+top+'" x2="'+x+'" y2="'+(top+4*fretH)+'" class="chord-svg-string" style="stroke-width:'+(i===0?2.4:i===5?1:1.5)+'"/>';
    const value=frets[i];
    if(value!=='x'&&value!=='0'){
      const fret=Number(value), row=fret-firstFret;
      if(row>=0&&row<4){
        const y=top+(row+.5)*fretH;
        svg+='<circle cx="'+x+'" cy="'+y+'" r="10.5" class="chord-svg-finger"/><text x="'+x+'" y="'+(y+3.7)+'" text-anchor="middle" class="chord-svg-finger-number">'+(chord.fingers[i]||'•')+'</text>';
      }
    }
  });
  if(firstFret>1) svg+='<text x="140" y="207" text-anchor="middle" class="chord-svg-muted">Позиция '+firstFret+' лада</text>';
  svg+='</svg><div class="chord-diagram-legend"><span><b>×</b> не играть</span><span><b>○</b> открытая</span><span><b>1–4</b> пальцы</span></div>';
  return '<div class="guitar-diagram">'+svg+'</div>';
}
function pianoDiagram(notes) {
  // WHY: render one octave only; repeating C–B twice made the chord diagram look duplicated and harder to read.
  const enharmonic = {Db:'C#',Eb:'D#',Gb:'F#',Ab:'G#',Bb:'A#'};
  const active = new Set(notes.map(note => enharmonic[note] || note));
  const whiteNotes = ['C','D','E','F','G','A','B'];
  const blackNotes = [{note:'C#',after:0},{note:'D#',after:1},{note:'F#',after:3},{note:'G#',after:4},{note:'A#',after:5}];
  const keyW=26, keyH=145, startX=10, whiteCount=7;
  let svg='<svg class="piano-chord-svg" viewBox="0 0 '+(startX*2+keyW*whiteCount)+' 178" role="img" aria-label="Одна октава клавиатуры пианино с подсвеченными нотами аккорда">';
  for(let i=0;i<whiteCount;i++){
    const note=whiteNotes[i], x=startX+i*keyW, isActive=active.has(note);
    svg+='<rect x="'+x+'" y="8" width="'+keyW+'" height="'+keyH+'" rx="2" class="'+(isActive?'piano-svg-white active':'piano-svg-white')+'"/>';
    svg+='<text x="'+(x+keyW/2)+'" y="142" text-anchor="middle" class="'+(isActive?'piano-svg-label active':'piano-svg-label')+'">'+note+'</text>';
  }
  blackNotes.forEach(({note,after})=>{
    const x=startX+(after+1)*keyW-7.5, isActive=active.has(note);
    svg+='<rect x="'+x+'" y="8" width="15" height="86" rx="2" class="'+(isActive?'piano-svg-black active':'piano-svg-black')+'"/>';
    if(isActive) svg+='<text x="'+(x+7.5)+'" y="84" text-anchor="middle" class="piano-svg-black-label">'+note+'</text>';
  });
  svg+='<text x="'+startX+'" y="170" class="piano-svg-octave">Одна октава · подсвечены ноты аккорда</text></svg>';
  return '<div class="piano-diagram">'+svg+'</div>';
}
