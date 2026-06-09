I want to redesign the content architecture of this portfolio from scratch.

Keep the existing visual identity, the Tree Stump character, the storytelling style, the seasonal atmosphere, and the artistic feeling.

Do NOT redesign the website.

Only redesign the content management architecture.

# General Philosophy

I want the website to remain simple.

No React.
No Vue.
No Angular.
No build tools.
No unnecessary complexity.

Use only:

* HTML
* CSS
* Vanilla JavaScript
* Firebase

The website files will be hosted as static files.

# Language

The website is Arabic only.

Requirements:

* lang="ar"
* dir="rtl"
* Arabic UI only
* Arabic content only
* No English interface

The entire website should use a single Arabic font.

I will provide the font files locally.

Use that font globally for every page and every component.
Make the default font bold.

Do not use Google Fonts.

# Theme

I do NOT want dark mode.

The website should always remain in light mode.

Keep the seasonal color changes.

# Firebase

Use Firebase as the content storage solution.

Use:

* Firebase Authentication
* Cloud Firestore
* Firebase Storage

Do not use any backend.

Everything should work directly from Firebase.

# Admin Panel

Create a completely separate folder:

/admin/

Example:

/admin/login.html
/admin/dashboard.html
/admin/articles.html
/admin/projects.html
/admin/services.html
/admin/settings.html

The admin panel should have its own CSS and JS files.

The admin panel should be simple and clean.

No complicated dashboards.

Arabic interface only.

# Authentication

Only administrators can access the dashboard.

Use Firebase Authentication.

If the user is not authenticated:

Redirect to login page.

# Blog Management

Inside the admin panel I want to:

* Add article
* Edit article
* Delete article

Each article should support:

* Title
* Slug
* Short description
* Main cover image
* Rich content
* Multiple images
* Tags
* Featured article
* Publish date

The content editor should be simple.

Textarea is acceptable.

Support Markdown syntax.

Store everything in Firestore.

Store images in Firebase Storage.

# Project Management

Inside admin:

* Add project
* Edit project
* Delete project

Each project supports:

* Title
* Slug
* Short description
* Full description
* Main image
* Multiple gallery images
* Technologies
* Github link
* Live demo link
* Featured project

Store images in Firebase Storage.

# Services Management

Admin should support:

* Add service
* Edit service
* Delete service

Fields:

* Title
* Icon
* Description
* Featured

# Skills Management

Admin should support:

* Add skill
* Edit skill
* Delete skill

Simple text list.

# Frontend

Homepage:

Show only:

* Featured services
* Featured projects
* Latest articles

Dedicated pages:

* All articles
* All projects
* All services

Single pages:

article.html?id=...

project.html?id=...

Load data dynamically from Firebase.

No static content.

# Images

All uploaded images should automatically go to Firebase Storage.

The website should display them dynamically.

Support:

* Cover images
* Gallery images
* Images inside articles

# File Structure

Keep everything organized.

Example:

/assets/
/css/
/js/
/admin/
/firebase/

Separate all code properly.

# Code Quality

Write clean code.

Use reusable functions.

Keep everything simple.

Avoid unnecessary abstractions.

Do not use frameworks.

# User Experience

The admin panel should feel like a small personal CMS.

I should be able to manage my entire personal website without editing source code.

My workflow should become:

1. Login.
2. Add article or project.
3. Upload images.
4. Publish.
5. The website updates automatically.

# Most Important Rule

Preserve the artistic identity of the website.

The Tree Stump remains the narrator.

The emotional storytelling remains unchanged.

Only the content management system should evolve.
