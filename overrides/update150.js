/* Content-only update: preserve ratings, film outcomes, and already saved feeds. */
function gf150Band(rating) {
  return rating >= 4 ? 'high' : rating >= 2.5 ? 'mixed' : 'low';
}

for (const [genre, interviews] of Object.entries(GF150_INTERVIEWS)) {
  for (const [index, [title, question, answer]] of interviews.entries()) {
    const id = 'interview150-' + genre + '-' + index;
    if (!GF64_NEWS_MASTER.entries.some(row => row.id === id)) {
      GF64_NEWS_MASTER.entries.push({
        id, category: 'interview', genre,
        title: '{featuredActor} · ' + title,
        body: 'Q. ' + question + '\nA. ' + answer
      });
    }
  }
}

const gf150RowsBefore = gf130Rows;
gf130Rows = function(genre, voice, rating) {
  const previous = gf150RowsBefore(genre, voice, rating);
  if (voice !== 'audience') return previous;
  const g = GF150_AUDIENCE[genre] ? genre : '드라마';
  const value = gf130Rating(rating), band = gf150Band(value);
  const authored = GF150_AUDIENCE[g][band].map((body, index) => ({
    id: 'audience150-' + g + '-' + band + '-' + index,
    core: 'audience150-' + band + '-' + index,
    genre: g, rating: value, body
  }));
  // Old ending variants share one core: changing the last sentence is not a new voice.
  const unique = previous.filter((row, index, all) => all.findIndex(r => r.core === row.core) === index);
  return [...authored, ...unique];
};

const gf150ChooseBefore = gf130Choose;
gf130Choose = function(p, voice, rating) {
  if (voice !== 'audience') return gf150ChooseBefore(p, voice, rating);
  const rows = gf130Rows(p.genre, voice, rating);
  return gf64Select(p, 'audience150-generated-' + rows[0].genre + '-' + gf150Band(rating), rows);
};

const gf150MonthBefore = gf08SetMonth;
gf08SetMonth = function(p, i, m) {
  // A month is generated once. Subsequent calls restore its exact saved choices.
  const frozen = p.feedMonths150?.[i];
  if (frozen) { m.events = frozen.slice(); return; }
  const hadAudienceCache = Boolean(p.gf64Content?.cache?.[i + '-community']);
  gf150MonthBefore(p, i, m);
  // The video replacement previously consumed the month's sole interview.
  if (!m.events.some(event => typeof event === 'string' && event.startsWith('GF|interview|'))) {
    const interview = gf08News(p, i, m, 'interview');
    const video = m.events.findIndex(event => typeof event === 'string' && event.startsWith('GF142|video|'));
    m.events.splice(video >= 0 ? video + 1 : m.events.length, 0, interview);
  }
  if (!hadAudienceCache) {
    const replacements = new Map();
    m.events = m.events.map(event => {
      if (typeof event !== 'string' || !event.startsWith('GF27|community|')) return event;
      let thread;
      try { thread = JSON.parse(event.slice(15)); } catch { return event; }
      if (!Array.isArray(thread.posts)) return event;
      thread.posts = thread.posts.map(post => {
        const rating = Number(post.reviewRating130);
        if (!Number.isFinite(rating)) return post;
        // Hidden comments must not exhaust the no-repeat history of visible posts.
        const rows = gf130Rows(p.genre, 'audience', rating);
        const row = gf64Select(p, 'audience150-visible-' + rows[0].genre + '-' + gf150Band(rating), rows);
        const newline = String(post.text).indexOf('\n');
        const dialogue = post.dialogueLine && newline >= 0 ? post.text.slice(newline) : '';
        const updated = {...post, text: row.body + dialogue, reviewId130: row.id, reviewGenre130: row.genre};
        replacements.set(post.id + '|' + post.nick, updated);
        return updated;
      });
      thread.contentVersion150 = 150;
      return 'GF27|community|' + JSON.stringify(thread);
    });
    const cache = p.gf64Content?.cache?.[i + '-community'];
    if (cache?.text?.startsWith('GF27|community|')) {
      try {
        const thread = JSON.parse(cache.text.slice(15));
        thread.posts = thread.posts.map(post => replacements.get(post.id + '|' + post.nick) || post);
        thread.contentVersion150 = 150;
        cache.text = 'GF27|community|' + JSON.stringify(thread);
      } catch { /* An unrecognized historical cache remains untouched. */ }
    }
  }
  p.feedMonths150 ??= {};
  p.feedMonths150[i] = m.events.slice();
};
