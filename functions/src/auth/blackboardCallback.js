const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {
  exchangeCodeForToken,
  fetchBlackboardUserProfile,
  createOrUpdateUser,
} = require("./blackboardOauth");

exports.blackboardCallback = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", process.env.FRONTEND_URL);
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      const { code, error, error_description } = req.query;

      // Handle authorization denial
      if (error) {
        console.warn("Blackboard authorization denied:", error_description);
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth?error=${encodeURIComponent(error_description || "Authorization denied")}`,
        );
      }

      if (!code) {
        console.error("No authorization code received");
        return res.status(400).send("Missing authorization code");
      }

      // Exchange code for access token
      console.log("Exchanging authorization code for access token...");
      const tokenData = await exchangeCodeForToken(code);
      const { access_token, user_id } = tokenData;

      // Fetch user profile from Blackboard
      console.log("Fetching user profile from Blackboard...");
      const blackboardProfile = await fetchBlackboardUserProfile(access_token);

      // Use Blackboard user ID as the Firestore document ID
      const uid = `bb_${blackboardProfile.id || user_id}`;

      // Create or update user in Firestore
      console.log("Creating/updating user in Firestore...");
      const userRef = await createOrUpdateUser(blackboardProfile, uid);

      // Create Firebase custom token
      console.log("Creating Firebase custom token...");
      const customToken = await admin.auth().createCustomToken(uid);

      // Redirect to OAuth callback page with token
      const callbackUrl = `${process.env.FRONTEND_URL}/oauth-callback?token=${encodeURIComponent(customToken)}&provider=blackboard`;
      return res.redirect(callbackUrl);
    } catch (error) {
      console.error("Blackboard callback error:", error.message);
      const errorMsg = encodeURIComponent(
        error.message || "Authentication failed",
      );
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth?error=${errorMsg}`,
      );
    }
  },
);

function validateOAuthState(sessionState, queryState) {
  if (!sessionState || !queryState || sessionState !== queryState) {
    throw new Error("Invalid OAuth state - possible CSRF attack");
  }
}

module.exports = { validateOAuthState };
