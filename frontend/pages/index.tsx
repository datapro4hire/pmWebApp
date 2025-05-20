// middleware.ts (in your project root or src/)
import { authMiddleware, redirectToSignIn } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export default authMiddleware({
  publicRoutes: ["/"], // Make the landing page public
  afterAuth(auth, req) {
    // Handle users who are authenticated
    if (auth.userId && auth.isPublicRoute) {
      // If user is signed in and on the landing page, redirect to dashboard
      if (req.nextUrl.pathname === "/") {
        const dashboardUrl = new URL("/dashboard", req.url);
        return NextResponse.redirect(dashboardUrl);
      }
    }
    // Handle users who are not authenticated
    if (!auth.userId && !auth.isPublicRoute) {
      return redirectToSignIn({ returnBackUrl: req.url });
    }
    // Allow users to visit public routes
    return NextResponse.next();
  }
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};