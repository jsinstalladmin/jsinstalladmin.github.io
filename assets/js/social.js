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
  <p>${r.text}</p>
  <footer><b>${r.name}</b><span>${r.job} &middot; ${r.when}</span></footer>
</article>`;

export function mountReviews(base=''){
  const host = document.getElementById('reviews');
  if(!host) return;
  /* Two rows travelling opposite ways. Each row's content is repeated so the
     loop has no seam: the animation translates by exactly one copy width. */
  const a = REVIEWS.filter((_,i)=>i%2===0), b = REVIEWS.filter((_,i)=>i%2===1);
  const row = (list, dir) => `<div class="rrow ${dir}">
      <div class="rtrack">${[...list,...list,...list,...list].map(card).join('')}</div>
    </div>`;
  host.innerHTML = `
    <div class="rhead">
      <div>
        <span class="label">What people say</span>
        <h2 data-rv="up">${TT_STATS.rating} on Thumbtack,<br>across ${TT_STATS.reviews} reviews</h2>
      </div>
      <div class="rmeta">
        <div><b>${TT_STATS.hires}</b><span>Jobs hired through Thumbtack</span></div>
        <div><b>${TT_STATS.years}</b><span>Years in business</span></div>
        <div><b>Top Pro</b><span>2024 and 2025</span></div>
      </div>
    </div>
    ${row(a,'left')}
    ${row(b,'right')}
    <p class="rsrc">Every review above is from the
      <a href="${TT_URL}" target="_blank" rel="noopener">JS Installations &amp; Closets Thumbtack profile</a>,
      shown with the reviewer's name as Thumbtack publishes it.</p>`;
}

const esc = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

export async function mountGallery(base=''){
  const host = document.getElementById('gallery');
  if(!host) return;
  let man = [];
  try { man = await (await fetch(base + 'img/work/manifest.json')).json(); } catch(e){}
  if(!man.length){ host.innerHTML = '<p class="note">Gallery is loading.</p>'; return; }
  host.innerHTML = `<div class="ggrid">` + man.map((m,i)=>`
    <button class="gcell ${m.portrait?'tall':''}" data-g="${i}" aria-label="Open: ${esc(m.alt||('photo '+(i+1)))}">
      <img src="${base}img/work/${m.id}@800.jpg" alt="${esc(m.alt||'Closet installed by JS Installations & Closets')}"
           loading="${i<6?'eager':'lazy'}" decoding="async" width="800" height="${Math.round(800*m.h/m.w)}">
    </button>`).join('') + `</div>
    <div class="glight" id="glight" hidden>
      <button class="gx" aria-label="Close">&times;</button>
      <button class="gprev" aria-label="Previous">&#9664;</button>
      <img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
      <button class="gnext" aria-label="Next">&#9654;</button>
      <span class="gcount"></span>
    </div>`;

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
