import { Platform } from 'react-native';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';

// Firebase web config is not secret — it's meant to ship inside client
// bundles (see https://firebase.google.com/docs/projects/api-keys).
const firebaseConfig = {
  apiKey: 'AIzaSyDdf6IfyYDKiUYto2lDwlCV9WkROqmfvq0',
  authDomain: 'nvoy-c24c2.firebaseapp.com',
  projectId: 'nvoy-c24c2',
  storageBucket: 'nvoy-c24c2.firebasestorage.app',
  messagingSenderId: '328259685760',
  appId: '1:328259685760:web:d910c3d245ef258d590565',
};

// Phone Auth here relies on the Firebase Web SDK's invisible reCAPTCHA,
// which needs a real DOM — only available in the Expo web build. Native
// (iOS/Android) support needs @react-native-firebase/auth, a native module
// that requires a custom dev client / EAS build, which this project hasn't
// set up. Verification stays optional and non-blocking either way.
export const phoneVerifySupported = Platform.OS === 'web';

let app: FirebaseApp | null = null;
function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

let recaptchaVerifier: RecaptchaVerifier | null = null;
function getRecaptchaVerifier(): RecaptchaVerifier {
  if (!recaptchaVerifier) {
    if (typeof document !== 'undefined' && !document.getElementById('recaptcha-container')) {
      const div = document.createElement('div');
      div.id = 'recaptcha-container';
      document.body.appendChild(div);
    }
    recaptchaVerifier = new RecaptchaVerifier(getAuth(getFirebaseApp()), 'recaptcha-container', {
      size: 'invisible',
    });
  }
  return recaptchaVerifier;
}

function toE164(raw: string): string {
  const cleaned = raw.replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    throw new Error(
      'Enter your number in international format (e.g. +1 555 123 4567) to verify it.',
    );
  }
  return cleaned;
}

export async function sendVerificationCode(phone: string): Promise<ConfirmationResult> {
  if (!phoneVerifySupported) {
    throw new Error('Phone verification is only available on web for now');
  }
  const auth = getAuth(getFirebaseApp());
  return signInWithPhoneNumber(auth, toE164(phone), getRecaptchaVerifier());
}

export async function confirmVerificationCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<string> {
  const credential = await confirmation.confirm(code);
  return credential.user.getIdToken();
}
