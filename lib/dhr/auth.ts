import { adminAuth } from "@/lib/firebaseAdmin";
export async function authenticated(request:Request) {
 const header=request.headers.get('authorization');if(!header?.startsWith('Bearer '))return false;
 try {await adminAuth.verifyIdToken(header.slice(7),true);return true;}catch{return false;}
}
