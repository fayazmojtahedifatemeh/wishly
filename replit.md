# Wishly - Smart Wishlist Tracker

## Overview
A comprehensive wishlist application with AI-powered categorization, price tracking, and beautiful pastel UI. Built with React, Express, and Gemini AI.

## Features
- **Activity Feed**: Track price changes with visual indicators (red up arrows for increases, green down arrows for decreases)
- **Smart Item Adding**: Enter product URL to auto-fetch details including all images, sizes, price with currency detection
- **AI Categorization**: Gemini AI automatically suggests appropriate lists for items
- **Multiple Lists**: Pre-defined categories (Dresses, Shoes, Electronics, etc.) plus custom list creation
- **Item Management**: Edit sizes, manage list assignments, view detailed product information
- **Price History**: Track price changes over last 3 months with visual charts
- **Goals Tracking**: Set savings targets and monitor progress
- **Image Search**: Reverse image search to find similar products
- **Stock Monitoring**: Visual indication of out-of-stock items
- **Price Alerts**: Every 6 hours automated price checking
- **Mobile Responsive**: Beautiful UI that works on all devices

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Recharts
- **Backend**: Express.js, Node.js
- **AI**: Google Gemini (via GEMINI_API_KEY)
- **Storage**: In-memory (MemStorage)
- **State Management**: TanStack Query
- **Forms**: React Hook Form + Zod validation

## Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # Utilities
│   │   └── App.tsx          # Main app with sidebar layout
│   └── index.html
├── server/
│   ├── routes.ts            # API routes
│   ├── storage.ts           # In-memory storage
│   └── gemini.ts            # Gemini AI integration
├── shared/
│   └── schema.ts            # Shared types and schemas
└── design_guidelines.md     # Design system documentation
```

## Recent Changes
- Initial setup with complete data models for items, lists, goals, and price history
- Implemented all frontend components with pastel design system
- Added Gemini AI integration for auto-categorization and image search (Google Lens-style)
- Built sidebar navigation with default categories
- Created activity feed, item cards, detail modals, and goal tracking
- Implemented web scraping for product data extraction with Puppeteer + Cheerio
- Added price history tracking with 6-hour automated checks via cron job
- Connected all frontend components to backend with proper error handling
- **October 2025**: Extended theme system with 6 beautiful pastel themes (Light, Dark, Pink, Blue, Green, Orange)
- **October 2025**: Improved main content area with gradient background and custom styled scrollbar
- **October 2025**: Added comprehensive clothing category lists (21 categories including Dresses, Tops, Shoes, Accessories, Beauty, etc.)
- **October 2025**: Enhanced scraper with Puppeteer support for JavaScript-heavy sites (Zara, H&M, etc.)
- **October 2025**: Improved size/color extraction with shared cleaning functions and "colour" support for UK sites
- **October 2025**: Fixed image display to show full images without cropping
- **October 2025**: Hardened stock detection logic to avoid false "out of stock" statuses
- **October 2025**: Improved CSV import with batch processing (size 5), detailed error reporting, and failed URL tracking

## Theme System
The app now supports 6 beautiful themes:
- **Light**: Default soft purple/lavender pastel theme
- **Dark**: Dark mode with purple accents
- **Pink**: Pastel pink color scheme
- **Blue**: Pastel blue color scheme  
- **Green**: Pastel green color scheme
- **Orange**: Pastel orange/peach color scheme

Users can switch themes via the palette icon in the top right corner. Theme preference is saved in localStorage and persists across sessions.

## Default Category Lists
Pre-configured categories for easy organization:
- **Clothing**: Dresses, Tops, Shirts and Blouses, Sweaters & Cardigans, Coats, Blazers, Skirts, Pants, Gym
- **Footwear**: Shoes
- **Accessories**: Bags, Jewelry, Accessories
- **Beauty**: Makeup, Nails, Perfumes
- **Home & Tech**: House Things, Electronics
- **Food**: Food
- **Other**: Extra Stuff, All Items

## Environment Variables
- `GEMINI_API_KEY`: Google Gemini API key for AI categorization

## User Preferences
- Multiple pastel color themes to choose from
- DM Sans font family for clean, modern typography
- Smooth animations and hover effects
- Custom scrollbar with theme-aware styling
- Mobile-first responsive design
