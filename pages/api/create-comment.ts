import type { NextApiRequest, NextApiResponse } from 'next'
import { createComment, getComments } from '../../utils/faunadb'

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
  const { name, comment } = req.body

  if (!route || !name || !comment) {
    return res.status(400).json({
      data: null,
      error: `Article is missing: ${[
        !route && 'route ',
        !name && 'name ',
        !comment && 'comment ',
      ]
        .filter(Boolean)
        .join(',')}`,
    })
  }

  await createComment({ route: route as string, name, comment })

  const { data } = await getComments({ route: route as string })

  return res.status(200).json({ data })
}
