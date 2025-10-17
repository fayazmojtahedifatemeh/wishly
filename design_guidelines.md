# Wishlist App Design Guidelines

## Design Approach: Reference-Based (Pinterest + Notion hybrid)
Drawing inspiration from Pinterest's visual-first card layouts and Notion's organizational clarity, creating a shopping wishlist experience that balances aesthetic appeal with functional organization.

**Core Principle**: Visual delight meets practical tracking - every item should feel like a curated collection piece.

---

## Color Palette

### Light Mode (Primary)
- **Background**: 280 15% 98% (soft lavender white)
- **Surface**: 0 0% 100% (pure white cards)
- **Primary**: 280 60% 65% (soft purple)
- **Secondary**: 200 45% 70% (dusty blue)
- **Accent Success**: 140 40% 65% (sage green for price drops)
- **Accent Alert**: 0 50% 70% (soft coral for price rises)
- **Text Primary**: 280 20% 20% (deep purple-gray)
- **Text Secondary**: 280 10% 50% (muted gray)

### Dark Mode
- **Background**: 280 25% 12% (deep purple-black)
- **Surface**: 280 20% 18% (elevated cards)
- **Maintain same hue relationships with adjusted lightness**

---

## Typography

**Font Stack**: 'DM Sans' (Google Fonts) for all text
- **Hero/Headers**: 600 weight, tracking-tight
- **Body**: 400 weight, leading-relaxed (1.75)
- **Labels/Meta**: 500 weight, text-sm, tracking-wide, uppercase
- **Prices**: 'DM Mono' for tabular numerals

**Scale**: text-xs | text-sm | text-base | text-lg | text-xl | text-2xl | text-4xl

---

## Layout System

**Spacing Primitives**: 2, 3, 4, 6, 8, 12, 16 units
- Container: max-w-7xl mx-auto
- Cards: p-4 to p-6, rounded-2xl
- Sections: py-8 to py-12
- Grid gaps: gap-4 (mobile) to gap-6 (desktop)

**Breakpoints**:
- Mobile: base (single column)
- Tablet: md (2 columns for items)
- Desktop: lg (3-4 columns masonry for items, 2 columns for modals)

---

## Component Library

### 1. Homepage Activity Feed
- **Layout**: Vertical timeline with connecting lines (subtle dotted)
- **Activity Cards**: Compact horizontal cards with:
  - Product thumbnail (80x80px, rounded-lg)
  - Item name (truncate, text-sm font-medium)
  - Price change badge (pill shape, with arrow icons)
  - Timestamp (text-xs, text-secondary)
- **Visual Indicators**: Up arrow (↑) in soft coral bg, down arrow (↓) in sage green bg
- **Spacing**: space-y-3, max 10 items visible, "View all" link

### 2. Add Item Button & Modal
- **Floating Action Button**: Fixed bottom-right (bottom-6 right-6)
  - Size: w-14 h-14, rounded-full
  - Shadow: shadow-xl with colored shadow (primary color at 30% opacity)
  - Icon: Plus icon, white color
- **Modal**: Full-screen on mobile, centered overlay (max-w-2xl) on desktop
  - URL input: Large, rounded-xl, focus:ring-4 ring-primary/20
  - Loading state: Skeleton cards showing image placeholders
  - Fetched preview: Image carousel (dots navigation), size selector, price display
  - List selector: Multi-select checkboxes with AI suggestion highlighted

### 3. Item Cards (Main Display)
- **Card Structure**: Aspect ratio 3:4, rounded-2xl, overflow-hidden
  - Image carousel: Swipeable, 3-5 images, dot indicators bottom
  - Gradient overlay: bottom gradient for text readability
  - Quick actions: Bookmark icon (top-right), menu dots (top-left)
- **Card Footer** (on hover/tap):
  - Item name (font-medium, truncate-2-lines)
  - Price (text-lg, font-mono)
  - Stock status: Badge (available/out-of-stock)
  - Badges: Platform icon, list tags (small pills)

### 4. Lists Navigation
- **Sidebar** (Desktop): w-64, fixed left
  - "All Items" with count badge
  - Categorized lists: Icon + label, nested with indent
  - "+ Add List" button at bottom
- **Mobile**: Bottom sheet drawer, swipe up to reveal
  - Horizontal scrolling pill navigation as alternative
- **Active State**: Primary color background, white text, subtle left border (4px)

### 5. Item Detail View
- **Layout**: Split view (image gallery 60% | details 40%)
  - Gallery: Large images, thumbnail strip below
  - Details panel: Sticky scroll
    - Name (text-2xl, font-semibold)
    - Link with icon (external link emoji or icon)
    - Size selector: Button group with available sizes
    - Price: Large, font-mono with currency
    - Price history chart: Line graph, 3-month view, min/max markers
    - Image search button: Secondary action
    - Edit/Delete: Subtle icon buttons

### 6. Goals Section
- **Card Design**: Colorful gradient backgrounds per goal
  - Progress ring: Circular, animated
  - Goal details: Target amount, current amount, items count
  - Timeline: Visual milestone markers
- **Layout**: 2-column grid (desktop), stacked (mobile)

### 7. Edit Modal
- **Smooth Transitions**: Slide-in from right (300ms ease-out)
- **Form Fields**: Floating labels, focus states with scale animation
- **Size Availability**: Available sizes colored primary, unavailable grayed with tooltip
- **Save Action**: Optimistic UI update with undo toast

---

## Interactive Elements

### Buttons
- **Primary**: bg-primary, text-white, rounded-xl, px-6 py-3, font-medium
- **Secondary**: border-2 border-primary, text-primary, hover:bg-primary/5
- **Icon Buttons**: w-10 h-10, rounded-full, hover:bg-surface

### Inputs
- **Text Fields**: border-2 border-gray-200, focus:border-primary, rounded-xl, px-4 py-3
- **Dropdowns**: Custom styled with Headless UI, smooth open animation

### Badges & Pills
- Price change: Rounded-full, px-3 py-1, font-medium, text-xs
- List tags: Rounded-lg, px-2.5 py-1, text-xs, muted colors
- Stock status: Rounded-md, px-2 py-0.5, uppercase, tracking-wide

---

## Animations (Minimal & Purposeful)

- Card hover: Subtle lift (translateY -2px, shadow increase)
- Modal entry: Fade + scale (95% to 100%)
- List item add: Slide in from top with spring animation
- Price change: Gentle pulse on new activity
- Image carousel: Smooth swipe with momentum

---

## Mobile Specific

- **Bottom Navigation**: 4 tabs (Home, Lists, Goals, Profile)
- **Swipe Gestures**: Swipe card right to quick-edit, left to delete
- **Pull to Refresh**: On activity feed
- **Notification Design**: 
  - Push notification: Product image, price drop amount, action buttons
  - In-app banner: Top slide-down, dismissible

---

## Images & Visual Assets

- **Product Images**: User-fetched from URLs, auto-optimized
- **Empty States**: Illustrated placeholders (pastel illustrations)
- **Icons**: Heroicons (outline style for most, solid for active states)
- **Placeholder**: Soft gradient placeholder while images load

---

## Data Visualization

- **Price History Chart**: 
  - Line graph with gradient fill below
  - X-axis: Time (3 months)
  - Y-axis: Price with currency
  - Markers: Red dot (max), green dot (min), current (blue)
  - Tooltip: Date, price on hover

---

## Error & Loading States

- **Loading**: Skeleton screens matching content structure, animated shimmer
- **Errors**: Inline messages, soft red background, rounded corners, retry button
- **Empty States**: Centered illustration + message + action button
- **Offline Mode**: Banner notification, cached data with indicator