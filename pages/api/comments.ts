import type { NextApiRequest, NextApiResponse } from 'next'
import { getComments } from '../../utils/faunadb'

interface ResponseData {
  data:
    | {
        name: string
        comment: string
        createdAt: number
      }[]
    | null
  error?: string
}

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) => {
  const { route } = req.query
  if (!route) {
    return res.status(400).json({
      data: null,
      error: "Article 'route' not provided",
    })
  }

  const { data } = await getComments({ route: route as string })

  return res.status(200).json({
    data,
  })
}
