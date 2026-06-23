import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, doc, collection, 
  addDoc as fbAddDoc, setDoc as fbSetDoc, updateDoc as fbUpdateDoc, deleteDoc as fbDeleteDoc, 
  getDoc as fbGetDoc, getDocs as fbGetDocs, onSnapshot as fbOnSnapshot, query, where, orderBy, 
  serverTimestamp, writeBatch as fbWriteBatch, getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Connectivity Check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// AUTH EXPORTS
export { onAuthStateChanged };

export const loginWithEmail = async (email: string, p: string) => {
  await signInWithEmailAndPassword(auth, email, p);
};

export const registerWithEmail = async (email: string, p: string) => {
  await createUserWithEmailAndPassword(auth, email, p);
};

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
};

export const logout = async () => {
  await signOut(auth);
};

// ERROR HANDLER
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// FIRESTORE EXPORTS
export { collection, doc, query, where, orderBy, serverTimestamp };

export const addDoc = async (colRef: any, data: any) => {
  try {
    return await fbAddDoc(colRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, colRef.path);
  }
};

export const setDoc = async (docRef: any, data: any, options?: any) => {
  try {
    if (options) {
      return await fbSetDoc(docRef, data, options);
    }
    return await fbSetDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docRef.path);
  }
};

export const updateDoc = async (docRef: any, data: any) => {
  try {
    return await fbUpdateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docRef.path);
  }
};

export const deleteDoc = async (docRef: any) => {
  try {
    return await fbDeleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docRef.path);
  }
};

export const getDoc = async (docRef: any) => {
  try {
    return await fbGetDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docRef.path);
  }
};

export const getDocs = async (queryRef: any) => {
  try {
    return await fbGetDocs(queryRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, queryRef.path || 'query');
  }
};

export const onSnapshot = (queryRef: any, callback: Function) => {
  return fbOnSnapshot(
    queryRef, 
    (snapshot) => callback(snapshot),
    (error) => handleFirestoreError(error, OperationType.LIST, queryRef.path || 'query')
  );
};

export const writeBatch = (dbObj: any) => {
  const batch = fbWriteBatch(dbObj);
  const path = 'batch';
  
  return {
    set: (docRef: any, data: any) => batch.set(docRef, data),
    update: (docRef: any, data: any) => batch.update(docRef, data),
    delete: (docRef: any) => batch.delete(docRef),
    commit: async () => {
      try {
        return await batch.commit();
      } catch (error) {
         handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  };
};
