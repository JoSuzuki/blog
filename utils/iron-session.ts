import { getIronSession } from 'iron-session';
import { NextApiRequest, NextApiResponse } from 'next';

export interface SessionAttributes {
  name: string;
  email: string;
  firstName: string;
  googleId: string;
}

export interface Session extends SessionAttributes {
  readonly save: () => Promise<void>;
  readonly destroy: () => void;
  readonly updateConfig: (newSessionOptions: any) => void;
}

const sessionOptions = {
  password: process.env.IRON_SESSION_SECRET as any,
  cookieName: "session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export async function getSession(req: NextApiRequest, res: NextApiResponse): Promise<Session> {
  const session = await getIronSession(req, res, sessionOptions);
  return session as Session;
}
