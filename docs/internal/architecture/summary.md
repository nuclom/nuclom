# Architecture Summary

This document provides a high-level summary of the Nuclom video collaboration platform architecture.

## Quick Reference

### Tech Stack Overview

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Better-Auth, Drizzle ORM
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Cloudflare R2 for video files
- **Deployment**: Vercel with automated CI/CD
- **AI**: OpenAI integration for video analysis

### Key Features

- Multi-organization video collaboration
- Real-time comments with timestamps and reactions
- AI-powered video summaries with structured outputs
- Personalized video recommendations
- Continue watching and watch later lists
- Real-time user presence indicators
- Performance monitoring and analytics
- Role-based access control
- OAuth authentication (GitHub, Google)
- Responsive design with dark theme

### Architecture Highlights

- **Scalable**: Serverless architecture with auto-scaling
- **Secure**: Authentication, authorization, and data protection
- **Performance**: Edge optimization and caching strategies
- **Type-safe**: Full TypeScript coverage with Drizzle ORM
- **Modern**: Latest Next.js features and best practices

## Documentation Structure

### 1. [Overall Architecture](./README.md)

- System overview and component relationships
- Technology stack and design principles
- Security and performance considerations

### 2. [Database Architecture](./database.md)

- Complete database schema with relationships
- Table structures and constraints
- Indexing strategy and performance optimization

### 3. [Frontend Architecture](./frontend.md)

- Next.js App Router structure
- Component architecture and patterns
- State management and data fetching

### 4. [Authentication System](./authentication.md)

- Better-Auth implementation
- OAuth provider integration
- Role-based access control

### 5. [Deployment Strategy](./deployment.md)

- Infrastructure and hosting setup
- CI/CD pipeline configuration
- Monitoring and scaling strategies

### 6. [Knowledge Graph](./knowledge-graph.md)

- Decision extraction from video transcripts
- Knowledge graph data model and relationships
- API endpoints and UI components

## Key Architectural Decisions

### 1. Next.js 16 App Router

**Decision**: Use Next.js 16 with App Router for the frontend framework
**Rationale**:

- Server Components for better performance
- Built-in API routes for backend functionality
- Excellent TypeScript support
- Vercel integration for deployment

### 2. PostgreSQL with Drizzle ORM

**Decision**: Use PostgreSQL as the primary database with Drizzle ORM
**Rationale**:

- Relational data model fits the collaboration use case
- Type-safe queries with Drizzle
- Excellent performance for read-heavy workloads
- Mature ecosystem and tooling

### 3. Better-Auth for Authentication

**Decision**: Use Better-Auth instead of NextAuth.js
**Rationale**:

- Better TypeScript support
- More flexible configuration
- Built-in session management
- OAuth provider integration

### 4. Cloudflare R2 for Storage

**Decision**: Use Cloudflare R2 for video file storage
**Rationale**:

- Cost-effective object storage
- Global CDN integration
- S3-compatible API
- Excellent performance for video streaming

### 5. Organization-based Multi-tenancy

**Decision**: Implement organization-based organization
**Rationale**:

- Clean separation of team data
- Scalable user management
- Flexible permission system
- URL-based organization routing

## Performance Characteristics

### Frontend Performance

- **Server-side rendering**: Fast initial page loads
- **Code splitting**: Automatic route-based splitting
- **Static generation**: Pre-rendered static content
- **Edge optimization**: Global CDN distribution

### Backend Performance

- **Serverless functions**: Auto-scaling API endpoints
- **Database optimization**: Indexed queries and connection pooling
- **File streaming**: Direct R2 streaming for videos
- **Caching**: Multiple layers of caching

### Database Performance

- **Query optimization**: Indexed foreign keys and common queries
- **Connection pooling**: Efficient database connections
- **Read replicas**: Potential for read scaling
- **Backup strategy**: Automated backups and recovery

## Security Architecture

### Authentication Security

- **OAuth integration**: Secure third-party authentication
- **Session management**: Secure session tokens
- **CSRF protection**: Built-in CSRF mitigation
- **Password security**: Proper hashing and validation

### Authorization Security

- **Role-based access**: Organization-level permissions
- **Data isolation**: Organization-based data separation
- **Input validation**: Comprehensive input sanitization
- **SQL injection prevention**: ORM-based query protection

### Infrastructure Security

- **HTTPS everywhere**: SSL/TLS for all communications
- **Secure headers**: Security-focused HTTP headers
- **Environment variables**: Secure configuration management
- **Audit logging**: Comprehensive activity tracking

## Scalability Considerations

### Horizontal Scaling

- **Serverless architecture**: Auto-scaling application tier
- **Database read replicas**: Distributed read operations
- **CDN distribution**: Global content delivery
- **Microservices ready**: Modular API design

### Vertical Scaling

- **Database optimization**: Query performance tuning
- **Connection pooling**: Efficient resource utilization
- **Caching strategies**: Multiple caching layers
- **Resource monitoring**: Performance tracking

## Development Workflow

### Local Development

1. Clone repository
2. Install dependencies: `pnpm install`
3. Set up environment variables
4. Run database migrations: `pnpm db:migrate`
5. Start development server: `pnpm dev`

### Code Quality

- **TypeScript**: Full type safety
- **Linting**: Biome for code quality
- **Formatting**: Automated code formatting
- **Testing**: Comprehensive test coverage

### Deployment Process

1. Push to main branch
2. Automated CI/CD pipeline
3. Run tests and type checking
4. Deploy to Vercel
5. Database migrations
6. Health checks and monitoring

## Recent Enhancements (v2.0)

### Newly Implemented Features

- **Knowledge Graph**: Automatic decision extraction and knowledge graph building
- **Structured AI Outputs**: Zod schemas for type-safe AI responses
- **Video Recommendations**: Personalized feeds based on watch history
- **Continue Watching**: Resume playback with progress tracking
- **Watch Later**: Bookmarking with priority and notes
- **Comment Reactions**: 8 reaction types (like, love, laugh, etc.)
- **User Presence**: Real-time collaboration indicators
- **Performance Monitoring**: Application metrics and analytics
- **Retry Utilities**: Exponential backoff for resilient operations

### New Database Tables

- `decisions` - Extracted decisions from videos
- `decision_participants` - People involved in decisions
- `knowledge_nodes` - Graph nodes (people, topics, artifacts)
- `knowledge_edges` - Relationships between nodes
- `decision_links` - Links to external artifacts
- `comment_reactions` - Comment engagement
- `watch_later` - User bookmarks
- `user_presence` - Real-time presence
- `performance_metrics` - Analytics data

## Future Roadmap

### Near-term Enhancements

- Mobile application support
- Enhanced search with AI
- Advanced video analytics dashboard
- Webhook integrations

### Long-term Vision

- Multi-region deployment
- Real-time video collaboration
- Integration marketplace
- Enterprise SSO and compliance

## Maintenance and Operations

### Monitoring

- Application performance monitoring
- Database performance tracking
- Error tracking and alerting
- User analytics and insights

### Backup and Recovery

- Automated database backups
- File storage redundancy
- Disaster recovery procedures
- Data retention policies

### Cost Management

- Resource usage monitoring
- Cost optimization strategies
- Usage-based scaling
- Budget alerts and controls

## Getting Started

For developers new to the codebase:

1. **Read the [Overall Architecture](./README.md)** for system understanding
2. **Review the [Database Schema](./database.md)** for data model knowledge
3. **Study the [Frontend Architecture](./frontend.md)** for UI patterns
4. **Understand [Authentication](./authentication.md)** for security implementation
5. **Follow the [Deployment Guide](./deployment.md)** for infrastructure setup

## Support and Documentation

- **Architecture Documentation**: This folder contains detailed technical documentation
- **API Documentation**: Available in `docs/api/` folder
- **User Guides**: Available in `docs/guides/` folder
- **Development Setup**: See `README.md` in the root directory

## Contributing

When making architectural changes:

1. Update relevant documentation in this folder
2. Follow established patterns and conventions
3. Consider backward compatibility
4. Add tests for new functionality
5. Update deployment configurations as needed

---

_This architecture documentation is maintained by the development team and updated with each major release._
