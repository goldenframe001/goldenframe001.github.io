const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=process.argv[2]||'_site',timers=new Map();let now=0,seq=0,renderCost=0;
const fixture=name=>fs.readFileSync(fs.existsSync(source+'/'+name)?source+'/'+name:source+'/gf-roulette-'+name,'utf8');
const element={classList:{remove(){},add(){},toggle(){}},textContent:''};
const ctx=vm.createContext({console,performance:{now:()=>now},setTimeout:(fn,ms)=>{timers.set(++seq,{fn,due:now+ms});return seq},clearTimeout:id=>timers.delete(id),render(){now+=renderCost},save(){},$:()=>element,gf27SetSpinLabel:(el,v)=>el.textContent=String(v),spinning:false,rouletteInterval:null,view:'draft',db:{draft:null},gf21Shuffle:a=>a,pick:a=>a[0],castPage:()=>'<div class="panel"><h2>캐스팅</h2><div class="draft-meta"><span>남은 제작비 <b>$55.0M</b></span></div></div>',revealPage:()=>'<h2>배우 선택</h2>',directorPage:()=>'<h2>감독 선택</h2>',titlePage:()=>'<h2>제목</h2>',home:()=>'<p>이번 영화 배정 제작비 <b class="gold">$55M</b></p>'});
const run=s=>vm.runInContext(s,ctx);
run(fixture('data.js'));
const baseline=fixture('v21_patch.js');
run(baseline.slice(baseline.indexOf('function gf78SpinSchedule('),baseline.indexOf('const gf21CastPage=')));
run(fs.readFileSync(__dirname+'/../overrides/update152.js','utf8'));
const years=JSON.parse(run('JSON.stringify(gfCastingYears())')),labels=[...years,'CLASSIC','NEW HOLLYWOOD'];
function drain(stall=0){let guard=0;while(timers.size){assert(++guard<300);const [id,t]=[...timers].sort((a,b)=>a[1].due-b[1].due)[0];timers.delete(id);now=Math.max(now,t.due)+stall;t.fn();}}
let cases=0;
for(const label of labels)for(const stall of [0,50,150]){
 now=0;renderCost=120;timers.clear();
 run(`view='draft';spinning=false;db.draft={budget:55,cast:[],roll:null,selected:null,rerolls:3};pick=()=>${JSON.stringify(label)};Math.random=()=>${label==='CLASSIC'?'.01':label==='NEW HOLLYWOOD'?'.03':'.5'};roll(true)`);
 drain(stall);
 assert.equal(run('db.draft.roll.year'),label);assert.equal(run('db.draft.rerolls'),3);assert.equal(run('spinning'),false);assert(now<=4000,`${label}: ${now}ms`);cases++;
}
for(const [tier,random] of [['UR',.01],['SSR',.1],['SR',.3],['R',.5],['F',.9]]){
 now=0;renderCost=0;timers.clear();run(`view='director';spinning=false;db.draft={tier:null};Math.random=()=>${random};spinDirector()`);drain();assert.equal(now,800);assert.equal(run('db.draft.tier'),tier);
}
// Navigating away or changing films cannot publish a cancelled result.
now=0;renderCost=0;timers.clear();run("view='draft';db.draft={roll:null,cast:[],rerolls:3};Math.random=()=>.5;roll(true);view='home'");drain();assert.equal(run('db.draft.roll'),null);assert(!run('spinning'));
run("view='draft';db.draft={budget:55,cast:[{fee:10},{fee:5.5}],selected:ACTORS[0].id};var saved152=JSON.stringify(db.draft),budget152=gf152Budget(db.draft)");
assert(run('budget152.includes("$55.0M")'));assert(run('budget152.includes("$15.5M")'));assert(run('budget152.includes("$39.5M")'));assert(run('budget152.includes("캐스팅 후 잔여")'));assert.equal(run('JSON.stringify(db.draft)'),run('saved152'));
for(const page of ['castPage','revealPage','directorPage','titlePage']){const html=run(page+'()');assert.equal((html.match(/aria-label="제작비 현황"/g)||[]).length,1);}
assert(run('home().includes("gf152-allocation")'));
run('db.draft.cast=[{fee:55}];db.draft.selected=null');assert(run('gf152Budget(db.draft).includes("is-low")'));assert(run('gf152Budget(db.draft).includes("$0.0M")'));
run('db.draft.met={ovr:80}');assert(!run('castPage().includes("gf152-budget")'));
console.log(`PASS ${cases} actor season/stall cases including legends, <=4s with simulated rendering delays; unchanged 800ms director tiers; cancellation; exact budget totals, preview, stable state and single-card rendering.`);
