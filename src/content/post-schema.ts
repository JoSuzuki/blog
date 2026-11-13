import { z } from 'zod'

// What a post's YAML frontmatter must look like. `date` is a bare YAML date
// (YYYY-MM-DD), which the YAML core schema keeps as a string.
export const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  author: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a date like 2023-09-19'),
  tags: z.array(z.string().min(1)).default([]),
  secret: z.boolean().default(false),
})

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>
