const admin = require('firebase-admin');
const serviceAccount = require(process.env.FIREBASE_KEY_PATH);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "twitter-app-90521.appspot.com",
});

const bucket = admin.storage().bucket();

module.exports = { admin, bucket };
