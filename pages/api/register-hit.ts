import type { NextApiRequest, NextApiResponse } from 'next'
import {
  addHitToCounter,
  createHitCounter,
  hitCounterExists,
} from '../../utils/faunadb'

interface ResponseData {
  hits: number | null
  error?: string
}

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) => {
  const { route } = req.query
  if (!route) {
    return res.status(400).json({
      hits: null,
      error: "Article 'route' not provided",
    })
  }
  // Check and see if the doc exists.
  const doesHitCounterExist = await hitCounterExists({ route: route as string })
  if (!doesHitCounterExist) {
    await createHitCounter({ route: route as string })
  }

  const data = await addHitToCounter({ route: route as string })

  return res.status(200).json({
    hits: data.hits,
  })
}
