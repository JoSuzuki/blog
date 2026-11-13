import { Link } from '@tanstack/react-router'

/** The tag in the heading of a tag page. */
export const TagName = ({ tag }: { tag: string }) => {
  return (
    <span className="mr-xs border border-accent bg-accent-background px-xs text-lg leading-[1.2] text-accent [box-shadow:3px_3px_0_0_var(--colors-accent)] wght-bold">
      {tag}
    </span>
  )
}

const Tag = ({ tag }: { tag: string }) => {
  return (
    <Link
      to="/tags/$tag"
      params={{ tag }}
      className="pressable flex border border-accent bg-accent-background px-xs leading-[1.2] text-accent active:shadow-[0_0_0_0_var(--colors-accent)]"
    >
      {tag}
    </Link>
  )
}

/** A run of tag links, each followed by a small gap. */
const Tags = ({ tags }: { tags: string[] }) => {
  return (
    <>
      {tags.map((tag) => (
        <div key={tag} className="mr-xs">
          <Tag tag={tag} />
        </div>
      ))}
    </>
  )
}

export default Tags
