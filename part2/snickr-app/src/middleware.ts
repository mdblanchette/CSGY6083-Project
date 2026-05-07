import { withAuth, NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(_req: NextRequestWithAuth) {
    return NextResponse.next();
  },
  {
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
      authorized: (params) => {
        const { token } = params;
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: ["/user/:path*", "/admin/:path*"],
};
