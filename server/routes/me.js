// Pinterest account + boards for the Studio dashboard (app.html).

import { sendJson, getSession, pinterest } from "../lib.js";

export default async function handler(req, res) {
  try {
    const s = await getSession(req, res);
    if (!s) return sendJson(res, 200, { connected: false });

    const a = await pinterest(s, "/user_account");
    if (!a.ok) {
      if (a.status === 401 || a.status === 403) return sendJson(res, 200, { connected: false });
      return sendJson(res, 502, { error: "Pinterest did not answer. Try again in a minute." });
    }

    let boards = [];
    let bookmark = "";
    for (let i = 0; i < 4; i++) {
      const b = await pinterest(s, "/boards?page_size=100" + (bookmark ? "&bookmark=" + encodeURIComponent(bookmark) : ""));
      if (!b.ok) break;
      boards = boards.concat((b.data.items || []).map(function (x) {
        return { id: x.id, name: x.name, privacy: x.privacy || "PUBLIC" };
      }));
      bookmark = b.data.bookmark || "";
      if (!bookmark) break;
    }

    sendJson(res, 200, {
      connected: true,
      account: {
        username: a.data.username || "",
        profile_image: a.data.profile_image || "",
        account_type: a.data.account_type || "",
        business_name: a.data.business_name || ""
      },
      boards: boards
    });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message });
  }
}
