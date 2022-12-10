declare module 'neo4j-driver-core/lib/graph-types' {
  const isNode:(node:any) => boolean
  const isRelationship:(node:any) => boolean
  export {
    isNode,
    isRelationship
  }
}