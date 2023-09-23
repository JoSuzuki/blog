import React from 'react'

export default function getTitle(children: React.ReactElement): [React.ReactNode, React.ReactNode[]] {
  const nodes = React.Children.toArray(children)
  const titleEl = nodes.find(
    (child: any) => child.props && child.props.mdxType === 'h1',
  )
  return [titleEl || null, nodes.filter((node) => node !== titleEl)]
}
