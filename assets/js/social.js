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

const card = r => `<article class="rcard">
  ${stars(5)}
  <blockquote>${r.text}</blockquote>
  <footer><b>${r.name}</b><span>${r.job}</span><em>${r.when}</em></footer>
</article>`;

export function mountReviews(base=''){
  const host = document.getElementById('reviews');
  if(!host) return;
  /* This was a black band with the reviews sliding across it on a loop. Three
     things were wrong with that. You cannot read a moving card, so the proof
     — which is the whole point of the section — went past unread. The cards
     clipped the text to four lines and ended on an ellipsis, so the longest
     and best review was the one you saw least of. And it looked like a widget
     dropped into the page rather than part of it: everything above and below
     is paper, rules and rounded cards.

     It is now what it should have been. Nothing moves, every review is whole,
     and it is built out of the same pieces as the rest of the site. */
  host.innerHTML = `
    <div class="rhead">
      <div class="rscore">
        <span class="label">What people say</span>
        <b class="rbig">${TT_STATS.rating}<em>/5</em></b>
        ${stars(TT_STATS.rating)}
        <span class="rsub">across ${TT_STATS.reviews} reviews on Thumbtack</span>
      </div>
      <div class="rmeta">
        <div><b>${TT_STATS.hires}</b><span>Jobs hired through Thumbtack</span></div>
        <div><b>${TT_STATS.years}</b><span>Years in business</span></div>
        <div><b>Top&nbsp;Pro</b><span>2024 and 2025</span></div>
      </div>
    </div>
    <div class="rrail">
      <button class="rnav prev" type="button" data-rscroll="-1" aria-label="Previous reviews">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <div class="rrow" tabindex="0">
        ${REVIEWS.map(card).join('')}
        <a class="rcard rall" href="${TT_URL}" target="_blank" rel="noopener">
          <span class="rallq">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H9l-5 4z"/></svg>
          </span>
          <b>Read all ${TT_STATS.reviews} on Thumbtack</b>
          <span>Every one of these is on his profile, under the reviewer's own name.</span>
        </a>
      </div>
      <button class="rnav next" type="button" data-rscroll="1" aria-label="More reviews">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
    </div>`;

  /* One row that slides, which is what was asked for. The arrows move it by a
     card and a half so a part-card always shows at the edge, which is what
     tells you there is more without needing a scrollbar. */
  const row = host.querySelector('.rrow');
  const ends = () => {
    host.querySelector('.rnav.prev').disabled = row.scrollLeft < 8;
    host.querySelector('.rnav.next').disabled =
      row.scrollLeft > row.scrollWidth - row.clientWidth - 8;
  };
  host.addEventListener('click', e => {
    const b = e.target.closest('[data-rscroll]'); if(!b) return;
    const step = (row.querySelector('.rcard')?.offsetWidth || 300) * 1.5;
    row.scrollBy({ left: step * +b.dataset.rscroll, behavior:'smooth' });
  });
  row.addEventListener('scroll', ends, { passive:true });
  ends();
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
