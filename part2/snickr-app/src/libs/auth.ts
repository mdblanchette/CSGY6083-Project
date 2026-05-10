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
      nickname?: string | null;
      status_emoji?: string | null;
      status_text?: string | null;
      bio?: string | null;
      last_active?: string | null;
      created_at?: string | null;
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
        const userId = token.sub;
        let dbUser = null;

        if (userId) {
          const result = await query(
            `
              SELECT user_id, email, username, nickname, status_emoji, status_text, bio, last_active, created_at
              FROM users
              WHERE user_id = $1
              LIMIT 1
            `,
            [userId],
          );

          dbUser = result.rows[0];
        }

        return {
          ...session,
          user: {
            ...session.user,
            id: token.sub,
            email: dbUser?.email || session.user.email,
            username:
              (dbUser?.username as string) ||
              (token.username as string) ||
              session.user.name,
            name:
              (dbUser?.username as string) ||
              (token.username as string) ||
              session.user.name,
            nickname: dbUser?.nickname || null,
            status_emoji: dbUser?.status_emoji || null,
            status_text: dbUser?.status_text || null,
            bio: dbUser?.bio || null,
            last_active: dbUser?.last_active ? new Date(dbUser.last_active).toISOString() : null,
            created_at: dbUser?.created_at ? new Date(dbUser.created_at).toISOString() : null,
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