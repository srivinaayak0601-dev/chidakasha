import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAXeqlE2xe71PIwnNwBIogiAiKZ906v4Xg",
  authDomain: "website-1141d.firebaseapp.com",
  projectId: "website-1141d",
  storageBucket: "website-1141d.firebasestorage.app",
  messagingSenderId: "461711052948",
  appId: "1:461711052948:web:f9e01e59eb27105d782481",
  measurementId: "G-SGS3PVS314"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
