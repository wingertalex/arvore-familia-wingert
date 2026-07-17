import {initializeApp} from 'firebase/app'
import {getAuth} from 'firebase/auth'
import {getFirestore} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyD3qxs2zhBIwVXERlaTNNIuCm2aUh7gjrk',
  authDomain: 'arvore-familia-wingert.firebaseapp.com',
  projectId: 'arvore-familia-wingert',
  storageBucket: 'arvore-familia-wingert.firebasestorage.app',
  messagingSenderId: '972094437748',
  appId: '1:972094437748:web:8ca2839acfe49ae2555421',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
