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
    const response = await axios.post(BLACKBOARD_TOKEN_URL, null, {
      params: {
        grant_type: "authorization_code",
        code: code,
        client_id: BLACKBOARD_CLIENT_ID,
        client_secret: BLACKBOARD_CLIENT_SECRET,
        redirect_uri: BLACKBOARD_REDIRECT_URI,
      },
    });

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
    console.error(
      "Failed to fetch user profile:",
      error.response?.data || error.message,
    );
    throw new Error("Failed to fetch user profile from Blackboard");
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
