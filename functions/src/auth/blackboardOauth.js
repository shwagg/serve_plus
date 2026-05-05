//token exchange and user profile fetching for Blackboard OAuth

const admin = require("firebase-admin");
const axios = require("axios");

const BLACKBOARD_TOKEN_URL = process.env.BLACKBOARD_TOKEN_URL;
const BLACKBOARD_USER_URL = process.env.BLACKBOARD_USER_URL;
const BLACKBOARD_CLIENT_ID = process.env.BLACKBOARD_CLIENT_ID;
const BLACKBOARD_CLIENT_SECRET = process.env.BLACKBOARD_CLIENT_SECRET;
const BLACKBOARD_REDIRECT_URI = process.env.BLACKBOARD_REDIRECT_URI;

async function exchangeCodeForToken(code) {
  try {
    const credentials = Buffer.from(
      `${BLACKBOARD_CLIENT_ID}:${BLACKBOARD_CLIENT_SECRET}`
    ).toString("base64");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: BLACKBOARD_REDIRECT_URI,
    }).toString();

    const response = await axios.post(BLACKBOARD_TOKEN_URL, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
    });

    console.log("Token response fields:", Object.keys(response.data));
    console.log("Token response data:", JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error(
      "Token exchange failed:",
      error.response?.data || error.message,
    );
    throw new Error("Failed to exchange authorization code");
  }
}

async function fetchBlackboardUserProfile(accessToken) {
  try {
    const response = await axios.get(BLACKBOARD_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error("fetchBlackboardUserProfile failed:");
    console.error("  URL:", BLACKBOARD_USER_URL);
    console.error("  Status:", status);
    console.error("  Response:", JSON.stringify(data));
    console.error("  Message:", error.message);
    throw new Error(`Blackboard /me failed [${status}]: ${JSON.stringify(data) || error.message}`);
  }
}

//update/create user in firestore
async function createOrUpdateUser(blackboardProfile, uid) {
  if (!uid) {
    throw new Error("Cannot create/update user: uid is required");
  }

  const userRef = admin.firestore().collection("users").doc(uid);

  //name, username, id number, and email 
  const userData = {
    email: blackboardProfile.email || blackboardProfile.contact?.email || "",
    displayName:
      blackboardProfile.name?.given && blackboardProfile.name?.family
        ? `${blackboardProfile.name.given} ${blackboardProfile.name.family}`
        : blackboardProfile.userName || "Blackboard User",
    blackboardId: blackboardProfile.id,
    blackboardUsername: blackboardProfile.userName,
    authProvider: "blackboard",
    lastLoginVia: "blackboard",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Check if user exists
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    // Update existing user
    await userRef.update(userData);
  } else {
    // Create new user with default student role
    await userRef.set({
      ...userData,
      role: "student",
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return userRef;
}

module.exports = {
  exchangeCodeForToken,
  fetchBlackboardUserProfile,
  createOrUpdateUser,
};
