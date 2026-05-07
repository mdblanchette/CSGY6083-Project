import { query } from "@/libs/db";
import { type NextAuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import bcrypt from "bcrypt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: DefaultSession["user"] & {
      id: string;
      username?: string | null;
      role?: string | null;
      coverImage?: string | null;
      image?: string | null;
    };
  }
}

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: {
          label: "Username or Email",
          type: "text",
          placeholder: "jane.doe or jane@example.com",
        },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Please enter your username/email and password");
        }

        const result = await query(
          `
            SELECT user_id, email, username, password_hash, created_at
            FROM users
            WHERE email = $1 OR username = $1
            LIMIT 1
          `,
          [credentials.identifier.toLowerCase()],
        );

        const user = result.rows[0];

        if (!user || !user?.password_hash) {
          throw new Error("No account found for that username/email");
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password_hash,
        );

        if (!passwordMatch) {
          throw new Error("Incorrect password");
        }

        return {
          id: String(user.user_id),
          name: user.username,
          username: user.username,
          email: user.email,
          image: null,
          coverImage: null,
          role: null,
        };
      },
    }),
  ],

  callbacks: {
    jwt: async (payload: any) => {
      const { token, trigger, session } = payload;
      const user: any = payload.user;

      if (trigger === "update") {
        // console.log(token.picture, session.user);
        return {
          ...token,
          ...session.user,
          picture: session.user.image,
          image: session.user.image,
        };
      }

      if (user) {
        return {
          ...token,
          uid: user.id,
          username: user.username || user.name,
          picture: user.image,
          image: user.image,
        };
      }
      return token;
    },

    session: async ({ session, token }: any) => {
      if (session?.user) {
        return {
          ...session,
          user: {
            ...session.user,
            id: token.sub,
            username: (token.username as string) || session.user.name,
            name: (token.username as string) || session.user.name,
            image: token.picture,
          },
        };
      }
      return session;
    },
  },

  // debug: process.env.NODE_ENV === "developement",
};

export const getAuthSession = async () => {
  return getServerSession(authOptions);
};
