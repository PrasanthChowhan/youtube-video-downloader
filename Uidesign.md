# PART 1: UNIVERSAL DESIGN CONSTANTS
Color System (Use These Exact Values Everywhere)


COLORS = {
  "bg_primary": "#1f2121",        // Main background (dark charcoal)
  "bg_surface": "#262828",        // Card/surface background
  "text_primary": "#f5f5f5",      // Main text (light gray)
  "text_secondary": "#a7a9a9",    // Hints/labels (muted)
  "accent": "#208089",             // Primary CTA (teal)
  "accent_hover": "#1a6e72",       // Darker teal on hover
  "accent_active": "#298fa1",      // Pressed state
  "border": "#3d4242",             // 1px subtle borders
  "success": "#32b8c6",            // Green-teal (download complete)
  "error": "#ff5459",              // Red (failed)
  "warning": "#e68159"             // Orange (rate limit)
}

Typography (Universal)
text
Font Family:  -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
Monospace:    "Courier New", Courier, monospace

Sizes:
  - h1 (title):     24px, weight 600
  - h2 (heading):   18px, weight 600
  - body (default): 14px, weight 400
  - small (label):  12px, weight 400
  - mono (path):    13px, weight 400 (monospace)

Line Heights: 1.2 (headings), 1.5 (body)
Spacing Grid (8px baseline)
text
xs:   4px
sm:   8px
md:   12px
lg:   16px
xl:   20px
2xl:  24px
3xl:  32px
Animation Easing (Use Everywhere)
text
cubic-bezier(0.16, 1, 0.3, 1)

Timings:
  - Fast:   150ms (focus, press)
  - Normal: 200-250ms (transitions)
  - Slow:   300-500ms (progress, modals)
  - Loop:   1000ms (spinner rotation)
PART 2: COMPONENT SPECIFICATIONS (Language-Neutral)
INPUT FIELD
States: Idle → Focus → Error

text
Idle:
  - Background: bg_surface (#262828)
  - Border: 1px solid border (#3d4242)
  - Height: 44px
  - Padding: 12px 16px
  - Border-radius: 8px
  - Text color: text_primary

Focus:
  - Border: 2px solid accent (#208089)
  - Box-shadow: 0 0 0 3px rgba(32,128,137,0.15)
  - Transition: 150ms easing
  
Error:
  - Border: 2px solid error (#ff5459)
  - Box-shadow: 0 0 0 3px rgba(255,84,89,0.15)
PRIMARY BUTTON (Download CTA)
States: Normal → Hover → Active

text
Normal:
  - Background: linear-gradient(135deg, accent, accent_hover)
  - Height: 48px
  - Padding: 12px 24px (vertical × horizontal)
  - Border-radius: 8px
  - Text: 14px, weight 600, color text_primary
  - Box-shadow: 0 4px 6px rgba(0,0,0,0.2)
  - Border: none

Hover:
  - Background: linear-gradient(135deg, accent_hover, #156268)
  - Box-shadow: 0 8px 12px rgba(32,128,137,0.25)
  - Transform: translateY(-2px)
  - Transition: 200ms easing

Active:
  - Transform: translateY(0)
  - Box-shadow: 0 2px 4px rgba(0,0,0,0.3)

Disabled:
  - Opacity: 0.5
  - Cursor: not-allowed
SECONDARY BUTTON
States: Normal → Hover

text
Normal:
  - Background: transparent
  - Border: 1px solid border (#3d4242)
  - Height: 40px
  - Padding: 10px 16px
  - Border-radius: 8px
  - Text: 12px, weight 500, color text_primary

Hover:
  - Background: rgba(160,160,160,0.2)
  - Border-color: #4a5050
  - Transition: 150ms easing
CARD CONTAINER
States: Normal → Hover

text
Normal:
  - Background: bg_surface (#262828)
  - Border: 1px solid border (#3d4242)
  - Border-radius: 12px
  - Padding: 20px
  - Box-shadow: 0 4px 6px rgba(0,0,0,0.1)

Hover:
  - Border-color: #4a5050
  - Box-shadow: 0 8px 12px rgba(0,0,0,0.2)
  - Transition: 250ms easing (all properties)
PROGRESS BAR
Animation: 0% → 100% (smooth fill)

text
Track:
  - Height: 4px
  - Background: rgba(160,160,160,0.15)
  - Border-radius: 2px
  - Width: 100% (fill container)

Fill:
  - Height: 4px
  - Background: linear-gradient(90deg, accent, success)
  - Border-radius: 2px
  - Width: 0% → 100% (animated)
  - Transition: 300ms easing per update
DROPDOWN / SELECT
States: Normal → Focus → Open

text
Normal:
  - Background: bg_surface
  - Border: 1px solid border
  - Height: 40px
  - Padding: 10px 12px
  - Border-radius: 8px
  - Text: 14px, color text_primary
  - Caret: right-aligned

Focus:
  - Border: 2px solid accent
  - Box-shadow: 0 0 0 3px rgba(32,128,137,0.15)

Open:
  - Border: 2px solid accent
  - Dropdown items appear below
  - Item background: bg_primary
  - Hover item: rgba(32,128,137,0.2)
  - Selected item: accent text + checkmark
CHECKBOX / TOGGLE
States: Unchecked → Checked

text
Unchecked:
  - Size: 20×20px
  - Background: bg_surface
  - Border: 2px solid border
  - Border-radius: 4px

Checked:
  - Background: linear-gradient(135deg, accent, accent_hover)
  - Border: 2px solid accent
  - Checkmark: #f5f5f5 (centered)
  - Animation: scale(1.05) then back to 1 (100ms)
LOADING SPINNER
Animation: Continuous rotation

text
Design:
  - Size: 32px (small) or 48px (large)
  - Circle border: 3px solid rgba(32,128,137,0.2)
  - Arc fill: 3px solid accent (25% of circle)
  - Animation: rotate(360deg) 1000ms linear infinite
  - Fade-in: 200ms ease-out on appearance
TOAST NOTIFICATION
Animation: Slide in → Hold → Slide out

text
Position: Bottom-right, 20px offset from edges

Success:
  - Background: rgba(50,184,198,0.15)
  - Border: 1px solid success
  - Text: success color
  - Padding: 12px 16px

Error:
  - Background: rgba(255,84,89,0.15)
  - Border: 1px solid error
  - Text: error color

Animation:
  - Entrance: slide up 200px + fade in (300ms)
  - Hold: 4000ms
  - Exit: slide down 200px + fade out (300ms)
PART 3: LAYOUT STRUCTURE (Framework-Independent)
text
┌─────────────────────────────────────────────────────┐
│ Header                                              │
│  Title: "YouTube Downloader"                        │
│  Subtitle: "Download videos at highest quality..."  │
├─────────────────────────────────────────────────────┤
│ Input Section                                       │
│  [URL Input Field........................] [Load]   │
├─────────────────────────────────────────────────────┤
│ Video Info Card                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ [Thumbnail]  Video Title                     │   │
│  │              Duration: 12:34 | Uploader: X   │   │
│  │                                               │   │
│  │ Format: [4K MP4 ▼] [✓ Subtitles]            │   │
│  │ Output: ~/Downloads/YouTube/Channel/title/   │   │
│  │                                               │   │
│  │ ████████░░░░░░░░ 45% | 1.2 MB/s | 3m 22s   │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ Button Section                                      │
│  [⬇️ Download] (full width, 48px height)           │
└─────────────────────────────────────────────────────┘
PART 4: INTERACTION FLOWS
Download Flow
text
State 1: Idle
  - URL field empty
  - Load Info button enabled
  └─ User enters URL

State 2: URL Entered
  - Load Info button highlighted (accent color)
  └─ User clicks Load Info

State 3: Loading
  - Spinner appears (fade-in 200ms)
  - Button disabled
  - URL field disabled
  └─ Fetch video metadata (yt-dlp)

State 4: Info Loaded
  - Thumbnail appears (fade-in 250ms)
  - Title, duration, uploader displayed
  - Format selector active
  - Download button active (teal, ready)
  └─ User clicks Download

State 5: Downloading
  - Progress bar appears (0% → animates)
  - Speed indicator updates
  - ETA displayed
  - Download button → Cancel button
  - URL field disabled
  └─ Download completes or cancelled

State 6: Complete
  - Progress bar reaches 100%
  - Green checkmark appears
  - Toast: "Downloaded successfully!" (green)
  - Auto-dismiss toast after 4s
  - Reset to State 1
  └─ Ready for next download

State 7: Error
  - Progress bar freezes
  - Toast: "Download failed: [reason]" (red)
  - Retry button appears
  - Return to State 4 (with URL preserved)
PART 5: ANIMATION SPECIFICATIONS
1. BUTTON PRESS ANIMATION
text
Trigger: Mouse hover on primary button
Timeline:
  0ms:   Normal state
  0-200ms: 
    - Background color shifts (darker gradient)
    - Transform: translateY(-2px)
    - Box-shadow increases
  200ms: Hover state (hold until mouse leaves)

Easing: cubic-bezier(0.16, 1, 0.3, 1)
On exit: Reverse animation 200ms
2. INPUT FOCUS GLOW
text
Trigger: Focus/click on input field
Timeline:
  0ms:     Border #3d4242, no shadow
  0-150ms: 
    - Border color → accent (#208089)
    - Border width: 1px → 2px
    - Box-shadow appears: 0 0 0 3px rgba(32,128,137,0.15)
  150ms:   Focus state (hold until blur)

On blur: Reverse 150ms
3. PROGRESS BAR FILL
text
Trigger: Download starts at 0%
Update cycle (every data chunk):
  - New percentage received (e.g., 5%)
  - Animate width 0% → 5% over 300ms
  - Repeat for each chunk

On completion (100%):
  - Hold at 100% for 500ms
  - Fade-out opacity 1 → 0 over 300ms
  - Reset for next download
4. LOADING SPINNER
text
Trigger: Loading info or downloading
Animation:
  - Continuous rotation: rotate(360deg)
  - Duration: 1000ms per rotation
  - Easing: linear (constant speed)
  - Loop: infinite until complete

Appearance:
  - Fade-in: opacity 0 → 1 over 200ms ease-out
  - On complete: Fade-out 300ms
5. TOAST NOTIFICATION
text
Trigger: Success/error event
Entrance:
  - Position: Start below viewport (bottom: -200px)
  - Opacity: 0
  - Duration: 300ms
  - End state: bottom: 20px, opacity: 1
  - Easing: cubic-bezier(0.16, 1, 0.3, 1)

Display: Hold for 4000ms

Exit:
  - Slide down 200px
  - Opacity: 1 → 0
  - Duration: 300ms
  - Easing: same curve
  - Then remove from DOM
6. CARD HOVER
text
Trigger: Mouse enter on video info card
Timeline:
  0-150ms:
    - Scale: 1 → 1.02
    - Box-shadow: low → medium
    - Border-color: subtle → lighter
  150ms: Hover state

On exit: Reverse 150ms
7. MODAL/DIALOG ENTRANCE
text
Trigger: Settings dialog or first-run modal
Timeline:
  0ms:     opacity: 0, scale: 0.95
  0-250ms:
    - Opacity: 0 → 1
    - Scale: 0.95 → 1
    - Transform-origin: center
  250ms:   Ready for interaction

Easing: cubic-bezier(0.34, 1.56, 0.64, 1)  // ease-out-back
PART 6: RESPONSIVE DESIGN
Breakpoints
text
Mobile:     < 600px width
  - Single column layout
  - Full-width buttons
  - Font sizes: -10%
  - No sidebar
  - Card padding: reduced to 16px

Tablet:     600px - 1024px
  - Two-column layout possible
  - Normal spacing
  - Some grouped elements

Desktop:    > 1024px
  - Three-column layout
  - Sidebar for history/settings possible
  - Full padding and spacing
Minimum Window: 480×600px
Default Window: 800×700px
Scales to: 1920px+ (full desktop)
PART 7: IMPLEMENTATION CHECKLIST
Colors
 All 11 colors defined (bg_primary through warning)

 Colors used consistently across all components

 No custom color values (all from COLORS dict)

Typography
 Font family applied globally

 All sizes: 24px (h1), 18px (h2), 14px (body), 12px (small)

 Line heights: 1.2 headings, 1.5 body

Spacing
 All margins/padding use 8px grid (4, 8, 12, 16, 20, 24, 32)

 No arbitrary spacing values

Animations
 Button hover: 200ms lift effect

 Input focus: 150ms glow border

 Progress bar: 300ms smooth fill

 Spinner: 1000ms continuous rotation

 Toast: 300ms slide in, 4s hold, 300ms out

 All use: cubic-bezier(0.16, 1, 0.3, 1)

Components
 Input field styled (idle + focus + error states)

 Primary button (hover lift effect)

 Secondary button (subtle hover)

 Card container (hover shadow)

 Progress bar (animated fill)

 Dropdown (focus state)

 Checkbox (scale animation on check)

 Loading spinner (rotating)

 Toast notifications (success/error/warning)

Responsive
 Works on 480px minimum width

 Full-width buttons on mobile

 Two-column on tablet

 Three-column on desktop

Accessibility
 4.5:1 contrast on all text

 Focus indicators visible (2px accent border)

 Keyboard navigation: Tab order logical

 Loading states announced

 Error messages clear and actionable

Download Flow
 State transitions smooth (150-300ms)

 Progress updates every 1% with animation

 ETA/speed displayed in real-time

 Error toast clearly visible

 Success toast auto-dismisses after 4s