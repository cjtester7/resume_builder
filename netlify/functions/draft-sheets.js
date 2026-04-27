/*
  FILE:    draft-sheets.js
  VERSION: v1
  UPDATED: 2026-04-27
  CHANGES: Initial version. Google Sheets backend for resume draft save/load.
           Supports save, load, list, and delete operations.
           Designed for drop-in replacement with draft-supabase.js when migrating.
           Sheet tab: Drafts. Columns: draft_id, user_email, label, data, profile, updated_at.
*/

const SHEET_ID  = "1rHh1hH3qS2iTYUhmBHOwAtFxK-7DmOvN-s7_Rhd_j-s";
const SHEET_TAB = "Drafts";

async function getAccessToken() {
  const email  = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64")
      .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");

  const now    = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim  = {
    iss:   email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600
  };

  const unsigned = `${encode(header)}.${encode(claim)}`;

  function pemToBuffer(pem) {
    const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/,"")
                   .replace(/-----END PRIVATE KEY-----/,"")
                   .replace(/\s+/g,"");
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  }

  const key = await crypto.subtle.importKey(
    "pkcs8", pemToBuffer(rawKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${Buffer.from(sig).toString("base64")
    .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt
    })
  });

  const tok = await res.json();
  return tok.access_token;
}

async function sheetsGet(token, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function sheetsAppend(token, row) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_TAB + "!A1:F1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ values: [row] })
  });
  return res.json();
}

async function sheetsUpdate(token, range, row) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method:  "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ values: [row] })
  });
  return res.json();
}

async function getAllRows(token) {
  const data = await sheetsGet(token, `${SHEET_TAB}!A2:F`);
  return data.values || [];
}

exports.handler = async function (event) {
  try {
    const { action, userEmail, draftId, label, data, profile } = JSON.parse(event.body || "{}");

    if (!action || !userEmail) {
      return respond(400, { error: "Missing action or userEmail" });
    }

    const token = await getAccessToken();

    if (action === "save") {
      const rows     = await getAllRows(token);
      const now      = new Date().toISOString();
      const newData  = JSON.stringify(data || {});
      const newLabel = label || "Untitled Draft";

      if (draftId) {
        const rowIndex = rows.findIndex(r => r[0] === draftId && r[1] === userEmail);
        if (rowIndex !== -1) {
          const sheetRow = rowIndex + 2;
          await sheetsUpdate(token, `${SHEET_TAB}!A${sheetRow}:F${sheetRow}`,
            [draftId, userEmail, newLabel, newData, profile || "", now]);
          return respond(200, { success: true, draftId, action: "updated" });
        }
      }

      const newId = "draft_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
      await sheetsAppend(token, [newId, userEmail, newLabel, newData, profile || "", now]);
      return respond(200, { success: true, draftId: newId, action: "created" });
    }

    if (action === "list") {
      const rows   = await getAllRows(token);
      const drafts = rows
        .filter(r => r[1] === userEmail && r[0])
        .map(r => ({
          draftId:   r[0] || "",
          label:     r[2] || "Untitled Draft",
          profile:   r[4] || "",
          updatedAt: r[5] || ""
        }))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      return respond(200, { drafts });
    }

    if (action === "load") {
      if (!draftId) return respond(400, { error: "Missing draftId" });

      const rows = await getAllRows(token);
      const row  = rows.find(r => r[0] === draftId && r[1] === userEmail);
      if (!row)  return respond(404, { error: "Draft not found" });

      return respond(200, {
        draft: {
          draftId:   row[0],
          label:     row[2] || "Untitled Draft",
          data:      JSON.parse(row[3] || "{}"),
          profile:   row[4] || "",
          updatedAt: row[5] || ""
        }
      });
    }

    if (action === "delete") {
      if (!draftId) return respond(400, { error: "Missing draftId" });

      const rows     = await getAllRows(token);
      const rowIndex = rows.findIndex(r => r[0] === draftId && r[1] === userEmail);
      if (rowIndex === -1) return respond(404, { error: "Draft not found" });

      const sheetRow = rowIndex + 2;
      await sheetsUpdate(token, `${SHEET_TAB}!A${sheetRow}:F${sheetRow}`,
        ["", "", "", "", "", ""]);
      return respond(200, { success: true, action: "deleted" });
    }

    return respond(400, { error: "Unknown action. Use: save, list, load, delete" });

  } catch (err) {
    return respond(500, { error: err.message });
  }
};

function respond(status, body) {
  return { statusCode: status, body: JSON.stringify(body) };
}
