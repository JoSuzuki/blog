import type { NextApiRequest, NextApiResponse } from 'next'
import { getSession, SessionAttributes } from '../../utils/iron-session'

interface ResponseData {
  data:
    | SessionAttributes
    | null
  error?: string
}

function isEmpty(obj: Record<string, any>) {
  for(var prop in obj) {
      if(obj.hasOwnProperty(prop))
          return false;
  }

  return true;
}

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) => {
  const session = await getSession(req, res)

  return res.status(200).json({
    data: isEmpty(session) ? null : {
      name: session.name,
      email: session.email,
      firstName: session.firstName,
      googleId: session.googleId,
    },
  })
}
