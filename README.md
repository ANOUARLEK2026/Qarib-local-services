Qarib (قريب) — Local Services

Qarib helps people find trusted service providers nearby and contact them directly on WhatsApp. It is a lightweight installable web app (PWA) with no build step and no framework, backed by Supabase.

Features

For customers

Browse and filter providers by category (plumber, electrician, tutor, driver, mechanic, painter), with search, sorting and availability filters
Nearby results using the device’s geolocation, with distance-based ranking
One-tap WhatsApp contact with each provider
Ratings and reviews. Only customers who actually contacted a provider can review them, and providers can reply
Bookings with date, time and notes
Service requests with category, description, budget and urgency
Favorites and profile views
Report abusive or fake profiles

For providers

Join as a provider with bio, phone, base price, years of experience and service area
Moderation workflow. Profiles stay pending until approved by an admin
Dashboard stats for profile views and contacts
Availability toggle, booking management and review replies

Platform

Three languages (English, French, Arabic) with full RTL support
Light and dark themes, mobile-first layout
Installable PWA with a web manifest, icons and a service worker for offline fallback
Demo mode. Without Supabase keys the app runs with sample data, so you can try it instantly
Tech stack
Layer	Tech
Frontend	Vanilla HTML/CSS/JS, single page, Cairo font
Data layer	qarib-api.js using supabase-js
Backend	Supabase (PostgreSQL, Auth, Row Level Security)
Auth	Passwordless email OTP
Offline	Service worker and web manifest
Backend highlights (supabase_schema.sql)
Tables for profiles, providers, services, contacts, reviews, bookings, requests, reports and provider events
Row Level Security policies on every table, plus an admin role
nearby_providers() RPC for distance-based search
Triggers that keep rating averages up to date and guard provider fields from tampering
delete_my_account() RPC for self-service account and data deletion
Getting started
Create a Supabase project and run supabase_schema.sql in the SQL editor.
Put your project URL and anon/public key in config.js. Never use the service_role key.
Serve the folder over HTTPS (GitHub Pages, Netlify, Vercel, and so on) and open it on your phone to install it.
Things to fix before publishing
config.js contains your real Supabase URL and anon key. The anon key is designed to be public, so this isn’t a leak by itself, as long as your RLS policies are enabled (they are in your schema). Still, many people prefer to commit a config.example.js with placeholders and add config.js to .gitignore.
Rename the HTML file to index.html. The file is currently called Qarib – local services.html, and your service worker already expects index.html. A non-ASCII dash in a filename also tends to cause problems on GitHub Pages and some unzip tools.
Add a screenshot, a license file, and a live demo link at the top of the README.
