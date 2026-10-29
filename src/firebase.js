// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCor_q_ly9L00UAtiqlzVhF-3IYnh22Hsw",
  authDomain: "pickleball-queue-59ab0.firebaseapp.com",
  projectId: "pickleball-queue-59ab0",
  storageBucket: "pickleball-queue-59ab0.firebasestorage.app",
  messagingSenderId: "372114967458",
  appId: "1:372114967458:web:afcdbe73b54f23e44480fb",
  measurementId: "G-6NQCLFRVJB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

export { app, db, analytics };
export default db;
