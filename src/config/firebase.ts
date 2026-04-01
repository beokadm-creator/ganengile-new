/**
 * Firebase configuration compatibility module.
 * Keeps older imports working while delegating to the canonical instance.
 */

export {
  auth,
  db,
  storage,
  firebaseApp as app,
  getCurrentUserId,
  requireUserId,
} from '../services/firebase';
