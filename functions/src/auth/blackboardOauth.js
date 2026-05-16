// Minimal Blackboard OAuth/OIDC bridge helpers.

const admin = require("firebase-admin");
const axios = require("axios");
const crypto = require("crypto");

const STATE_COOKIE = "blackboard_oauth_state";
const STATE_MAX_AGE_SECONDS = 10 * 60;

let cachedJwks = null;
let cachedJwksAt = 0;
const JWKS_CACHE_MS = 10 * 60 * 1000;

function getConfig() {
  return {
    clientId: process.env.BLACKBOARD_CLIENT_ID,
    clientSecret: process.env.BLACKBOARD_CLIENT_SECRET,
    authorizationEndpoint: process.env.BLACKBOARD_AUTHORIZATION_ENDPOINT,
    tokenEndpoint:
      process.env.BLACKBOARD_TOKEN_ENDPOINT ||
      process.env.BLACKBOARD_TOKEN_URL,
    jwksUrl: process.env.BLACKBOARD_JWKS_URL,
    userinfoEndpoint:
      process.env.BLACKBOARD_USERINFO_ENDPOINT ||
      process.env.BLACKBOARD_USER_URL,
    redirectUri: process.env.BLACKBOARD_REDIRECT_URI,
    frontendUrl: process.env.FRONTEND_URL,
    issuer: process.env.BLACKBOARD_ISSUER,
  };
}

function requireConfig(config, keys) {
  const missing = keys.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Blackboard config: ${missing.join(", ")}`);
  }
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!match) return "";
  return decodeURIComponent(match.slice(name.length + 1));
}

function shouldUseSecureCookie(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  return forwardedProto === "https" || !process.env.FUNCTIONS_EMULATOR;
}

function setStateCookie(req, res, state) {
  const parts = [
    `${STATE_COOKIE}=${encodeURIComponent(state)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${STATE_MAX_AGE_SECONDS}`,
  ];

  if (shouldUseSecureCookie(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearStateCookie(req, res) {
  const parts = [
    `${STATE_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (shouldUseSecureCookie(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function assertValidState(sessionState, queryState) {
  if (!sessionState || !queryState) {
    throw new Error("Invalid OAuth state");
  }

  const sessionBuffer = Buffer.from(sessionState);
  const queryBuffer = Buffer.from(queryState);

  if (
    sessionBuffer.length !== queryBuffer.length ||
    !crypto.timingSafeEqual(sessionBuffer, queryBuffer)
  ) {
    throw new Error("Invalid OAuth state");
  }
}

function getQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function redirectToAuthError(res, frontendUrl, message) {
  const safeMessage = encodeURIComponent(message || "Blackboard sign-in failed.");
  return res.redirect(`${frontendUrl}/auth?error=${safeMessage}`);
}

function decodeJwtPart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function parseJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid ID token");
  }

  return {
    header: decodeJwtPart(parts[0]),
    payload: decodeJwtPart(parts[1]),
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: Buffer.from(parts[2], "base64url"),
  };
}

async function fetchJwks(jwksUrl) {
  const now = Date.now();
  if (cachedJwks && now - cachedJwksAt < JWKS_CACHE_MS) {
    return cachedJwks;
  }

  const response = await axios.get(jwksUrl, { timeout: 10000 });
  cachedJwks = response.data;
  cachedJwksAt = now;
  return cachedJwks;
}

function verifyJwtSignature(parsedToken, jwk) {
  const algorithms = {
    RS256: "RSA-SHA256",
    RS384: "RSA-SHA384",
    RS512: "RSA-SHA512",
  };
  const algorithm = algorithms[parsedToken.header.alg];

  if (!algorithm) {
    throw new Error("Unsupported ID token algorithm");
  }

  const publicKey = crypto.createPublicKey({key: jwk, format: "jwk"});
  const verifier = crypto.createVerify(algorithm);
  verifier.update(parsedToken.signingInput);
  verifier.end();

  if (!verifier.verify(publicKey, parsedToken.signature)) {
    throw new Error("Invalid ID token signature");
  }
}

function assertIdTokenClaims(payload, config) {
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error("Expired ID token");
  }

  if (payload.nbf && payload.nbf > now + 60) {
    throw new Error("ID token is not valid yet");
  }

  if (!payload.aud) {
    throw new Error("Missing ID token audience");
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.clientId)) {
    throw new Error("Invalid ID token audience");
  }

  if (payload.iss !== config.issuer) {
    throw new Error("Invalid ID token issuer");
  }
}

async function verifyIdToken(idToken, config) {
  requireConfig(config, ["clientId", "issuer", "jwksUrl"]);

  const parsedToken = parseJwt(idToken);
  const jwks = await fetchJwks(config.jwksUrl);
  const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
  const jwk =
    keys.find((key) => key.kid && key.kid === parsedToken.header.kid) ||
    (keys.length === 1 ? keys[0] : null);

  if (!jwk) {
    throw new Error("Unable to find ID token signing key");
  }

  verifyJwtSignature(parsedToken, jwk);
  assertIdTokenClaims(parsedToken.payload, config);
  return parsedToken.payload;
}

async function exchangeCodeForToken(code, config) {
  requireConfig(config, [
    "clientId",
    "clientSecret",
    "tokenEndpoint",
    "redirectUri",
  ]);

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  }).toString();

  let response;
  try {
    response = await axios.post(config.tokenEndpoint, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      timeout: 15000,
    });
  } catch (error) {
    console.error("Blackboard token exchange failed:", {
      status: error.response?.status,
      code: error.response?.data?.code || error.response?.data?.error,
      message: error.response?.data?.message || error.response?.data?.error_description,
    });
    throw new Error("Blackboard token exchange failed");
  }

  return response.data;
}

async function fetchBlackboardUserProfile(accessToken, config) {
  requireConfig(config, ["userinfoEndpoint"]);

  let response;
  try {
    response = await axios.get(config.userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    });
  } catch (error) {
    console.error("Blackboard user profile fetch failed:", {
      status: error.response?.status,
      code: error.response?.data?.code || error.response?.data?.error,
      message: error.response?.data?.message || error.response?.data?.error_description,
    });
    throw new Error("Blackboard user profile fetch failed");
  }

  return response.data;
}

function getDisplayName(profile) {
  if (typeof profile.name === "string" && profile.name.trim()) {
    return profile.name.trim();
  }

  const givenName = profile.given_name || profile.name?.given;
  const familyName = profile.family_name || profile.name?.family;
  const fullName = [givenName, familyName].filter(Boolean).join(" ").trim();

  return (
    fullName ||
    profile.displayName ||
    profile.fullName ||
    profile.userName ||
    profile.preferred_username ||
    profile.email ||
    "Blackboard User"
  );
}

function extractBlackboardUser(profile) {
  const blackboardId =
    profile.sub ||
    profile.id ||
    profile.user_id ||
    profile.userId ||
    profile.uuid;
  const email =
    profile.email ||
    profile.contact?.email ||
    profile.contact?.emailAddress ||
    profile.mail;
  const displayName = getDisplayName(profile);

  if (!blackboardId) {
    throw new Error("Blackboard profile is missing a user id");
  }

  if (!email) {
    throw new Error("Blackboard profile is missing an email address");
  }

  return {
    uid: `blackboard_${blackboardId}`,
    blackboardId: String(blackboardId),
    email,
    displayName,
    username: profile.userName || profile.preferred_username || "",
  };
}

async function createOrUpdateFirebaseUser(user) {
  const blackboardAuthUid = user.uid;
  const userData = {
    email: user.email,
    displayName: user.displayName,
    emailVerified: true,
  };

  try {
    await admin.auth().updateUser(blackboardAuthUid, userData);
    return {...user, uid: blackboardAuthUid, blackboardAuthUid};
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      return useExistingFirebaseUserByEmail(user, blackboardAuthUid);
    }

    if (error.code !== "auth/user-not-found") throw error;
  }

  try {
    await admin.auth().createUser({
      uid: blackboardAuthUid,
      ...userData,
    });
    return {...user, uid: blackboardAuthUid, blackboardAuthUid};
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      return useExistingFirebaseUserByEmail(user, blackboardAuthUid);
    }

    throw error;
  }
}

async function useExistingFirebaseUserByEmail(user, blackboardAuthUid) {
  const existingUser = await admin.auth().getUserByEmail(user.email);

  await admin.auth().updateUser(existingUser.uid, {
    displayName: existingUser.displayName || user.displayName,
  });

  console.warn("Blackboard email matched an existing Firebase Auth user.");
  return {
    ...user,
    uid: existingUser.uid,
    blackboardAuthUid,
  };
}

async function createOrUpdateUserProfile(user) {
  const userRef = admin.firestore().collection("users").doc(user.uid);
  const existing = await userRef.get();
  const updateData = {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    displayName: user.displayName,
    blackboardId: user.blackboardId,
    blackboardAuthUid: user.blackboardAuthUid || user.uid,
    blackboardUsername: user.username,
    authProvider: "blackboard",
    lastLoginVia: "blackboard",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (existing.exists) {
    await userRef.set(updateData, {merge: true});
    return;
  }

  await userRef.set({
    ...updateData,
    role: "student",
    status: "active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function handleBlackboardStart(req, res) {
  const config = getConfig();
  requireConfig(config, [
    "clientId",
    "authorizationEndpoint",
    "redirectUri",
    "frontendUrl",
  ]);

  const state = crypto.randomBytes(32).toString("hex");
  setStateCookie(req, res, state);

  const authorizationUrl = new URL(config.authorizationEndpoint);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("scope", "read");
  authorizationUrl.searchParams.set("state", state);

  return res.redirect(authorizationUrl.toString());
}

async function handleBlackboardCallback(req, res) {
  const config = getConfig();
  requireConfig(config, ["frontendUrl"]);

  try {
    const code = getQueryValue(req.query.code);
    const state = getQueryValue(req.query.state);
    const error = getQueryValue(req.query.error);
    const errorDescription = getQueryValue(req.query.error_description);
    const sessionState = getCookie(req, STATE_COOKIE);

    clearStateCookie(req, res);
    assertValidState(sessionState, state);

    if (error) {
      console.warn(
        `Blackboard authorization returned an error: error=${error || ""}; ` +
        `description=${errorDescription || ""}`,
      );
      return redirectToAuthError(
        res,
        config.frontendUrl,
        errorDescription || "Blackboard authorization was denied.",
      );
    }

    if (!code || typeof code !== "string") {
      throw new Error("Missing authorization code");
    }

    const tokenData = await exchangeCodeForToken(code, config);
    const {access_token: accessToken, id_token: idToken} = tokenData;

    if (!accessToken && !idToken) {
      throw new Error("Blackboard did not return usable tokens");
    }

    let profile = null;
    if (idToken) {
      profile = await verifyIdToken(idToken, config);
    }

    if (!profile || !profile.email) {
      if (!accessToken) {
        throw new Error("Blackboard profile could not be resolved");
      }
      const userProfile = await fetchBlackboardUserProfile(accessToken, config);
      profile = {...profile, ...userProfile};
    }

    let blackboardUser = extractBlackboardUser(profile);

    blackboardUser = await createOrUpdateFirebaseUser(blackboardUser);
    await createOrUpdateUserProfile(blackboardUser);

    const customToken = await admin.auth().createCustomToken(
      blackboardUser.uid,
      {
        provider: "blackboard",
        blackboardId: blackboardUser.blackboardId,
      },
    );

    const callbackUrl = new URL(
      "/auth/blackboard/complete",
      config.frontendUrl,
    );
    callbackUrl.searchParams.set("token", customToken);
    return res.redirect(callbackUrl.toString());
  } catch (error) {
    console.error("Blackboard callback failed:", error.message);
    return redirectToAuthError(
      res,
      config.frontendUrl,
      "Blackboard sign-in failed. Please try again.",
    );
  }
}

module.exports = {
  handleBlackboardStart,
  handleBlackboardCallback,
  validateOAuthState: assertValidState,
};
