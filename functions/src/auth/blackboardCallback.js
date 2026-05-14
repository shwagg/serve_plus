const {onRequest} = require("firebase-functions/v2/https");
const {
  handleBlackboardStart,
  handleBlackboardCallback,
} = require("./blackboardOauth");

function getRequestPath(req) {
  return (req.path || req.url.split("?")[0] || "/").replace(/\/+$/, "") || "/";
}

async function blackboardRouter(req, res) {
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  const path = getRequestPath(req);

  try {
    if (path === "/auth/blackboard/start") {
      await handleBlackboardStart(req, res);
      return;
    }

    if (
      path === "/auth/blackboard/callback" ||
      (path === "/" && (req.query.code || req.query.error))
    ) {
      await handleBlackboardCallback(req, res);
      return;
    }

    res.status(404).send("Not found");
  } catch (error) {
    console.error("Blackboard auth route failed:", error.message);
    res.status(500).send("Blackboard authentication is not configured.");
  }
}

const blackboardAuth = onRequest(
  {region: "asia-southeast1"},
  blackboardRouter,
);

module.exports = {
  blackboardAuth,
  blackboardCallback: blackboardAuth,
};
