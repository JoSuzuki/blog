import type { NextApiRequest, NextApiResponse } from 'next'
import { OAuth2Client } from 'google-auth-library'
import { getSession, Session } from '../../utils/iron-session'
import prisma from '../../utils/prisma'

interface ResponseData {
  data: Omit<Session, 'save'> | null
  error?: string
}

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) => {
  try {
    const { credential } = req.body

    const client = new OAuth2Client()
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience:
        '464384148013-0lakedv6kgvi61su00ohotbihk0468ri.apps.googleusercontent.com',
    })
    const payload = ticket.getPayload()

    const session = await getSession(req, res)
    session.name = payload?.name as string
    session.email = payload?.email as string
    session.googleId = payload?.sub as string
    session.firstName = payload?.given_name as string
    await session.save()

    await prisma.user.upsert({
      where: {
        email: session.email,
      },
      update: {},
      create: {
        email: session.email,
        name: session.name,
        googleId: session.googleId,
      }
    })

    return res
      .status(200)
      .json({
        data: {
          name: session.name,
          email: session.email,
          googleId: session.googleId,
          firstName: session.firstName,
        },
      })
  } catch(e) {
    return res.status(500).json({ data: null, error: e.message })
  }
}
