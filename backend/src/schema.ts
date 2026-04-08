
import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type GraphNode {
    id: String!
    name: String!
    type: String!
    size: Int!
    parent: String
  }

  type GraphEdge {
    source: String!
    target: String!
  }

  type GraphData {
    nodes: [GraphNode!]!
    edges: [GraphEdge!]!
    analysisId: String!
  }

  type FileAnalysis {
    content: String!
    suggestion: String!
  }

  type Query {
    getAiAnalysisForFile(analysisId: String!, filePath: String!): FileAnalysis!
  }
  
  type Mutation {
    analyzeRepository(url: String!): GraphData!
    getSuggestionForSnippet(code: String!): String!
    executeCommand(analysisId: String!, command: String!): String!
    saveFile(analysisId: String!, filePath: String!, content: String!): Boolean
  }
`;