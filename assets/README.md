# Assets Directory

This folder contains application assets such as icons and images.

## Files

- `icon.ico` - Application icon (add your own 256x256 or larger .ico file)

## Creating an Icon

1. Create a 256x256 PNG image
2. Convert to .ico format using:
   - **Online tools**: [ConvertICO](https://convertico.com/) or [ICO Convert](https://icoconvert.com/)
   - **ImageMagick CLI**: `magick convert icon.png -define icon:auto-resize=256,128,64,32,16 icon.ico`
