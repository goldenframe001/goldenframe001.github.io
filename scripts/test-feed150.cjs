const fs = require('fs'), path = require('path'), assert = require('assert');
const repo = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || '.');
process.chdir(source);
const setup = fs.readFileSync('scripts/test-update137.cjs', 'utf8').split('\nfunction drainOne')[0];
const {run} = new Function('require', setup + '\nreturn {run};')(require);
for (const file of ['feed-content150.js', 'update150.js']) run(fs.readFileSync(path.join(repo, 'overrides', file), 'utf8'));
const read = expression => JSON.parse(run('JSON.stringify(' + expression + ')'));
assert.equal(run('Object.values(GF150_AUDIENCE).flatMap(g => Object.values(g).flat()).length'), 600);
assert.equal(run('new Set(Object.values(GF150_AUDIENCE).flatMap(g => Object.values(g).flat())).size'), 600);
assert.equal(run('Object.values(GF150_INTERVIEWS).flat().length'), 80);
let months = 0, interviews = 0, posts = 0;
for (const genre of read('GENRES')) for (const score of [35, 60, 75, 86, 96]) {
  run(`db=blank();var p150=fixture(${score});p150.genre=${JSON.stringify(genre)};p150.title='검증 <장면> & 이야기';db.draft=p150;var before150=JSON.stringify(p150.met),seen150={};Math.random=()=>.51;`);
  for (let i = 0; i < 12; i++) {
    run(`var m150={month:MONTHS[${i}],gross:20,critic:${score},audience:${score}};gf08SetMonth(p150,${i},m150);p150.months.push(m150);`);
    const events = read('m150.events');
    assert(events.some(e => e.startsWith('GF|interview|')));
    assert(events.some(e => e.startsWith('GF142|video|')));
    assert.equal(run('JSON.stringify(p150.met)'), run('before150'));
    for (const event of events) {
      assert(!/\{(?:featuredActor|coActor|role|title)\}/.test(event));
      if (event.startsWith('GF|interview|')) {
        interviews++;
        assert(read('p150.cast.map(c=>c.name)').some(name => event.includes(name)));
      }
      if (event.startsWith('GF27|community|')) {
        const t = JSON.parse(event.slice(15));
        for (const post of t.posts) {
          assert(post.text.length > 5);
          assert(post.reviewRating130 >= .5 && post.reviewRating130 <= 5);
          posts++;
        }
      }
      const rendered = run('gfStoryRender(' + JSON.stringify(event) + ')');
      assert(!rendered.includes('검증 <장면>'));
    }
    const frozen = run('JSON.stringify(p150)');
    run(`gf08SetMonth(p150,${i},m150)`);
    assert.equal(run('JSON.stringify(p150)'), frozen);
    // Reload must keep both choices and the no-repeat history.
    if (i === 5) run('p150=JSON.parse(JSON.stringify(p150));db.draft=p150;');
    months++;
  }
}
// Visible selection consumes one core per choice across adjacent individual ratings.
run("var fresh150=fixture(90);db.draft=fresh150;var first150=[];for(var n150=0;n150<20;n150++){var rate150=n150%2?4:4.5;var bank150=gf130Rows('드라마','audience',rate150);first150.push(gf64Select(fresh150,'audience150-visible-드라마-high',bank150).id)}");
assert.equal(new Set(read('first150')).size, 20);
// Existing interview bodies and historical monthly records are never migrated on render.
run("var old150=fixture(80);db.draft=old150;old150.gf64Content={used:{},last:{},cache:{'0-interview':{text:'GF|interview|기존 배우|저장된 인터뷰'}}};var oldMonth150={events:['GF|interview|기존 배우|저장된 인터뷰']};old150.months=[oldMonth150];var oldSnapshot150=JSON.stringify(old150);gf08News(old150,0,{},'interview');gfStoryRender(oldMonth150.events[0]);");
assert.equal(run('JSON.stringify(old150)'), run('oldSnapshot150'));
// A filmed line survives review diversification verbatim.
run("var dialogue150=fixture(85);db.draft=dialogue150;dialogue150.filming117={scenes:[{id:'scene150',actorId:dialogue150.cast[0].id,actorName:dialogue150.cast[0].name,line:'우리의 선택은 여기에 남아.',result:{}}]};var dialogueMonth150={month:MONTHS[0],audience:85,critic:85,gross:20};gf08SetMonth(dialogue150,0,dialogueMonth150);var full150=JSON.parse(dialogue150.gf64Content.cache['0-community'].text.slice(15));");
assert(read('full150.posts').some(p => p.dialogueLine === '우리의 선택은 여기에 남아.' && p.text.includes('우리의 선택은 여기에 남아.')));
console.log(`PASS: ${months} genre/score/month cases; ${interviews} interviews; ${posts} visible audience posts; cast attribution, ratings, reload, frozen history, dialogue and escaping.`);
