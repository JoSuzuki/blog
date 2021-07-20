import faunadb from 'faunadb'

const q = faunadb.query

const client = new faunadb.Client({
  secret: process.env.FAUNA_SECRET_KEY as string,
})

type Name = string
type CreatedAt = number
type Comment = string
type Route = string

interface CommentsResponse {
  data: [CreatedAt, Name, Comment, Route][]
}

export const getComments = async ({ route }: { route: string }) => {
  const document = await client.query<CommentsResponse>(
    q.Paginate(q.Match(q.Index('comments_by_route'), route)),
  )
  return {
    data: document.data.map((comment) => ({
      createdAt: comment[0],
      name: comment[1],
      comment: comment[2],
    })),
  }
}

export const createComment = async ({
  route,
  name,
  comment,
}: {
  route: string
  name: Name
  comment: Comment
}) => {
  return client.query(
    q.Create(q.Collection('comments'), {
      data: { route, name, comment, createdAt: Date.now() },
    }),
  )
}

export const hitCounterExists = async ({
  route,
}: {
  route: string
}): Promise<boolean> => {
  return client.query<boolean>(
    q.Exists(q.Match(q.Index('hits_by_route'), route)),
  )
}

export const createHitCounter = async ({ route }: { route: string }) => {
  return client.query(
    q.Create(q.Collection('hits'), {
      data: { route, hits: 0 },
    }),
  )
}

interface HitResponse {
  ref: string
  data: {
    hits: number
  }
}

export const addHitToCounter = async ({
  route,
}: {
  route: string
}): Promise<{ hits: number }> => {
  const document = await client.query<HitResponse>(
    q.Get(q.Match(q.Index('hits_by_route'), route)),
  )

  await client.query(
    q.Update(document.ref, {
      data: {
        hits: q.Add(q.Select(['data', 'hits'], q.Get(document.ref)), 1),
      },
    }),
  )
  return { hits: document.data.hits + 1 }
}
