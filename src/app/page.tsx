import { cookies } from "next/headers";
import { Splash } from "@/components/splash";
import { SESSION_COOKIE } from "@/server/auth";

export default async function HomePage() {
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  return <Splash next={signedIn ? "/dashboard" : "/signin"} />;
}
