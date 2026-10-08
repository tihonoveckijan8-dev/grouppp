import { test, expect } from 'playwright/test';

const BASE = 'http://127.0.0.1:4174';
const SIZES = [
  [360,800],[390,844],[768,1024],[1280,800],[1920,1080]
];
const THEMES = ['light','dark','amoled'];
const ACCENTS = ['red','blue','amber'];
const ROUTES = [
  ['calendar','#/calendar'],
  ['songs','#/songs'],
  ['song','#/song/visual-s1'],
  ['setlists','#/setlists'],
  ['setlist','#/setlist/visual-sl1'],
  ['settings','#/settings']
];

async function auditViewport(page,label){
  const result=await page.evaluate(()=>{
    const bad=[];
    const viewportWidth=innerWidth;
    for(const el of document.querySelectorAll('button,input,select,textarea,[data-act],.card,.song-card,.sl-item,.ev-row,.page-head,.toolbar')){
      const r=el.getBoundingClientRect();
      if(r.width<=0||r.height<=0)continue;
      if(r.left < -1 || r.right > viewportWidth+1) bad.push({tag:el.tagName,cls:el.className?.toString().slice(0,80),left:r.left,right:r.right});
      if((el instanceof HTMLElement) && el.scrollWidth > el.clientWidth + 4 && !['INPUT','TEXTAREA'].includes(el.tagName)){
        bad.push({overflow:true,tag:el.tagName,cls:el.className?.toString().slice(0,80),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth});
      }
    }
    const pageWidth=document.documentElement.scrollWidth;
    return {pageWidth,viewportWidth,bad};
  });
  expect(result.pageWidth, label+' horizontal document overflow').toBeLessThanOrEqual(result.viewportWidth+1);
  expect(result.bad, label+' element overflow').toEqual([]);
}

test('BandPlan visual matrix: themes, accents, responsive screens', async ({browser}, testInfo) => {
  let screenshotIndex=0;
  for(const [width,height] of SIZES){
    for(const theme of THEMES){
      for(const accent of ACCENTS){
        const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
        await page.goto(BASE+'/?bandplan-test=visual',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>typeof window.__bandplanEnsureCore==='function',{timeout:15000});
        await page.evaluate(()=>window.__bandplanEnsureCore());
        await page.waitForFunction(()=>typeof window.__bandplanTestHooks?.seedVisualState==='function',{timeout:15000});
        await page.evaluate(({theme,accent})=>{
          window.__bandplanTestHooks.seedVisualState();
          window.__bandplanTestHooks.visualPrefs(theme,accent);
        },{theme,accent});

        for(const [name,hash] of ROUTES){
          await page.evaluate(hash=>{location.hash=hash},hash);
          await page.waitForTimeout(120);
          await auditViewport(page, width+'x'+height+' '+theme+'/'+accent+'/'+name);
        }

        // The calendar is the representative screenshot for every matrix combination.
        await page.evaluate(()=>{location.hash='#/calendar'});
        await page.waitForTimeout(100);
        await page.screenshot({
          path:testInfo.outputPath('matrix-'+String(++screenshotIndex).padStart(2,'0')+'-'+width+'x'+height+'-'+theme+'-'+accent+'.png'),
          fullPage:true
        });

        // Forms and Scene are exercised once per combination too.
        await page.evaluate(()=>{location.hash='#/calendar'});
        await page.waitForTimeout(80);
        const newEvent=page.locator('[data-act="new-event"]:visible').first();
        if(await newEvent.count()) {
          await newEvent.click();
          await page.waitForTimeout(80);
          await auditViewport(page, width+'x'+height+' '+theme+'/'+accent+'/event-form');
          await page.locator('[data-act="modal-close"]').first().click();
        }

        await page.evaluate(()=>{location.hash='#/songs'});
        await page.waitForTimeout(80);
        const newSong=page.locator('[data-act="new-song"]:visible').first();
        if(await newSong.count()) {
          await newSong.click();
          await page.waitForTimeout(80);
          await auditViewport(page, width+'x'+height+' '+theme+'/'+accent+'/song-form');
          await page.locator('[data-act="modal-close"]').first().click();
        }

        await page.evaluate(()=>{location.hash='#/setlists'});
        await page.waitForTimeout(80);
        const newSetlist=page.locator('[data-act="new-setlist"]:visible').first();
        if(await newSetlist.count()) {
          await newSetlist.click();
          await page.waitForTimeout(80);
          await auditViewport(page, width+'x'+height+' '+theme+'/'+accent+'/setlist-form');
          await page.locator('[data-act="modal-close"]').first().click();
        }

        await page.evaluate(()=>{location.hash='#/calendar'});
        await page.waitForTimeout(80);
        const scene=page.locator('[data-act="scene-quick"]:visible').first();
        if(await scene.count()) {
          await scene.click();
          await page.waitForTimeout(80);
          await auditViewport(page, width+'x'+height+' '+theme+'/'+accent+'/scene');
          await page.keyboard.press('Escape');
        }

        expect(errors, width+'x'+height+' '+theme+'/'+accent+' browser errors').toEqual([]);
        await context.close();
      }
    }
  }
});
