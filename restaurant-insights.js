// 가게 카드 호버 오버레이용 평점/AI 한줄요약 공용 헬퍼.
// popular-restaurants.js, recommend.js 둘 다 실데이터에 평점/요약 필드가 없으므로,
// 가게 이름을 시드로 결정적으로(매 새로고침 랜덤 X) 만들어 채운다.

window.RestaurantInsights = (function () {
  "use strict";

  const SUMMARY_POOL = [
    { keyword: "한식", lines: ["집밥 느낌 나는 반찬 구성이 만족스러워요", "국물 맛이 깊고 재료가 신선해요"] },
    { keyword: "일식", lines: ["재료 신선도가 좋고 플레이팅이 정갈해요", "숙성회와 초밥의 밸런스가 좋아요"] },
    { keyword: "중식", lines: ["불맛이 확실하고 양이 넉넉해요", "면요리와 탕수육 조합이 인기예요"] },
    { keyword: "이탈리안", lines: ["파스타 면이 알덴테로 잘 삶아져요", "분위기 좋고 와인 페어링이 훌륭해요"] },
    { keyword: "양식", lines: ["플레이팅이 세련되고 서비스가 친절해요", "메인 요리 화력 조절이 인상적이에요"] },
    { keyword: "카페", lines: ["원두 향이 좋고 좌석이 편해요", "디저트가 다양하고 사진 찍기 좋아요"] },
    { keyword: "브런치", lines: ["플레이팅이 예쁘고 재료가 신선해요", "주말 브런치로 대기 없이 즐기기 좋아요"] },
    { keyword: "이자카야", lines: ["안주 구성이 알차고 사케 종류가 다양해요", "분위기 아늑하고 2차 장소로 좋아요"] },
    { keyword: "술집", lines: ["안주 맛이 진하고 술 종류가 다양해요", "왁자지껄한 분위기가 모임하기 좋아요"] },
    { keyword: "분식", lines: ["떡볶이 소스가 중독적이에요", "가성비 좋고 회전이 빨라 줄이 금방 줄어요"] },
    { keyword: "고기", lines: ["고기 질이 좋고 굽는 서비스가 친절해요", "숯불향이 진하고 반찬 리필이 후해요"] },
    { keyword: "구이", lines: ["고기 질이 좋고 굽는 서비스가 친절해요", "숯불향이 진하고 반찬 리필이 후해요"] }
  ];
  const DEFAULT_SUMMARY_LINES = ["재방문 의사가 높은 곳으로 꼽혀요", "메뉴 구성과 가격이 무난해요"];

  function hashSeed(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function ratingFor(name, presetRating) {
    if (typeof presetRating === "number") return presetRating;
    const seed = hashSeed(name || "");
    return Math.round((4.2 + (seed % 71) / 100) * 10) / 10;
  }

  function summaryFor(name, category, presetSummary) {
    if (presetSummary) return presetSummary;
    const text = category || "";
    let lines = DEFAULT_SUMMARY_LINES;
    for (let i = 0; i < SUMMARY_POOL.length; i++) {
      if (text.indexOf(SUMMARY_POOL[i].keyword) !== -1) {
        lines = SUMMARY_POOL[i].lines;
        break;
      }
    }
    const seed = hashSeed(name || "");
    return lines[seed % lines.length];
  }

  return { ratingFor: ratingFor, summaryFor: summaryFor };
})();
