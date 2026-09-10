# 🍔 Hunger's Hunt V2.0

**Hunger's Hunt** is a restaurant discovery web application built to help users explore restaurants, cafés, bakeries, fast-food places, and other food-related locations by location and category.

V2.0 represents a major architectural evolution from the original V1 project.

While V1 relied primarily on manually entered restaurant data, V2 introduces a real backend, PostgreSQL database integration, live external restaurant discovery, provider abstraction, API-driven rendering, improved UX, security hardening, and automated API testing.

---

## 🚀 Version Evolution

### V1 — Manual Data

The original Hunger's Hunt implementation used manually maintained restaurant data and frontend-driven rendering.

```text
Manual restaurant data
        ↓
HTML / CSS / JavaScript
        ↓
Restaurant cards
        ↓
Search & filtering
```

### V2 — Live Discovery + Database

V2 introduces a proper application architecture:

```text
                    Hunger's Hunt V2
                           │
             ┌─────────────┴─────────────┐
             ↓                           ↓
      PostgreSQL Database          Live Discovery
      Curated Restaurants                │
             │                    ┌──────┴──────┐
             │                    ↓             ↓
             │                   OSM       Foursquare
             │
             └────────────┬───────────────┘
                          ↓
                     Node.js API
                          ↓
                  Provider Abstraction
                          ↓
                Vanilla JS Frontend
```

The result is a public, anonymous restaurant discovery platform that combines curated local data with live external discovery.

---

# ✨ V2.0 Features

## 🔎 Restaurant Search

Users can select a location and search for restaurants available in that area.

Search results are retrieved dynamically through the backend and external providers.

The application supports:

* Location-based discovery
* Restaurant search
* Category filtering
* Dynamic result rendering
* Search loading states
* Empty-result states
* Provider-failure states
* Stale-request protection

---

## 📍 Location-Aware Discovery

The selected location controls the restaurant discovery process.

Location state is preserved across intended navigation such as:

```text
Home
 ↓
Search
 ↓
Category
 ↓
Restaurant Detail
 ↓
Back
```

Changing the selected location invalidates stale location-dependent content so restaurants from a previous location are not incorrectly displayed.

---

# 🗄️ PostgreSQL

V2 introduces PostgreSQL as the authoritative database for Hunger's Hunt's curated restaurant dataset.

The database currently contains the curated restaurant records used by the application.

The backend communicates with PostgreSQL rather than allowing the frontend to directly access the database.

```text
Frontend
   ↓
Node.js API
   ↓
PostgreSQL
```

Restaurant information can be accessed through API endpoints such as:

```text
GET /api/restaurants
GET /api/restaurants/:id
```

---

# 🌍 Live Restaurant Providers

V2 uses a provider abstraction so Hunger's Hunt is not permanently tied to a single external restaurant-data provider.

## OpenStreetMap

**OpenStreetMap (OSM)** is the current default live discovery provider.

OSM-based discovery uses external geospatial services to locate restaurants and related places around the selected location.

Example:

```text
/api/restaurants/search?provider=osm&near=Lahore
```

---

## Foursquare

Foursquare remains implemented as an alternate provider.

It is retained so the application can switch providers without requiring a complete rewrite of the frontend or backend architecture.

Example:

```text
/api/restaurants/search?provider=foursquare&near=Lahore
```

OSM remains the default provider in V2.

---

# 🏙️ Peshawar Hybrid Mode

Peshawar has a deliberate hybrid behavior in V2.

When Peshawar is selected, Hunger's Hunt can combine:

```text
Curated PostgreSQL restaurants
+
OSM live discovery
```

For other locations, live discovery is used without automatically displaying unrelated curated restaurant sections.

This prevents curated restaurants from appearing simply because the homepage is being displayed.

---

# 🧩 Provider-Neutral Restaurant Data

External providers can return inconsistent information.

V2 normalizes restaurant information into a provider-neutral structure so the frontend does not need to understand every provider's internal API format.

The architecture also maintains a consistent provider identity through:

```text
providerId
```

This allows future providers to be added without redesigning the entire application.

---

# 🖼️ Image Handling

V2 distinguishes between different image situations.

### Valid image

The actual restaurant image is displayed.

### Missing or broken image

An animated restaurant/image placeholder is displayed.

### No restaurants found

A separate no-results visual is displayed.

These states are intentionally different.

```text
Missing image
≠
No restaurant found
≠
Provider failure
```

This prevents users from confusing incomplete restaurant information with an actual search failure.

---

# ⏳ Loading States

V2 provides dedicated loading states for asynchronous operations.

The application uses a Pac-Man-inspired loading animation in appropriate search/loading contexts.

Loading begins immediately when a request starts.

V2 does **not** use artificial delays simply to make an animation visible.

```text
Request starts
     ↓
Loading state
     ↓
Actual response
     ↓
Results / Empty / Error
```

---

# ❌ Error & Empty States

V2 distinguishes between different failure conditions.

### No restaurants found

The selected location/provider returned no suitable results.

### Provider failure

An external service such as OSM or Foursquare failed or was unavailable.

### Database failure

The PostgreSQL backend could not be reached or queried successfully.

### Invalid restaurant

The requested restaurant does not exist.

Each situation is handled separately instead of showing a generic broken-page message.

---

# 💬 Feedback System

V2 includes a database-backed feedback system.

Public users can submit feedback without creating an account.

Feedback submissions are validated before being stored.

The feedback system includes validation for:

* Required fields
* Data types
* Message length
* Name length
* Email format where provided
* Invalid payloads

Feedback administration is protected separately.

The administrative feedback endpoint requires the configured:

```text
FEEDBACK_ADMIN_TOKEN
```

The token is supplied through the appropriate request header and is never intended to be exposed through the frontend.

---

# 🔐 Security

Security was a major part of the final V2 hardening pass.

V2 includes protections such as:

* HTTP security headers
* Content Security Policy
* X-Content-Type-Options
* Referrer-Policy
* Permissions-Policy
* X-Frame-Options
* Request body-size limits
* API input validation
* PostgreSQL parameterized queries
* Sensitive static-file protection
* Admin feedback protection
* Rate limiting
* Safe API error responses
* Provider error handling
* Secret/environment-variable separation

Sensitive server-side resources such as environment configuration and backend source files are not intended to be directly accessible through the browser.

---

# 🛡️ Secret Management

Secrets must remain in environment configuration.

Examples include:

```text
FOURSQUARE_API_KEY
DATABASE_URL
FEEDBACK_ADMIN_TOKEN
```

Real credentials must never be committed to the repository.

The repository should contain only a safe configuration template such as:

```text
.env.example
```

with placeholders rather than real credentials.

The actual:

```text
.env
```

file must remain local and ignored by Git.

---

# 🚦 Rate Limiting

V2 includes rate limiting for potentially expensive or abuse-prone public endpoints, including:

* Restaurant discovery/search
* Suggestions
* Feedback submissions

The goal is to reduce unnecessary abuse while keeping normal use of the application comfortable.

---

# 🧪 Automated Testing

V2 includes a native Node.js API test suite.

Run:

```bash
npm test
```

The test suite validates important application behavior including:

* Database health
* Restaurant listing
* Restaurant detail
* Restaurant filtering/search
* Invalid input handling
* Invalid provider handling
* Feedback validation
* Admin feedback protection
* Sensitive-file protection
* API behavior

The final V2 validation run completed successfully with:

```text
9 tests passed
0 tests failed
```

---

# 📱 Responsive Design

The application was audited across multiple viewport sizes.

Validated sizes include:

```text
390px   Mobile
768px   Tablet
1024px  Laptop / Tablet landscape
1440px  Desktop
```

The audit checked:

* Horizontal overflow
* Restaurant cards
* Navigation
* Images
* Category layouts
* Loading states
* Empty states
* Restaurant detail pages
* Footer behavior
* Button/layout overlap

The application was verified to maintain:

```text
scrollWidth === viewportWidth
```

where applicable.

---

# 🏗️ Project Structure

The project follows a vanilla frontend + Node.js backend architecture.

A simplified structure is:

```text
Hunger Hunt V2.0/
│
├── backend/
│   ├── foursquare.js
│   ├── osm.js
│   └── server.js
│
├── Css/
│
├── images/
│
├── js/
│   ├── data/
│   ├── about.js
│   ├── app.js
│   ├── category.js
│   ├── data.js
│   ├── restaurant.js
│   ├── restaurants.js
│   └── ui.js
│
├── about.html
├── categories.html
├── index.html
├── restaurant.html
│
├── .env.example
├── .gitignore
├── api.test.js
├── package.json
└── package-lock.json
```

The exact structure may evolve as the project develops.

---

# ⚙️ Technology Stack

## Frontend

* HTML5
* CSS3
* Vanilla JavaScript

## Backend

* Node.js
* Express

## Database

* PostgreSQL

## External Data

* OpenStreetMap ecosystem
* Foursquare Places API

## Testing

* Native Node.js test tooling

---

# 🛠️ Local Setup

## 1. Clone the repository

```bash
git clone <repository-url>
```

Enter the project directory:

```bash
cd "Hunger Hunt V2.0"
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure environment variables

Create a local:

```text
.env
```

based on:

```text
.env.example
```

Configure the required database/provider/admin values locally.

Never commit `.env`.

---

## 4. Start the server

Use the project's configured start command from `package.json`.

For example, if configured:

```bash
npm start
```

The application can then be accessed through the local server.

---

# 🔌 Main API Endpoints

## Database Health

```http
GET /api/health/database
```

Checks PostgreSQL connectivity.

---

## Restaurant List

```http
GET /api/restaurants
```

Returns curated restaurant records from PostgreSQL.

---

## Restaurant Detail

```http
GET /api/restaurants/:id
```

Returns a specific curated restaurant.

---

## Live Restaurant Search

```http
GET /api/restaurants/search
```

Provider-aware restaurant discovery.

Example:

```text
/api/restaurants/search?provider=osm&near=Lahore
```

or:

```text
/api/restaurants/search?provider=foursquare&near=Lahore
```

---

## Feedback Submission

```http
POST /api/feedback
```

Accepts validated public feedback.

---

## Feedback Administration

```http
GET /api/feedback
```

Protected administrative endpoint.

Requires the configured administrative authentication header.

---

# 🧭 V2 Content Model

The homepage intentionally distinguishes between different content modes.

### Normal homepage

```text
Normal homepage content
```

### Peshawar hybrid

```text
PostgreSQL curated data
+
OSM live discovery
```

### Other location search

```text
OSM live discovery
```

This prevents unrelated curated restaurants from appearing underneath live searches.

---

# 👤 Anonymous V2 Design

Hunger's Hunt V2 intentionally does **not** require users to create accounts.

Users can:

* Browse restaurants
* Search locations
* Explore categories
* View restaurant details
* Use live discovery
* Submit public feedback

without authentication.

This is intentional.

Authentication and personalized functionality are reserved for a future major version.

---

# 🚫 Features Intentionally Deferred to V3

The following are **not missing V2 features**.

They are deliberately reserved for V3.

## User System

* Registration
* Login
* Logout
* Authentication
* User accounts
* Sessions
* User profiles

## Personal Activity

* Favorites
* Previous searches
* Visit history
* Personalized recommendations

## User Reviews

* Authenticated reviews
* User-owned reviews
* Dual taste/service ratings
* Database-generated restaurant averages
* Reviewer counts

## Restaurant Owner Platform

* Restaurant-owner accounts
* Owner registration
* Owner verification
* Restaurant claiming
* Owner dashboard
* Restaurant editing
* Menu management
* Image uploads
* Opening/closing hours
* Events
* Owner analytics

These systems require a proper identity and permissions architecture and are intentionally outside the scope of V2.

---

# 🧱 V2 as the Foundation for V3

Although V3 functionality is not implemented, V2 was structured so that future development can build upon it.

The V2 foundation provides:

```text
PostgreSQL
     ↓
Node.js API
     ↓
Provider abstraction
     ↓
Normalized restaurant data
     ↓
Stable frontend architecture
```

V3 can therefore introduce authenticated users, restaurant owners, reviews, favorites, activity, and personalization without needing to discard the V2 foundation.

---

# 🔮 Future Direction

V2 establishes Hunger's Hunt as a functional public restaurant discovery platform.

The long-term direction is to evolve the application beyond anonymous discovery into a platform involving:

* Users
* Restaurant owners
* Personalized activity
* Reviews
* Ratings
* Favorites
* Restaurant management
* Richer restaurant information
* Events
* Analytics
* Intelligent discovery

These capabilities are intentionally reserved for future development.

---

# 📌 Current V2 Status

**Hunger's Hunt V2.0 is feature-complete for its intended anonymous restaurant-discovery scope.**

Current foundation:

* ✅ PostgreSQL-backed curated restaurant data
* ✅ Live OSM discovery
* ✅ Foursquare provider architecture
* ✅ Provider normalization
* ✅ Location-based search
* ✅ Category discovery
* ✅ Restaurant detail pages
* ✅ Feedback system
* ✅ Loading states
* ✅ Empty states
* ✅ Provider failure states
* ✅ Missing-image handling
* ✅ Responsive layout
* ✅ API validation
* ✅ Security hardening
* ✅ Rate limiting
* ✅ Sensitive-file protection
* ✅ Admin feedback protection
* ✅ Automated API testing
* ✅ `npm audit` clean
* ✅ 9 automated tests passing
* ✅ 0 known npm vulnerabilities

---

# 📜 Version

```text
Hunger's Hunt V2.0
```

V2 is the second major generation of Hunger's Hunt, evolving the original manually maintained website into a database-backed and API-driven restaurant discovery application.

---

## 👨‍💻 Project Philosophy

Hunger's Hunt is being developed incrementally with an emphasis on learning, experimentation, real-world data, maintainable architecture, and continuous improvement.

V1 proved the concept.

V2 established the technical foundation.

V3 will expand that foundation into the next generation of Hunger's Hunt.
