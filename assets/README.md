# Assets Directory

This folder contains application assets such as icons and images.

## Files

- `icon.ico` - Application icon (add your own 256x256 or larger .ico file)

## Creating an Icon

1. Create a 256x256 PNG image
2. Convert to .ico format using online tools or:
   ```python
   from PIL import Image
   img = Image.open("icon.png")
   img.save("icon.ico", format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
   ```
