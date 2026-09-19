import { getSession as get, requireSession as require_ } from "@kch/auth/server";
import { auth } from "./auth";

export const getSession = () => get(auth);
export const requireSession = () => require_(auth, "/login");
