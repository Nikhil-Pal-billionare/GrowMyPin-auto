// Publishes ONE pin that the user has approved in the review queue.
// The request must carry approved: true, which the UI only sends after the user
// clicks Approve on that pin and confirms the publish dialog.

import { getSession, pinterest, sendJson, isHttpUrl, clip } from "../lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const s = await getSession(req, res);
    if (!s) return sendJson(res, 401, { error: "Connect your Pinterest account first" });

    const b = req.body || {};
    if (b.approved !== true) {
      return sendJson(res, 400, { error: "This pin is not approved. Approve it in the review queue first." });
    }

    const boardId = clip(b.board_id, 64);
    const title = clip(b.title, 100);
    const description = clip(b.description, 800);
    const altText = clip(b.alt_text, 500);
    const imageUrl = clip(b.image_url, 2000);
    const link = clip(b.link, 2000);

    if (!boardId) return sendJson(res, 400, { error: "Choose a board" });
    if (!title) return sendJson(res, 400, { error: "Title is required" });
    if (!isHttpUrl(imageUrl)) return sendJson(res, 400, { error: "Valid image URL is required" });
    if (link && !isHttpUrl(link)) return sendJson(res, 400, { error: "Link must be a valid URL" });

    const pin = {
      board_id: boardId,
      title: title,
      description: description,
      alt_text: altText,
      media_source: { source_type: "image_url", url: imageUrl }
    };
    if (link) pin.link = link;

    const r = await pinterest(s, "/pins", { method: "POST", body: pin });
    if (!r.ok) {
      return sendJson(res, r.status === 401 ? 401 : 502, {
        error: (r.data && r.data.message) || "Pinterest rejected the pin",
        detail: r.data
      });
    }
    sendJson(res, 200, { id: r.data.id, url: "https://www.pinterest.com/pin/" + r.data.id + "/" });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message });
  }
}
