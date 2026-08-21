// 구글 리뷰 텍스트를 Gemini에 보내 감정 분류 / 핵심 키워드 / 한 줄 요약을 한 번에 받아온다.
// 참고: https://ai.google.dev/api/generate-content
// GEMINI_API_KEY는 반드시 서버(이 함수) 안에서만 사용하고, 클라이언트로 절대 전달하지 않는다.

const PRIMARY_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sentiments: {
      type: "ARRAY",
      items: { type: "STRING", enum: ["positive", "neutral", "negative"] },
    },
    keywords: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          score: { type: "INTEGER" },
          sentiment: { type: "STRING", enum: ["positive", "negative"] },
        },
        required: ["word", "score", "sentiment"],
      },
    },
    summary: { type: "STRING" },
  },
  required: ["sentiments", "keywords", "summary"],
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed", message: "POST만 지원합니다." });
    return;
  }

  const body = req.body || {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const reviews = Array.isArray(body.reviews) ? body.reviews : [];
  const validReviews = reviews.filter(function (review) {
    return review && typeof review.text === "string" && review.text.trim().length > 0;
  });

  if (!name || validReviews.length === 0 || validReviews.length > 5) {
    res.status(400).json({ error: "bad_request", message: "name과 1~5개의 reviews가 필요합니다." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "upstream_error", message: "GEMINI_API_KEY가 설정되지 않았습니다." });
    return;
  }

  try {
    const prompt = buildPrompt(name, validReviews);
    const result = await callGemini(apiKey, prompt);

    if (result.sentiments.length !== validReviews.length) {
      res.status(502).json({ error: "upstream_error", message: "AI 응답의 리뷰 개수가 일치하지 않습니다." });
      return;
    }

    const sentiment = summarizeSentiments(result.sentiments);
    const keywords = shapeKeywords(result.keywords);

    res.status(200).json({
      sentiment: sentiment,
      keywords: keywords,
      summary: result.summary || "",
    });
  } catch (error) {
    console.error("Gemini analyze error:", error);
    res.status(502).json({ error: "upstream_error", message: "AI 분석에 실패했습니다." });
  }
};

function buildPrompt(name, reviews) {
  const numberedReviews = reviews
    .map(function (review, index) {
      const rating = typeof review.rating === "number" ? review.rating : "정보 없음";
      return index + 1 + ". (별점: " + rating + ") " + review.text;
    })
    .join("\n");

  return (
    "다음은 '" +
    name +
    "'이라는 음식점에 대한 구글 리뷰 " +
    reviews.length +
    "개입니다. 각 리뷰에 번호가 매겨져 있습니다.\n\n" +
    numberedReviews +
    "\n\n다음 세 가지를 분석해주세요:\n" +
    "1. 각 리뷰를 순서대로 긍정(positive)/보통(neutral)/부정(negative) 중 하나로 분류하세요. " +
    "반드시 리뷰 개수(" +
    reviews.length +
    "개)와 동일한 개수의 값을 같은 순서로 반환하세요.\n" +
    "2. 음식 이름, 맛, 분위기, 서비스와 관련된 핵심 키워드를 8~15개 추출하고, " +
    "각 키워드마다 중요도 점수(1~10)와 긍정적 맥락인지 부정적 맥락인지를 매기세요.\n" +
    "3. 이 가게의 리뷰 전체를 한국어 한 문장으로 요약하세요."
  );
}

async function callGemini(apiKey, prompt) {
  try {
    return await requestGemini(apiKey, PRIMARY_MODEL, prompt);
  } catch (error) {
    if (error.status === 404) {
      return await requestGemini(apiKey, FALLBACK_MODEL, prompt);
    }
    throw error;
  }
}

async function requestGemini(apiKey, model, prompt) {
  const response = await fetch(GEMINI_API_BASE + model + ":generateContent?key=" + apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: RESPONSE_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const error = new Error("Gemini API request failed with status " + response.status);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  const text = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;

  if (!text) {
    throw new Error("Gemini API returned no content");
  }

  const parsed = JSON.parse(text);
  return {
    sentiments: Array.isArray(parsed.sentiments) ? parsed.sentiments : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

function summarizeSentiments(sentiments) {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  sentiments.forEach(function (sentiment) {
    if (counts.hasOwnProperty(sentiment)) {
      counts[sentiment] += 1;
    }
  });
  return {
    positive: counts.positive,
    neutral: counts.neutral,
    negative: counts.negative,
    total: sentiments.length,
  };
}

function shapeKeywords(keywords) {
  return keywords
    .filter(function (keyword) {
      return keyword && typeof keyword.word === "string" && keyword.word.trim().length > 0;
    })
    .slice(0, 15)
    .map(function (keyword) {
      const score = Math.round(Number(keyword.score));
      return {
        word: keyword.word.trim(),
        score: Math.max(1, Math.min(10, Number.isFinite(score) ? score : 5)),
        sentiment: keyword.sentiment === "negative" ? "negative" : "positive",
      };
    });
}
