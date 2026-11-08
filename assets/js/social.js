/* ============================================================
   social.js — the reviews wall and the work gallery.

   Both run on any page that has the matching mount point, so the
   homepage, the about page and the gallery page share one source.

   The reviews are REAL, taken from the Thumbtack profile, with the
   reviewer's name as Thumbtack shows it and a link back to the source.
   Nothing here is written by us. If a review is not on that profile it
   does not go on this page.
   ============================================================ */

export const TT_URL = 'https://www.thumbtack.com/ny/astoria/kitchen-cabinet-makers/js-installations-closets/service/449636483136937986';

export const TT_STATS = {
  rating: 4.8, reviews: 36, hires: 66, years: 18, team: 4,
  /* `jobs` is the real figure: closets Joseph has installed since he started
     the company. `hires` is only Thumbtack's own counter, which began the day
     he joined Thumbtack and therefore misses most of the work. The two are
     different numbers and the big one is the true one. */
  jobs: '2,000+',
  badges: ['Top Pro 2025', 'Top Pro 2024', 'Background checked']
};

export const REVIEWS = [
  { name:'Erica D.', when:'1 month ago', job:'Closet and shelving system installation',
    text:'JS Closet company did an amazing job on my closet! We worked on a design that fit the space and the install went beautifully! We are so happy we used JS Closets!' },
  { name:'Peter G.', when:'May 7, 2026', job:'Four closets, hanging and shoe storage',
    text:'Joseph and his team were awesome. They took designs I’d had done by another company, improved them, and did work of the same quality for a much lower price. We’re very happy with how our four closets turned out and would definitely use this team again!' },
  { name:'Zoya K.', when:'Feb 18, 2026', job:'Every closet in the house',
    text:'We had all of the closets in our home done by this company, and I truly cannot say enough good things about our experience. From start to finish, they were professional, organized, and incredibly detail-oriented. The installation team was punctual, respectful of our home, and extremely skilled. The craftsmanship is outstanding. Everything feels solid, high-quality, and built to last.' },
  { name:'Roja A.', when:'Oct 7, 2025', job:'Custom closet design, rental',
    text:'I contacted Joseph from JS Installation for custom closet help. He was very professional and responsive. After I shared the measurements, he sent detailed 2D and 3D designs within hours. Would definitely consider using their services for a permanent home!' },
  { name:'Lisa M.', when:'Oct 4, 2025', job:'Shoe, handbag and hanging storage',
    text:'When I decided to get my closets done, I never considered custom closets as they sounded out of my price range. Until JS Installations said, “let me send you a quote, you’d be surprised.” They arrived on time, were right on budget, and delivered top quality work product with a 10-year warranty. I highly recommend them.' }
];

const stars = n => '<span class="rstars" aria-label="' + n + ' out of 5">' +
  '★★★★★'.split('').map((s,i)=>`<i class="${i < Math.round(n) ? 'on' : ''}">${s}</i>`).join('') + '</span>';

const card = (r, ghost) => `<article class="rcard"${ghost?' aria-hidden="true"':''}>
  ${stars(5)}
  <blockquote>${r.text}</blockquote>
  <footer><b>${r.name}</b><span>${r.job}</span><em>${r.when}</em></footer>
</article>`;

export function mountReviews(base=''){
  const host = document.getElementById('reviews');
  if(!host) return;
  /* With no reviews and no rating the whole band comes out, rather than
     showing an empty rail under a 0.0. Matters for a brand new site. */
  if(!REVIEWS.length && !TT_STATS.rating){
    host.closest('.revwrap')?.remove();
    return;
  }

  /* ── THE REVIEWS MOVE BY THEMSELVES ──
     They are the proof on this page, so they do not wait to be clicked at.
     The row carries the five reviews twice and slides left for exactly the
     width of one set, which lands it back where it started: there is no jump
     and no end, so every review comes round again without anyone touching
     anything.

     It stops the moment you want to read one -- hover, keyboard focus, or a
     finger down on a phone -- and starts again when you let go. The duplicate
     set is aria-hidden so a screen reader hears each review once.

     The "read all of them on Thumbtack" card is gone from the rail: the rail
     is the reviews, and the count and the source are stated in the box above
     it. */

  const live = REVIEWS.map(card).join('');
  const dup  = REVIEWS.map(r => card(r, true)).join('');

  host.innerHTML = `
    <div class="rhead">
      <div class="rbox rbox-score">
        <span class="label">What people say</span>
        <span class="rline"><b class="rbig">${TT_STATS.rating}<em>/5</em></b>${stars(TT_STATS.rating)}</span>
        <span class="rsub">${TT_STATS.reviews} reviews on Thumbtack</span>
      </div>
      <div class="rstats">
        ${TT_STATS.jobs ? `<div class="rbox rbox-hero"><b>${TT_STATS.jobs}</b><span>Closets installed</span></div>` : ''}
        <div class="rbox"><b>${TT_STATS.years}</b><span>Years in business</span></div>
        <div class="rbox"><b>Top&nbsp;Pro</b><span>2024 and 2025</span></div>
      </div>
    </div>
    <div class="rrail">
      <div class="rrow" tabindex="0" aria-label="Customer reviews">${live}${dup}</div>
    </div>`;

  const row = host.querySelector('.rrow');

  /* The animation travels exactly half the row, which is one full set, so the
     second set is sitting where the first one was when it loops. The duration
     follows the real width at about 42px a second, so adding a review makes
     it longer rather than faster. */
  const retime = () => {
    const one = row.scrollWidth / 2;
    if(!one) return;
    row.style.setProperty('--rdist', one + 'px');
    row.style.setProperty('--rtime', Math.round(one / 26) + 's');
  };
  retime();
  addEventListener('resize', retime);
  /* widths settle after the webfont swaps in */
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(retime);

  /* The fade at the foot of a quote belongs only on a quote that is actually
     cut off. Painted on every card it read as a styling tic, and it dimmed
     the last line of reviews that fitted perfectly well. CSS cannot ask
     whether a box overflowed, so it is measured here. */
  const markClipped = () => row.querySelectorAll('blockquote').forEach(q => {
    q.classList.toggle('clipped', q.scrollHeight > q.clientHeight + 2);
  });
  markClipped();
  addEventListener('resize', markClipped);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(markClipped);

  const hold = on => row.classList.toggle('held', on);
  row.addEventListener('pointerenter', () => hold(true));
  row.addEventListener('pointerleave', () => hold(false));
  row.addEventListener('pointerdown',  () => hold(true));
  addEventListener('pointerup',        () => hold(false));
  row.addEventListener('focusin',  () => hold(true));
  row.addEventListener('focusout', () => hold(false));
}

const esc = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

export async function mountGallery(base=''){
  const host = document.getElementById('gallery');
  if(!host) return;
  let man = [];
  try { man = await (await fetch(base + 'img/work/manifest.json')).json(); } catch(e){}
  if(!man.length){ host.innerHTML = '<p class="note">Gallery is loading.</p>'; return; }
  /* The grid used to be every photo at once, so every job added to the folder
     made this page taller and pushed everything under it further away. It is
     now a fixed window onto the work: three rows, then a button that says how
     many more there are. Adding a hundred photos changes what is behind the
     button, not the length of the page. */
  /* The box is a FIXED SIZE and the photographs page in and out of it.

     "Show all" used to lift the lid off the box: max-height went to none, the
     page grew by however many photographs were in the folder, and everything
     under the gallery was pushed a screen and a half further away. Adding work
     to the folder made the page worse, which is backwards.

     Now the box never changes height. Pressing the button loads the next
     batch INSIDE it and the box scrolls, so the gallery can hold a hundred
     photographs and the page is exactly as long as it is with twelve. */
  const PAGE = 12;
  let shown = 0;
  const cell = (m,i) => `
    <button class="gcell ${m.portrait?'tall':''}" data-g="${i}" aria-label="Open: ${esc(m.alt||('photo '+(i+1)))}">
      <img src="${base}img/work/${m.id}@800.jpg" alt="${esc(m.alt||'Closet installed by JS Installations & Closets')}"
           loading="${i<6?'eager':'lazy'}" decoding="async" width="800" height="${Math.round(800*m.h/m.w)}">
    </button>`;
  host.innerHTML = `<div class="gwrap"><div class="ggrid"></div><div class="gfade"></div></div>
    <div class="gmore"><button type="button" class="btn btn-ghost" data-gmore></button>
      <span class="gcount2"></span></div>
    <div class="glight" id="glight" hidden>
      <button class="gx" aria-label="Close">&times;</button>
      <button class="gprev" aria-label="Previous">&#9664;</button>
      <img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
      <button class="gnext" aria-label="Next">&#9654;</button>
      <span class="gcount"></span>
    </div>`;

  const grid = host.querySelector('.ggrid'),
        wrap = host.querySelector('.gwrap'),
        more = host.querySelector('[data-gmore]'),
        tally = host.querySelector('.gcount2');
  function page(){
    const next = man.slice(shown, shown + PAGE);
    grid.insertAdjacentHTML('beforeend', next.map((m,k) => cell(m, shown + k)).join(''));
    shown += next.length;
    const left = man.length - shown;
    more.textContent = left ? `Show ${Math.min(PAGE,left)} more` : '';
    more.hidden = !left;
    tally.textContent = `${shown} of ${man.length}`;
    wrap.classList.toggle('gdone', !left);
  }
  page();

  const lb = host.querySelector('#glight'), img = lb.querySelector('img'),
        cnt = lb.querySelector('.gcount');
  let at = 0;
  const show = i => { at = (i + man.length) % man.length;
    img.src = base + 'img/work/' + man[at].id + '@1600.jpg';
    /* The caption is the photo's own description, not a number. It is what a
       screen reader announces and what an image search indexes. */
    img.alt = man[at].alt || 'Closet installed by JS Installations & Closets';
    cnt.textContent = (at+1) + ' / ' + man.length; };
  const open = i => { show(i); lb.hidden = false; document.body.style.overflow = 'hidden'; };
  const close = () => { lb.hidden = true; document.body.style.overflow = ''; };
  host.addEventListener('click', e => {
    if(e.target.closest('[data-gmore]')){ page(); return; }
    const c = e.target.closest('[data-g]'); if(c) return open(+c.dataset.g);
    if(e.target.closest('.gx') || e.target === lb) return close();
    if(e.target.closest('.gprev')) return show(at-1);
    if(e.target.closest('.gnext')) return show(at+1);
  });
  addEventListener('keydown', e => {
    if(lb.hidden) return;
    if(e.key === 'Escape') close();
    if(e.key === 'ArrowLeft') show(at-1);
    if(e.key === 'ArrowRight') show(at+1);
  });
}
