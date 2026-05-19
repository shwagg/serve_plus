const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const eventPreviewHandler = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    const match = req.path.match(/\/event\/([^/?]+)/);
    const eventId = match?.[1];
    if (!eventId) {
      res.status(400).send("Bad request");
      return;
    }

    const host = req.get("x-forwarded-host") || req.get("host");
    const spaUrl = `/event/${eventId}`;
    const canonicalUrl = `https://${host}/preview/event/${eventId}`;
    const defaultImage = `https://${host}/og-default.jpg`;

    try {
      const db = admin.firestore();
      const missionSnap = await db.collection("missions").doc(eventId).get();

      if (!missionSnap.exists) {
        res.redirect(302, spaUrl);
        return;
      }

      const m = missionSnap.data();
      const title = escHtml(m.title || "Serve+ Event");
      const description = escHtml(
        (m.description || "Join us for community service!").slice(0, 200)
      );
      const imageUrl =
        m.img && m.img.trim() !== "" ? escHtml(m.img) : defaultImage;

      res.set("Cache-Control", "public, max-age=300, s-maxage=300");
      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} – Serve+</title>
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Serve+">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${escHtml(canonicalUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <script>window.location.replace(${JSON.stringify(spaUrl)});</script>
</head>
<body>
  <p><a href="${escHtml(spaUrl)}">${title}</a></p>
</body>
</html>`);
    } catch (err) {
      console.error("eventPreview error:", err);
      res.redirect(302, spaUrl);
    }
  }
);

module.exports = { eventPreviewHandler };
