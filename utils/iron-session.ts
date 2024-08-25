import { getIronSession } from 'iron-session';
import { NextApiRequest, NextApiResponse } from 'next';

export interface Session {
  name: string;
  email: string;
  firstName: string;
  googleId: string;
  save: () => Promise<void>;
}

const sessionOptions = {
  password: process.env.IRON_SESSION_SECRET,
  cookieName: "session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export async function getSession(req: NextApiRequest, res: NextApiResponse): Promise<Session> {
  const session = await getIronSession(req, res, sessionOptions);
  return session;
}
