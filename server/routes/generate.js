// Creates pin DRAFTS with AI. Nothing is posted here.
// Drafts go back to the browser, where the user must approve each one before publishing.

import { getSession, sendJson, isHttpUrl, clip } from "../lib.js";
import { isOwnerPreview } from "../growth.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

function seasonHint(d) {
  const m = d.getUTCMonth(); // 0 = Jan
  const day = d.getUTCDate();
  if (m === 6 || m === 7) return "Early holiday planners are searching Christmas DIY and decor ideas. Light early-planning angle is fine.";
  if (m === 8) return "Holiday searches are starting to rise. Gift and fall angles work well.";
  if (m === 9) return "October is the gift-ideas peak build-up on Pinterest. Frame products as gift ideas for the holidays.";
  if (m === 10) return "November is the highest buying-intent month. Use Christmas gift and holiday shopping framing.";
  if (m === 11 && day <= 20) return "Early-to-mid December: last-minute Christmas gift framing.";
  if (m === 11) return "Late December: Christmas search drops. Use New Year, fresh start and organization framing, not Christmas.";
  if (m === 0) return "January: fresh start, New Year, organization and self-care framing.";
  if (m === 1) return "February: Valentine's Day gift framing.";
  if (m === 2 || m === 3) return "Spring: spring refresh and Easter or Mother's Day early planning framing.";
  if (m === 4) return "May: Mother's Day gifts and summer planning framing.";
  return "Summer: summer style, travel and Father's Day framing.";
}

const STRATEGY_PLAYBOOK = {
  trend: "Trend wave: most pins ride what people search on Pinterest this month (seasonal and trending angles). Keep one variation evergreen.",
  gift: "Gift angle: frame every pin as a gift for a specific person (for mom, for her, for him, for a friend, for a coworker). Use buying-intent words like gift idea and gift for.",
  evergreen: "Evergreen SEO: search-led titles built on keywords people use all year. Avoid dated words like this Christmas or 2026.",
  hook: "Curiosity hooks: titles that make people stop scrolling (for example You never gifted this to your mom), while staying accurate and keyword-led. Put the search keyword early in the description.",
  lifestyle: "Lifestyle glow: describe the product inside a warm, glowing lifestyle scene (cozy room, golden hour, styled outfit) so the pin feels aspirational."
};

const COUNTRY_NAMES = {
  US: "United States", CA: "Canada", GB: "United Kingdom", AU: "Australia", DE: "Germany", FR: "France",
  IN: "India", NZ: "New Zealand", IE: "Ireland", AE: "United Arab Emirates", NL: "Netherlands", MX: "Mexico"
};

function countryGuide(codes) {
  const names = codes.map(function (c) { return COUNTRY_NAMES[c] || c; });
  const lines = ["Target countries: " + names.join(", ") + ". Write in English and use the words people in these countries search."];
  if (codes.indexOf("US") === -1 && codes.some(function (c) { return ["GB", "AU", "NZ", "IE"].indexOf(c) > -1; })) {
    lines.push("Use British spelling (colour, jewellery, organise).");
  }
  if (codes.some(function (c) { return c === "AU" || c === "NZ"; })) {
    lines.push("Australia and New Zealand are in the southern hemisphere: their seasons are reversed (December is summer), so keep seasonal words neutral or match their season.");
  }
  return lines.join(" ");
}

function buildPrompt(input, count, today) {
  return [
    "You write Pinterest pin copy for Etsy and Shopify sellers.",
    "Today is " + today.toISOString().slice(0, 10) + ". Seasonal guidance: " + seasonHint(today),
    countryGuide(input.countries),
    "Target audience: " + (input.audience || "shoppers who match this product") + ".",
    "Strategy to follow: " + (STRATEGY_PLAYBOOK[input.strategy] || STRATEGY_PLAYBOOK.trend),
    "",
    "Product title: " + input.productTitle,
    "Niche: " + (input.niche || "not given"),
    "Seller keywords (optional, pick at most 1-2 per pin): " + (input.keywords || "none"),
    "Extra notes from seller: " + (input.notes || "none"),
    "",
    "Write " + count + " DIFFERENT pin variations for this one product, all following the strategy above,",
    "each with its own angle.",
    "",
    "Rules:",
    "- title: under 100 characters, most important search keyword first, SEO style, no hashtags.",
    "- description: 2-3 natural sentences, 150-400 characters, value first, max 4-5 light keywords in total.",
    "- Never copy the full product title. Never stack many keywords. Never mix unrelated occasions",
    "  (for example Christmas and Halloween) in one pin. One clear theme per pin.",
    "- No false claims, no 'guaranteed', no fake discounts, no prices.",
    "- For Indian or Ayurvedic products use Western wellness wording (herbal tea, natural remedy).",
    "- alt_text: plain visual description of the product image, under 250 characters.",
    "- Use plain ASCII characters only. No emojis, no curly quotes, no long dashes.",
    "",
    "Return ONLY a JSON array, no other text, like:",
    "[{\"angle\":\"gift for mom\",\"title\":\"...\",\"description\":\"...\",\"alt_text\":\"...\"}]"
  ].join("\n");
}

function toAscii(s) {
  // Map smart quotes / long dashes / ellipsis to plain ASCII, then drop anything else non-ASCII.
  const map = {};
  map[String.fromCharCode(8216)] = "'";
  map[String.fromCharCode(8217)] = "'";
  map[String.fromCharCode(8220)] = "\"";
  map[String.fromCharCode(8221)] = "\"";
  map[String.fromCharCode(8211)] = "-";
  map[String.fromCharCode(8212)] = "-";
  map[String.fromCharCode(8722)] = "-";
  map[String.fromCharCode(8230)] = "...";
  let out = "";
  for (const ch of String(s || "")) {
    if (map[ch] !== undefined) out += map[ch];
    else {
      const c = ch.charCodeAt(0);
      if ((c >= 32 && c <= 126) || c === 10) out += ch;
    }
  }
  return out.trim();
}

async function callClaude(prompt, imageUrl) {
  const content = [];
  if (imageUrl) content.push({ type: "image", source: { type: "url", url: imageUrl } });
  content.push({ type: "text", text: prompt });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: content }]
    })
  });
  const data = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const err = new Error("AI error " + r.status);
    err.detail = data;
    throw err;
  }
  return (data.content || []).filter(function (b) { return b.type === "text"; })
    .map(function (b) { return b.text; }).join("\n");
}

function parseDrafts(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("AI did not return JSON");
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error("AI did not return a list");
  return arr;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const s = await getSession(req, res);
    if (!s && !isOwnerPreview(req)) return sendJson(res, 401, { error: "Connect your Pinterest account first" });
    if (!process.env.ANTHROPIC_API_KEY) return sendJson(res, 500, { error: "ANTHROPIC_API_KEY env var missing" });

    const body = req.body || {};
    const input = {
      productTitle: clip(body.productTitle, 300),
      niche: clip(body.niche, 80),
      keywords: clip(body.keywords, 200),
      notes: clip(body.notes, 300),
      audience: clip(body.audience, 300),
      strategy: STRATEGY_PLAYBOOK[body.strategy] ? body.strategy : "trend",
      countries: (Array.isArray(body.countries) ? body.countries : ["US"])
        .map(function (c) { return String(c || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2); })
        .filter(function (c) { return COUNTRY_NAMES[c]; })
        .slice(0, 8)
    };
    if (!input.countries.length) input.countries = ["US"];
    const productLink = clip(body.productLink, 2000);
    const imageUrl = clip(body.imageUrl, 2000);
    let count = parseInt(body.count, 10);
    if (!(count >= 1)) count = 3;
    if (count > 5) count = 5;

    if (!input.productTitle) return sendJson(res, 400, { error: "Product title is required" });
    if (!isHttpUrl(imageUrl)) return sendJson(res, 400, { error: "A valid image URL is required" });
    if (productLink && !isHttpUrl(productLink)) return sendJson(res, 400, { error: "Product link must be a valid URL" });

    const prompt = buildPrompt(input, count, new Date());
    let text;
    try {
      text = await callClaude(prompt, imageUrl);
    } catch (e) {
      // Some image hosts block fetching. Retry once with text only.
      console.error("Retrying without image", e.message, JSON.stringify(e.detail || {}));
      text = await callClaude(prompt, null);
    }

    const drafts = parseDrafts(text).slice(0, count).map(function (d, i) {
      return {
        id: Date.now().toString(36) + "-" + i + "-" + Math.random().toString(36).slice(2, 7),
        angle: toAscii(d.angle).slice(0, 60),
        title: toAscii(d.title).slice(0, 100),
        description: toAscii(d.description).slice(0, 500),
        alt_text: toAscii(d.alt_text).slice(0, 500),
        link: productLink,
        image_url: imageUrl,
        strategy: input.strategy,
        countries: input.countries,
        status: "pending",
        created_at: new Date().toISOString()
      };
    });

    sendJson(res, 200, { drafts: drafts });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message || "Generation failed" });
  }
}
