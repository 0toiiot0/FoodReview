// ---- recent reviews fake data ----
const reviews = [
  { rating:"4.5", quote:"회식하기 딱 좋았어요", place:"을지로" },
  { rating:"4.0", quote:"재방문 의사 100%예요", place:"합정" },
  { rating:"4.8", quote:"웨이팅 있어도 갈 가치 있어요", place:"연남동" },
  { rating:"3.8", quote:"가격 대비 양이 조금 아쉬워요", place:"성수" },
  { rating:"4.6", quote:"단체 예약도 친절하게 받아주셨어요", place:"망원동" },
  { rating:"4.2", quote:"혼밥해도 눈치 안 보여요", place:"광장시장" },
  { rating:"4.9", quote:"사장님이 정말 친절하세요", place:"을지로" },
  { rating:"4.1", quote:"소음이 좀 있는 편이에요", place:"합정" },
  { rating:"4.7", quote:"분위기 좋아서 데이트 코스로도 괜찮아요", place:"연남동" },
  { rating:"4.3", quote:"주차가 편해서 좋았어요", place:"성수" },
  { rating:"4.4", quote:"다음 모임도 여기서 하기로 했어요", place:"망원동" },
  { rating:"3.9", quote:"웨이팅 시간이 꽤 긴 편이에요", place:"광장시장" }
];

function buildTickerItem(r){
  const item = document.createElement('div');
  item.className = 'ticker-item';
  item.innerHTML =
    '<span class="rating">' + r.rating + '</span>' +
    '<span class="quote">“' + r.quote + '”</span>' +
    '<span class="place">' + r.place + '</span>';
  return item;
}

const track = document.getElementById('tickerTrack');
// duplicate the list once for a seamless -50% loop
[...reviews, ...reviews].forEach(r => track.appendChild(buildTickerItem(r)));

// ---- scroll reveal ----
const revealEls = document.querySelectorAll('.reveal');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion) {
  revealEls.forEach(el => el.classList.add('is-visible'));
} else if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => observer.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('is-visible'));
}

// ---- sub nav active state (scroll-spy) ----
const subnavLinks = document.querySelectorAll('.site-subnav a[href^="#"]');
const subnavTargets = Array.from(subnavLinks)
  .map(link => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if (subnavLinks.length && subnavTargets.length && 'IntersectionObserver' in window) {
  const subnavObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const link = document.querySelector('.site-subnav a[href="#' + entry.target.id + '"]');
      if (!link) return;
      subnavLinks.forEach(l => l.classList.remove('is-active'));
      link.classList.add('is-active');
    });
  }, { threshold: 0, rootMargin: '-45% 0px -50% 0px' });

  subnavTargets.forEach(t => subnavObserver.observe(t));
}
