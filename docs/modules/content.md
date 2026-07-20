# Content Module

- **Owner**: Content Team
- **Dependencies**: Auth Module, Upload Module
- **Related Documents**: None

## Purpose

Manage all site-wide content including blog posts, announcements, FAQs, and guides. Public-facing content is viewable by any visitor. CRUD operations and content management are restricted to admin users.

## Models

- **Content**: The primary content entity. Fields include title, slug (URL-friendly, unique), content body (rich text/Markdown), excerpt, type (blog, announcement, faq, guide), status (draft, published, archived), author, featured image, publish date, metadata (SEO fields). Supports soft delete.
- **ContentCategory**: Taxonomy for organizing content. Tree structure with parent/child relationships. Each content item may belong to one category. Fields include name, slug, description, sort order, active flag.
- **ContentTag**: Lightweight labeling for cross-cutting organization. Many-to-many relationship with Content. Fields include name, slug, usage count.

## Services

- **contentService**: Complete CRUD for content, categories, and tags. Handles slug generation and uniqueness enforcement. Manages content status transitions (draft → published → archived). Implements caching for public content queries. Provides search across titles and body text.

## Key Flows

1. **Create Content (Admin)**: Admin creates content → sets type, category, tags, body → chooses draft or publish → contentService validates slug uniqueness → persists → invalidates cache.
2. **View Public Content**: Visitor requests `/content/:slug` → contentService checks cache → returns published content with SEO metadata → 404 if not found or not published.
3. **Manage Categories**: Admin creates hierarchical categories → used for content organization and navigation menus.

### Content Access Rules

| Role | Public Content | Admin CRUD |
|------|---------------|------------|
| Visitor | Read published | — |
| Member | Read published | — |
| Staff | Read published | Create, edit own |
| Admin | Read published | Full CRUD |
| Super Admin | Read published | Full CRUD + delete |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /content | Public | List published content (paginated, filterable by type, category) |
| GET | /content/:slug | Public | Get published content by slug |
| POST | /content | Admin | Create content |
| GET | /content/admin/list | Admin | List all content (including drafts and archived) |
| GET | /content/admin/:id | Admin | Get any content by ID |
| PUT | /content/:id | Admin | Update content |
| DELETE | /content/:id | Admin | Delete content (soft) |
| GET | /categories | Public | List active categories |
| POST | /categories | Admin | Create category |
| PUT | /categories/:id | Admin | Update category |
| DELETE | /categories/:id | Admin | Delete category |
| GET | /tags | Public | List tags |
| POST | /tags | Admin | Create tag |
| PUT | /tags/:id | Admin | Update tag |
| DELETE | /tags/:id | Admin | Delete tag |

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| CONT_001 | Slug already exists | Content slug must be unique |
| CONT_002 | Content not found | Content not found or not accessible |
| CONT_003 | Invalid status transition | e.g. archived → draft not allowed |
| CONT_004 | Category not found | Referenced category does not exist |
| CONT_005 | Tag not found | Referenced tag does not exist |

## Future

- Rich text editor with image embedding via Upload module
- Content scheduling (set future publish date)
- Version history with diff view
- Multi-language content support
- Content analytics (views, read time, shares)
